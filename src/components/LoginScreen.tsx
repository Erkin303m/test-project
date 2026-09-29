import { useState } from 'react'

import { DEFAULT_API_URL, GreenApiError, normalizeApiUrl } from '../api/greenApi'
import type { Credentials } from '../api/types'

interface Props {
  initial: Credentials
  onSubmit: (credentials: Credentials) => Promise<void>
}

function describeError(error: unknown): string {
  if (error instanceof GreenApiError) {
    if (error.isAuthError) {
      return 'Неверный idInstance или apiTokenInstance. Проверьте данные в личном кабинете GREEN-API.'
    }
    if (error.status === 0) return error.message
    return `GREEN-API ответил ошибкой ${error.status}: ${error.message}`
  }
  return error instanceof Error ? error.message : 'Не удалось подключиться к GREEN-API.'
}

export function LoginScreen({ initial, onSubmit }: Props) {
  const [apiUrl, setApiUrl] = useState(initial.apiUrl || DEFAULT_API_URL)
  const [idInstance, setIdInstance] = useState(initial.idInstance ?? '')
  const [apiTokenInstance, setApiTokenInstance] = useState(initial.apiTokenInstance ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initial.apiUrl))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError('Укажите idInstance и apiTokenInstance.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        apiUrl: normalizeApiUrl(apiUrl) || DEFAULT_API_URL,
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
      })
    } catch (cause) {
      setError(describeError(cause))
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <span className="brand-mark brand-mark--telegram" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" role="presentation">
              <path d="M21.9 4.3 18.6 19.4c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.6 13.1 2 11.6c-1-.3-1-1 .2-1.5l17-6.6c.8-.3 1.5.2 1.3 1.5z" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h1 className="auth__title">Telegram Chat</h1>
            <p className="auth__subtitle">Прототип чата на GREEN-API</p>
          </div>
        </div>

        <form className="auth__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">idInstance</span>
            <input
              className="field__input"
              value={idInstance}
              inputMode="numeric"
              autoComplete="off"
              placeholder="3100000001"
              disabled={busy}
              onChange={(event) => {
                setIdInstance(event.target.value)
                setError(null)
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">apiTokenInstance</span>
            <input
              className="field__input"
              type="password"
              value={apiTokenInstance}
              autoComplete="off"
              placeholder="d75b3a66374942c5b3c019c698abc206"
              disabled={busy}
              onChange={(event) => {
                setApiTokenInstance(event.target.value)
                setError(null)
              }}
            />
          </label>

          {showAdvanced ? (
            <label className="field">
              <span className="field__label">Адрес API</span>
              <input
                className="field__input"
                value={apiUrl}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setApiUrl(event.target.value)}
              />
              <span className="field__hint">
                Для Telegram в документации используется персональный адрес вида{' '}
                <code>https://&lt;idInstance&gt;.api.green-api.com</code> — скопируйте
                поле <code>apiUrl</code> из кабинета.
              </span>
            </label>
          ) : (
            <button
              type="button"
              className="link-button"
              onClick={() => setShowAdvanced(true)}
              disabled={busy}
            >
              Указать адрес API вручную
            </button>
          )}

          {error && <p className="alert alert--error">{error}</p>}

          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {busy ? 'Подключаемся…' : 'Подключиться'}
          </button>
        </form>

        <p className="auth__footnote">
          Данные инстанса берутся в{' '}
          <a href="https://console.green-api.com/instanceList" target="_blank" rel="noreferrer">
            личном кабинете GREEN-API
          </a>{' '}
          и сохраняются только в вашем браузере (localStorage). Инстанс нужно
          заранее авторизовать в Telegram — в приложении: «Настройки → Устройства →
          Подключить устройство», затем QR-код в кабинете GREEN-API.
        </p>
      </div>
    </div>
  )
}
