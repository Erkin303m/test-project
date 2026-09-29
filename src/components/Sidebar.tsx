import type { Chat, Message } from '../api/types'
import type { ConnectionState } from '../hooks/useNotifications'
import { formatChatTime, formatPhone } from '../lib/format'
import { Avatar } from './Avatar'

interface Props {
  chats: Chat[]
  lastMessages: Map<string, Message>
  activeChatId: string | null
  connection: ConnectionState
  instanceLabel: string
  onSelect: (chatId: string) => void
  onNewChat: () => void
  onLogout: () => void
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: 'Не подключено',
  connecting: 'Подключение…',
  online: 'На связи',
  error: 'Нет связи',
}

export function Sidebar({
  chats,
  lastMessages,
  activeChatId,
  connection,
  instanceLabel,
  onSelect,
  onNewChat,
  onLogout,
}: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__identity">
          <span className="brand-mark brand-mark--sm" aria-hidden="true">
            M
          </span>
          <div className="sidebar__identity-text">
            <span className="sidebar__instance">{instanceLabel}</span>
            <span className={`status status--${connection}`}>
              <span className="status__dot" aria-hidden="true" />
              {CONNECTION_LABEL[connection]}
            </span>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onNewChat} aria-label="Новый чат">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="sidebar__list">
        {chats.length === 0 && (
          <p className="sidebar__empty">
            Чатов пока нет.
            <br />
            Нажмите «+», чтобы начать переписку.
          </p>
        )}

        {chats.map((chat) => {
          const last = lastMessages.get(chat.chatId)
          const preview = last
            ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}`
            : 'Нет сообщений'

          return (
            <button
              key={chat.chatId}
              type="button"
              className={`chat-item${chat.chatId === activeChatId ? ' chat-item--active' : ''}`}
              onClick={() => onSelect(chat.chatId)}
            >
              <Avatar chatId={chat.chatId} title={chat.title} />
              <span className="chat-item__body">
                <span className="chat-item__title">
                  {chat.title}
                  {last && <span className="chat-item__time">{formatChatTime(last.timestamp)}</span>}
                </span>
                <span className="chat-item__preview">{preview}</span>
                {chat.phone && <span className="chat-item__phone">{formatPhone(chat.phone)}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <footer className="sidebar__footer">
        <button type="button" className="link-button" onClick={onLogout}>
          Выйти
        </button>
      </footer>
    </aside>
  )
}
