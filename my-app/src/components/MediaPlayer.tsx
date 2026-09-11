import { useEffect, useRef, useState } from 'react'
import './MediaPlayer.css'

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function MediaPlayer({ file }: { file: File }) {
  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const [failedFile, setFailedFile] = useState<File | null>(null)
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [playback, setPlayback] = useState({ file, time: 0, duration: 0, playing: false })
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playError, setPlayError] = useState<File | null>(null)
  const current = playback.file === file ? playback : { time: 0, duration: 0, playing: false }
  const available = readyFile === file && failedFile !== file

  function syncPlayback() {
    const media = mediaRef.current
    if (media) setPlayback({ file, time: media.currentTime,
      duration: Number.isFinite(media.duration) ? media.duration : 0, playing: !media.paused && !media.ended })
  }

  async function togglePlayback() {
    const media = mediaRef.current
    if (!media) return
    if (!media.paused) { media.pause(); return }
    try {
      await media.play()
      setPlayError(null)
    } catch {
      if (mediaRef.current === media) setPlayError(file)
    }
  }
  const isVideo = file.type.startsWith('video/')
    || (!file.type.startsWith('audio/') && /\.(mp4|webm)$/i.test(file.name))

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    const url = URL.createObjectURL(file)
    media.src = url
    media.defaultPlaybackRate = speedRef.current
    media.playbackRate = speedRef.current
    return () => {
      media.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file, isVideo])

  function skip(seconds: number) {
    const media = mediaRef.current
    if (!media || !Number.isFinite(media.duration)) return
    media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds))
  }

  function changeSpeed(value: number) {
    speedRef.current = value
    setSpeed(value)
    if (mediaRef.current) {
      mediaRef.current.defaultPlaybackRate = value
      mediaRef.current.playbackRate = value
    }
  }

  const props = {
    controls: false,
    preload: 'metadata',
    onError: () => setFailedFile(file),
    onLoadedMetadata: () => { setReadyFile(file); syncPlayback() },
    onTimeUpdate: syncPlayback,
    onDurationChange: syncPlayback,
    onPlay: syncPlayback,
    onPause: syncPlayback,
    onEnded: syncPlayback,
    onVolumeChange: () => {
      if (mediaRef.current) {
        setVolume(mediaRef.current.volume)
        setMuted(mediaRef.current.muted)
      }
    },
    onRateChange: () => {
      const value = mediaRef.current?.playbackRate ?? 1
      speedRef.current = value
      setSpeed(value)
    },
    ref: (node: HTMLMediaElement | null) => { mediaRef.current = node },
    'aria-label': `Проигрыватель: ${file.name}`,
  }

  return (
    <section className="media-player" aria-label="Прослушивание записи">
      <div className="media-player__header">
        <span className="media-player__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {isVideo ? <><rect x="3" y="5" width="18" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" /></>
              : <><path d="M5 10v4M9 6v12M13 3v18M17 7v10M21 10v4" /></>}
          </svg>
        </span>
        <div className="media-player__heading">
          <p className="media-player__eyebrow">{isVideo ? 'Видеозапись' : 'Аудиозапись'}</p>
          <h2 className="media-player__title">Предпросмотр записи</h2>
        </div>
        <span className="media-player__format">{file.name.split('.').pop()?.toUpperCase()}</span>
      </div>
      <div className="media-player__body">
        <div className="media-player__metadata">
          <span className="media-player__filename" title={file.name}>{file.name}</span>
          <span className="media-player__size">{file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))} КБ`
            : `${(file.size / 1024 / 1024).toFixed(1)} МБ`}</span>
        </div>
        {isVideo ? <video {...props} playsInline /> : <audio {...props} />}
        <div className="media-player__transport" role="group" aria-label="Управление воспроизведением">
          <button className="media-player__play" type="button" disabled={!available}
            onClick={togglePlayback} aria-label={current.playing ? 'Пауза' : 'Воспроизвести'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {current.playing ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
                : <path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5Z" />}
            </svg>
          </button>
          <div className="media-player__timeline">
            <div className="media-player__times"><span>{clock(current.time)}</span><span>{clock(current.duration)}</span></div>
            <input type="range" className="media-player__seek" aria-label="Позиция воспроизведения"
              aria-valuetext={`${clock(current.time)} из ${clock(current.duration)}`}
              min="0" max={current.duration || 1} step="0.1" value={Math.min(current.time, current.duration)}
              disabled={!available || !current.duration}
              style={{ background: `linear-gradient(to right, #009de5 ${current.duration ? current.time / current.duration * 100 : 0}%, #d7e7f0 0%)` }}
              onChange={event => {
                if (mediaRef.current) { mediaRef.current.currentTime = Number(event.target.value); syncPlayback() }
              }} />
          </div>
          <div className="media-player__volume">
            <button type="button" className="media-player__mute" aria-label={muted || volume === 0 ? 'Включить звук' : 'Выключить звук'}
              onClick={() => {
                const media = mediaRef.current
                if (!media) return
                if (media.muted || media.volume === 0) { media.muted = false; if (!media.volume) media.volume = 1 }
                else media.muted = true
              }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4Z" />
                {muted || !volume ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
              </svg>
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Громкость"
              onChange={event => {
                if (mediaRef.current) { mediaRef.current.volume = Number(event.target.value); mediaRef.current.muted = false }
              }} />
          </div>
        </div>
        {playError === file && <p className="media-player__hint" role="status">Не удалось начать воспроизведение. Попробуйте еще раз.</p>}
        <div className="media-player__tools">
          <div className="media-player__skip" role="group" aria-label="Перемотка записи">
            <button type="button" disabled={readyFile !== file || failedFile === file}
              onClick={() => skip(-10)} aria-label="Назад на 10 секунд">
              <span aria-hidden="true">↶</span> 10 сек
            </button>
            <button type="button" disabled={readyFile !== file || failedFile === file}
              onClick={() => skip(10)} aria-label="Вперед на 10 секунд">
              10 сек <span aria-hidden="true">↷</span>
            </button>
          </div>
          <label className="media-player__speed">
            Скорость
            <select aria-label="Скорость воспроизведения" value={speed}
              onChange={event => changeSpeed(Number(event.target.value))}>
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map(value => (
                <option key={value} value={value}>{value}×</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="media-player__hint">Проверьте запись перед анализом. Можно перемотать к нужному моменту.</p>
      {failedFile === file && (
        <p className="media-player__error" role="status">
          Браузер не смог воспроизвести эту запись. Вы можете попробовать открыть ее другим
          проигрывателем или отправить на анализ.
        </p>
      )}
    </section>
  )
}
