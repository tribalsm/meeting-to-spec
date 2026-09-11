// src/App.tsx
import { useEffect, useRef, useState } from 'react'
import './App.css'
import Layout from './components/Layout/Layout'
import FileUploader from './components/FileUploader/FileUploader'
import AnalyzeButton from './components/AnalyzeButton/AnalyzeButton'
import StatusMessage from './components/StatusMessage/StatusMessage'
import ResultView from './components/ResultView/ResultView'
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner'
import MediaPlayer from './components/MediaPlayer'
import { uploadFile, ApiError } from './api/analyzeApi'
import type { AppStatus, AnalyzeResponse } from './types/contract'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const uploadRef = useRef<HTMLDivElement>(null)
  const analyzeRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'success' && result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [status, result])

  async function handleAnalyze() {
    if (!file || status === 'loading') return

    setStatus('loading')
    setErrorText(null)
    setResult(null)

    try {
      const data = await uploadFile(file)
      setResult(data)
      setStatus('success')
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorText(err.message)
      } else {
        setErrorText('Произошла непредвиденная ошибка. Попробуйте ещё раз.')
      }
      setStatus('error')
    }
  }

  function handleFileSelect(newFile: File | null) {
    setFile(newFile)
    if (status === 'error' || status === 'success') {
      setStatus('idle')
      setResult(null)
      setErrorText(null)
    }
  }

  return (
    <Layout>
      <WelcomeBanner
        activeStep={result ? 3 : file ? 2 : 1}
        loading={status === 'loading'}
        resultAvailable={Boolean(result)}
        onStepSelect={step => {
          const target = step === 1 ? uploadRef : step === 2 ? analyzeRef : resultRef
          target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      <div ref={uploadRef} className="app__anchor">
        <FileUploader
          onFileSelect={handleFileSelect}
          disabled={status === 'loading'}
        />
      </div>

      <div ref={analyzeRef} className="app__anchor">
        {file && <MediaPlayer file={file} />}

        <AnalyzeButton
          onClick={handleAnalyze}
          status={status}
          disabled={!file}
        />

        <StatusMessage
          status={status}
          errorText={errorText}
        />
      </div>

      <div ref={resultRef} className="app__anchor">
        {result && <ResultView result={result} />}
      </div>
    </Layout>
  )
}

export default App
