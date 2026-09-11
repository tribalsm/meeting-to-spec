import os
import tempfile
import logging
import uuid

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from transcription import TranscriptionServiceError, transcribe_file
from analysis import (
    AnalysisInputTooLong,
    AnalysisResponseError,
    AnalysisServiceError,
    analyze_transcription,
)


app = FastAPI()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".mp3", ".mp4", ".wav", ".m4a", ".webm"}
MAX_FILE_SIZE = 25 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024


app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    temp_file_path = None
    request_id = uuid.uuid4().hex[:12]

    try:
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Файл не выбран"
            )

        suffix = os.path.splitext(file.filename)[1].lower()

        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Неподдерживаемый формат файла"
            )

        # Создаем временный файл
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:
            temp_file_path = temp_file.name
            total_size = 0

            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Файл слишком большой. Максимальный размер - 25 МБ"
                    )

                temp_file.write(chunk)

        if total_size == 0:
            raise HTTPException(status_code=400, detail="Загружен пустой файл")

        # Этап 1: Speech-to-Text
        try:
            transcription = await run_in_threadpool(
                transcribe_file,
                temp_file_path
            )

        except TranscriptionServiceError as error:
            logger.error("Ошибка транскрипции [%s]: %s", request_id, error.code)
            status_code = 422 if error.code == "GROQ_MEDIA_INVALID" else 502
            raise HTTPException(
                status_code=status_code,
                detail=error.user_message,
                headers={"X-Error-Code": error.code, "X-Request-ID": request_id},
            ) from None
        except Exception:
            logger.error("Ошибка транскрипции [%s]: TRANSCRIPTION_UNEXPECTED", request_id)

            raise HTTPException(
                status_code=502,
                detail="Не удалось выполнить распознавание речи",
                headers={"X-Error-Code": "TRANSCRIPTION_UNEXPECTED", "X-Request-ID": request_id},
            )

        if not transcription.get("text", "").strip():
            raise HTTPException(status_code=422, detail="В записи не обнаружена речь")

        # Этап 2: анализ транскрипции
        try:
            analysis = await run_in_threadpool(
                analyze_transcription,
                transcription
            )

        except AnalysisInputTooLong as error:
            logger.warning("Ошибка анализа [%s]: %s", request_id, error.code)
            raise HTTPException(
                status_code=422,
                detail=error.user_message,
                headers={"X-Error-Code": error.code, "X-Request-ID": request_id},
            ) from None
        except (AnalysisServiceError, AnalysisResponseError) as error:
            logger.error("Ошибка анализа [%s]: %s", request_id, error.code)
            raise HTTPException(
                status_code=502,
                detail=error.user_message,
                headers={"X-Error-Code": error.code, "X-Request-ID": request_id},
            ) from None
        except Exception:
            logger.error("Ошибка анализа [%s]: ANALYSIS_UNEXPECTED", request_id)

            raise HTTPException(
                status_code=502,
                detail="Не удалось выполнить анализ транскрипции",
                headers={"X-Error-Code": "ANALYSIS_UNEXPECTED", "X-Request-ID": request_id},
            )

        return {
            "status": "success",
            "filename": file.filename,
            "transcription": transcription,
            "analysis": analysis
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Внутренняя ошибка обработки файла [%s]", request_id)
        raise HTTPException(
            status_code=500,
            detail="Не удалось обработать файл",
            headers={"X-Error-Code": "PROCESSING_FAILED", "X-Request-ID": request_id},
        ) from None
    finally:
        try:
            await file.close()
        except Exception:
            logger.warning("Не удалось закрыть загруженный файл", exc_info=True)

        if temp_file_path is not None and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                logger.warning(
                    "Не удалось удалить временный файл %s",
                    temp_file_path,
                    exc_info=True
                )
