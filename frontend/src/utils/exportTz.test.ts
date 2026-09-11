import { describe, expect, it } from 'vitest'
import { buildSpecificationMarkdown } from './exportTz'
import { mockResponse } from '../mock/mockResponse'

describe('technical specification export', () => {
  it('creates a readable document with roles, evidence and transcript', () => {
    const markdown = buildSpecificationMarkdown(mockResponse, mockResponse.analysis.requirements)
    expect(markdown).toContain('# Техническое задание по итогам встречи')
    expect(markdown).toContain('## Требования')
    expect(markdown).toContain('### Сотрудник')
    expect(markdown).toContain('Источники: фрагмент 1, фрагмент 2')
    expect(markdown).toContain('## Пользовательские сценарии')
    expect(markdown).toContain('## Транскрипция')
    expect(markdown).toContain('**1. 0:00-0:05**')
  })

  it('exports current user edits', () => {
    const edited = [{ ...mockResponse.analysis.requirements[0], title: 'Исправленное требование' }]
    expect(buildSpecificationMarkdown(mockResponse, edited)).toContain('Исправленное требование')
  })
})
