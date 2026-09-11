// src/App.tsx
import { useState } from 'react'
import './App.css'
import Layout from './components/Layout/Layout'
import FileUploader from './components/FileUploader/FileUploader'
import AnalyzeButton from './components/AnalyzeButton/AnalyzeButton'
import StatusMessage from './components/StatusMessage/StatusMessage'
import ResultView from './components/ResultView/ResultView'
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner'
import { uploadFile, ApiError } from './api/analyzeApi'
import type { AppStatus, AnalyzeResponse } from './types/contract'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)

  async function handleAnalyze() {
    if (!file) return

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

  function handleFileSelect(newFile: File) {
    setFile(newFile)
    if (status === 'error' || status === 'success') {
      setStatus('idle')
      setResult(null)
      setErrorText(null)
    }
  }

  return (
    <Layout>
      {/* приветствие только в idle до первого анализа */}
      {status === 'idle' && !result && (
        <WelcomeBanner />
      )}

      <FileUploader
        onFileSelect={handleFileSelect}
        disabled={status === 'loading'}
      />

      <AnalyzeButton
        onClick={handleAnalyze}
        status={status}
        disabled={!file}
      />

      <StatusMessage
        status={status}
        errorText={errorText}
      />

      {result && <ResultView result={result} />}
    </Layout>
  )
}

export default App





