// src/components/AnalyzeButton/AnalyzeButton.tsx
import './AnalyzeButton.css'
import type { AppStatus } from '../../types/contract'

interface AnalyzeButtonProps {
  onClick: () => void
  status: AppStatus
  disabled?: boolean
}

export default function AnalyzeButton({ onClick, status, disabled = false }: AnalyzeButtonProps) {
  const isLoading = status === 'loading'

  return (
    <button
      className={[
        'analyze-btn',
        isLoading ? 'analyze-btn--loading' : '',
      ].join(' ')}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <span className="analyze-btn__spinner" />
          Анализируем...
        </>
      ) : (
        <>
          {/* иконка искры */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z"
              fill="currentColor"
            />
          </svg>
          Анализировать
        </>
      )}
    </button>
  )
}

