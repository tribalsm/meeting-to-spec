import json
from unittest.mock import Mock

import pytest
import requests
import analysis as a

TRANSCRIPT = {"text": "Нужна регистрация", "segments": [
    {"id": 2, "start": 0.0, "end": 2.0, "text": "Нужна регистрация"}
]}


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("YANDEX_API_KEY", "unit-test-placeholder")
    monkeypatch.setenv("YANDEX_FOLDER_ID", "unit-test-folder")
    response = Mock()
    response.json.return_value = {"result": {"alternatives": [{"message": {
        "text": json.dumps({"summary": "Регистрация", "requirements": [{
            "title": "Регистрация", "description": "По почте", "sourceSegmentIds": ["2", 2, 999]
        }]})
    }}]}}
    post = Mock(return_value=response)
    monkeypatch.setattr(a.requests, "post", post)
    return response, post


@pytest.mark.parametrize('value,expected', [(0.8, .8), ('0.8', .8), ('high', .5),
    (None, .5), (5, 1.), (-2, 0.), ('nan', .5), ('inf', .5), ('-inf', .5)])
def test_confidence(value, expected):
    result = a._safe_confidence(value)
    assert type(result) is float and result == expected


@pytest.mark.parametrize('value,expected', [(True, True), (False, False), ('true', True), ('false', False)])
def test_bool(value, expected):
    assert a._safe_bool(value) is expected


@pytest.mark.parametrize('value,expected', [('high', 'high'), ('low', 'low'), ('unknown', 'medium'), (None, 'medium')])
def test_priority(value, expected):
    assert a._safe_priority(value) == expected


def test_sources():
    assert a._normalize_source_ids([2, '2', 999, 'bad', None, True, 2.5, float('inf')], {1, 2}) == [2]
    assert a._normalize_source_ids('2', {2}) == []


@pytest.mark.parametrize('value', [None, 'bad', {}, 1])
def test_bad_collections(value):
    assert a._normalize_requirements(value, {2}) == []
    assert a._normalize_scenarios(value, {2}) == []


def test_empty_fields_and_unique_ids():
    items = a._normalize_requirements([None, {}, {'title': None},
        {'id': 'req_2', 'title': 'A'}, {'id': 'req_2', 'description': 'B'},
        {'id': None, 'title': 'C', 'role': None}], {2})
    assert len(items) == 3
    assert len({x['id'] for x in items}) == 3
    assert all(x['needsClarification'] for x in items)
    assert items[-1]['role'] == ''
    assert a._normalize_scenarios([None, {}, {'title': None}], {2}) == []


@pytest.mark.parametrize('text', ['{"summary":"ok"}', '```json\n{"summary":"ok"}\n```',
    'Here is JSON: {"summary":"ok"} Done.'])
def test_json_wrappers(text):
    assert a._extract_json(text) == {'summary': 'ok'}


@pytest.mark.parametrize('text', ['[]', '[{"summary":"bad"}]', 'null', 'broken', '{bad}', '{} {}', None])
def test_bad_json(text):
    with pytest.raises(ValueError):
        a._extract_json(text)


def test_success_normalization(api):
    response, post = api
    result = a.analyze_transcription(TRANSCRIPT)
    assert set(result) == set(a.RESPONSE_SCHEMA)
    assert result['summary'] == 'Регистрация'
    assert result['requirements'][0]['sourceSegmentIds'] == [2]
    assert result['requirements'][0]['needsClarification'] is False
    json.dumps(result, allow_nan=False)
    assert post.call_args.kwargs['timeout'] == (10, 120)
    assert '[id=2' in post.call_args.kwargs['json']['messages'][1]['text']


@pytest.mark.parametrize('key', ['YANDEX_API_KEY', 'YANDEX_FOLDER_ID'])
def test_missing_credentials(api, monkeypatch, key):
    monkeypatch.delenv(key)
    with pytest.raises(RuntimeError, match=key):
        a.analyze_transcription(TRANSCRIPT)
    api[1].assert_not_called()


@pytest.mark.parametrize('error', [requests.Timeout(), requests.ConnectionError(),
    requests.HTTPError('401'), requests.HTTPError('429'), requests.HTTPError('500')])
def test_http_errors(api, error):
    api[1].side_effect = error
    with pytest.raises(RuntimeError, match='YandexGPT API'):
        a.analyze_transcription(TRANSCRIPT)


@pytest.mark.parametrize('payload', [None, [], {}, {'result': None}, {'result': {'alternatives': []}},
    {'result': {'alternatives': [None]}}, {'result': {'alternatives': ['bad']}},
    {'result': {'alternatives': [{'message': {}}]}},
    {'result': {'alternatives': [{'status': 'ALTERNATIVE_STATUS_TRUNCATED', 'message': {'text': '{}'}}]}}])
def test_bad_response_structure(api, payload):
    api[0].json.return_value = payload
    with pytest.raises(ValueError):
        a.analyze_transcription(TRANSCRIPT)


def test_non_json_http_response(api):
    api[0].json.side_effect = ValueError('not JSON')
    with pytest.raises(ValueError):
        a.analyze_transcription(TRANSCRIPT)


def test_bad_model_json(api):
    api[0].json.return_value = {'result': {'alternatives': [{'message': {'text': 'invalid'}}]}}
    with pytest.raises(ValueError, match='JSON'):
        a.analyze_transcription(TRANSCRIPT)


@pytest.mark.parametrize('transcript', [{}, {'text': None}, {'text': ' ', 'segments': []},
    {'text': '', 'segments': [{'id': 0, 'text': None}]}])
def test_empty_transcript(api, transcript):
    with pytest.raises(ValueError, match='пуста'):
        a.analyze_transcription(transcript)
    api[1].assert_not_called()
