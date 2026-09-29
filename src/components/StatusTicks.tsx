import type { MessageStatus } from '../api/types'

interface Props {
  status: MessageStatus
}

const CHECK = 'M1.5 5.4 L4 7.9 L9 2.9'

/** Галочки в стиле Telegram: одна — отправлено, две — доставлено/прочитано. */
export function StatusTicks({ status }: Props) {
  if (status === 'failed' || status === 'noAccount' || status === 'notInGroup') {
    return (
      <svg className="ticks ticks--error" viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 3.4 V6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="6" cy="8.8" r="0.8" fill="currentColor" />
      </svg>
    )
  }

  if (status === 'pending') {
    return (
      <svg className="ticks ticks--pending" viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M6 3.4 V6 L7.7 7.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (status === 'delivered' || status === 'read') {
    return (
      <svg
        className={`ticks ticks--${status}`}
        viewBox="0 0 17 12"
        width="18"
        height="12"
        aria-hidden="true"
      >
        <path
          d={CHECK}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 5.4 L10.5 7.9 L15.5 2.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg className="ticks ticks--sent" viewBox="0 0 12 12" width="14" height="12" aria-hidden="true">
      <path
        d={CHECK}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
