/**
 * 高亮标记：基于官方 Highlight 扩展增加调色板 color 属性（类名驱动 kala-mark-{key}）
 * 无 color 属性时保持官方 <mark> 默认行为
 */
import { Highlight } from '@tiptap/extension-highlight'
import { mergeAttributes } from '@tiptap/core'
import { markClassName, paletteKeyFromClassName } from '../../palette'

/** 高亮标记的属性结构 */
interface HighlightPaletteAttrs {
  color: string | null
}

export const HighlightPalette = Highlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element) => paletteKeyFromClassName(element.getAttribute('class'), 'kala-mark'),
        renderHTML: (attributes: HighlightPaletteAttrs) => {
          if (!attributes.color) {
            return {}
          }
          return { 'data-mark-color': attributes.color }
        },
      },
    }
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = mark.attrs['color']
    if (typeof color !== 'string' || color.length === 0) {
      return this.parent?.({ mark, HTMLAttributes }) ?? ['mark', HTMLAttributes, 0]
    }
    return ['mark', mergeAttributes(HTMLAttributes, { class: markClassName(color) }), 0]
  },
})
