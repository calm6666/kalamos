/**
 * LaTeX 公式节点：块级原子节点
 * formula 属性存储公式文本（对齐 eva3 latex_content / node_type 5）
 * 静态渲染输出 div.kala-latex[data-latex]，Client NodeView 用 katex 渲染
 * Markdown 语法 $$...$$（序列化侧支持，解析侧由 markdown 导入按块拆分）
 */
import { Node, mergeAttributes } from '@tiptap/core'

/** 公式节点属性结构 */
export interface LatexAttrs {
  formula: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    latex: {
      /** 插入或更新公式块 */
      insertLatex: (attrs: Partial<LatexAttrs>) => ReturnType
    }
  }
}

export const Latex = Node.create({
  name: 'latex',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') ?? element.textContent ?? '',
        renderHTML: (attributes: Record<string, unknown>) => {
          const formula = attributes['formula']
          return typeof formula === 'string' && formula.length > 0
            ? { 'data-latex': formula }
            : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div.kala-latex' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const formula = typeof node.attrs['formula'] === 'string' ? node.attrs['formula'] : ''
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'kala-latex',
        'data-latex': formula,
      }),
      formula,
    ]
  },

  renderText({ node }) {
    const formula = typeof node.attrs['formula'] === 'string' ? node.attrs['formula'] : ''
    return `$$${formula}$$`
  },

  addCommands() {
    return {
      insertLatex:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs })
        },
    }
  },
})
