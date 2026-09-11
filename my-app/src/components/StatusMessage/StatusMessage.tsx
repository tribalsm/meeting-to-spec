// src/components/StatusMessage/StatusMessage.tsx
import './StatusMessage.css'
import type { AppStatus } from '../../types/contract'
import { IconWarning, IconSuccess } from '../Icons/Icons'

interface StatusMessageProps {
  status: AppStatus
  errorText?: string | null
}

export default function StatusMessage({ status, errorText }: StatusMessageProps) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="status status--loading">
        <div className="status__spinner" />
        <div>
          <p className="status__title">Обрабатываем запись...</p>
          <p className="status__subtitle">
            Расшифровываем аудио и выделяем требования из разговора.
            <br />
            Это может занять до нескольких минут — не закрывайте страницу.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="status status--error">
        <span className="status__icon status__icon--error">
          <IconWarning size={20} />
        </span>
        <div>
          <p className="status__title">Что-то пошло не так</p>
          {errorText && <p className="status__subtitle">{errorText}</p>}
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="status status--success">
        <span className="status__icon status__icon--success">
          <IconSuccess size={20} />
        </span>
        <p className="status__title">Анализ завершён — ТЗ сформировано</p>
      </div>
    )
  }

  return null
}


