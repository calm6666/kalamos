/**
 * 对齐扩展：globalAttributes 注入 alignment（left / center / right）
 * 类名驱动 kala-align-{value}，禁止内联样式
 */
import { Extension } from '@tiptap/core'

/** 对齐枚举 */
export type AlignValue = 'left' | 'center' | 'right'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    align: {
      /** 设置选区对齐方式（left 为恢复默认） */
      setAlign: (value: AlignValue) => ReturnType
    }
  }
}

export const Align = Extension.create({
  name: 'align',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote'],
        attributes: {
          alignment: {
            default: 'left',
            parseHTML: (element) => {
              const classAttr = element.getAttribute('class') ?? ''
              if (classAttr.split(/\s+/).includes('kala-align-center')) {
                return 'center'
              }
              if (classAttr.split(/\s+/).includes('kala-align-right')) {
                return 'right'
              }
              return 'left'
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const value = attributes['alignment']
              if (value === 'center' || value === 'right') {
                return { class: `kala-align-${value}` }
              }
              return {}
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setAlign:
        (value) =>
        ({ commands }) => {
          const targets = ['paragraph', 'heading', 'blockquote']
          const results = targets.map((type) =>
            commands.updateAttributes(type, { alignment: value }),
          )
          return results.every((result) => result === true)
        },
    }
  },
})
