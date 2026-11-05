/**
 * ProseMirror JSON → Markdown 序列化器（方向二：导出 / 静态渲染）
 *
 * 自实现完整遍历（替代静态渲染库的 Markdown 通道），保证自定义节点
 * （image / latex / mention / topic / emoji / taskItem / 表格）按 §8.2 契约输出。
 *
 * 往返设计取舍（显式声明，非缺陷）：
 * - 卡片不参与 Markdown 往返，输出 HTML 注释占位
 * - indent / alignment / 字体族 / 字号 / 字级 / 字色 / 背景色 / 格式刷等
 *   Markdown 表达力之外的属性在序列化中丢弃
 * - 文本不做 Markdown 元字符转义（与原版行为一致）
 */
import type { JSONContent } from '@tiptap/core'

/** 行内节点 → Markdown 行内文本 */
function renderInline(nodes: JSONContent[] | undefined): string {
  if (!Array.isArray(nodes)) {
    return ''
  }
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return wrapTextMarks(node)
      }
      if (node.type === 'hardBreak') {
        return '  \n'
      }
      if (node.type === 'emoji') {
        const name = typeof node.attrs?.['name'] === 'string' ? node.attrs['name'] : ''
        return `:${name}:`
      }
      if (node.type === 'mention') {
        const id = typeof node.attrs?.['id'] === 'string' ? node.attrs['id'] : ''
        const label = typeof node.attrs?.['label'] === 'string' ? node.attrs['label'] : id
        return `@${label}`
      }
      if (node.type === 'topic') {
        const name = typeof node.attrs?.['name'] === 'string' ? node.attrs['name'] : ''
        return `#${name}#`
      }
      // 行内未知节点：输出纯文本兜底
      return typeof node.text === 'string' ? node.text : ''
    })
    .join('')
}

/** 按文本节点的标记集合包裹 Markdown 语法 */
function wrapTextMarks(node: JSONContent): string {
  const text = typeof node.text === 'string' ? node.text : ''
  const marks = Array.isArray(node.marks) ? node.marks : []
  const markByName = new Map<string, Record<string, unknown>>()
  for (const mark of marks) {
    if (typeof mark.type === 'string') {
      markByName.set(mark.type, mark.attrs ?? {})
    }
  }

  let inner = text
  // 行内 code：Markdown 语义下与其他标记互斥
  if (markByName.has('code')) {
    return '`' + inner + '`'
  }
  if (markByName.has('bold')) {
    inner = `**${inner}**`
  }
  if (markByName.has('italic')) {
    inner = `*${inner}*`
  }
  if (markByName.has('strike')) {
    inner = `~~${inner}~~`
  }
  if (markByName.has('underline')) {
    inner = `<u>${inner}</u>`
  }
  if (markByName.has('highlight')) {
    inner = `<mark>${inner}</mark>`
  }
  if (markByName.has('textColor') || markByName.has('backgroundColor') || markByName.has('textStyle')) {
    inner = `<span>${inner}</span>`
  }
  const linkAttrs = markByName.get('link')
  if (linkAttrs !== undefined) {
    const href = typeof linkAttrs['href'] === 'string' ? linkAttrs['href'] : ''
    inner = `[${inner}](${href})`
  }
  return inner
}

/** 列表项 / 引用等容器内容 → 多行文本 */
function renderContainerContent(node: JSONContent, prefixLines: (line: string) => string): string {
  const blocks = Array.isArray(node.content) ? node.content : []
  const rendered = blocks
    .map((block) => renderBlock(block))
    .filter((result): result is string => result !== null)
  return rendered.map((blockText) => prefixLines(blockText)).join('\n')
}

/** 给多行文本的每一行加前缀（首行由调用方处理时传 onlyContinuation） */
function prefixLinesExceptFirst(text: string, prefix: string): string {
  const lines = text.split('\n')
  return lines
    .map((line, index) => (index === 0 ? line : line.length > 0 ? prefix + line : line))
    .join('\n')
}

