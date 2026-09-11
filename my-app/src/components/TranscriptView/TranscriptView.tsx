// src/components/TranscriptView/TranscriptView.tsx
import { useEffect, useRef } from 'react'
import './TranscriptView.css'
import type { TranscriptSegment } from '../../types/contract'

interface TranscriptViewProps {
  segments: TranscriptSegment[]
  highlightedIds?: number[]   // какие сегменты подсветить (от RequirementCard)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TranscriptView({ segments, highlightedIds = [] }: TranscriptViewProps) {
  const highlightedRef = useRef<HTMLDivElement | null>(null)

  // ── Скролл к первому подсвеченному сегменту ──
  useEffect(() => {
    if (highlightedIds.length > 0 && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [highlightedIds])

  if (segments.length === 0) {
    return (
      <div className="transcript-view__empty">
        Транскрипция недоступна
      </div>
    )
  }

  return (
    <div className="transcript-view">
      {segments.map((seg, index) => {
        const isHighlighted = highlightedIds.includes(seg.id)
        const isFirst = isHighlighted && highlightedIds[0] === seg.id

        return (
          <div
            key={seg.id}
            // ref на первый подсвеченный — к нему скроллим
            ref={isFirst ? highlightedRef : null}
            className={[
              'transcript-view__segment',
              isHighlighted ? 'transcript-view__segment--highlighted' : '',
            ].join(' ')}
          >
            {/* порядковый номер + таймкод */}
            <div className="transcript-view__meta">
              <span className="transcript-view__index">{index + 1}</span>
              <span className="transcript-view__time">{formatTime(seg.start)}</span>
            </div>

            <p className="transcript-view__text">{seg.text}</p>
          </div>
        )
      })}
    </div>
  )
}

