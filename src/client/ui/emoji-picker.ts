/**
 * 表情选择器：Unicode 与图片表情双组，插入 emoji 节点
 */
import { positionFloating } from './floating'
import { t } from '../i18n'

/** 表情条目定义 */
export interface EmojiItem {
  /** 表情名（:name: 语法） */
  name: string
  /** Unicode 字符（图片表情时为 null） */
  char: string | null
  /** 图片 URL（Unicode 表情时为 null） */
  img: string | null
}

/** 内置表情集（demo 用；宿主可经 createEditor({ emojis }) 覆盖） */
export const builtinEmojis: EmojiItem[] = [
  { name: 'smile', char: '😀', img: null },
  { name: 'laugh', char: '😂', img: null },
  { name: 'drool', char: '🤤', img: null },
  { name: 'cry', char: '😢', img: null },
  { name: 'angry', char: '😡', img: null },
  { name: 'surprise', char: '😲', img: null },
  { name: 'shy', char: '😳', img: null },
  { name: 'think', char: '🤔', img: null },
  { name: 'ok', char: '👌', img: null },
  { name: 'thumb', char: '👍', img: null },
  { name: 'clap', char: '👏', img: null },
  { name: 'star', char: '⭐', img: null },
  { name: 'heart', char: '❤️', img: null },
  { name: 'doge', char: '🐕', img: null },
  { name: 'cat', char: '🐱', img: null },
  { name: 'candle', char: '🕯️', img: null },
]

export interface EmojiPickerOptions {
  /** 可用表情集（默认 builtinEmojis） */
  emojis?: EmojiItem[]
  /** 选中回调 */
  onSelect: (item: EmojiItem) => void
  /** 关闭回调 */
  onClose: () => void
}

/** 创建表情选择器浮层并挂载到 body */
export function createEmojiPicker(
  reference: HTMLElement,
  options: EmojiPickerOptions,
): HTMLDivElement {
  const panel = document.createElement('div')
  panel.className = 'kala-emoji-picker'
  panel.title = t('emojiPicker.title')

  const emojis = options.emojis ?? builtinEmojis
  for (const item of emojis) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'kala-emoji-picker__btn'
    btn.title = item.name
    if (typeof item.img === 'string' && item.img.length > 0) {
      const img = document.createElement('img')
      img.referrerPolicy = 'no-referrer'
      img.src = item.img
      img.alt = item.name
      btn.appendChild(img)
    } else if (item.char !== null) {
      btn.textContent = item.char
    }
    btn.addEventListener('click', () => {
      options.onSelect(item)
      panel.remove()
      options.onClose()
    })
    panel.appendChild(btn)
  }

  document.body.appendChild(panel)
  void positionFloating(reference, panel, 'bottom-start')

  const onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target
    if (target instanceof Node && !panel.contains(target) && target !== reference) {
      panel.remove()
      document.removeEventListener('mousedown', onDocMouseDown)
      options.onClose()
    }
  }
  document.addEventListener('mousedown', onDocMouseDown)

  return panel
}
