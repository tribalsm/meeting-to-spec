import os
from functools import lru_cache

from dotenv import load_dotenv
from groq import Groq


load_dotenv()


@lru_cache(maxsize=1)
def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY не настроен")

    return Groq(api_key=api_key)


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

    for index, segment in enumerate(transcription.segments):
        segments.append(
            {
                "id": index,
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip()
            }
        )

    return {
        "text": transcription.text.strip(),
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
