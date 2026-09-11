// src/components/WelcomeBanner/WelcomeBanner.tsx
import './WelcomeBanner.css'

export default function WelcomeBanner() {
  return (
    <div className="welcome">
      <div className="welcome__steps">
        <div className="welcome__step">
          <span className="welcome__step-num">1</span>
          <span className="welcome__step-text">Загрузите запись встречи</span>
        </div>
        <div className="welcome__divider" />
        <div className="welcome__step">
          <span className="welcome__step-num">2</span>
          <span className="welcome__step-text">Нажмите «Анализировать»</span>
        </div>
        <div className="welcome__divider" />
        <div className="welcome__step">
          <span className="welcome__step-num">3</span>
          <span className="welcome__step-text">Получите готовое ТЗ</span>
        </div>
      </div>
    </div>
  )
}
