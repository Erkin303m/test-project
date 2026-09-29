import type { MessageStatus, NotificationBody } from './types'

export type ParsedNotification =
  | {
      kind: 'incoming'
      chatId: string
      idMessage: string
      text: string
      timestamp: number
      title?: string
      phone?: string
    }
  | {
      kind: 'outgoing'
      chatId: string
      idMessage: string
      text: string
      timestamp: number
    }
  | {
      kind: 'status'
      chatId: string
      idMessage: string
      status: MessageStatus
      description?: string
    }
  | { kind: 'ignore' }

const STATUS_MAP: Record<string, MessageStatus> = {
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'noAccount',
  notInGroup: 'notInGroup',
}

function toMessageStatus(raw: string | undefined): MessageStatus | null {
  if (!raw) return null
  return STATUS_MAP[raw] ?? null
}

/**
 * Приводит уведомление из очереди входящих к внутренней модели.
 * Поддерживаются только текстовые сообщения — файлы, стикеры и прочие типы
 * намеренно игнорируются (требование задания: только текст).
 *
 * В `outgoingMessageStatus` поля `chatId` и `status` лежат на верхнем
 * уровне, а не внутри `senderData`, поэтому chatId ищется в обоих местах.
 */
export function parseNotification(body: NotificationBody): ParsedNotification {
  const sender = body.senderData
  const chatId = sender?.chatId ?? body.chatId ?? ''

  switch (body.typeWebhook) {
    case 'incomingMessageReceived': {
      const text = body.messageData?.textMessageData?.textMessage
      if (!chatId || !body.idMessage || text === undefined) return { kind: 'ignore' }
      return {
        kind: 'incoming',
        chatId,
        idMessage: body.idMessage,
        text,
        timestamp: body.timestamp,
        title: sender?.chatName || sender?.senderName || undefined,
        phone:
          sender?.senderPhoneNumber && sender.senderPhoneNumber > 0
            ? String(sender.senderPhoneNumber)
            : undefined,
      }
    }

    case 'outgoingAPIMessage':
    case 'outgoingMessage': {
      const text = body.messageData?.textMessageData?.textMessage
      if (!chatId || !body.idMessage || text === undefined) return { kind: 'ignore' }
      return {
        kind: 'outgoing',
        chatId,
        idMessage: body.idMessage,
        text,
        timestamp: body.timestamp,
      }
    }

    case 'outgoingMessageStatus': {
      const status = toMessageStatus(body.status)
      if (!chatId || !body.idMessage || !status) return { kind: 'ignore' }
      return {
        kind: 'status',
        chatId,
        idMessage: body.idMessage,
        status,
        description: body.description || undefined,
      }
    }

    default:
      return { kind: 'ignore' }
  }
}
