/**
 * #话题# 节点：行内原子节点
 * Markdown 语法 #name#；输入规则：键入 #xxx# 自动转换为话题节点
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

/** 话题节点属性结构 */
export interface TopicAttrs {
  /** 话题名（不含两侧 #） */
  name: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    topic: {
      /** 插入话题 */
      insertTopic: (attrs: Partial<TopicAttrs>) => ReturnType
    }
  }
}

export const Topic = Node.create({
  name: 'topic',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => {
          const name = element.getAttribute('data-topic-name')
          if (typeof name === 'string' && name.length > 0) {
            return name
          }
          const text = element.textContent
          // 兼容 #name# 文本形态
          const match = /^#(.+)#$/.exec(text ?? '')
          return match !== null ? match[1] : null
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span.kala-topic' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : ''
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'kala-topic',
        'data-topic-name': name,
      }),
      `#${name}#`,
    ]
  },

  renderText({ node }) {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : ''
    return `#${name}#`
  },

  addInputRules() {
    return [
      // 键入 #xxx#（空格或结尾触发）时转换话题节点
      new InputRule({
        find: /#([^#\s]{1,32})#$/,
        handler: ({ range, match, commands }) => {
          const name = match[1] ?? ''
          if (name.length === 0) {
            return
          }
          commands.insertContentAt(range, this.type.create({ name }))
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertTopic:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs })
        },
    }
  },
})
