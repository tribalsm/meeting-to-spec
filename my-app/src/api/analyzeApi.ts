// src/api/analyzeApi.ts
import type { AnalyzeResponse } from '../types/contract'
import { mockResponse } from '../mock/mockResponse'

const USE_MOCK = true
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (data.detail) return data.detail
  } catch {
    // тело не JSON
  }
  return `Ошибка сервера: ${response.status}`
}

export async function uploadFile(file: File): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    await delay(2000)

    // ── раскомментировать чтобы протестировать ошибку ──
    // throw new ApiError('Сервер недоступен', 'NETWORK_ERROR')

    return mockResponse
  }

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
      'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
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

  return response.json() as Promise<AnalyzeResponse>
}

