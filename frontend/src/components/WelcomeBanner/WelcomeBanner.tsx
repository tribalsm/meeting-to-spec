// src/components/WelcomeBanner/WelcomeBanner.tsx
import './WelcomeBanner.css'

interface WelcomeBannerProps {
  activeStep: 1 | 2 | 3
  loading: boolean
  resultAvailable: boolean
  onStepSelect: (step: 1 | 2 | 3) => void
}

const steps = [
  { number: 1 as const, label: 'Загрузка записи' },
  { number: 2 as const, label: 'Анализ встречи' },
  { number: 3 as const, label: 'Готовое ТЗ' },
]

export default function WelcomeBanner({ activeStep, loading, resultAvailable, onStepSelect }: WelcomeBannerProps) {
  return (
    <nav className="welcome" aria-label="Этапы работы">
      <div className="welcome__steps">
        {steps.map((step, index) => {
          const completed = step.number < activeStep || resultAvailable
          const disabled = step.number === 2 && activeStep === 1
            || step.number === 3 && !resultAvailable
          return (
            <div className="welcome__step-wrap" key={step.number}>
              {index > 0 && <span className={`welcome__divider ${completed ? 'welcome__divider--done' : ''}`} />}
              <button
                type="button"
                className={`welcome__step ${step.number === activeStep ? 'welcome__step--active' : ''} ${completed ? 'welcome__step--done' : ''}`}
                aria-current={step.number === activeStep ? 'step' : undefined}
                disabled={disabled}
                onClick={() => onStepSelect(step.number)}
              >
                <span className="welcome__step-num">{completed && step.number !== activeStep ? '✓' : step.number}</span>
                <span className="welcome__step-text">{step.number === 2 && loading ? 'Идет анализ...' : step.label}</span>
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
