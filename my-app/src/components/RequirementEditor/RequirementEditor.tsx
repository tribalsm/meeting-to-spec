// src/components/RequirementEditor/RequirementEditor.tsx
import { useState } from 'react'
import './RequirementEditor.css'
import type { Requirement } from '../../types/contract'

interface RequirementEditorProps {
  onAdd: (requirement: Requirement) => void
}

const emptyDraft = {
  title: '',
  role: '',
  description: '',
}

export default function RequirementEditor({ onAdd }: RequirementEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState<Partial<typeof emptyDraft>>({})

  function validate(): boolean {
    const newErrors: Partial<typeof emptyDraft> = {}
    if (!draft.title.trim()) newErrors.title = 'Укажите название'
    if (!draft.role.trim()) newErrors.role = 'Укажите роль'
    if (!draft.description.trim()) newErrors.description = 'Укажите описание'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleAdd() {
    if (!validate()) return

    const newRequirement: Requirement = {
      id: `req-${Date.now()}`,   // уникальный id на фронте
      title: draft.title.trim(),
      role: draft.role.trim(),
      description: draft.description.trim(),
      sourceSegmentIds: [],       // новое требование не привязано к сегментам
      needsClarification: false,
    }

    onAdd(newRequirement)
    setDraft(emptyDraft)
    setErrors({})
    setIsOpen(false)
  }

  function handleCancel() {
    setDraft(emptyDraft)
    setErrors({})
    setIsOpen(false)
  }

  return (
    <div className="req-editor">
      {!isOpen ? (
        <button
          className="req-editor__trigger"
          onClick={() => setIsOpen(true)}
        >
          <span className="req-editor__trigger-icon">+</span>
          Добавить требование
        </button>
      ) : (
        <div className="req-editor__form">
          <h4 className="req-editor__form-title">Новое требование</h4>

          {/* Название */}
          <div className="req-editor__field">
            <label className="req-editor__label">Название *</label>
            <input
              className={[
                'req-editor__input',
                errors.title ? 'req-editor__input--error' : '',
              ].join(' ')}
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="например: Авторизация"
            />
            {errors.title && (
              <span className="req-editor__error">{errors.title}</span>
            )}
          </div>

          {/* Роль */}
          <div className="req-editor__field">
            <label className="req-editor__label">Роль *</label>
            <input
              className={[
                'req-editor__input',
                errors.role ? 'req-editor__input--error' : '',
              ].join(' ')}
              value={draft.role}
              onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}
              placeholder="например: Сотрудник"
            />
            {errors.role && (
              <span className="req-editor__error">{errors.role}</span>
            )}
          </div>

          {/* Описание */}
          <div className="req-editor__field">
            <label className="req-editor__label">Описание *</label>
            <textarea
              className={[
                'req-editor__textarea',
                errors.description ? 'req-editor__input--error' : '',
              ].join(' ')}
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Пользователь должен иметь возможность..."
              rows={3}
            />
            {errors.description && (
              <span className="req-editor__error">{errors.description}</span>
            )}
          </div>

          {/* Кнопки */}
          <div className="req-editor__actions">
            <button className="req-editor__btn req-editor__btn--save" onClick={handleAdd}>
              Добавить
            </button>
            <button className="req-editor__btn req-editor__btn--cancel" onClick={handleCancel}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

