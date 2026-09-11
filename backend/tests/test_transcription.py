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


@pytest.mark.parametrize('start,end', [('0.2', '2.4'), (float('nan'), 1), (0, float('inf')), (-1, 2), (3, 2)])
def test_segment_times_and_file_closure(monkeypatch, tmp_path, start, end):
    path = tmp_path / 'meeting.wav'
    path.write_bytes(b'audio')
    opened = []
    def create(**kwargs):
        opened.append(kwargs['file'])
        return SimpleNamespace(text=' A   B ', segments=[{'id': 99, 'start': start, 'end': end, 'text': ' A   B '}])
    monkeypatch.setattr(transcription, 'get_groq_client', lambda: SimpleNamespace(audio=SimpleNamespace(transcriptions=SimpleNamespace(create=create))))
    if isinstance(start, str):
        result = transcription.transcribe_file(path)
        assert result == {'text': 'A B', 'segments': [{'id': 0, 'start': .2, 'end': 2.4, 'text': 'A B'}]}
    else:
        with pytest.raises(ValueError):
            transcription.transcribe_file(path)
    assert opened[0].closed


def test_groq_failure_closes_file(monkeypatch, tmp_path):
    path = tmp_path / 'meeting.mp3'
    path.write_bytes(b'audio')
    opened = []
    def create(**kwargs):
        opened.append(kwargs['file'])
        raise RuntimeError('provider error')
    monkeypatch.setattr(transcription, 'get_groq_client', lambda: SimpleNamespace(audio=SimpleNamespace(transcriptions=SimpleNamespace(create=create))))
    with pytest.raises(RuntimeError):
        transcription.transcribe_file(path)
    assert opened[0].closed
