import type { AnalyzeResponse, Requirement } from '../types/contract'

const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' }

function clean(value: string): string {
  return value.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function listSection(title: string, values: string[]): string {
  if (!values.length) return `## ${title}\n\nНет данных.\n`
  return `## ${title}\n\n${values.map(value => `- ${clean(value)}`).join('\n')}\n`
}

export function buildSpecificationMarkdown(result: AnalyzeResponse, requirements: Requirement[]): string {
  const { analysis, transcription } = result
  const grouped = new Map<string, Requirement[]>()
  for (const requirement of requirements) {
    const role = clean(requirement.role) || 'Роль не определена'
    grouped.set(role, [...(grouped.get(role) ?? []), requirement])
  }

  const requirementText = grouped.size
    ? [...grouped.entries()].map(([role, items]) => [
        `### ${role}`,
        ...items.map((item, index) => [
          `#### ${index + 1}. ${clean(item.title) || 'Без названия'}`,
          '',
          clean(item.description) || 'Описание отсутствует.',
          '',
          `- Приоритет: ${priorityLabels[item.priority]}`,
          `- Уверенность: ${Math.round(item.confidence * 100)}%`,
          `- Требует уточнения: ${item.needsClarification ? 'да' : 'нет'}`,
          `- Источники: ${item.sourceSegmentIds.length ? item.sourceSegmentIds.map(id => `фрагмент ${id + 1}`).join(', ') : 'не указаны'}`,
        ].join('\n')),
      ].join('\n\n')).join('\n\n')
    : 'Требования не обнаружены.'

  const scenarios = analysis.userScenarios.length
    ? analysis.userScenarios.map((scenario, index) => [
        `### ${index + 1}. ${clean(scenario.title) || 'Без названия'}`,
        '',
        clean(scenario.description) || 'Описание отсутствует.',
        '',
        `- Уверенность: ${Math.round(scenario.confidence * 100)}%`,
        `- Источники: ${scenario.sourceSegmentIds.length ? scenario.sourceSegmentIds.map(id => `фрагмент ${id + 1}`).join(', ') : 'не указаны'}`,
      ].join('\n')).join('\n\n')
    : 'Пользовательские сценарии не обнаружены.'

  const transcript = transcription.segments.length
    ? transcription.segments.map(segment =>
        `**${segment.id + 1}. ${formatTime(segment.start)}-${formatTime(segment.end)}**  \n${clean(segment.text)}`).join('\n\n')
    : clean(transcription.text) || 'Транскрипция отсутствует.'

  return [
    '# Техническое задание по итогам встречи',
    '',
    `Исходный файл: ${clean(result.filename)}`,
    `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
    '',
    '## Краткое описание',
    '',
    clean(analysis.summary) || 'Краткое описание отсутствует.',
    '',
    listSection('Роли пользователей', analysis.roles),
    '## Требования',
    '',
    requirementText,
    '',
    '## Пользовательские сценарии',
    '',
    scenarios,
    '',
    listSection('Ограничения', analysis.constraints),
    listSection('Условия', analysis.conditions),
    listSection('Открытые вопросы', analysis.openQuestions),
    listSection('Договоренности', analysis.agreements),
    listSection('Противоречия', analysis.contradictions),
    '## Транскрипция',
    '',
    transcript,
    '',
  ].join('\n')
}

export function exportTz(result: AnalyzeResponse, requirements: Requirement[]): void {
  const markdown = buildSpecificationMarkdown(result, requirements)
  const blob = new Blob([`\uFEFF${markdown}`], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tz-${result.filename.replace(/\.[^.]+$/, '')}-${formatDate()}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
