import os

from fastapi.testclient import TestClient
import pytest

import main


client = TestClient(main.app)

TRANSCRIPTION = {
    "text": "Клиент хочет регистрацию по почте",
    "segments": [
        {
            "id": 0,
            "start": 0.0,
            "end": 3.5,
            "text": "Клиент хочет регистрацию по почте",
        }
    ],
}

ANALYSIS = {
    "summary": "Сервис с регистрацией пользователей",
    "roles": ["Пользователь"],
    "requirements": [],
    "userScenarios": [],
    "constraints": [],
    "conditions": [],
    "openQuestions": [],
    "agreements": [],
    "contradictions": [],
}


@pytest.fixture
def successful_ai_mocks(monkeypatch):
    monkeypatch.setattr(main, "transcribe_file", lambda _path: TRANSCRIPTION)
    monkeypatch.setattr(main, "analyze_transcription", lambda _value: ANALYSIS)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_success_returns_expected_json(successful_ai_mocks):
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"audio", "audio/mpeg")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "filename": "meeting.mp3",
        "transcription": TRANSCRIPTION,
        "analysis": ANALYSIS,
    }


def test_analyze_requires_file():
    response = client.post("/api/analyze")

    assert response.status_code == 422


def test_analyze_rejects_unsupported_extension():
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.txt", b"not media", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Неподдерживаемый формат файла"


def test_analyze_rejects_file_over_limit():
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.wav", b"0" * (25 * 1024 * 1024 + 1), "audio/wav")},
    )

    assert response.status_code == 413


def test_analyze_accepts_17_mib_file(successful_ai_mocks):
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"0" * (17 * 1024 * 1024), "audio/mpeg")},
    )

    assert response.status_code == 200


def test_transcription_error_returns_502(monkeypatch):
    def fail_transcription(_path):
        raise RuntimeError("Groq unavailable")

    monkeypatch.setattr(main, "transcribe_file", fail_transcription)
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"audio", "audio/mpeg")},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Не удалось выполнить распознавание речи"


def test_analysis_error_returns_502(monkeypatch):
    def fail_analysis(_transcription):
        raise RuntimeError("Analyzer unavailable")

    monkeypatch.setattr(main, "transcribe_file", lambda _path: TRANSCRIPTION)
    monkeypatch.setattr(main, "analyze_transcription", fail_analysis)
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"audio", "audio/mpeg")},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Не удалось выполнить анализ транскрипции"


def test_provider_error_returns_safe_specific_message_and_code(monkeypatch):
    monkeypatch.setattr(main, "transcribe_file", lambda _path: (_ for _ in ()).throw(
        main.TranscriptionServiceError("GROQ_RATE_LIMIT", "Повторите попытку через минуту")
    ))
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"audio", "audio/mpeg")},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Повторите попытку через минуту"
    assert response.headers["x-error-code"] == "GROQ_RATE_LIMIT"
    assert response.headers["x-request-id"]


def test_too_long_transcript_returns_422(monkeypatch):
    monkeypatch.setattr(main, "transcribe_file", lambda _path: TRANSCRIPTION)
    monkeypatch.setattr(main, "analyze_transcription", lambda _value: (_ for _ in ()).throw(
        main.AnalysisInputTooLong("Транскрипция слишком длинная")
    ))
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp3", b"audio", "audio/mpeg")},
    )

    assert response.status_code == 422
    assert "слишком длинная" in response.json()["detail"]
    assert response.headers["x-error-code"] == "ANALYSIS_INPUT_TOO_LONG"


def test_segments_keep_expected_structure(successful_ai_mocks):
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.webm", b"audio", "video/webm")},
    )

    segment = response.json()["transcription"]["segments"][0]
    assert segment == {
        "id": 0,
        "start": 0.0,
        "end": 3.5,
        "text": "Клиент хочет регистрацию по почте",
    }


def test_temporary_file_is_deleted_after_success(monkeypatch):
    captured_path = None

    def transcribe(path):
        nonlocal captured_path
        captured_path = path
        assert os.path.exists(path)
        return TRANSCRIPTION

    monkeypatch.setattr(main, "transcribe_file", transcribe)
    monkeypatch.setattr(main, "analyze_transcription", lambda _value: ANALYSIS)
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.m4a", b"audio", "audio/mp4")},
    )

    assert response.status_code == 200
    assert captured_path is not None
    assert not os.path.exists(captured_path)


def test_temporary_file_is_deleted_after_exception(monkeypatch):
    captured_path = None

    def fail_transcription(path):
        nonlocal captured_path
        captured_path = path
        assert os.path.exists(path)
        raise RuntimeError("Groq unavailable")

    monkeypatch.setattr(main, "transcribe_file", fail_transcription)
    response = client.post(
        "/api/analyze",
        files={"file": ("meeting.mp4", b"video", "video/mp4")},
    )

    assert response.status_code == 502
    assert captured_path is not None
    assert not os.path.exists(captured_path)


def test_cors_allows_local_vite_origin():
    response = client.options(
        "/api/analyze",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


@pytest.mark.parametrize('extension', ['mp3', 'mp4', 'wav', 'm4a', 'webm', 'MP3'])
def test_all_formats(successful_ai_mocks, extension):
    assert client.post('/api/analyze', files={'file': ('meeting.' + extension, b'audio')}).status_code == 200


def test_empty_file(monkeypatch):
    def forbidden(*args):
        pytest.fail('AI should not be called')
    monkeypatch.setattr(main, 'transcribe_file', forbidden)
    assert client.post('/api/analyze', files={'file': ('empty.mp3', b'')}).status_code == 400


def test_no_speech(monkeypatch):
    monkeypatch.setattr(main, 'transcribe_file', lambda _: {'text': '', 'segments': []})
    assert client.post('/api/analyze', files={'file': ('silent.mp3', b'audio')}).status_code == 422


def test_analysis_failure_cleanup_and_no_secret_logs(monkeypatch, caplog):
    paths = []
    def transcribe(path):
        paths.append(path)
        return TRANSCRIPTION
    def fail(value):
        assert value == TRANSCRIPTION
        raise RuntimeError('SENSITIVE_SENTINEL')
    monkeypatch.setattr(main, 'transcribe_file', transcribe)
    monkeypatch.setattr(main, 'analyze_transcription', fail)
    response = client.post('/api/analyze', files={'file': ('meeting.mp3', b'audio')})
    assert response.status_code == 502
    assert paths and not os.path.exists(paths[0])
    assert 'SENSITIVE_SENTINEL' not in caplog.text + response.text


def test_storage_error_is_controlled(monkeypatch):
    def fail(*args, **kwargs):
        raise OSError('SENSITIVE_SENTINEL')
    monkeypatch.setattr(main.tempfile, 'NamedTemporaryFile', fail)
    response = client.post('/api/analyze', files={'file': ('meeting.mp3', b'audio')})
    assert response.status_code == 500 and 'SENSITIVE_SENTINEL' not in response.text


@pytest.mark.parametrize('payload,limit,status', [(b'', 10, 400), (b'12345', 4, 413)])
def test_validation_failure_cleanup(monkeypatch, tmp_path, payload, limit, status):
    original = main.tempfile.NamedTemporaryFile
    def temporary(*args, **kwargs):
        return original(*args, dir=tmp_path, **kwargs)
    monkeypatch.setattr(main.tempfile, 'NamedTemporaryFile', temporary)
    monkeypatch.setattr(main, 'MAX_FILE_SIZE', limit)
    response = client.post('/api/analyze', files={'file': ('meeting.mp3', payload)})
    assert response.status_code == status
    assert list(tmp_path.iterdir()) == []
