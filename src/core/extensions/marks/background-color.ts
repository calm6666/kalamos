/**
 * 背景色标记：调色板 key 类名驱动（kala-bg-{key}），零内联样式
 * 对齐 eva3 背景色板：6 色 × 4 档 + 3 档灰
 */
import { Mark, mergeAttributes } from '@tiptap/core'
import { bgColorClassName, paletteKeyFromClassName } from '../../palette'

/** 背景色标记的属性结构 */
interface BackgroundColorAttrs {
  value: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundColor: {
      /** 设置选区背景色（移除用 unsetBackgroundColor） */
      setBackgroundColor: (key: string) => ReturnType
      /** 移除选区背景色 */
      unsetBackgroundColor: () => ReturnType
    }
  }
}

export const BackgroundColor = Mark.create({
  name: 'backgroundColor',

  inclusive: false,

  addAttributes() {
    return {
      value: {
        default: null,
        parseHTML: (element) => paletteKeyFromClassName(element.getAttribute('class'), 'kala-bg'),
        renderHTML: (attributes: BackgroundColorAttrs) => {
          if (!attributes.value) {
            return {}
          }
          return { 'data-bg': attributes.value }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-bg]',
        getAttrs: (element) => {
          const key = paletteKeyFromClassName(element.getAttribute('class'), 'kala-bg')
          return key !== null ? {} : false
        },
      },
    ]
  },

  renderHTML({ mark, HTMLAttributes }) {
    const value = mark.attrs['value']
    if (typeof value !== 'string' || value.length === 0) {
      return ['span', HTMLAttributes, 0]
    }
    return ['span', mergeAttributes(HTMLAttributes, { class: bgColorClassName(value) }), 0]
  },

  addCommands() {
    return {
      setBackgroundColor:
        (key) =>
        ({ commands }) => {
          if (!key) {
            return commands.unsetBackgroundColor()
          }
          return commands.setMark(this.name, { value: key })
        },
      unsetBackgroundColor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
