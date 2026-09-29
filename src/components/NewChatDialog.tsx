import { useEffect, useState } from 'react'

import { formatPhone } from '../lib/format'
import { parseRecipient, type Recipient } from '../lib/recipient'

interface Props {
  onClose: () => void
  onCreate: (recipient: Recipient) => Promise<void>
}

export function NewChatDialog({ onClose, onCreate }: Props) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async () => {
    const recipient = parseRecipient(value)
    if (!recipient) {
      setError('Введите номер в международном формате (например, +7 999 123-45-67) или имя пользователя @username.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onCreate(recipient)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать чат.')
      setBusy(false)
    }
  }

  const parsed = parseRecipient(value)

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="modal__title" id="new-chat-title">
          Новый чат
        </h2>
        <p className="modal__hint">
          Укажите номер телефона или имя пользователя получателя. Приложение найдёт его
          аккаунт методом CheckAccount и создаст чат.
        </p>

        <label className="field">
          <span className="field__label">Телефон или @username</span>
          <input
            className="field__input"
            type="text"
            inputMode={value.trim().startsWith('@') ? 'text' : 'tel'}
            autoFocus
            placeholder="+7 999 123 45 67 или @durov"
            value={value}
            disabled={busy}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
          />
          {parsed && (
            <span className="field__hint">
              {parsed.kind === 'phone' ? formatPhone(parsed.value) : `Поиск: ${parsed.value}`}
            </span>
          )}
        </label>

        {error && <p className="alert alert--error">{error}</p>}

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Проверяем…' : 'Создать чат'}
          </button>
        </div>
      </div>
    </div>
  )
}
