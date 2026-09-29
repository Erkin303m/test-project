export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type InstanceState =
  | 'notAuthorized'
  | 'authorized'
  | 'blocked'
  | 'starting'
  | 'suspended'
  | 'pendingPassword'

export interface InstanceSettings {
  wid: string
  typeInstance: string
  webhookUrl: string
  incomingWebhook: string
  outgoingWebhook: string
  outgoingMessageWebhook: string
  outgoingAPIMessageWebhook: string
  stateWebhook: string
}

export interface StateInstanceResponse {
  stateInstance: InstanceState
}

export interface CheckAccountResponse {
  exist?: boolean
  chatId?: string
  username?: string
  phoneNumber?: number
  fromCache?: boolean
  status?: boolean
  reason?: string
  data?: { status?: string; reason?: string; retryAfter?: number }
}

/**
 * Поиск аккаунта Telegram. Метод принимает либо номер телефона
 * (международный формат, без `+`), либо `@username` — строго одно из двух.
 */
export type AccountLookup =
  | { kind: 'phone'; value: string }
  | { kind: 'username'; value: string }

export interface SendMessageResponse {
  idMessage: string
}

export interface DeleteNotificationResponse {
  result: boolean
  reason: string
}

export interface InstanceData {
  idInstance: number
  wid: string
  typeInstance: string
}

export interface SenderData {
  chatId: string
  chatName?: string
  chatType?: string
  sender?: string
  senderName?: string
  senderType?: string
  senderContactName?: string
  senderPhoneNumber?: number
}

export interface MessageData {
  typeMessage?: string
  textMessageData?: { textMessage: string }
}

/**
 * Универсальное тело уведомления Telegram: набор полей зависит от
 * `typeWebhook`, поэтому здесь собраны все поля, встречающиеся в API.
 * Для `outgoingMessageStatus` поля `chatId`/`status` лежат на верхнем
 * уровне, а не внутри `senderData`.
 */
export interface NotificationBody {
  typeWebhook: string
  timestamp: number
  idMessage: string
  instanceData: InstanceData
  senderData?: SenderData
  messageData?: MessageData
  /** Приходит только в `outgoingMessageStatus`. */
  chatId?: string
  status?: string
  description?: string
}

export interface NotificationEnvelope {
  receiptId: number
  body: NotificationBody
}

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'noAccount'
  | 'notInGroup'

export interface Chat {
  chatId: string
  title: string
  phone?: string
  username?: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  chatId: string
  text: string
  direction: 'in' | 'out'
  timestamp: number
  status: MessageStatus
  error?: string
}
