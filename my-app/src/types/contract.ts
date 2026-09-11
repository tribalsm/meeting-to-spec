// src/types/contract.ts

// ------------------------------------------------------------------
// Транскрипция
// ------------------------------------------------------------------

export interface TranscriptSegment {
  id: number;           // число, не строка — как сказал бэк
  start: number;        // секунды, float
  end: number;
  text: string;
}

export interface Transcription {
  text: string;         // полный текст всей транскрипции
  segments: TranscriptSegment[];
}

// ------------------------------------------------------------------
// Требование
// ------------------------------------------------------------------

export interface Requirement {
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  id: string;                      // генерируем на фронте при создании нового
  title: string;                   // название функции/фичи
  role: string;                    // роль пользователя
  description: string;             // текст требования
  sourceSegmentIds: number[];      // ссылки на сегменты транскрипции (числа)
  needsClarification: boolean;     // флаг «требует уточнения»
}

// ------------------------------------------------------------------
// Анализ (вложен в ответ бэка)
// ------------------------------------------------------------------

export interface UserScenario {
  title: string;
  description: string;
  confidence: number;
  sourceSegmentIds: number[];
}

export interface Analysis {
  summary: string;
  roles: string[];
  requirements: Requirement[];
  userScenarios: UserScenario[];     // camelCase — запомни регистр!
  constraints: string[];
  conditions: string[];
  openQuestions: string[];     // camelCase!
  agreements: string[];
  contradictions: string[];
}

// ------------------------------------------------------------------
// Корневой ответ от POST /api/analyze
// ------------------------------------------------------------------

export interface AnalyzeResponse {
  status: string;          // "success"
  filename: string;
  transcription: Transcription;
  analysis: Analysis;
}

// ------------------------------------------------------------------
// Ошибка от бэка
// ------------------------------------------------------------------

export interface ApiError {
  detail: string;          // {"detail": "..."} — как сказал бэк
}

// ------------------------------------------------------------------
// Состояния приложения
// ------------------------------------------------------------------

export type AppStatus = 'idle' | 'loading' | 'error' | 'success';

// ------------------------------------------------------------------
// Локальное состояние редактора (пункт 4)
// Расширяет Requirement — добавляем поле для UI
// ------------------------------------------------------------------

export interface RequirementDraft extends Requirement {
  isNew?: boolean;    // флаг для нового несохранённого требования
}
