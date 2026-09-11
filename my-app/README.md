# meeting-to-spec frontend

React + TypeScript + Vite. Real backend is enabled by default. mockResponse is a test fixture only.

## Local launch

Backend, first PowerShell terminal:

```powershell
Set-Location 'C:\Users\tribal\Documents\hackathon\backend'
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend, second terminal:

```powershell
Set-Location 'C:\Users\tribal\Documents\hackathon\my-app'
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards /api and /health to http://127.0.0.1:8000.
No .env is needed locally. Port 5173 is fixed; an occupied port is reported explicitly.

Select an mp3/mp4/wav/m4a/webm file (up to 25 MiB) and click Analyze. FormData uses field file.
Keep the page open while analysis runs. Errors from the backend are displayed in the UI.
Results include transcription, editable requirements, structured scenarios, constraints,
conditions, questions, agreements and contradictions. Click requirements or scenario evidence
buttons to highlight source segments. Export includes current edits and metadata.
Edits are local to the page; download the JSON before refreshing.

## Checks

```powershell
npm test
npm run build
npm run lint
```

Tests mock fetch and never call paid AI services. Coverage includes multipart requests,
backend errors, structured scenarios, evidence highlighting, pending controls and file clearing.

## Deployment

Set VITE_API_URL to the public backend origin before npm run build, or configure a same-origin
reverse proxy for /api. The Vite development proxy does not exist in the static production build.
For separate origins, configure backend CORS_ORIGINS with the exact frontend origin.
Never put Groq or Yandex credentials in VITE_ variables: browser configuration is public.
