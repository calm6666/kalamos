/**
 * 字级扩展：扩展 TextStyle 增加 fontLevel 属性（类名驱动 kala-font-small）
 * 对齐 eva3「极小字号」：正文 regular（无类名）、极小 small
 *
 * 注意：属性与命令定义在同一个扩展上，替换默认 TextStyle 加入扩展数组
 */
import { TextStyle } from '@tiptap/extension-text-style'

/** 字级枚举 */
export type FontLevel = 'regular' | 'small'

/** TextStyle 增加 fontLevel 属性后的标记类型（替换默认 TextStyle 使用） */
export const FontLevelTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontLevel: {
        default: null,
        parseHTML: (element) => {
          const classAttr = element.getAttribute('class')
          if (classAttr && classAttr.split(/\s+/).includes('kala-font-small')) {
            return 'small'
          }
          const dataLevel = element.getAttribute('data-font-level')
          return dataLevel === 'small' ? 'small' : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const level = attributes['fontLevel']
          if (typeof level === 'string' && level !== 'regular' && level.length > 0) {
            return { class: `kala-font-${level}` }
          }
          return {}
        },
      },
    }
  },

  addCommands() {
    return {
      setFontLevel:
        (level) =>
        ({ commands }) => {
          if (level === 'regular') {
            return commands.updateAttributes('textStyle', { fontLevel: null })
          }
          return commands.setMark('textStyle', { fontLevel: level })
        },
      unsetFontLevel:
        () =>
        ({ commands }) => {
          return commands.updateAttributes('textStyle', { fontLevel: null })
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontLevel: {
      /** 设置字级（regular 为正文默认，small 为极小字号） */
      setFontLevel: (level: FontLevel) => ReturnType
      /** 取消字级（恢复正文） */
      unsetFontLevel: () => ReturnType
    }
  }
}

declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    /** 字级属性（挂在 textStyle 标记上） */
    fontLevel?: FontLevel | null
  }
}
