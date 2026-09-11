import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MediaPlayer from './MediaPlayer'

afterEach(cleanup)

it('seeks within the recording and changes playback speed', () => {
  URL.createObjectURL = vi.fn(() => 'blob:audio')
  URL.revokeObjectURL = vi.fn()
  render(<MediaPlayer file={new File(['audio'], 'sample.mp3')} />)
  const audio = screen.getByLabelText('Проигрыватель: sample.mp3') as HTMLAudioElement
  expect((screen.getByRole('button', { name: 'Назад на 10 секунд' }) as HTMLButtonElement).disabled).toBe(true)
  Object.defineProperty(audio, 'duration', { value: 25, configurable: true })
  fireEvent.loadedMetadata(audio)
  audio.currentTime = 5
  fireEvent.click(screen.getByRole('button', { name: 'Назад на 10 секунд' }))
  expect(audio.currentTime).toBe(0)
  audio.currentTime = 20
  fireEvent.click(screen.getByRole('button', { name: 'Вперед на 10 секунд' }))
  expect(audio.currentTime).toBe(25)
  fireEvent.change(screen.getByLabelText('Скорость воспроизведения'), { target: { value: '1.5' } })
  expect(audio.playbackRate).toBe(1.5)
})

it('plays a local audio URL and releases it on replacement and removal', () => {
  URL.createObjectURL = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
  URL.revokeObjectURL = vi.fn()
  const first = new File(['audio'], 'one.mp3', { type: 'audio/mpeg' })
  const { rerender, unmount } = render(<MediaPlayer file={first} />)
  const audio = screen.getByLabelText('Проигрыватель: one.mp3') as HTMLAudioElement
  expect(audio.tagName).toBe('AUDIO')
  expect(audio.controls).toBe(false)
  expect(audio.autoplay).toBe(false)
  expect(audio.getAttribute('src')).toBe('blob:first')
  rerender(<MediaPlayer file={new File(['audio'], 'two.wav')} />)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second')
})

it('renders video and reports unsupported browser playback', () => {
  URL.createObjectURL = vi.fn(() => 'blob:video')
  URL.revokeObjectURL = vi.fn()
  render(<MediaPlayer file={new File(['video'], 'clip.mp4')} />)
  const video = screen.getByLabelText('Проигрыватель: clip.mp4')
  expect(video.tagName).toBe('VIDEO')
  fireEvent.error(video)
  expect(screen.getByRole('status').textContent).toContain('отправить на анализ')
})
