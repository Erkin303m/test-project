import { normalizePhone } from '../lib/format'

/** Похоже на `phone`, но допускает `@username`. */
export function looksLikeUsername(value: string): boolean {
  return /^@[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value.trim())
}

export function normalizeUsername(value: string): string | null {
  const trimmed = value.trim()
  if (!looksLikeUsername(trimmed)) return null
  return trimmed
}

export type Recipient =
  | { kind: 'phone'; value: string; label: string }
  | { kind: 'username'; value: string; label: string }

/**
 * Разбирает то, что ввёл пользователь, в аргумент для `CheckAccount`.
 * Telegram принимает либо международный номер без `+`, либо `@username`.
 */
export function parseRecipient(value: string): Recipient | null {
  const trimmed = value.trim()

  if (trimmed.startsWith('@')) {
    const username = normalizeUsername(trimmed)
    if (!username) return null
    return { kind: 'username', value: username, label: username }
  }

  const phone = normalizePhone(trimmed)
  if (phone) return { kind: 'phone', value: phone, label: phone }

  return null
}
