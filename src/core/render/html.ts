/**
 * 静态 HTML 渲染封装（SSR 主通道）
 * renderToHTMLString 不实例化 Editor、不执行事务钩子，
 * 因此依赖事务的属性（heading id / 卡片快照）必须在渲染前完成预处理。
 *
 * 卡片通过 nodeMapping 走 Core 共享模板，保证 SSR 与编辑态 DOM 完全一致。
 */
import { renderToHTMLString } from '@tiptap/static-renderer'
import type { JSONContent } from '@tiptap/core'
import katex from 'katex'
import { buildCardHTML, cardInputFromAttrs } from '../cards'
import { buildUserInlineHTML, userInlineInfoFromAttrs } from '../cards/user-inline'
import { defaultExtensions } from '../extensions'
import { generateHeadingIds } from '../heading-ids'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 公式节点映射：Node 端直接用 katex 出静态 HTML（与编辑态渲染保持一致） */
function renderLatexNode(node: { attrs: Record<string, unknown> }): string {
  const formula = typeof node.attrs['formula'] === 'string' ? node.attrs['formula'] : ''
  const attr = escapeHtml(formula)
  if (formula.length === 0) {
    return `<div class="kala-latex" data-latex=""></div>`
  }
  try {
    const rendered = katex.renderToString(formula, { throwOnError: false, displayMode: true })
    return `<div class="kala-latex" data-latex="${attr}">${rendered}</div>`
  } catch {
    return `<div class="kala-latex" data-latex="${attr}">${escapeHtml(formula)}</div>`
  }
}

/** 节点映射：卡片走共享模板，公式走 katex 静态渲染，用户行内走行内模板 */
const nodeMapping = {
  card: ({ node }: { node: { attrs: Record<string, unknown> } }): string =>
    buildCardHTML(cardInputFromAttrs(node.attrs, false)),
  latex: ({ node }: { node: { attrs: Record<string, unknown> } }): string =>
    renderLatexNode(node),
  userInline: ({ node }: { node: { attrs: Record<string, unknown> } }): string => {
    const status = typeof node.attrs['status'] === 'string' ? node.attrs['status'] : 'loaded'
    return buildUserInlineHTML(userInlineInfoFromAttrs(node.attrs['info']), status)
  },
}

/**
 * ProseMirror JSON → HTML 字符串
 * 渲染前自动补齐标题 id（已有 id 保留）
 */
export function renderToHTML(doc: JSONContent): string {
  const prepared = generateHeadingIds(doc)
  return renderToHTMLString({
    content: prepared,
    extensions: defaultExtensions,
    options: { nodeMapping },
  })
}
