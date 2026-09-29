import { useEffect, useRef, useState } from 'react'

import { deleteNotification, GreenApiError, receiveNotification } from '../api/greenApi'
import { parseNotification, type ParsedNotification } from '../api/notifications'
import type { Credentials } from '../api/types'

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'error'

/** Документация допускает receiveTimeout от 5 до 60 секунд. */
const RECEIVE_TIMEOUT_SECONDS = 25

const MAX_BACKOFF_MS = 30_000

interface Options {
  credentials: Credentials | null
  enabled: boolean
  onNotification: (notification: ParsedNotification) => void
  onError: (error: Error) => void
}

/**
 * Цикл приёма уведомлений по технологии HTTP API:
 * ReceiveNotification (long-poll) -> обработка -> DeleteNotification.
 *
 * Бэкенд не нужен: GREEN-API отдаёт уведомления прямо в браузер,
 * а CORS-заголовки на api.green-api.com разрешают кросс-доменные запросы.
 */
export function useNotifications({
  credentials,
  enabled,
  onNotification,
  onError,
}: Options): ConnectionState {
  const [state, setState] = useState<ConnectionState>('idle')

  // Колбэки храним в ref, чтобы перезапуск цикла не зависел от рендеров.
  const notifyRef = useRef(onNotification)
  const errorRef = useRef(onError)

  useEffect(() => {
    notifyRef.current = onNotification
    errorRef.current = onError
  })

  useEffect(() => {
    if (!enabled || !credentials) {
      setState('idle')
      return
    }

    const controller = new AbortController()
    const { signal } = controller
    let backoff = 0
    let stopped = false

    setState('connecting')

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
      })

    const run = async () => {
      while (!stopped && !signal.aborted) {
        try {
          const envelope = await receiveNotification(
            credentials,
            RECEIVE_TIMEOUT_SECONDS,
            signal,
          )
          if (signal.aborted) return

          if (envelope) {
            notifyRef.current(parseNotification(envelope.body))
            try {
              await deleteNotification(credentials, envelope.receiptId, signal)
            } catch (error) {
              // Не подтверждённое уведомление вернётся в очередь — это не критично.
              if (error instanceof DOMException && error.name === 'AbortError') return
            }
          }

          backoff = 0
          setState('online')
        } catch (error) {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
            return
          }

          // Ошибка авторизации не исправится повтором — ждать бессмысленно.
          if (error instanceof GreenApiError && error.isAuthError) {
            stopped = true
            setState('error')
            errorRef.current(error)
            return
          }

          setState('error')
          errorRef.current(
            error instanceof Error ? error : new Error('Неизвестная ошибка приёма уведомлений'),
          )

          backoff = backoff ? Math.min(backoff * 2, MAX_BACKOFF_MS) : 1_000
          await wait(backoff)
        }
      }
    }

    void run()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [credentials, enabled])

  return state
}
