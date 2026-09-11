// src/components/TranscriptView/TranscriptView.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const activeSearchRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const matches = useMemo(() => normalizedQuery
    ? segments.filter(segment => segment.text.toLocaleLowerCase('ru').includes(normalizedQuery))
    : [], [segments, normalizedQuery])

  useEffect(() => {
    if (matches.length > 0) {
      activeSearchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeMatch, matches.length])

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
    <div className="transcript-view-wrap">
      <div className="transcript-search">
        <label className="transcript-search__field">
          <span className="transcript-search__icon" aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={event => {
            setQuery(event.target.value)
            setActiveMatch(0)
          }}
            placeholder="Поиск по транскрипции" aria-label="Поиск по транскрипции" />
        </label>
        <span className="transcript-search__count" role="status">
          {normalizedQuery ? `${matches.length ? activeMatch + 1 : 0} из ${matches.length}` : `${segments.length} фрагм.`}
        </span>
        <button type="button" aria-label="Предыдущее совпадение" disabled={matches.length < 2}
          onClick={() => setActiveMatch(value => (value - 1 + matches.length) % matches.length)}>↑</button>
        <button type="button" aria-label="Следующее совпадение" disabled={matches.length < 2}
          onClick={() => setActiveMatch(value => (value + 1) % matches.length)}>↓</button>
      </div>
      {normalizedQuery && matches.length === 0 && (
        <p className="transcript-search__empty">Совпадений не найдено</p>
      )}
      <div className="transcript-view">
        {segments.map((seg, index) => {
        const isHighlighted = highlightedIds.includes(seg.id)
        const isFirst = isHighlighted && highlightedIds[0] === seg.id
        const searchIndex = matches.findIndex(item => item.id === seg.id)
        const isSearchMatch = searchIndex >= 0
        const isActiveSearchMatch = searchIndex === activeMatch && isSearchMatch

        return (
          <div
            key={seg.id}
            ref={node => {
              if (isFirst) highlightedRef.current = node
              if (isActiveSearchMatch) activeSearchRef.current = node
            }}
            className={[
              'transcript-view__segment',
              isHighlighted ? 'transcript-view__segment--highlighted' : '',
              isSearchMatch ? 'transcript-view__segment--match' : '',
              isActiveSearchMatch ? 'transcript-view__segment--active-match' : '',
            ].join(' ')}
          >
            {/* порядковый номер + таймкод */}
            <div className="transcript-view__meta">
              <span className="transcript-view__index">{index + 1}</span>
              <span className="transcript-view__time">{formatTime(seg.start)}</span>
            </div>

            <p className="transcript-view__text">{highlightText(seg.text, normalizedQuery)}</p>
          </div>
        )
        })}
      </div>
    </div>
  )
}

function highlightText(text: string, query: string) {
  if (!query) return text
  const nodes: React.ReactNode[] = []
  const lowerText = text.toLocaleLowerCase('ru')
  let cursor = 0
  let index = lowerText.indexOf(query)
  while (index >= 0) {
    if (index > cursor) nodes.push(text.slice(cursor, index))
    nodes.push(<mark key={`${index}-${nodes.length}`}>{text.slice(index, index + query.length)}</mark>)
    cursor = index + query.length
    index = lowerText.indexOf(query, cursor)
  }
  nodes.push(text.slice(cursor))
  return nodes
}
