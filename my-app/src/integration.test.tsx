import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { uploadFile } from './api/analyzeApi'
import { mockResponse } from './mock/mockResponse'

const file = () => new File(['audio'], 'meeting.mp3', { type: 'audio/mpeg' })
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test-recording')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unmocked network forbidden')))
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('API contract', () => {
  it('sends multipart file without overriding the boundary', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockResponse)))
    const selected = file()
    expect(await uploadFile(selected)).toEqual(mockResponse)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/analyze')
    expect(init?.method).toBe('POST')
    expect((init?.body as FormData).get('file')).toBe(selected)
    expect(init?.headers).toBeUndefined()
  })
  it.each([400, 422, 502])('shows backend detail for %s', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'Ошибка анализа' }), { status }))
    await expect(uploadFile(file())).rejects.toThrow('Ошибка анализа')
  })
  it('formats FastAPI validation arrays', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: 'Field required' }] }), { status: 422 }))
    await expect(uploadFile(file())).rejects.toThrow('Field required')
  })
  it('handles unreachable server', async () => {
    await expect(uploadFile(file())).rejects.toThrow('backend')
  })
  it.each(['not json', '{}'])('rejects malformed successful response %s', async body => {
    vi.mocked(fetch).mockResolvedValue(new Response(body))
    await expect(uploadFile(file())).rejects.toThrow('некорректный результат')
  })
})

describe('upload and results', () => {
  it('renders real contract scenario objects, contradictions and evidence links', async () => {
    const result = structuredClone(mockResponse)
    result.analysis.contradictions = ['Сроки противоречат друг другу']
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result)))
    const user = userEvent.setup()
    render(<App />)
    await user.upload(screen.getByLabelText('Выбрать запись'), file())
    await user.click(screen.getByRole('button', { name: 'Анализировать' }))
    expect(await screen.findByText(result.analysis.summary)).toBeTruthy()
    expect(screen.getByText(result.analysis.userScenarios[0].description)).toBeTruthy()
    expect(screen.getByText('Сроки противоречат друг другу')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Показать фрагменты' })[0])
    expect(document.querySelectorAll('.transcript-view__segment--highlighted')).toHaveLength(2)
  })
  it('disables analysis after clearing or rejecting a new file', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Выбрать запись')
    await user.upload(input, file())
    await user.click(screen.getByLabelText('Убрать файл'))
    expect((screen.getByRole('button', { name: 'Анализировать' }) as HTMLButtonElement).disabled).toBe(true)
    await user.upload(input, file())
    fireEvent.change(input, { target: { files: [new File(['x'], 'wrong.txt', { type: 'audio/mpeg' })] } })
    expect((screen.getByRole('button', { name: 'Анализировать' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps controls disabled while pending and displays provider errors', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(r => { resolve = r }))
    const user = userEvent.setup()
    render(<App />)
    await user.upload(screen.getByLabelText('Выбрать запись'), file())
    await user.click(screen.getByRole('button', { name: 'Анализировать' }))
    expect((screen.getByRole('button', { name: 'Анализируем...' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Выбрать запись') as HTMLInputElement).disabled).toBe(true)
    resolve(new Response(JSON.stringify({ detail: 'Не удалось выполнить анализ транскрипции' }), { status: 502 }))
    await waitFor(() => expect(screen.getByText(/Не удалось выполнить анализ транскрипции/)).toBeTruthy())
  })
  it('shows an appropriate empty requirement state', async () => {
    const result = structuredClone(mockResponse)
    result.analysis.requirements = []
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result)))
    const user = userEvent.setup()
    render(<App />)
    await user.upload(screen.getByLabelText('Выбрать запись'), file())
    await user.click(screen.getByRole('button', { name: 'Анализировать' }))
    expect(await screen.findByText('Требований пока нет. Их можно добавить вручную.')).toBeTruthy()
  })
})
