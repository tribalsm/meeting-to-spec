// src/utils/exportTz.ts
import type { AnalyzeResponse, Requirement } from '../types/contract'

interface ExportData {
  meetingId: string
  filename: string
  exportedAt: string
  summary: string
  roles: string[]
  requirements: Requirement[]
  userScenarios: string[]
  constraints: string[]
  conditions: string[]
  openQuestions: string[]
  agreements: string[]
  transcript: {
    text: string
    segments: AnalyzeResponse['transcription']['segments']
  }
}

export function exportTz(result: AnalyzeResponse, requirements: Requirement[]): void {
  const data: ExportData = {
    meetingId: result.filename.replace(/\.[^.]+$/, ''), // имя файла без расширения как id
    filename: result.filename,
    exportedAt: new Date().toISOString(),
    summary: result.analysis.summary,
    roles: result.analysis.roles,
    requirements,                        // актуальный список — с правками пользователя
    userScenarios: result.analysis.userScenarios,
    constraints: result.analysis.constraints,
    conditions: result.analysis.conditions,
    openQuestions: result.analysis.openQuestions,
    agreements: result.analysis.agreements,
    transcript: result.transcription,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  // создаём ссылку, кликаем, удаляем
  const a = document.createElement('a')
  a.href = url
  a.download = `tz-${result.filename.replace(/\.[^.]+$/, '')}-${formatDate()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
