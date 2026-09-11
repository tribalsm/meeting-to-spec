// src/components/Layout/Layout.tsx
// src/components/Layout/Layout.tsx — первая строка
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-inner">
          <div className="layout__logo">
            {/* иконка микрофона — SVG inline, без зависимостей */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="11" rx="3" fill="var(--color-accent)" />
              <path
                d="M5 11a7 7 0 0 0 14 0"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="12" y1="18" x2="12" y2="22"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8" y1="22" x2="16" y2="22"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="layout__logo-text">ТЗ из разговора</span>
          </div>

          <nav className="layout__nav">
            <span className="layout__nav-badge">MVP · Хакатон 2025</span>
          </nav>
        </div>
      </header>

      <main className="layout__main">
        <div className="layout__content">
          {children}
        </div>
      </main>

      <footer className="layout__footer">
        <span>Преобразуем разговор в техническое задание с помощью AI</span>
      </footer>
    </div>
  )
}
