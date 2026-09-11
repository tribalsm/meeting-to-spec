import os
import math
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from groq import Groq


load_dotenv(Path(__file__).with_name(".env"))


@lru_cache(maxsize=1)
def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY не настроен")

    return Groq(api_key=api_key, timeout=120.0, max_retries=0)


def transcribe_file(file_path: str):
    client = get_groq_client()

    with open(file_path, "rb") as media_file:
        transcription = client.audio.transcriptions.create(
            file=media_file,
            model="whisper-large-v3-turbo",
            language="ru",
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )

    segments = []

    raw_segments = transcription.segments
    if raw_segments is None:
        raw_segments = []
    if not isinstance(raw_segments, list):
        raise ValueError("Некорректные сегменты Groq")
    for index, segment in enumerate(raw_segments):
        if not isinstance(segment, dict):
            raise ValueError("Некорректный сегмент Groq")
        start, end = float(segment["start"]), float(segment["end"])
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start:
            raise ValueError("Некорректное время сегмента Groq")
        if not isinstance(segment.get("text"), str):
            raise ValueError("Некорректный текст сегмента Groq")
        segments.append(
            {
                "id": index,
                "start": start,
                "end": end,
                "text": " ".join(segment["text"].split())
            }
        )

    if not isinstance(transcription.text, str):
        raise ValueError("Некорректный текст Groq")
    text = " ".join(transcription.text.split())
    if text and not segments:
        raise ValueError("Groq не вернул временные сегменты")
    return {
        "text": text,
        "segments": segments
    }


def format_time(seconds: float):
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)

    return f"{minutes:02}:{seconds:02}"


if __name__ == "__main__":
    result = transcribe_file("test.mp4")

    print("Полный текст:")
    print(result["text"])

    print("\nСегменты:")

    for segment in result["segments"]:
        start = format_time(segment["start"])
        end = format_time(segment["end"])

        print(
            f'{start} - {end} | {segment["text"]}'
        )
