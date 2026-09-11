import json
import math
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

from prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE


load_dotenv(Path(__file__).with_name(".env"))

API_URL = "https://api.groq.com/openai/v1/chat/completions"
ANALYSIS_MODEL = "openai/gpt-oss-120b"
MAX_CHUNK_CHARS = 12_000
MAX_ANALYSIS_CHUNKS = 8
REQUEST_TIMEOUT = (10, 120)
TRANSIENT_STATUS_CODES = {408, 409, 429, 500, 502, 503, 504}

RESPONSE_SCHEMA = {
    "summary": "",
    "roles": [],
    "requirements": [],
    "userScenarios": [],
    "constraints": [],
    "conditions": [],
    "openQuestions": [],
    "agreements": [],
    "contradictions": [],
}


class AnalysisServiceError(RuntimeError):
    def __init__(self, code: str, user_message: str):
        super().__init__(f"Ошибка сервиса анализа: {code}")
        self.code = code
        self.user_message = user_message


class AnalysisResponseError(ValueError):
    def __init__(self, code: str, user_message: str):
        super().__init__(f"Некорректный ответ сервиса анализа: {code}")
        self.code = code
        self.user_message = user_message


class AnalysisInputTooLong(ValueError):
    code = "ANALYSIS_INPUT_TOO_LONG"
    user_message = "Транскрипция слишком длинная для анализа. Разделите запись на части."


def _empty_response() -> dict:
    return {key: value.copy() if isinstance(value, list) else value for key, value in RESPONSE_SCHEMA.items()}


def _extract_json(raw_text: str) -> dict:
    if not isinstance(raw_text, str):
        raise ValueError("Ответ нейросети не является строкой")
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start < 0 or text.startswith("["):
            raise ValueError("В ответе нейросети не найден JSON-объект") from None
        try:
            result, end = json.JSONDecoder().raw_decode(text, start)
        except json.JSONDecodeError as error:
            raise ValueError("Не удалось разобрать JSON нейросети") from error
        if "{" in text[end:] or "}" in text[end:]:
            raise ValueError("Неоднозначный JSON в ответе нейросети")
    if not isinstance(result, dict):
        raise ValueError("Нейросеть вернула JSON неправильной структуры")
    return result


def _safe_confidence(value) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.5
    if not math.isfinite(confidence):
        return 0.5
    return max(0.0, min(1.0, confidence))


def _safe_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def _safe_priority(value) -> str:
    if not isinstance(value, str):
        return "medium"
    priority = value.strip().lower()
    return priority if priority in {"high", "medium", "low"} else "medium"


def _safe_text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _normalize_string_list(value) -> list:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        text = _safe_text(item)
        if text and text not in result:
            result.append(text)
    return result


def _normalize_source_ids(source_ids, valid_segment_ids: set) -> list:
    if not isinstance(source_ids, list):
        return []
    normalized = []
    for source_id in source_ids:
        if isinstance(source_id, bool) or not isinstance(source_id, (int, str)):
            continue
        try:
            source_id = int(source_id)
        except (TypeError, ValueError):
            continue
        if source_id in valid_segment_ids and source_id not in normalized:
            normalized.append(source_id)
    return normalized


def _normalize_requirements(requirements, valid_segment_ids: set) -> list:
    if not isinstance(requirements, list):
        return []
    normalized = []
    used_ids = set()
    for requirement in requirements:
        if not isinstance(requirement, dict):
            continue
        title = _safe_text(requirement.get("title"))
        description = _safe_text(requirement.get("description"))
        if not title and not description:
            continue
        requirement_id = _safe_text(requirement.get("id"))
        if not requirement_id or requirement_id in used_ids:
            number = len(normalized) + 1
            requirement_id = f"req_{number}"
            while requirement_id in used_ids:
                number += 1
                requirement_id = f"req_{number}"
        used_ids.add(requirement_id)
        source_ids = _normalize_source_ids(requirement.get("sourceSegmentIds"), valid_segment_ids)
        normalized.append({
            "id": requirement_id,
            "title": title,
            "description": description,
            "role": _safe_text(requirement.get("role")),
            "priority": _safe_priority(requirement.get("priority")),
            "confidence": _safe_confidence(requirement.get("confidence")),
            "needsClarification": _safe_bool(requirement.get("needsClarification"))
                or not source_ids or not title or not description,
            "sourceSegmentIds": source_ids,
        })
    return normalized


