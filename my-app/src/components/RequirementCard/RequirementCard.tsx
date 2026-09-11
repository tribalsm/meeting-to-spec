// src/components/RequirementCard/RequirementCard.tsx
import { useState } from 'react'
import './RequirementCard.css'
import type { Requirement } from '../../types/contract'
import { IconCheck } from '../Icons/Icons'

interface RequirementCardProps {
  requirement: Requirement
  isHighlighted: boolean                          // карточка активна (по ней кликнули)
  onHighlight: (ids: number[]) => void            // передаём наверх какие сегменты подсветить
  onUpdate: (updated: Requirement) => void        // сохранить изменения
  onDelete: (id: string) => void                  // удалить требование
}

export default function RequirementCard({
  requirement,
  isHighlighted,
  onHighlight,
  onUpdate,
  onDelete,
}: RequirementCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // локальные копии полей для редактирования
  const [titleDraft, setTitleDraft] = useState(requirement.title)
  const [roleDraft, setRoleDraft] = useState(requirement.role)
  const [descDraft, setDescDraft] = useState(requirement.description)

  function handleSave() {
    onUpdate({
      ...requirement,
      title: titleDraft.trim() || requirement.title,
      role: roleDraft.trim() || requirement.role,
      description: descDraft.trim() || requirement.description,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    // сбрасываем черновики
    setTitleDraft(requirement.title)
    setRoleDraft(requirement.role)
    setDescDraft(requirement.description)
    setIsEditing(false)
  }

  function handleToggleClarification() {
    onUpdate({ ...requirement, needsClarification: !requirement.needsClarification })
  }

  function handleCardClick() {
    // клик на карточку → подсвечиваем сегменты транскрипции
    onHighlight(requirement.sourceSegmentIds)
  }

  return (
    <div
      className={[
        'req-card',
        isHighlighted ? 'req-card--highlighted' : '',
        requirement.needsClarification ? 'req-card--clarify' : '',
      ].join(' ')}
      onClick={!isEditing ? handleCardClick : undefined}
    >
      {/* ── Шапка карточки ── */}
      <div className="req-card__header">
        {isEditing ? (
          <div className="req-card__edit-row">
            <input
              className="req-card__input req-card__input--title"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              placeholder="Название"
              onClick={e => e.stopPropagation()}
            />
            <input
              className="req-card__input req-card__input--role"
              value={roleDraft}
              onChange={e => setRoleDraft(e.target.value)}
              placeholder="Роль"
              onClick={e => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="req-card__title-row">
            <span className="req-card__title">{requirement.title}</span>
            <span className="req-card__role">{requirement.role}</span>
          </div>
        )}

        {/* ── Бейдж «Уточнить» ── */}
        {requirement.needsClarification && !isEditing && (
          <span className="req-card__badge">⚠ Уточнить</span>
        )}
      </div>

      {/* ── Описание ── */}
      {isEditing ? (
        <textarea
          className="req-card__textarea"
          value={descDraft}
          onChange={e => setDescDraft(e.target.value)}
          rows={3}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <p className="req-card__desc">{requirement.description}</p>
      )}

      {/* ── Ссылки на сегменты ── */}
      {requirement.sourceSegmentIds.length > 0 && !isEditing && (
        <div className="req-card__segments">
          <span className="req-card__segments-label">Фрагменты:</span>
          {requirement.sourceSegmentIds.map(id => (
            <span key={id} className="req-card__segment-tag">
              #{id + 1}
            </span>
          ))}
        </div>
      )}

      {/* ── Панель действий ── */}
      <div
        className="req-card__actions"
        onClick={e => e.stopPropagation()} // не триггерим подсветку
      >
        {isEditing ? (
          <>
            <button className="req-card__btn req-card__btn--save" onClick={handleSave}>
              Сохранить
            </button>
            <button className="req-card__btn req-card__btn--cancel" onClick={handleCancel}>
              Отмена
            </button>
          </>
        ) : (
          <>
            <button
              className="req-card__btn req-card__btn--edit"
              onClick={() => setIsEditing(true)}
              title="Редактировать"
            >
              ✏️ Изменить
            </button>

            <button
              className={[
                'req-card__btn',
                requirement.needsClarification
                  ? 'req-card__btn--clarify-active'
                  : 'req-card__btn--clarify',
              ].join(' ')}
              onClick={handleToggleClarification}
            >
              {requirement.needsClarification ? (
                <>
                  <IconCheck size={12} />
                  Ясно
                </>
              ) : (
                '⚠ Уточнить'
              )}
            </button>

            {/* Удаление с подтверждением */}
            {showDeleteConfirm ? (
                  <div className="req-card__delete-group">
                    <span className="req-card__delete-confirm">Удалить?</span>
                    <button className="req-card__btn req-card__btn--delete-yes" onClick={() => onDelete(requirement.id)}>
                      Да
                    </button>
                    <button className="req-card__btn req-card__btn--cancel" onClick={() => setShowDeleteConfirm(false)}>
                      Нет
                    </button>
                  </div>
            ) : (
              <button
                className="req-card__btn req-card__btn--delete"
                onClick={() => setShowDeleteConfirm(true)}
                title="Удалить требование"
              >
                🗑 Удалить
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

