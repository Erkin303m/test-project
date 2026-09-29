import type { ParsedNotification } from '../api/notifications'
import type { Chat, Message, MessageStatus } from '../api/types'

export interface Workspace {
  chats: Chat[]
  messages: Message[]
  activeChatId: string | null
}

export function createWorkspace(): Workspace {
  return { chats: [], messages: [], activeChatId: null }
}

function sortChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
}

function upsertChat(ws: Workspace, chat: Chat): Workspace {
  const existing = ws.chats.find((item) => item.chatId === chat.chatId)
  if (existing) {
    return {
      ...ws,
      chats: sortChats(
        ws.chats.map((item) =>
          item.chatId === chat.chatId
              ? {
                  ...item,
                  // Не затираем название, если новый вариант хуже прежнего.
                  title: chat.title || item.title,
                  phone: chat.phone ?? item.phone,
                  username: chat.username ?? item.username,
                  updatedAt: Math.max(item.updatedAt, chat.updatedAt),
                }
            : item,
        ),
      ),
    }
  }
  return { ...ws, chats: sortChats([chat, ...ws.chats]) }
}

function appendMessage(ws: Workspace, message: Message): Workspace {
  if (ws.messages.some((item) => item.id === message.id)) return ws
  return { ...ws, messages: [...ws.messages, message] }
}

export function patchMessage(
  ws: Workspace,
  id: string,
  patch: Partial<Omit<Message, 'id' | 'chatId'>>,
): Workspace {
  let changed = false
  const messages = ws.messages.map((message) => {
    if (message.id !== id) return message
    changed = true
    return { ...message, ...patch }
  })
  return changed ? { ...ws, messages } : ws
}

export function selectChat(ws: Workspace, chatId: string | null): Workspace {
  return { ...ws, activeChatId: chatId }
}

export function addChat(ws: Workspace, chat: Chat, activate = true): Workspace {
  const next = upsertChat(ws, chat)
  return activate ? { ...next, activeChatId: chat.chatId } : next
}

/** Оптимистично показывает отправленное сообщение до ответа GREEN-API. */
export function appendOutgoing(
  ws: Workspace,
  chatId: string,
  text: string,
  tempId: string,
): Workspace {
  return appendMessage(ws, {
    id: tempId,
    chatId,
    text,
    direction: 'out',
    timestamp: Math.floor(Date.now() / 1000),
    status: 'pending',
  })
}

/** Статусы упорядочены по «прогрессу»: назад по шкале не откатываемся. */
const STATUS_RANK: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
  noAccount: 4,
  notInGroup: 4,
}

/** Заменяет временный id на реальный `idMessage` из ответа SendMessage. */
export function replaceOutgoingId(ws: Workspace, tempId: string, realId: string): Workspace {
  if (ws.messages.some((message) => message.id === realId)) {
    return patchMessage(ws, tempId, { status: 'sent' })
  }
  let changed = false
  const messages = ws.messages.map((message) => {
    if (message.id !== tempId) return message
    changed = true
    // Статус мог прийти раньше ответа SendMessage — не откатываем его в sent.
    const status: MessageStatus =
      STATUS_RANK[message.status] > STATUS_RANK.sent ? message.status : 'sent'
    return { ...message, id: realId, status }
  })
  return changed ? { ...ws, messages } : ws
}

const STATUS_ERRORS: Partial<Record<MessageStatus, string>> = {
  failed: 'Сообщение не отправлено',
  noAccount: 'У получателя нет аккаунта Telegram',
  notInGroup: 'Отправитель не состоит в группе',
}

export function applyNotification(ws: Workspace, notification: ParsedNotification): Workspace {
  switch (notification.kind) {
    case 'incoming': {
      const known = ws.chats.some((chat) => chat.chatId === notification.chatId)
      const next = known
        ? ws
        : upsertChat(ws, {
            chatId: notification.chatId,
            title: notification.title || notification.phone || notification.chatId,
            phone: notification.phone,
            createdAt: notification.timestamp,
            updatedAt: notification.timestamp,
          })

      return appendMessage(next, {
        id: notification.idMessage,
        chatId: notification.chatId,
        text: notification.text,
        direction: 'in',
        timestamp: notification.timestamp,
        status: 'delivered',
      })
    }

    case 'outgoing': {
      const existing = ws.messages.find(
        (message) => message.id === notification.idMessage && message.chatId === notification.chatId,
      )
      if (existing) {
        return patchMessage(ws, existing.id, { text: notification.text, status: 'sent' })
      }
      return appendMessage(ws, {
        id: notification.idMessage,
        chatId: notification.chatId,
        text: notification.text,
        direction: 'out',
        timestamp: notification.timestamp,
        status: 'sent',
      })
    }

    case 'status': {
      const error = STATUS_ERRORS[notification.status]
      const patch = {
        status: notification.status,
        error: error ?? notification.description,
      }

      if (ws.messages.some((message) => message.id === notification.idMessage)) {
        return patchMessage(ws, notification.idMessage, patch)
      }

      // Telegram подтверждает доставку быстрее, чем приходит ответ
      // SendMessage, поэтому статус может прийти на ещё не заменённый
      // временный id. Берём последнее неотправленное сообщение чата.
      const pending = [...ws.messages]
        .reverse()
        .find(
          (message) =>
            message.chatId === notification.chatId &&
            message.direction === 'out' &&
            (message.status === 'pending' || message.status === 'sent'),
        )

      return pending ? patchMessage(ws, pending.id, patch) : ws
    }

    default:
      return ws
  }
}
