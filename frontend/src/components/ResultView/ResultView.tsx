// src/components/ResultView/ResultView.tsx
import { useEffect, useRef, useState } from 'react'
import './ResultView.css'
import type { AnalyzeResponse, Requirement } from '../../types/contract'
import TranscriptView from '../TranscriptView/TranscriptView'
import RequirementCard from '../RequirementCard/RequirementCard'
import RequirementEditor from '../RequirementEditor/RequirementEditor'
import {
  IconMic, IconList, IconUser, IconUsers,
  IconBlock, IconCheck, IconQuestion, IconHandshake
} from '../Icons/Icons'
import { exportTz } from '../../utils/exportTz'

interface ResultViewProps {
  result: AnalyzeResponse
}

export default function ResultView({ result }: ResultViewProps) {
  const { transcription, analysis } = result

  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<number[]>([])
  const [activeReqId, setActiveReqId] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<Requirement[]>(analysis.requirements)
  const [newRequirementId, setNewRequirementId] = useState<string | null>(null)
  const newRequirementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (newRequirementId) {
      newRequirementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      newRequirementRef.current?.focus({ preventScroll: true })
    }
  }, [newRequirementId])

  function handleHighlight(reqId: string, segmentIds: number[]) {
    if (activeReqId === reqId) {
      setActiveReqId(null)
      setHighlightedSegmentIds([])
    } else {
      setActiveReqId(reqId)
      setHighlightedSegmentIds(segmentIds)
    }
  }

  function handleUpdate(updated: Requirement) {
    setRequirements(prev =>
      prev.map(r => r.id === updated.id ? updated : r)
    )
  }

  function handleDelete(id: string) {
    setRequirements(prev => prev.filter(r => r.id !== id))
    if (activeReqId === id) {
      setActiveReqId(null)
      setHighlightedSegmentIds([])
    }
  }

  function handleAdd(newReq: Requirement) {
    setNewRequirementId(newReq.id)
    setRequirements(prev => [newReq, ...prev])
  }

  return (
    <div className="result-view">

      {/* ── Тулбар ── */}
      <div className="result-view__toolbar">
        <span className="result-view__toolbar-info">
          📄 {result.filename}
        </span>
        <button
          className="result-view__export-btn"
          onClick={() => exportTz(result, requirements)}
        >
          ⬇ Скачать ТЗ (.md)
        </button>
      </div>

      {/* ── Саммари ── */}
      {analysis.summary && (
        <div className="result-view__summary">
          <p className="result-view__summary-text">{analysis.summary}</p>
        </div>
      )}

      {/* ── Основная сетка ── */}
      <div className="result-view__grid">

        {/* Левая колонка — транскрипция */}
        <section className="result-view__section">
          <h2 className="result-view__section-title">
            <IconMic size={18} />
            Транскрипция
          </h2>
          <TranscriptView
            segments={transcription.segments}
            highlightedIds={highlightedSegmentIds}
          />
        </section>

        {/* Правая колонка — требования */}
        <section className="result-view__section">
          <h2 className="result-view__section-title">
            <IconList size={18} />
            Требования
            <span className="result-view__count">{requirements.length}</span>
          </h2>

          <div className="result-view__requirements">
            {requirements.length === 0 ? (
              <p className="result-view__empty">Требований пока нет. Их можно добавить вручную.</p>
            ) : (
              requirements.map(req => (
                <div key={req.id} ref={req.id === newRequirementId ? newRequirementRef : undefined}
                  tabIndex={req.id === newRequirementId ? -1 : undefined} className="result-view__requirement-anchor">
                  <RequirementCard
                    requirement={req}
                    isHighlighted={activeReqId === req.id}
                    onHighlight={(ids) => handleHighlight(req.id, ids)}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                </div>
              ))
            )}
          </div>

          <RequirementEditor onAdd={handleAdd} />
        </section>

      </div>

      {/* ── Нижние списки ── */}
      <div className="result-view__lists">
        {analysis.contradictions.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">Противоречия</h3>
            <ul className="result-view__list">
              {analysis.contradictions.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

        {analysis.userScenarios.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconUser size={15} />
              Пользовательские сценарии
            </h3>
            <ul className="result-view__list">
              {analysis.userScenarios.map((item, i) => (
                <li key={i}>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  {item.sourceSegmentIds.length > 0 && (
                    <button type="button" onClick={() => handleHighlight(`scenario-${i}`, item.sourceSegmentIds)}>
                      Показать фрагменты
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {analysis.roles.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconUsers size={15} />
              Роли
            </h3>
            <ul className="result-view__list">
              {analysis.roles.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

        {analysis.constraints.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconBlock size={15} />
              Ограничения
            </h3>
            <ul className="result-view__list">
              {analysis.constraints.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

        {analysis.conditions.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconCheck size={15} />
              Условия
            </h3>
            <ul className="result-view__list">
              {analysis.conditions.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

        {analysis.openQuestions.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconQuestion size={15} />
              Открытые вопросы
            </h3>
            <ul className="result-view__list">
              {analysis.openQuestions.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

        {analysis.agreements.length > 0 && (
          <section className="result-view__list-block">
            <h3 className="result-view__list-title">
              <IconHandshake size={15} />
              Договорённости
            </h3>
            <ul className="result-view__list">
              {analysis.agreements.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}

      </div>
    </div>
  )
}
