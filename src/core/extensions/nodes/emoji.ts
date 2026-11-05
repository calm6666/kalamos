/**
 * 表情节点：行内原子节点，支持图片表情与 Unicode 字符双形态
 * Markdown 语法 :name:；静态渲染 span.kala-emoji
 */
import { Node, mergeAttributes } from '@tiptap/core'

/** 表情节点属性结构 */
export interface EmojiAttrs {
  /** 表情名（如 mengzhili ） */
  name: string
  /** Unicode 字符形态（图片表情时为 null） */
  char: string | null
  /** 图片表情 URL（Unicode 表情时为 null） */
  img: string | null
  /** 图片表情尺寸（px，默认 24） */
  size: number | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emoji: {
      /** 插入表情 */
      insertEmoji: (attrs: Partial<EmojiAttrs>) => ReturnType
    }
  }
}

export const Emoji = Node.create({
  name: 'emoji',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-emoji-name'),
      },
      char: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-emoji-char'),
        renderHTML: () => ({}),
      },
      img: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute('src')
          return typeof src === 'string' && src.length > 0 ? src : null
        },
        renderHTML: () => ({}),
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-emoji-size')
          if (raw === null) {
            return null
          }
          const parsed = Number.parseInt(raw, 10)
          return Number.isNaN(parsed) ? null : parsed
        },
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span.kala-emoji[data-emoji-name]' },
      { tag: 'img.kala-emoji[data-emoji-name]' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : ''
    const img = node.attrs['img']
    const char = node.attrs['char']
    const size = node.attrs['size']

    if (typeof img === 'string' && img.length > 0) {
      const sizeAttrs: Record<string, unknown> =
        typeof size === 'number' && size > 0 ? { width: size, height: size } : {}
      return [
        'img',
        mergeAttributes(HTMLAttributes, {
          class: 'kala-emoji',
          src: img,
          'data-emoji-name': name,
          ...sizeAttrs,
        }),
      ]
    }

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'kala-emoji',
        'data-emoji-name': name,
        'data-emoji-char': typeof char === 'string' ? char : '',
      }),
      typeof char === 'string' && char.length > 0 ? char : `:${name}:`,
    ]
  },

  renderText({ node }) {
    const char = node.attrs['char']
    if (typeof char === 'string' && char.length > 0) {
      return char
    }
    const name = node.attrs['name']
    return `:${typeof name === 'string' ? name : ''}:`
  },

  addCommands() {
    return {
      insertEmoji:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs })
        },
    }
  },
})