def _normalize_scenarios(scenarios, valid_segment_ids: set) -> list:
    if not isinstance(scenarios, list):
        return []
    normalized = []
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            continue
        title = _safe_text(scenario.get("title"))
        description = _safe_text(scenario.get("description"))
        if not title and not description:
            continue
        normalized.append({
            "title": title,
            "description": description,
            "confidence": _safe_confidence(scenario.get("confidence")),
            "sourceSegmentIds": _normalize_source_ids(scenario.get("sourceSegmentIds"), valid_segment_ids),
        })
    return normalized


def _normalize_result(result: dict, valid_segment_ids: set) -> dict:
    normalized = _empty_response()
    normalized["summary"] = _safe_text(result.get("summary"))
    normalized["roles"] = _normalize_string_list(result.get("roles"))
    normalized["requirements"] = _normalize_requirements(result.get("requirements"), valid_segment_ids)
    normalized["userScenarios"] = _normalize_scenarios(result.get("userScenarios"), valid_segment_ids)
    for key in ("constraints", "conditions", "openQuestions", "agreements", "contradictions"):
        normalized[key] = _normalize_string_list(result.get(key))
    return normalized


def _prepare_transcription(transcription: dict) -> tuple[str, list]:
    if not isinstance(transcription, dict):
        raise ValueError("transcription должен быть словарем")
    full_text = _safe_text(transcription.get("text"))
    raw_segments = transcription.get("segments", [])
    if not isinstance(raw_segments, list):
        raw_segments = []
    segments = []
    used_ids = set()
    for segment in raw_segments:
        if not isinstance(segment, dict) or type(segment.get("id")) is not int:
            continue
        segment_id = segment["id"]
        if segment_id in used_ids:
            continue
        try:
            start = float(segment.get("start", 0))
            end = float(segment.get("end", 0))
        except (TypeError, ValueError):
            continue
        text = _safe_text(segment.get("text"))
        if not text or not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start:
            continue
        used_ids.add(segment_id)
        segments.append({"id": segment_id, "start": start, "end": end, "text": text})
    if not full_text and not segments:
        raise ValueError("Транскрипция пуста")
    return full_text, segments


def _split_transcription(full_text: str, segments: list) -> list[list[dict]]:
    if not segments:
        pieces = [full_text[index:index + MAX_CHUNK_CHARS]
                  for index in range(0, len(full_text), MAX_CHUNK_CHARS)]
        return [[{"id": None, "start": 0.0, "end": 0.0, "text": piece}] for piece in pieces]
    chunks = []
    current = []
    current_size = 0
    for segment in segments:
        pieces = [segment["text"][index:index + MAX_CHUNK_CHARS]
                  for index in range(0, len(segment["text"]), MAX_CHUNK_CHARS)] or [""]
        for piece in pieces:
            item = {**segment, "text": piece}
            item_size = len(piece) + 40
            if current and current_size + item_size > MAX_CHUNK_CHARS:
                chunks.append(current)
                current = []
                current_size = 0
            current.append(item)
            current_size += item_size
    if current:
        chunks.append(current)
    return chunks


def _segments_block(segments: list[dict]) -> str:
    lines = []
    for segment in segments:
        if segment["id"] is None:
            lines.append(segment["text"])
        else:
            lines.append(
                f"[id={segment['id']} | {segment['start']:.1f}-{segment['end']:.1f}] {segment['text']}"
            )
    return "\n".join(lines)


