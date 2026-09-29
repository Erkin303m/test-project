/**
 * Приводит номер к формату, который принимает `CheckAccount`:
 * только цифры, международный формат, без `+` и пробелов.
 *
 * Telegram не ограничен РФ/РБ, поэтому кроме привычных сокращений для
 * российских номеров принимается любой international-номер длиной 10–15
 * цифр. Без кода страны однозначно восстановить номер нельзя, поэтому
 * номера вида «89991234567» считаются российскими.
 *
 * Возвращает `null`, если номер нельзя распознать.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  if (digits.length === 10 && digits.startsWith('9')) {
    return `7${digits}` // 9XX XXX XX XX -> 7 9XX ...
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}` // 8 XXX XXX XX XX -> 7 XXX ...
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return digits
  }
  if (digits.length === 12 && digits.startsWith('375')) {
    return digits
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return digits // произвольная страна, код уже включён
  }
  return null
}

/** 79991234567 -> +7 999 123-45-67, 375291112233 -> +375 29 111-22-33 */
export function formatPhone(phone: string): string {
  if (phone.startsWith('375') && phone.length === 12) {
    return `+375 ${phone.slice(3, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
  }
  if (phone.length === 11 && phone.startsWith('7')) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`
  }
  if (phone.length >= 10 && phone.length <= 15) {
    return `+${phone}`
  }
  return phone
}

export function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatChatTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return formatTime(unixSeconds)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
