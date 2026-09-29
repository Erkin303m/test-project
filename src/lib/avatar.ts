/** Заглушки аватаров: у Telegram аватары — фото, а GetAvatar требует отдельного запроса. */
const AVATAR_GRADIENTS = [
  ['#40a7e3', '#8fd0f2'],
  ['#5b8def', '#a3c4ff'],
  ['#2cbe7f', '#7fe0b6'],
  ['#e0655a', '#f5a396'],
  ['#8a6ee0', '#c0aaf5'],
]

export function avatarGradient(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
}
