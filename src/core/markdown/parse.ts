/**
 * Markdown → ProseMirror JSON 管线（方向一：导入 / 粘贴）
 *
 * markdown 文本 ──markdown-it(+task-lists)──► HTML ──generateJSON──► PM JSON
 * 与 eva3 同款管线：markdown-it default 预设 + markdown-it-task-lists
 * generateJSON 必须从 @tiptap/html 导入（同构实现，Node 可运行）
 */
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { generateJSON } from '@tiptap/html'
import type { JSONContent } from '@tiptap/core'
import { defaultExtensions } from '../extensions'

/** markdown-it 实例类型（默认导入为类值，实例类型由此派生） */
type MarkdownItInstance = InstanceType<typeof MarkdownIt>

/** 模块级 markdown-it 单例（对齐原版「markdown-it 未初始化」守卫思路） */
let markdownItInstance: MarkdownItInstance | null = null

/**
 * 获取共享 markdown-it 实例
 * html: false —— 禁止原始 HTML 透传（安全，与原版一致）
 * linkify: true —— 自动链接
 */
export function getMarkdownIt(): MarkdownItInstance {
  if (markdownItInstance === null) {
    markdownItInstance = new MarkdownIt({ html: false, linkify: true })
    markdownItInstance.use(taskLists)
  }
  return markdownItInstance
}

/**
 * markdown-it-task-lists 输出 li.task-list-item + 内嵌 checkbox input，
 * 而 Tiptap TaskItem 的 parseHTML 只识别 li[data-checked]，
 * 此处对 HTML 做轻量后处理：把 checkbox 的 checked 状态转成 data-checked 属性
 */
function normalizeTaskListHtml(html: string): string {
  return html.replace(
    /<li class="task-list-item([^"]*)">([\s\S]*?)<\/li>/g,
    (_match, extraClass: string, inner: string) => {
      const checked = /type="checkbox"[^>]*checked|checked[^>]*type="checkbox"/.test(inner)
      const extra = extraClass.trim()
      const classAttr = extra.length > 0 ? `task-list-item ${extra}` : 'task-list-item'
      return `<li data-checked="${checked ? 'true' : 'false'}" class="${classAttr}">${inner}</li>`
    },
  )
}

/**
 * Markdown 文本 → ProseMirror JSON
 * 解析结果为空文档时返回 null（上层抛 markdownParseEmpty）
 */
export function markdownToJSON(markdown: string): JSONContent | null {
  const trimmed = markdown.trim()
  if (trimmed.length === 0) {
    return null
  }
  const html = normalizeTaskListHtml(getMarkdownIt().render(markdown))
  const json: JSONContent = generateJSON(html, defaultExtensions)
  // 空内容判定：唯一段落且无文本
  const content = json.content
  if (!Array.isArray(content) || content.length === 0) {
    return null
  }
  if (
    content.length === 1 &&
    content[0]?.type === 'paragraph' &&
    !Array.isArray(content[0]?.content)
  ) {
    return null
  }
  return json
}

/**
 * HTML → ProseMirror JSON（供 Word 导入 mammoth 产物复用管线）
 */
export function htmlToJSON(html: string): JSONContent {
  return generateJSON(html, defaultExtensions)
}
