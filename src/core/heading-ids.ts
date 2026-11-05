/**
 * 标题 id 预处理
 *
 * 静态渲染（SSR）不执行事务钩子，heading 的 id 属性为空，
 * 因此渲染前调用本模块为缺少 id 的标题节点补齐 id（TOC / 锚点依赖）。
 * 已有 id 一律保留；无文本内容的标题按序号生成兜底 id。
 */
import type { EditorDoc } from './types'

/** 将标题文本转换为 URL 友好的锚点 slug（保留中文与字母数字，空白折叠为连字符） */
function slugifyHeadingText(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
  return slug
}

/** 递归遍历文档 JSON，为 heading 节点补齐 id 属性（返回新对象，不改入参） */
function walk(node: EditorDoc, counter: { seq: number }): EditorDoc {
  const isHeading = node.type === 'heading'
  const nextNode: EditorDoc = { ...node }

  if (isHeading) {
    const attrs: Record<string, unknown> = { ...(node.attrs ?? {}) }
    const existingId = attrs['id']
    if (typeof existingId !== 'string' || existingId.length === 0) {
      const rawText = extractText(node)
      const slug = slugifyHeadingText(rawText)
      if (slug.length > 0) {
        attrs['id'] = slug
      } else {
        counter.seq += 1
        attrs['id'] = `heading-${counter.seq}`
      }
    }
    nextNode.attrs = attrs
  }

  if (Array.isArray(node.content) && node.content.length > 0) {
    nextNode.content = node.content.map((child) => walk(child, counter))
  }

  return nextNode
}

/** 提取节点下全部纯文本（用于生成 slug） */
function extractText(node: EditorDoc): string {
  if (typeof node.text === 'string') {
    return node.text
  }
  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractText(child)).join('')
  }
  return ''
}

/** 为文档中缺少 id 的标题生成锚点 id（纯函数，不修改入参文档） */
export function generateHeadingIds(doc: EditorDoc): EditorDoc {
  return walk(doc, { seq: 0 })
}
