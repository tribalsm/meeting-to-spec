// src/api/analyzeApi.ts
import type { AnalyzeResponse } from '../types/contract'


const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

// ── Типизированные коды ошибок ──
export type ApiErrorCode =
  | 'NETWORK_ERROR'      // сеть упала
  | 'SERVER_ERROR'       // 500
  | 'BAD_REQUEST'        // 400 — бэк отверг файл
  | 'TOO_LARGE'          // 413 — файл слишком большой
  | 'UNKNOWN'

export class ApiError extends Error {
  code: ApiErrorCode

  constructor(message: string, code: ApiErrorCode) {
    super(message)
    this.code = code
  }
}



async function parseBackendError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail)) return data.detail.map((item: { msg?: string }) => item.msg ?? 'Некорректные данные').join('; ')
  } catch {
    // тело не JSON
  }
  return `Ошибка сервера: ${response.status}`
}

export async function uploadFile(file: File): Promise<AnalyzeResponse> {


  // ── Реальный запрос ──
  let response: Response

  try {
    const formData = new FormData()
    formData.append('file', file)

    response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    // fetch бросает только если сеть упала совсем
    throw new ApiError(
      'Не удалось подключиться к backend. Проверьте, что сервер запущен и доступен.',
      'NETWORK_ERROR'
    )
  }

  // ── Разбираем HTTP-статусы ──
  if (!response.ok) {
    const detail = await parseBackendError(response)

    if (response.status === 413) {
      throw new ApiError('Файл слишком большой. Максимум — 25 МБ.', 'TOO_LARGE')
    }

    if (response.status === 400 || response.status === 422) {
      throw new ApiError(detail, 'BAD_REQUEST')
    }

    if (response.status >= 500) {
      throw new ApiError(`Ошибка на сервере. Попробуйте ещё раз.\n${detail}`, 'SERVER_ERROR')
    }

    throw new ApiError(detail, 'UNKNOWN')
  }

  try {
    const data: AnalyzeResponse = await response.json()
    const analysis = data.analysis
    if (data.status !== 'success' || typeof data.filename !== 'string'
      || typeof data.transcription?.text !== 'string'
      || !Array.isArray(data.transcription?.segments)
      || typeof analysis?.summary !== 'string'
      || !['roles', 'requirements', 'userScenarios', 'constraints', 'conditions',
        'openQuestions', 'agreements', 'contradictions'].every(key => Array.isArray(analysis[key as keyof typeof analysis]))) {
      throw new Error('Invalid contract')
    }
    return data
  } catch {
    throw new ApiError('Сервер вернул некорректный результат анализа.', 'SERVER_ERROR')
  }
}

