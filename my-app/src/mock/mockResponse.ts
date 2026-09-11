// src/mock/mockResponse.ts
import type { AnalyzeResponse } from '../types/contract'

export const mockResponse: AnalyzeResponse = {
  status: 'success',
  filename: 'meeting.mp3',
  transcription: {
    text: 'Нам нужна система авторизации через корпоративный аккаунт. Сотрудники должны входить по логину и паролю. Также нужен личный кабинет где можно менять данные профиля. Важно чтобы система работала на мобильных устройствах. Пароль должен сбрасываться через email.',
    segments: [
      { id: 0, start: 0.0,  end: 5.2,  text: 'Нам нужна система авторизации через корпоративный аккаунт.' },
      { id: 1, start: 5.2,  end: 10.1, text: 'Сотрудники должны входить по логину и паролю.' },
      { id: 2, start: 10.1, end: 17.4, text: 'Также нужен личный кабинет где можно менять данные профиля.' },
      { id: 3, start: 17.4, end: 24.0, text: 'Важно чтобы система работала на мобильных устройствах.' },
      { id: 4, start: 24.0, end: 30.5, text: 'Пароль должен сбрасываться через email.' },
    ],
  },
  analysis: {
    summary: 'Требуется корпоративная система авторизации с личным кабинетом сотрудника, поддержкой мобильных устройств и восстановлением пароля через email.',
    roles: ['Сотрудник', 'Администратор'],
    requirements: [
      {
        id: 'req-1',
        title: 'Авторизация',
        role: 'Сотрудник',
        description: 'Пользователь должен иметь возможность войти в систему через корпоративную учётную запись по логину и паролю.',
        sourceSegmentIds: [0, 1],
        priority: 'medium',
        confidence: 0.8,
        needsClarification: false,
      },
      {
        id: 'req-2',
        title: 'Личный кабинет',
        role: 'Сотрудник',
        description: 'Пользователь должен иметь доступ к личному кабинету с возможностью редактирования данных профиля.',
        sourceSegmentIds: [2],
        priority: 'medium',
        confidence: 0.8,
        needsClarification: false,
      },
      {
        id: 'req-3',
        title: 'Мобильная поддержка',
        role: 'Сотрудник',
        description: 'Система должна корректно работать на мобильных устройствах.',
        sourceSegmentIds: [3],
        priority: 'medium',
        confidence: 0.8,
        needsClarification: true,
      },
      {
        id: 'req-4',
        title: 'Восстановление пароля',
        role: 'Сотрудник',
        description: 'Пользователь должен иметь возможность сбросить пароль через email.',
        sourceSegmentIds: [4],
        priority: 'medium',
        confidence: 0.8,
        needsClarification: false,
      },
    ],
    contradictions: [],
    userScenarios: [
      { title: 'Вход', description: 'Сотрудник входит в систему через корпоративный аккаунт', confidence: 0.8, sourceSegmentIds: [0, 1] },
      { title: 'Профиль', description: 'Сотрудник редактирует данные профиля в личном кабинете', confidence: 0.8, sourceSegmentIds: [2] },
      { title: 'Восстановление', description: 'Сотрудник восстанавливает пароль через email', confidence: 0.8, sourceSegmentIds: [4] },
    ],
    constraints: [
      'Система должна поддерживать мобильные устройства',
      'Авторизация только через корпоративные учётные записи',
    ],
    conditions: [
      'Наличие корпоративного email у каждого сотрудника',
      'Доступ к интернету для работы с системой',
    ],
    openQuestions: [
      'Какие именно мобильные платформы нужно поддерживать — iOS, Android или обе?',
      'Нужна ли двухфакторная аутентификация?',
      'Какой срок действия сессии после входа?',
    ],
    agreements: [
      'Авторизация реализуется через корпоративный SSO',
      'Восстановление пароля — только через email',
    ],
  },
}
