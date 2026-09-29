const PREFIX = 'max-chat'

const CREDENTIALS_KEY = `${PREFIX}:credentials`

function workspaceKey(idInstance: string) {
  return `${PREFIX}:workspace:${idInstance}`
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Квота или приватный режим — работаем без сохранения.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Игнорируем.
  }
}

export const credentialsStorage = {
  load: <T>() => readJson<T>(CREDENTIALS_KEY),
  save: (value: unknown) => writeJson(CREDENTIALS_KEY, value),
  clear: () => removeKey(CREDENTIALS_KEY),
}

export const workspaceStorage = {
  load: <T>(idInstance: string) => readJson<T>(workspaceKey(idInstance)),
  save: (idInstance: string, value: unknown) => writeJson(workspaceKey(idInstance), value),
  clear: (idInstance: string) => removeKey(workspaceKey(idInstance)),
}
