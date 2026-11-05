/**
 * @提及节点：基于官方 Mention 扩展，输出 span.kala-mention
 * label 属性存储昵称（show_text），搜索下拉由 Client 层通过 suggestion 注入
 */
import { Mention } from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'

export const KalamosMention = Mention.extend({
  renderHTML({ node, HTMLAttributes }) {
    const id = typeof node.attrs['id'] === 'string' ? node.attrs['id'] : ''
    const label = typeof node.attrs['label'] === 'string' ? node.attrs['label'] : id
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'kala-mention',
        'data-mention-id': id,
        'data-mention-label': label,
      }),
      `@${label}`,
    ]
  },

  renderText({ node }) {
    const id = typeof node.attrs['id'] === 'string' ? node.attrs['id'] : ''
    const label = typeof node.attrs['label'] === 'string' ? node.attrs['label'] : id
    return `@${label}`
  },
})
