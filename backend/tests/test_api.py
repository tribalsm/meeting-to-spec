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
