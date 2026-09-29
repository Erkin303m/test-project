import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  checkAccount,
  getSettings,
  getStateInstance,
  sendMessage,
} from './api/greenApi'
import type { ParsedNotification } from './api/notifications'
import type { Credentials, InstanceSettings, InstanceState, Message } from './api/types'
import { Avatar } from './components/Avatar'
import { Composer } from './components/Composer'
import { LoginScreen } from './components/LoginScreen'
import { MessageList } from './components/MessageList'
import { NewChatDialog } from './components/NewChatDialog'
import { Sidebar } from './components/Sidebar'
import { useNotifications } from './hooks/useNotifications'
import { formatPhone } from './lib/format'
import type { Recipient } from './lib/recipient'
import {
  addChat,
  appendOutgoing,
  applyNotification,
  createWorkspace,
  patchMessage,
  replaceOutgoingId,
  selectChat,
  type Workspace,
} from './lib/reducer'
import { credentialsStorage, workspaceStorage } from './lib/storage'

interface Session {
  credentials: Credentials
  settings: InstanceSettings | null
  state: InstanceState
}

const EMPTY_CREDENTIALS: Credentials = {
  apiUrl: '',
  idInstance: '',
  apiTokenInstance: '',
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [workspace, setWorkspace] = useState<Workspace>(createWorkspace)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const restoredFor = useRef<string | null>(null)

  const connect = useCallback(async (credentials: Credentials, options?: { silent?: boolean }) => {
    const [settings, state] = await Promise.all([
      getSettings(credentials).catch(() => null),
      getStateInstance(credentials).catch(() => null),
    ])

    if (!settings) {
      if (options?.silent) return
      throw new Error('GREEN-API не вернул настройки инстанса. Проверьте учётные данные.')
    }

    const instanceState: InstanceState = state?.stateInstance ?? 'notAuthorized'
    credentialsStorage.save(credentials)
    setSession({ credentials, settings, state: instanceState })

    // Переписка хранится отдельно для каждого инстанса.
    restoredFor.current = credentials.idInstance
    setWorkspace(workspaceStorage.load<Workspace>(credentials.idInstance) ?? createWorkspace())

    const notes: string[] = []
    if (instanceState !== 'authorized') {
      notes.push('Инстанс не авторизован в Telegram — отправка сообщений не сработает.')
    }
    if (settings.webhookUrl) {
      notes.push(
        'В настройках инстанса указан webhookUrl — приём уведомлений по HTTP API отключён. Очистите поле в кабинете GREEN-API.',
      )
    }
    setBanner(notes.length ? notes.join(' ') : null)
  }, [])

  // Восстанавливаем сохранённый инстанс при первом рендере.
  useEffect(() => {
    const saved = credentialsStorage.load<Credentials>()
    if (!saved?.idInstance || !saved?.apiTokenInstance) {
      setRestoring(false)
      return
    }
    void connect(saved, { silent: true })
      .catch(() => undefined)
      .finally(() => setRestoring(false))
  }, [connect])

  // Сохраняем переписку.
  useEffect(() => {
    const idInstance = session?.credentials.idInstance
    if (!idInstance) return
    workspaceStorage.save(idInstance, workspace)
  }, [workspace, session?.credentials.idInstance])

  const handleNotification = useCallback((notification: ParsedNotification) => {
    setWorkspace((current) => applyNotification(current, notification))
  }, [])

  const connection = useNotifications({
    credentials: session?.credentials ?? null,
    enabled: Boolean(session) && !banner?.includes('webhookUrl'),
    onNotification: handleNotification,
    onError: (error) => setBanner((current) => current ?? error.message),
  })

  const handleLogout = useCallback(() => {
    const idInstance = session?.credentials.idInstance
    if (idInstance) workspaceStorage.clear(idInstance)
    credentialsStorage.clear()
    restoredFor.current = null
    setSession(null)
    setWorkspace(createWorkspace())
    setBanner(null)
  }, [session?.credentials.idInstance])

  const handleSend = useCallback(
    async (text: string) => {
      if (!session) return
      const chatId = workspace.activeChatId
      if (!chatId) return

      const tempId = `temp:${crypto.randomUUID()}`
      setWorkspace((current) => appendOutgoing(current, chatId, text, tempId))

      try {
        const { idMessage } = await sendMessage(session.credentials, chatId, text)
        setWorkspace((current) => replaceOutgoingId(current, tempId, idMessage))
      } catch (error) {
        setWorkspace((current) =>
          patchMessage(current, tempId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Сообщение не отправлено',
          }),
        )
      }
    },
    [session, workspace.activeChatId],
  )

  const handleCreateChat = useCallback(
    async (recipient: Recipient) => {
      if (!session) return

      const lookup =
        recipient.kind === 'phone'
          ? ({ kind: 'phone', value: recipient.value } as const)
          : ({ kind: 'username', value: recipient.value } as const)

      const result = await checkAccount(session.credentials, lookup)
      if (result.reason) throw new Error(result.reason)
      if (result.data?.reason) {
        throw new Error(
          result.data.reason === 'rate_limit_exceeded'
            ? 'Telegram временно ограничил частоту поиска аккаунтов. Попробуйте позже.'
            : result.data.reason,
        )
      }
      if (!result.exist || !result.chatId) {
        throw new Error('Аккаунт Telegram с таким номером или именем не найден.')
      }

      const username = result.username || (recipient.kind === 'username' ? recipient.value : undefined)
      const now = Math.floor(Date.now() / 1000)

      setWorkspace((current) =>
        addChat(current, {
          chatId: result.chatId as string,
          title: username ?? formatPhone(recipient.value),
          phone: recipient.kind === 'phone' ? recipient.value : undefined,
          username,
          createdAt: now,
          updatedAt: now,
        }),
      )
      setDialogOpen(false)
    },
    [session],
  )

  const activeChat = useMemo(
    () => workspace.chats.find((chat) => chat.chatId === workspace.activeChatId) ?? null,
    [workspace.chats, workspace.activeChatId],
  )

  const activeMessages = useMemo(() => {
    if (!activeChat) return []
    return workspace.messages
      .filter((message) => message.chatId === activeChat.chatId)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [workspace.messages, activeChat])

  const lastMessages = useMemo(() => {
    const map = new Map<string, Message>()
    for (const message of workspace.messages) {
      const current = map.get(message.chatId)
      if (!current || message.timestamp >= current.timestamp) {
        map.set(message.chatId, message)
      }
    }
    return map
  }, [workspace.messages])

  if (restoring) {
    return (
      <div className="boot">
        <span className="spinner" aria-hidden="true" />
        <p>Подключаемся к GREEN-API…</p>
      </div>
    )
  }

  if (!session) {
    const saved = credentialsStorage.load<Credentials>()
    return (
      <LoginScreen initial={saved ?? EMPTY_CREDENTIALS} onSubmit={(c) => connect(c)} />
    )
  }

  return (
    <div className="layout">
      <Sidebar
        chats={workspace.chats}
        lastMessages={lastMessages}
        activeChatId={workspace.activeChatId}
        connection={connection}
        instanceLabel={session.credentials.idInstance}
        onSelect={(chatId) => setWorkspace((current) => selectChat(current, chatId))}
        onNewChat={() => setDialogOpen(true)}
        onLogout={handleLogout}
      />

      <main className="chat">
        {banner && (
          <div className="alert alert--warning chat__banner" role="status">
            <span>{banner}</span>
            <button type="button" className="icon-button" onClick={() => setBanner(null)} aria-label="Скрыть">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {!activeChat ? (
          <div className="chat__placeholder">
            <span className="brand-mark brand-mark--lg brand-mark--telegram" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" role="presentation">
                <path
                  d="M21.9 4.3 18.6 19.4c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.6 13.1 2 11.6c-1-.3-1-1 .2-1.5l17-6.6c.8-.3 1.5.2 1.3 1.5z"
                  fill="currentColor"
                />
              </svg>
            </span>
              <h2>Выберите чат или начните новый</h2>
              <p>
                Отправка — методом <code>SendMessage</code>, приём — через{' '}
                <code>ReceiveNotification</code> и <code>DeleteNotification</code>.
              </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setDialogOpen(true)}
            >
              Новый чат
            </button>
          </div>
        ) : (
          <>
            <header className="chat__header">
              <Avatar chatId={activeChat.chatId} title={activeChat.title} size={42} />
              <div className="chat__header-text">
                <h2 className="chat__title">{activeChat.title}</h2>
                <p className="chat__subtitle">
                  {activeChat.phone ? formatPhone(activeChat.phone) : `chatId: ${activeChat.chatId}`}
                </p>
              </div>
            </header>

            <MessageList messages={activeMessages} chatTitle={activeChat.title} />
            <Composer
              onSend={(text) => void handleSend(text)}
              placeholder="Напишите сообщение… (Enter — отправить, Shift+Enter — новая строка)"
            />
          </>
        )}
      </main>

      {dialogOpen && (
        <NewChatDialog onClose={() => setDialogOpen(false)} onCreate={handleCreateChat} />
      )}
    </div>
  )
}