def _request_analysis(segments: list[dict], valid_segment_ids: set, api_key: str) -> dict:
    body = {
        "model": ANALYSIS_MODEL,
        "reasoning_effort": "low",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(segments_block=_segments_block(segments))},
        ],
        "temperature": 0.1,
        "max_completion_tokens": 4000,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = None
    for attempt in range(2):
        try:
            response = requests.post(API_URL, headers=headers, json=body, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            break
        except (requests.Timeout, requests.ConnectionError) as error:
            if attempt == 0:
                continue
            raise AnalysisServiceError(
                "GROQ_LLM_TEMPORARY", "Сервис анализа временно недоступен. Повторите попытку позже."
            ) from error
        except requests.RequestException as error:
            status = getattr(getattr(error, "response", None), "status_code", None)
            if status in TRANSIENT_STATUS_CODES and attempt == 0:
                continue
            if status == 429:
                message = "Сервис анализа перегружен. Повторите попытку через минуту."
                code = "GROQ_LLM_RATE_LIMIT"
            elif status in {400, 413}:
                message = "Транскрипция не помещается в запрос анализа. Попробуйте более короткую запись."
                code = "GROQ_LLM_INPUT_REJECTED"
            else:
                message = "Сервис анализа не выполнил запрос. Повторите попытку позже."
                code = "GROQ_LLM_FAILED"
            raise AnalysisServiceError(code, message) from error
    try:
        data = response.json()
        choice = data["choices"][0]
        if not isinstance(choice, dict):
            raise TypeError
        status = choice.get("finish_reason")
        if status is not None and status != "stop":
            raise ValueError("generation_not_final")
        raw_text = choice["message"]["content"]
        if not isinstance(raw_text, str):
            raise TypeError
    except (ValueError, KeyError, IndexError, TypeError) as error:
        raise AnalysisResponseError(
            "GROQ_LLM_RESPONSE_INVALID", "Сервис анализа вернул некорректный ответ. Повторите попытку."
        ) from error
    try:
        return _normalize_result(_extract_json(raw_text), valid_segment_ids)
    except ValueError as error:
        raise AnalysisResponseError(
            "GROQ_LLM_JSON_INVALID", "Не удалось разобрать результат анализа. Повторите попытку."
        ) from error


def _merge_results(results: list[dict]) -> dict:
    merged = _empty_response()
    summaries = []
    for result in results:
        if result["summary"] and result["summary"] not in summaries:
            summaries.append(result["summary"])
        for key in ("roles", "constraints", "conditions", "openQuestions", "agreements", "contradictions"):
            for item in result[key]:
                if item not in merged[key]:
                    merged[key].append(item)
    merged["summary"] = " ".join(summaries)

    requirements = {}
    for result in results:
        for item in result["requirements"]:
            key = (_safe_text(item["title"]).casefold(), _safe_text(item["description"]).casefold(),
                   _safe_text(item["role"]).casefold())
            if key not in requirements:
                requirements[key] = {**item, "sourceSegmentIds": list(item["sourceSegmentIds"])}
            else:
                current = requirements[key]
                current["sourceSegmentIds"] = list(dict.fromkeys(
                    current["sourceSegmentIds"] + item["sourceSegmentIds"]
                ))
                current["confidence"] = max(current["confidence"], item["confidence"])
                current["needsClarification"] = current["needsClarification"] or item["needsClarification"]
    merged["requirements"] = list(requirements.values())
    for index, item in enumerate(merged["requirements"], start=1):
        item["id"] = f"req_{index}"

    scenarios = {}
    for result in results:
        for item in result["userScenarios"]:
            key = (_safe_text(item["title"]).casefold(), _safe_text(item["description"]).casefold())
            if key not in scenarios:
                scenarios[key] = {**item, "sourceSegmentIds": list(item["sourceSegmentIds"])}
            else:
                current = scenarios[key]
                current["sourceSegmentIds"] = list(dict.fromkeys(
                    current["sourceSegmentIds"] + item["sourceSegmentIds"]
                ))
                current["confidence"] = max(current["confidence"], item["confidence"])
    merged["userScenarios"] = list(scenarios.values())
    return merged


def analyze_transcription(transcription: dict) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY не найден в .env")
    full_text, segments = _prepare_transcription(transcription)
    chunks = _split_transcription(full_text, segments)
    if len(chunks) > MAX_ANALYSIS_CHUNKS:
        raise AnalysisInputTooLong(
            "Транскрипция слишком длинная для анализа. Разделите запись на части."
        )
    valid_ids = {segment["id"] for segment in segments}
    results = [_request_analysis(chunk, valid_ids, api_key) for chunk in chunks]
    return _merge_results(results)
