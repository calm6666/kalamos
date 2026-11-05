/**
 * kalamos Server 层入口（仅 Node.js）
 *
 * 接收 Markdown / JSON，调用 Core 输出 HTML / Markdown 字符串。
 * 本层禁止任何 DOM 依赖；客户端请使用 kalamos/client 的 createEditor。
 */
import type { JSONContent } from '@tiptap/core'
import { markdownToJSON, renderToHTML, renderToMarkdown } from '../core'
import { renderOpusDisplay } from '../core/opus/render'
import type { OpusDisplayDoc } from '../core/opus/display'
import { assertNodeEnvironment } from './guard'

/**
 * Markdown → HTML 字符串
 * 解析结果为空时抛出 markdownParseEmpty 语义错误
 */
export function renderMarkdownToString(markdown: string): string {
  assertNodeEnvironment()
  const json = markdownToJSON(markdown)
  if (json === null) {
    throw new Error('[kalamos] markdownParseEmpty: Markdown 解析结果为空')
  }
  return renderToHTML(json)
}

/**
 * ProseMirror JSON → HTML 字符串
 * 渲染前自动补齐标题 id（generateHeadingIds）
 */
export function renderJSONToString(json: JSONContent): string {
  assertNodeEnvironment()
  return renderToHTML(json)
}

/** ProseMirror JSON → Markdown 字符串 */
export function renderJSONToMarkdown(json: JSONContent): string {
  assertNodeEnvironment()
  return renderToMarkdown(json)
}

/** Markdown → ProseMirror JSON（宿主需要中间产物时使用） */
export function renderMarkdownToJSON(markdown: string): JSONContent {
  assertNodeEnvironment()
  const json = markdownToJSON(markdown)
  if (json === null) {
    throw new Error('[kalamos] markdownParseEmpty: Markdown 解析结果为空')
  }
  return json
}

/** opus 展示数据 → 展示页 HTML 字符串（正文/目录/作者/版权/底部全模块直出） */
export function renderOpusToString(doc: OpusDisplayDoc): string {
  assertNodeEnvironment()
  return renderOpusDisplay(doc)
}
