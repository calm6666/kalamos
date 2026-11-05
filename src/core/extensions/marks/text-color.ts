/**
 * 字体颜色标记：调色板 key 类名驱动（kala-color-{key}），零内联样式
 * 对齐 eva3 字色板：6 色 × 4 档 + 3 档灰
 */
import { Mark, mergeAttributes } from '@tiptap/core'
import { paletteKeyFromClassName, textColorClassName } from '../../palette'

/** 字色标记的属性结构 */
interface TextColorAttrs {
  value: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      /** 设置选区字色（传 null 移除） */
      setTextColor: (key: string | null) => ReturnType
      /** 移除选区字色 */
      unsetTextColor: () => ReturnType
    }
  }
}

export const TextColor = Mark.create({
  name: 'textColor',

  /** 不跨输入延续（与原版行为一致：新输入文本不带旧字色） */
  inclusive: false,

  addAttributes() {
    return {
      value: {
        default: null,
        parseHTML: (element) => paletteKeyFromClassName(element.getAttribute('class'), 'kala-color'),
        renderHTML: (attributes: TextColorAttrs) => {
          if (!attributes.value) {
            return {}
          }
          return { 'data-color': attributes.value }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        // 匹配任意携带 kala-color-* 类名的 span，getAttrs 中再校验 key 合法性
        tag: 'span[data-color]',
        getAttrs: (element) => {
          const key = paletteKeyFromClassName(element.getAttribute('class'), 'kala-color')
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
    return ['span', mergeAttributes(HTMLAttributes, { class: textColorClassName(value) }), 0]
  },

  addCommands() {
    return {
      setTextColor:
        (key) =>
        ({ commands }) => {
          if (!key) {
            return commands.unsetTextColor()
          }
          return commands.setMark(this.name, { value: key })
        },
      unsetTextColor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
