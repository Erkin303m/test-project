import type { Message } from '../api/types'
import { formatTime } from '../lib/format'
import { StatusTicks } from './StatusTicks'

interface Props {
  message: Message
  isLastInGroup: boolean
}

export function MessageBubble({ message, isLastInGroup }: Props) {
  const isOut = message.direction === 'out'

  return (
    <div
      className={[
        'bubble-row',
        isOut ? 'bubble-row--out' : 'bubble-row--in',
        isLastInGroup ? 'bubble-row--last' : 'bubble-row--stacked',
      ].join(' ')}
    >
      <div className="bubble">
        <span className="bubble__text">{message.text}</span>
        <span className="bubble__meta">
          <time className="bubble__time" dateTime={new Date(message.timestamp * 1000).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
          {isOut && <StatusTicks status={message.status} />}
        </span>
      </div>
      {message.error && <p className="bubble__error">{message.error}</p>}
    </div>
  )
}
