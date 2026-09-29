import { avatarGradient } from '../lib/avatar'

interface Props {
  chatId: string
  title: string
  size?: number
}

/** Заголовок из номера телефона не даёт осмысленной буквы — рисуем силуэт. */
function isPhoneTitle(title: string): boolean {
  return title.startsWith('+') || /^\d+$/.test(title.trim())
}

export function Avatar({ chatId, title, size = 44 }: Props) {
  const showGlyph = isPhoneTitle(title)

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, backgroundImage: avatarGradient(chatId) }}
      aria-hidden="true"
    >
      {showGlyph ? (
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55}>
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0z" fill="currentColor" />
        </svg>
      ) : (
        <span style={{ fontSize: size * 0.4 }}>{title.trim().charAt(0).toUpperCase() || '?'}</span>
      )}
    </span>
  )
}
