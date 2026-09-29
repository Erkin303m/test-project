import { useEffect, useRef, useState } from 'react'

import { MAX_MESSAGE_LENGTH } from '../api/greenApi'

interface Props {
  disabled?: boolean
  placeholder?: string
  onSend: (text: string) => void
}

export function Composer({ disabled = false, placeholder, onSend }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [value])

  const trimmed = value.trim()
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(trimmed)
    setValue('')
  }

  const remaining = MAX_MESSAGE_LENGTH - value.length

  return (
    <div className="composer">
      <div className="composer__field">
        <textarea
          ref={textareaRef}
          className="composer__input"
          value={value}
          rows={1}
          placeholder={placeholder ?? 'Напишите сообщение…'}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          className="composer__send"
          onClick={submit}
          disabled={!canSend}
          aria-label="Отправить"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M4 12h13M12 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {remaining < 500 && (
        <p className={`composer__counter${remaining < 0 ? ' composer__counter--error' : ''}`}>
          Осталось символов: {remaining}
        </p>
      )}
    </div>
  )
}
