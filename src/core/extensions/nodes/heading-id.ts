/**
 * 标题扩展：基于官方 Heading 增加 id 属性（TOC / 锚点）
 * level 限制为 1-3（对齐 eva3 标题下拉：正文 + H1–H3）
 */
import { Heading } from '@tiptap/extension-heading'

export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const id = attributes['id']
          return typeof id === 'string' && id.length > 0 ? { id } : {}
        },
      },
    }
  },
})
