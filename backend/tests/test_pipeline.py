import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi.testclient import TestClient
import main
import analysis
import transcription


def test_full_pipeline_with_mocked_providers(monkeypatch):
    monkeypatch.setenv('GROQ_API_KEY', 'placeholder')
    def create(**kwargs):
        assert kwargs['file'].read() == b'audio'
        return SimpleNamespace(text='Нужен вход по почте', segments=[
            {'start': 0, 'end': 2, 'text': 'Нужен вход по почте'}])
    monkeypatch.setattr(transcription, 'get_groq_client', lambda: SimpleNamespace(audio=SimpleNamespace(transcriptions=SimpleNamespace(create=create))))
    response = Mock()
    response.json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
        'summary': 'Обсуждение входа', 'requirements': [{'id': 'req_1', 'title': 'Вход',
        'description': 'По почте', 'confidence': '0.8', 'needsClarification': 'false',
        'sourceSegmentIds': ['0', 999]}]})}}]}
    monkeypatch.setattr(analysis.requests, 'post', lambda *args, **kwargs: response)
    with TestClient(main.app) as client:
        result = client.post('/api/analyze', files={'file': ('meeting.mp3', b'audio')})
    assert result.status_code == 200
    body = result.json()
    assert body['analysis']['requirements'][0]['sourceSegmentIds'] == [0]
    assert body['analysis']['requirements'][0]['confidence'] == .8
    assert body['analysis']['requirements'][0]['needsClarification'] is False
    assert set(body['analysis']) == set(analysis.RESPONSE_SCHEMA)


def test_import_and_health_without_credentials():
    env = os.environ.copy()
    for key in ('GROQ_API_KEY',):
        env.pop(key, None)
    env['PYTHON_DOTENV_DISABLED'] = '1'
    code = 'from fastapi.testclient import TestClient; import main; r=TestClient(main.app).get("/health"); assert r.status_code == 200 and r.json() == {"status":"ok"}'
    completed = subprocess.run([sys.executable, '-c', code], env=env,
        cwd=Path(__file__).resolve().parents[1], capture_output=True, timeout=20)
    assert completed.returncode == 0
