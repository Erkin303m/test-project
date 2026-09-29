import type {
  AccountLookup,
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  InstanceSettings,
  NotificationBody,
  SendMessageResponse,
  StateInstanceResponse,
} from './types'

/**
 * Универсальный адрес. Для Telegram документация показывает
 * персональный `apiUrl` вида `https://<id>.api.green-api.com`,
 * поэтому его лучше скопировать из кабинета (см. поле в настройках входа).
 */
export const DEFAULT_API_URL = 'https://api.green-api.com'

/** Документированный лимит Telegram SendMessage — 4096 символов. */
export const MAX_MESSAGE_LENGTH = 4096

export class GreenApiError extends Error {
  readonly status: number
  readonly method: string

  constructor(method: string, status: number, message: string) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
    this.method = method
  }

  /** Некорректные учётные данные или адрес apiUrl. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  /**
   * 469 — ограничение на стороне Telegram, а не GREEN-API. Возникает при
   * частом поиске аккаунтов: Telegram не раскрывает срок, ждать придётся
   * несколько часов. Отдельный флаг помогает не путать это с 429.
   */
  get isMessengerRateLimited(): boolean {
    return this.status === 469
  }
}

export function normalizeApiUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

/**
 * GREEN-API ограничивает частоту вызовов в расчёте на инстанс
 * (см. https://green-api.com/telegram/docs/api/ratelimiter/). Часть методов имеет
 * лимит 1 запрос в секунду, поэтому добавляем локальный троттлинг,
 * чтобы не получать 429 из-за двух кликов подряд.
 */
const METHOD_INTERVAL_MS: Record<string, number> = {
  getSettings: 1100,
  setSettings: 1100,
  getStateInstance: 1100,
  getAccountSettings: 1100,
  checkAccount: 120,
}

const lastCallAt = new Map<string, number>()

async function throttle(method: string): Promise<void> {
  const interval = METHOD_INTERVAL_MS[method]
  if (!interval) return

  const key = `${method}`
  const last = lastCallAt.get(key) ?? 0
  const wait = last + interval - Date.now()
  if (wait > 0) {
    await sleep(wait)
  }
  lastCallAt.set(key, Date.now())
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(
  credentials: Credentials,
  method: string,
  query?: RequestOptions['query'],
): string {
  const base = normalizeApiUrl(credentials.apiUrl) || DEFAULT_API_URL
  const url = `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}`

  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `HTTP ${response.status}`

  try {
    const parsed = JSON.parse(text) as { message?: string; reason?: string }
    return parsed.message ?? parsed.reason ?? text
  } catch {
    return text
  }
}

async function request<T>(
  credentials: Credentials,
  method: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, signal } = options
  await throttle(method)

  const init: RequestInit = { method: 'GET', signal }
  if (body !== undefined) {
    init.method = 'POST'
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }

  let response: Response
  try {
    response = await fetch(buildUrl(credentials, method, query), init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GreenApiError(
      method,
      0,
      'Не удалось соединиться с GREEN-API. Проверьте адрес API и подключение к сети.',
    )
  }

  if (!response.ok) {
    throw new GreenApiError(
      method,
      response.status,
      await readErrorMessage(response),
    )
  }

  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new GreenApiError(method, response.status, 'GREEN-API вернул некорректный ответ.')
  }
}

/** Проверяет учётные данные. Документация: /telegram/docs/api/account/GetSettings/. */
export function getSettings(credentials: Credentials, signal?: AbortSignal) {
  return request<InstanceSettings>(credentials, 'getSettings', { signal })
}

/** Состояние авторизации инстанса. Документация: /telegram/docs/api/account/GetStateInstance/. */
export function getStateInstance(credentials: Credentials, signal?: AbortSignal) {
  return request<StateInstanceResponse>(credentials, 'getStateInstance', { signal })
}

/**
 * Резолвит номер телефона или `@username` в Telegram `chatId`.
 * Документация: /telegram/docs/api/service/CheckAccount/.
 *
 * Метод жёстко троттлится со стороны Telegram: 10 req/s у GREEN-API плюс
 * собственные ограничения на аккаунт (HTTP 469). Поэтому дальше отправляем
 * по полученному `chatId`, а не по номеру/имени.
 */
export function checkAccount(
  credentials: Credentials,
  lookup: AccountLookup,
  signal?: AbortSignal,
) {
  const body =
    lookup.kind === 'phone'
      ? { phoneNumber: Number(lookup.value) }
      : { username: lookup.value }

  return request<CheckAccountResponse>(credentials, 'checkAccount', { body, signal })
}

/** Отправляет текстовое сообщение. Документация: /telegram/docs/api/sending/SendMessage/. */
export function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
) {
  return request<SendMessageResponse>(credentials, 'sendMessage', {
    body: { chatId, message },
    signal,
  })
}

/**
 * Забирает одно уведомление из очереди входящих (long-poll).
 * Документация: /telegram/docs/api/receiving/technology-http-api/ReceiveNotification/.
 *
 * Возвращает `null`, если за `receiveTimeout` секунд ничего не пришло
 * (GREEN-API отвечает пустым телом) либо если очередь пуста.
 */
export async function receiveNotification(
  credentials: Credentials,
  receiveTimeout: number,
  signal?: AbortSignal,
): Promise<{ receiptId: number; body: NotificationBody } | null> {
  const url = buildUrl(credentials, 'receiveNotification', {
    receiveTimeout: Math.min(60, Math.max(5, Math.round(receiveTimeout))),
  })

  const response = await fetch(url, { method: 'GET', signal })
  if (!response.ok) {
    throw new GreenApiError(
      'receiveNotification',
      response.status,
      await readErrorMessage(response),
    )
  }

  const text = await response.text()
  if (!text.trim()) return null

  try {
    const parsed = JSON.parse(text) as { receiptId?: number; body?: NotificationBody }
    if (typeof parsed.receiptId !== 'number' || !parsed.body) return null
    return { receiptId: parsed.receiptId, body: parsed.body }
  } catch {
    return null
  }
}

/**
 * Подтверждает обработку уведомления — иначе оно вернётся в очередь.
 * Документация: /telegram/docs/api/receiving/technology-http-api/DeleteNotification/.
 */
export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<DeleteNotificationResponse> {
  const base = normalizeApiUrl(credentials.apiUrl) || DEFAULT_API_URL
  const url = `${base}/waInstance${credentials.idInstance}/deleteNotification/${credentials.apiTokenInstance}/${receiptId}`

  const response = await fetch(url, { method: 'DELETE', signal })
  if (!response.ok) {
    throw new GreenApiError(
      'deleteNotification',
      response.status,
      await readErrorMessage(response),
    )
  }
  const text = await response.text()
  if (!text) return { result: true, reason: '' }
  return JSON.parse(text) as DeleteNotificationResponse
}
