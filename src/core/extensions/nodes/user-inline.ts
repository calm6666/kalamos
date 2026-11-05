/**
 * 用户行内节点（逆向自原站 userInline）
 *
 * - inline atom，不可选中、不承载 mark；attrs 仅 status / info
 * - 编辑态由 UserInlineView（client/node-views/user-inline.ts）接管，
 *   renderHTML 输出属性壳供粘贴解析；完整结构经 SSR nodeMapping 走共享模板
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { userInlineInfoFromAttrs } from '../../cards/user-inline'
import { readRecord, readString } from '../../cards/utils'

export const UserInline = Node.create({
  name: 'userInline',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,
  marks: '',

  addAttributes() {
    return {
      status: {
        default: 'loading',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-status') ?? 'loading',
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-status': attributes['status'] }),
      },
      info: {
        default: {},
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-info')
          try {
            return raw !== null ? JSON.parse(raw) : {}
          } catch {
            return {}
          }
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const info = userInlineInfoFromAttrs(attributes['info'])
          return Object.keys(info).length > 0 ? { 'data-info': JSON.stringify(info) } : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="user-inline"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'user-inline', class: 'user-inline' })]
  },

  renderText({ node }) {
    const info = userInlineInfoFromAttrs(node.attrs['info'])
    const user = readRecord(info, 'user')
    return (user !== null ? readString(user, 'name') : '') || readString(info, 'name')
  },
})
