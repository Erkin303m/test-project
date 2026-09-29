import { useEffect, useMemo, useRef } from 'react'

import type { Message } from '../api/types'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: Message[]
  chatTitle: string
}

/** Сообщения одного автора подряд склеиваются в группу (как в Telegram). */
const GROUP_WINDOW_SECONDS = 300

function dayKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toDateString()
}

export function MessageList({ messages, chatTitle }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const items = useMemo(
    () =>
      messages.map((message, index) => {
        const previous = messages[index - 1]
        const next = messages[index + 1]
        const newDay = !previous || dayKey(previous.timestamp) !== dayKey(message.timestamp)
        const continuesNext =
          !!next &&
          next.direction === message.direction &&
          next.timestamp - message.timestamp < GROUP_WINDOW_SECONDS

        return { message, showDate: newDay, isLastInGroup: !continuesNext }
      }),
    [messages],
  )

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="messages messages--empty">
        <div className="empty-state">
          <p className="empty-state__title">Сообщений пока нет</p>
          <p className="empty-state__hint">
            Напишите первым — сообщение уйдёт в {chatTitle} через GREEN-API.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="messages"
      onScroll={(event) => {
        const element = event.currentTarget
        stickToBottomRef.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 80
      }}
    >
      <div className="messages__inner">
        {items.map(({ message, showDate, isLastInGroup }) => (
          <div key={message.id}>
            {showDate && (
              <div className="date-chip">
                {new Date(message.timestamp * 1000).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })}
              </div>
            )}
            <MessageBubble message={message} isLastInGroup={isLastInGroup} />
          </div>
        ))}
        <div ref={bottomRef} className="messages__anchor" />
      </div>
    </div>
  )
}
