from types import SimpleNamespace

import pytest

import transcription


def test_transcribe_file_formats_verbose_segments(monkeypatch, tmp_path):
    media_path = tmp_path / "meeting.mp3"
    media_path.write_bytes(b"audio")

    class FakeTranscriptions:
        def create(self, **kwargs):
            assert kwargs["file"].read() == b"audio"
            assert kwargs["model"] == "whisper-large-v3-turbo"
            assert kwargs["response_format"] == "verbose_json"
            assert kwargs["timestamp_granularities"] == ["segment"]
            return SimpleNamespace(
                text="  Клиент хочет регистрацию по почте  ",
                segments=[
                    {
                        "start": 0.0,
                        "end": 3.5,
                        "text": "  Клиент хочет регистрацию по почте  ",
                    }
                ],
            )

    fake_client = SimpleNamespace(
        audio=SimpleNamespace(transcriptions=FakeTranscriptions())
    )
    monkeypatch.setattr(transcription, "get_groq_client", lambda: fake_client)

    result = transcription.transcribe_file(str(media_path))

    assert result == {
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


def test_groq_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    transcription.get_groq_client.cache_clear()

    with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
        transcription.get_groq_client()
