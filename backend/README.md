# meeting-to-spec backend

FastAPI MVP: multipart upload → Groq Whisper → YandexGPT → transcription + analysis.

## Run locally

Verified with Python 3.14.6 on Windows. Run from the backend directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# For a new installation only: copy .env.example to .env and fill credentials.
# Do not overwrite an existing .env.
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The local .env is loaded relative to the Python modules. Environment variables override it.
GET /health returns {"status":"ok"} even without AI credentials. API docs: http://localhost:8000/docs.

## Frontend contract

```javascript
const form = new FormData();
form.append("file", selectedFile);
const response = await fetch("http://localhost:8000/api/analyze", {
  method: "POST",
  body: form,
}); // Do not manually set Content-Type: the browser supplies the multipart boundary.
const data = await response.json();
if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Upload validation failed");
// data.status, data.filename, data.transcription.text, data.transcription.segments,
// data.analysis.summary, roles, requirements, userScenarios, constraints,
// conditions, openQuestions, agreements, contradictions
```

Requirements retain id/title/description/role/priority/confidence/needsClarification/sourceSegmentIds.
Scenarios retain title/description/confidence/sourceSegmentIds. Segment IDs are integers;
sourceSegmentIds are deduplicated and limited to existing segments. Missing evidence marks
a requirement as needing clarification. No automatic retries of paid requests.

Accepted extensions: .mp3, .mp4, .wav, .m4a, .webm (case-insensitive), up to 25 MiB.
Extension validation does not prove that the bytes are valid audio; provider rejection returns 502.
No audio conversion or chunking. Each provider has a 120-second read timeout; the frontend
should display a pending state and avoid short request timeouts.

| HTTP status | Meaning |
| --- | --- |
| 200 | Successful transcription and analysis |
| 400 | Unsupported extension or empty file |
| 413 | File exceeds limit |
| 422 | Missing multipart file or no recognized speech |
| 502 | Transcription or analysis failed, distinguished by detail |
| 500 | Internal file-processing failure |

CORS defaults to http://localhost:5173 and http://127.0.0.1:5173.
Set CORS_ORIGINS to a comma-separated list of exact frontend origins for deployment.
This replaces the defaults. No secrets are returned in error details or provider error logs.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q -x "[\\/]\.venv[\\/]" .
```

Unit tests block provider HTTP transports and use mocks. A single real smoke test returned
HTTP 200 with eight segments and a nonempty summary. Its audio was a historical announcement,
not a requirements meeting; zero requirements were appropriate. The model produced an
unsupported role. The prompt was tightened afterwards, without another paid request.
Extraction quality on a real customer meeting remains unverified; AI output requires review.

## Deployment boundary

Local frontend integration is ready. Production deployment is not configured or verified.
Configure hosting, credentials, exact CORS origins and proxy upload/time limits before deployment.
The 25 MiB application check runs after multipart parsing: a public reverse proxy must also limit
request size to prevent oversized uploads consuming temporary disk space. Long meetings exceeding
the model context window are not chunked; upstream errors remain controlled 502 responses.
