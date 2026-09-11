// src/components/FileUploader/FileUploader.tsx
import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import './FileUploader.css'
import { IconMusicNote } from '../Icons/Icons'

// ── Константы — берём из контракта с бэком ──
const ACCEPTED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'video/webm']
const ACCEPTED_EXTENSIONS = ['.mp3', '.mp4', '.wav', '.m4a', '.webm']
const MAX_SIZE_MB = 25
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface FileUploaderProps {
  onFileSelect: (file: File) => void   // отдаём файл наверх в App.tsx
  disabled?: boolean                    // блокируем во время загрузки
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function validateFile(file: File): string | null {
  // Проверяем по расширению И по MIME-типу — оба варианта
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const mimeOk = ACCEPTED_FORMATS.includes(file.type)
  const extOk = ACCEPTED_EXTENSIONS.includes(ext)

  if (!mimeOk && !extOk) {
    return `Формат не поддерживается. Загрузите файл: ${ACCEPTED_EXTENSIONS.join(', ')}`
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Файл слишком большой: ${formatSize(file.size)}. Максимум — ${MAX_SIZE_MB} МБ`
  }
  return null // null = всё ок
}

export default function FileUploader({ onFileSelect, disabled = false }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const error = validateFile(file)
    if (error) {
      setValidationError(error)
      setSelectedFile(null)
      return
    }
    setValidationError(null)
    setSelectedFile(file)
    onFileSelect(file)  // передаём наверх
  }

  // ── Drag события ──
  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()  // без этого drop не сработает
    if (!disabled) setIsDragging(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Клик по зоне → открываем input ──
  function onZoneClick() {
    if (!disabled) inputRef.current?.click()
  }

  // ── Выбор через диалог ──
  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // сбрасываем value чтобы можно было выбрать тот же файл повторно
    e.target.value = ''
  }

  return (
    <div className="file-uploader">
      {/* ── Зона drag-and-drop ── */}
      <div
        className={[
          'file-uploader__zone',
          isDragging ? 'file-uploader__zone--dragging' : '',
          disabled ? 'file-uploader__zone--disabled' : '',
          selectedFile ? 'file-uploader__zone--has-file' : '',
        ].join(' ')}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onZoneClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => e.key === 'Enter' && onZoneClick()}
        aria-label="Зона загрузки файла"
      >
        {/* скрытый input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={onInputChange}
          className="file-uploader__input"
          tabIndex={-1}
        />

        {selectedFile ? (
          // ── Файл выбран ──
          <div className="file-uploader__file-info">
              <IconMusicNote size={32} />
            <div>
              <p className="file-uploader__file-name">{selectedFile.name}</p>
              <p className="file-uploader__file-size">{formatSize(selectedFile.size)}</p>
            </div>
            {!disabled && (
              <button
                className="file-uploader__clear"
                onClick={(e) => {
                  e.stopPropagation() // не открываем диалог
                  setSelectedFile(null)
                  setValidationError(null)
                }}
                aria-label="Убрать файл"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          // ── Файл не выбран ──
          <div className="file-uploader__placeholder">
            <svg className="file-uploader__icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5"/>
              <path
                d="M12 16V8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M8.5 11.5L12 8l3.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="file-uploader__hint-primary">
              {isDragging ? 'Отпустите файл' : 'Перетащите файл сюда'}
            </p>
            <p className="file-uploader__hint-secondary">
              или <span className="file-uploader__link">выберите на компьютере</span>
            </p>
            <p className="file-uploader__formats">
              {ACCEPTED_EXTENSIONS.join(', ')} · до {MAX_SIZE_MB} МБ
            </p>
          </div>
        )}
      </div>

      {/* ── Ошибка валидации ── */}
      {validationError && (
        <p className="file-uploader__error">{validationError}</p>
      )}
    </div>
  )
}
