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
    monkeypatch.setenv("GROQ_API_KEY", "unit-test-placeholder")
    response = Mock()
    response.json.return_value = {"choices": [{"finish_reason": "stop", "message": {
        "content": json.dumps({"summary": "Регистрация", "requirements": [{
            "title": "Регистрация", "description": "По почте", "sourceSegmentIds": ["2", 2, 999]
        }]})
    }}]}
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
    assert post.call_count == 2
    request = post.call_args_list[0].kwargs
    assert request['timeout'] == (10, 120)
    assert request['json']['model'] == 'openai/gpt-oss-120b'
    assert request['headers']['Authorization'] == 'Bearer unit-test-placeholder'
    assert '[id=2' in request['json']['messages'][1]['content']
    secondary_request = post.call_args_list[1].kwargs
    assert secondary_request['timeout'] == (10, 45)
    assert secondary_request['json']['model'] == 'openai/gpt-oss-20b'
    assert secondary_request['json']['max_completion_tokens'] == 1400
    assert '[id=2' in secondary_request['json']['messages'][1]['content']


def test_long_transcript_is_split_and_results_are_merged(api, monkeypatch):
    monkeypatch.setattr(a, 'MAX_CHUNK_CHARS', 65)
    transcript = {'text': 'Первая часть. Вторая часть.', 'segments': [
        {'id': 0, 'start': 0, 'end': 1, 'text': 'Первая достаточно длинная часть записи'},
        {'id': 1, 'start': 1, 'end': 2, 'text': 'Вторая достаточно длинная часть записи'},
    ]}
    responses = []
    for number, segment_id in enumerate((0, 1), start=1):
        response = Mock()
        response.json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
            'summary': f'Часть {number}',
            'roles': ['Пользователь'],
            'requirements': [{
                'title': f'Требование {number}', 'description': f'Описание {number}',
                'sourceSegmentIds': [segment_id]
            }],
        })}}]}
        responses.append(response)
    api[1].side_effect = [*responses, responses[-1]]

    result = a.analyze_transcription(transcript)

    assert api[1].call_count == 3
    assert result['summary'] == 'Часть 1 Часть 2'
    assert [item['id'] for item in result['requirements']] == ['req_1', 'req_2']
    assert [item['sourceSegmentIds'] for item in result['requirements']] == [[0], [1]]
    assert result['roles'] == ['Пользователь']


def test_transient_analysis_error_is_retried_once(api):
    api[1].side_effect = [requests.Timeout(), api[0], api[0]]

    result = a.analyze_transcription(TRANSCRIPT)

    assert result['summary'] == 'Регистрация'
    assert api[1].call_count == 3


def test_secondary_categories_are_merged(api):
    secondary_response = Mock()
    secondary_response.json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {
        'content': json.dumps({
            'constraints': ['Только сотрудникам'],
            'conditions': ['После авторизации'],
            'openQuestions': ['Отдельно согласуем формат'],
            'agreements': ['Для первой версии не делаем экспорт'],
            'contradictions': ['Участники назвали сроки противоречием'],
        })
    }}]}
    api[1].side_effect = [api[0], secondary_response]

    result = a.analyze_transcription(TRANSCRIPT)

    assert result['constraints'] == ['Только сотрудникам']
    assert result['conditions'] == ['После авторизации']
    assert result['openQuestions'] == ['Отдельно согласуем формат']
    assert result['agreements'] == ['Для первой версии не делаем экспорт']
    assert result['contradictions'] == ['Участники назвали сроки противоречием']


def test_secondary_failure_keeps_primary_result(api, caplog):
    api[1].side_effect = [api[0], requests.Timeout()]

    result = a.analyze_transcription(TRANSCRIPT)

    assert result['summary'] == 'Регистрация'
    assert 'Secondary LLM pass failed: Timeout' in caplog.text


def test_excessive_number_of_chunks_is_rejected_before_api_call(api, monkeypatch):
    monkeypatch.setattr(a, 'MAX_CHUNK_CHARS', 45)
    monkeypatch.setattr(a, 'MAX_ANALYSIS_CHUNKS', 1)
    transcript = {'text': 'Длинная встреча', 'segments': [
        {'id': 0, 'start': 0, 'end': 1, 'text': 'Первая длинная часть'},
        {'id': 1, 'start': 1, 'end': 2, 'text': 'Вторая длинная часть'},
    ]}

    with pytest.raises(a.AnalysisInputTooLong):
        a.analyze_transcription(transcript)
    api[1].assert_not_called()


def test_missing_credentials(api, monkeypatch):
    monkeypatch.delenv('GROQ_API_KEY')
    with pytest.raises(RuntimeError, match='GROQ_API_KEY'):
        a.analyze_transcription(TRANSCRIPT)
    api[1].assert_not_called()


@pytest.mark.parametrize('error', [requests.Timeout(), requests.ConnectionError(),
    requests.HTTPError('401'), requests.HTTPError('429'), requests.HTTPError('500')])
def test_http_errors(api, error):
    api[1].side_effect = error
    with pytest.raises(RuntimeError, match='сервиса анализа'):
        a.analyze_transcription(TRANSCRIPT)


@pytest.mark.parametrize('payload', [None, [], {}, {'choices': None}, {'choices': []},
    {'choices': [None]}, {'choices': ['bad']}, {'choices': [{'message': {}}]},
    {'choices': [{'finish_reason': 'length', 'message': {'content': '{}'}}]}])
def test_bad_response_structure(api, payload):
    api[0].json.return_value = payload
    with pytest.raises(ValueError):
        a.analyze_transcription(TRANSCRIPT)


def test_non_json_http_response(api):
    api[0].json.side_effect = ValueError('not JSON')
    with pytest.raises(ValueError):
        a.analyze_transcription(TRANSCRIPT)


def test_bad_model_json(api):
    api[0].json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {'content': 'invalid'}}]}
    with pytest.raises(ValueError, match='JSON'):
        a.analyze_transcription(TRANSCRIPT)


@pytest.mark.parametrize('transcript', [{}, {'text': None}, {'text': ' ', 'segments': []},
    {'text': '', 'segments': [{'id': 0, 'text': None}]}])
def test_empty_transcript(api, transcript):
    with pytest.raises(ValueError, match='пуста'):
        a.analyze_transcription(transcript)
    api[1].assert_not_called()
