import os
import tempfile
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from transcription import transcribe_file
from analysis import analyze_transcription


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

        except Exception:
            logger.error("Ошибка транскрипции: внешний сервис не выполнил запрос")

            raise HTTPException(
                status_code=502,
                detail="Не удалось выполнить распознавание речи"
            )

        if not transcription.get("text", "").strip():
            raise HTTPException(status_code=422, detail="В записи не обнаружена речь")

        # Этап 2: анализ транскрипции
        try:
            analysis = await run_in_threadpool(
                analyze_transcription,
                transcription
            )

        except Exception:
            logger.error("Ошибка анализа: внешний сервис не выполнил запрос")

            raise HTTPException(
                status_code=502,
                detail="Не удалось выполнить анализ транскрипции"
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
        logger.error("Внутренняя ошибка обработки файла")
        raise HTTPException(status_code=500, detail="Не удалось обработать файл") from None
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
