/**
 * Markdown 静态渲染封装（JSON → Markdown 字符串）
 * 序列化器见 markdown/serialize.ts（自定义节点补齐实现）
 */
import type { JSONContent } from '@tiptap/core'
import { docToMarkdown } from '../markdown/serialize'

/** ProseMirror JSON → Markdown 字符串 */
export function renderToMarkdown(doc: JSONContent): string {
  return docToMarkdown(doc)
}