/** 块级节点 → Markdown 文本（无对应语法返回 null 丢弃） */
function renderBlock(node: JSONContent): string | null {
  switch (node.type) {
    case 'heading': {
      const level = typeof node.attrs?.['level'] === 'number' ? node.attrs['level'] : 1
      const hashes = '#'.repeat(Math.min(Math.max(level, 1), 3))
      return `${hashes} ${renderInline(node.content)}`.trimEnd()
    }
    case 'paragraph': {
      return renderInline(node.content)
    }
    case 'blockquote': {
      return renderContainerContent(node, (line) => `> ${line}`)
    }
    case 'bulletList': {
      const items = Array.isArray(node.content) ? node.content : []
      return items
        .map((item) => {
          const body = renderListItemBody(item)
          return `- ${prefixLinesExceptFirst(body, '  ')}`
        })
        .join('\n')
    }
    case 'orderedList': {
      const items = Array.isArray(node.content) ? node.content : []
      const start = typeof node.attrs?.['start'] === 'number' ? node.attrs['start'] : 1
      return items
        .map((item, index) => {
          const body = renderListItemBody(item)
          return `${start + index}. ${prefixLinesExceptFirst(body, '  ')}`
        })
        .join('\n')
    }
    case 'taskList': {
      const items = Array.isArray(node.content) ? node.content : []
      return items
        .map((item) => {
          const checked = item.attrs?.['checked'] === true
          const body = renderListItemBody(item)
          return `- [${checked ? 'x' : ' '}] ${prefixLinesExceptFirst(body, '  ')}`
        })
        .join('\n')
    }
    case 'codeBlock': {
      const lang = typeof node.attrs?.['language'] === 'string' ? node.attrs['language'] : ''
      const code = Array.isArray(node.content)
        ? node.content.map((line) => (typeof line.text === 'string' ? line.text : '')).join('\n')
        : ''
      return '```' + lang + '\n' + code + '\n```'
    }
    case 'horizontalRule': {
      return '---'
    }
    case 'image': {
      const src = typeof node.attrs?.['src'] === 'string' ? node.attrs['src'] : ''
      const caption = typeof node.attrs?.['caption'] === 'string' ? node.attrs['caption'] : ''
      const alt = typeof node.attrs?.['alt'] === 'string' && node.attrs['alt'].length > 0
        ? node.attrs['alt']
        : caption
      return `![${alt}](${src})`
    }
    case 'latex': {
      const formula = typeof node.attrs?.['formula'] === 'string' ? node.attrs['formula'] : ''
      return `$$${formula}$$`
    }
    case 'card': {
      const cardType = typeof node.attrs?.['cardType'] === 'string' ? node.attrs['cardType'] : 'generic'
      const refId = typeof node.attrs?.['refId'] === 'string' ? node.attrs['refId'] : ''
      return `<!-- kalamos-card:${cardType}:${refId} -->`
    }
    case 'table': {
      return renderTable(node)
    }
    default: {
      // 未知块级节点：尝试输出其行内文本，块链中无内容则丢弃
      const text = renderInline(node.content)
      return text.length > 0 ? text : null
    }
  }
}

/** 列表项内容（跳过嵌套列表由 renderBlock 递归处理） */
function renderListItemBody(item: JSONContent): string {
  const blocks = Array.isArray(item.content) ? item.content : []
  return blocks
    .map((block) => renderBlock(block))
    .filter((result): result is string => result !== null)
    .join('\n')
}

/** 表格 → GFM 管道表格 */
function renderTable(node: JSONContent): string {
  const rows = Array.isArray(node.content) ? node.content : []
  const cellLines = rows.map((row) => {
    const cells = Array.isArray(row.content) ? row.content : []
    return cells.map((cell) => {
      const paragraphs = Array.isArray(cell.content) ? cell.content : []
      return paragraphs.map((p) => renderInline(p.content)).join('<br>')
    })
  })
  if (cellLines.length === 0) {
    return ''
  }
  const header = cellLines[0] ?? []
  const columnCount = header.length
  const headerLine = `| ${header.join(' | ')} |`
  const dividerLine = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`
  const bodyLines = cellLines.slice(1).map((cells) => `| ${cells.join(' | ')} |`)
  return [headerLine, dividerLine, ...bodyLines].join('\n')
}

/** 文档 → Markdown */
export function docToMarkdown(doc: JSONContent): string {
  const blocks = Array.isArray(doc.content) ? doc.content : []
  return blocks
    .map((block) => renderBlock(block))
    .filter((result): result is string => result !== null && result.trim().length >= 0)
    .join('\n\n')
    .trimEnd() + '\n'
}
