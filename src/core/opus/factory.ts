/**
 * Opus 数据结构转换层（对齐 eva3 OpusNodeFactory）
 *
 * PM JSON ⇄ opus 结构双向映射：
 * | PM 节点/标记            | opus 结构                            |
 * | paragraph 文本 + marks  | node_type: 1 word（font_size 默认 17）|
 * | link/mention/topic/emoji| node_type: 3 link（link_type 枚举）   |
 * | latex                   | node_type: 5 formula（latex_content） |
 * | image                   | pics 数组（宽高/注释）                |
 * | card                    | content_card（card_style/card_info）  |
 *
 * 未识别节点记录 logUnsupportedNode 并跳过（与原版行为一致）
 */
import type { JSONContent } from '@tiptap/core'
import { cardTypes } from '../types'
import type { CardType } from '../types'
import type { OpusDisplayDoc, OpusDisplayInline } from './display'

/** opus word 节点（node_type 1） */
export interface OpusWordNode {
  node_type: 1
  text: string
  /** 默认 17（对齐原版） */
  font_size: number
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
  /** 字级（极小字号） */
  font_level?: string
  /** 调色板 key */
  color?: string
  background_color?: string
}

/** opus link 节点（node_type 3）：link / mention / topic / emoji */
export interface OpusLinkNode {
  node_type: 3
  /** 链接类型枚举：url / mention / topic / emoji */
  link_type: 'url' | 'mention' | 'topic' | 'emoji'
  /** 展示文本 */
  show_text: string
  /** url 形态的目标地址 */
  url?: string
  /** mention 形态的用户 id */
  user_id?: string
  /** topic / emoji 形态的资源名 */
  name?: string
  /** emoji 图片地址 */
  img?: string
}

/** opus formula 节点（node_type 5） */
export interface OpusFormulaNode {
  node_type: 5
  latex_content: string
}

/** opus 节点联合 */
export type OpusInlineNode = OpusWordNode | OpusLinkNode | OpusFormulaNode

/** opus 段落（node_type 0） */
export interface OpusParagraph {
  node_type: 0
  words: OpusInlineNode[]
  paragraph_style?: {
    align?: 'left' | 'center' | 'right'
    indent?: number
    heading_level?: number
  }
}

/** opus 图片（pics 数组元素） */
export interface OpusPic {
  url: string
  width: number | null
  height: number | null
  /** 图片注释 */
  caption: string | null
}

/** opus 图片段（node_type 2） */
export interface OpusImageSection {
  node_type: 2
  pics: OpusPic[]
}

/** opus 卡片段（node_type 6） */
export interface OpusCardSection {
  node_type: 6
  content_card: {
    card_style: CardType
    card_info: {
      ref_id: string
      title: string
      desc: string
      cover: string
      extra: Record<string, unknown>
    }
  }
}

/** opus 公式段（node_type 5，块级） */
export interface OpusFormulaSection {
  node_type: 5
  latex_content: string
}

/** opus 段落联合 */
export type OpusSection =
  | OpusParagraph
  | OpusImageSection
  | OpusCardSection
  | OpusFormulaSection

/** opus 文档 */
export interface OpusDocument {
  sections: OpusSection[]
}

/** opus 字号默认值（对齐原版） */
export const defaultFontSize = 17

/** 未识别节点记录（与原版 logUnsupportedNode 行为一致） */
function logUnsupportedNode(type: string | undefined, direction: string): void {
  console.warn(`[kalamos][opus][${direction}] 未支持的节点类型: ${String(type)}，已跳过`)
}

/** 判断对象是否为 JSONContent 形状（类型守卫，替代 as 断言） */
function isJSONContent(value: unknown): value is JSONContent {
  return typeof value === 'object' && value !== null
}

/** 判断未知值是否为普通对象（类型守卫） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 字符串 → 合法 CardType（未识别回退 generic） */
function toCardType(value: string): CardType {
  return cardTypes.find((type) => type === value) ?? 'generic'
}

/** 安全读取属性字符串 */
function attrString(node: JSONContent, key: string): string {
  const value = node.attrs?.[key]
  return typeof value === 'string' ? value : ''
}

/** 安全读取属性数字 */
function attrNumber(node: JSONContent, key: string): number | null {
  const value = node.attrs?.[key]
  return typeof value === 'number' ? value : null
}

/**
 * PM JSON → opus 结构
 * 仅处理 paragraph / heading（以 words 段落表达）/ image / latex / card，
 * 列表、表格、代码块等结构不在 opus 映射范围（跳过并记录）
 */
export function jsonToOpus(doc: JSONContent): OpusDocument {
  const sections: OpusSection[] = []
  const blocks = Array.isArray(doc.content) ? doc.content : []

  for (const block of blocks) {
    if (!isRecord(block) || !isJSONContent(block)) {
      continue
    }
    switch (block.type) {
      case 'paragraph':
      case 'heading': {
        const words: OpusInlineNode[] = []
        const inlines = Array.isArray(block.content) ? block.content : []
        for (const inline of inlines) {
          const converted = convertInlineToOpus(inline)
          for (const word of converted) {
            words.push(word)
          }
        }
        const paragraphStyle: OpusParagraph['paragraph_style'] = {}
        const alignment = block.attrs?.['alignment']
        if (alignment === 'center' || alignment === 'right') {
          paragraphStyle['align'] = alignment
        }
        const indent = block.attrs?.['indent']
        if (typeof indent === 'number' && indent > 0) {
          paragraphStyle['indent'] = indent
        }
        if (block.type === 'heading') {
          const level = block.attrs?.['level']
          paragraphStyle['heading_level'] = typeof level === 'number' ? level : 1
        }
        sections.push({
          node_type: 0,
          words,
          ...(Object.keys(paragraphStyle).length > 0 ? { paragraph_style: paragraphStyle } : {}),
        })
        break
      }
      case 'image': {
        sections.push({
          node_type: 2,
          pics: [
            {
              url: attrString(block, 'src'),
              width: attrNumber(block, 'width'),
              height: null,
              caption: typeof block.attrs?.['caption'] === 'string' ? attrString(block, 'caption') : null,
            },
          ],
        })
        break
      }
      case 'latex': {
        const formulaSection: OpusFormulaSection = {
          node_type: 5,
          latex_content: attrString(block, 'formula'),
        }
        sections.push(formulaSection)
        break
      }
      case 'card': {
        let extra: Record<string, unknown> = {}
        const extraRaw = attrString(block, 'extra')
        if (extraRaw.length > 0) {
          try {
            const parsed: unknown = JSON.parse(extraRaw)
            if (isRecord(parsed)) {
              extra = parsed
            }
          } catch {
            // extra 非法时按空对象处理
          }
        }
        sections.push({
          node_type: 6,
          content_card: {
            card_style: toCardType(attrString(block, 'cardType')),
            card_info: {
              ref_id: attrString(block, 'refId'),
              title: attrString(block, 'title'),
              desc: attrString(block, 'desc'),
              cover: attrString(block, 'cover'),
              extra,
            },
          },
        })
        break
      }
      default: {
        logUnsupportedNode(block.type, 'jsonToOpus')
      }
    }
  }

  return { sections }
}

/** 行内 PM 节点 → opus 内联节点数组 */
function convertInlineToOpus(node: JSONContent): OpusInlineNode[] {
  switch (node.type) {
    case 'text': {
      const marks = Array.isArray(node.marks) ? node.marks : []
      const markTypes = new Set(marks.map((mark) => (typeof mark.type === 'string' ? mark.type : '')))
      const markAttr = (name: string, key: string): unknown =>
        marks.find((mark) => mark.type === name)?.attrs?.[key]

      const word: OpusWordNode = {
        node_type: 1,
        text: typeof node.text === 'string' ? node.text : '',
        font_size: defaultFontSize,
      }
      if (markTypes.has('bold')) {
        word['bold'] = true
      }
      if (markTypes.has('italic')) {
        word['italic'] = true
      }
      if (markTypes.has('strike')) {
        word['strikethrough'] = true
      }
      if (markTypes.has('underline')) {
        word['underline'] = true
      }
      const linkMark = marks.find((mark) => mark.type === 'link')
      if (linkMark !== undefined) {
        // link 是 PM 的 mark，在 opus 中升级为独立 link 节点
        const href = typeof linkMark.attrs?.['href'] === 'string' ? linkMark.attrs['href'] : ''
        return [
          {
            node_type: 3,
            link_type: 'url',
            show_text: typeof node.text === 'string' ? node.text : '',
            url: href,
          },
        ]
      }
      const fontLevel = markAttr('textStyle', 'fontLevel')
      if (typeof fontLevel === 'string' && fontLevel !== 'regular') {
        word['font_level'] = fontLevel
      }
      const textColor = markAttr('textColor', 'value')
      if (typeof textColor === 'string') {
        word['color'] = textColor
      }
      const bgColor = markAttr('backgroundColor', 'value')
      if (typeof bgColor === 'string') {
        word['background_color'] = bgColor
      }
      return [word]
    }
    case 'mention': {
      return [
        {
          node_type: 3,
          link_type: 'mention',
          show_text: `@${attrString(node, 'label') || attrString(node, 'id')}`,
          user_id: attrString(node, 'id'),
        },
      ]
    }
    case 'topic': {
      return [
        {
          node_type: 3,
          link_type: 'topic',
          show_text: `#${attrString(node, 'name')}#`,
          name: attrString(node, 'name'),
        },
      ]
    }
    case 'emoji': {
      const img = node.attrs?.['img']
      return [
        {
          node_type: 3,
          link_type: 'emoji',
          show_text: attrString(node, 'name'),
          name: attrString(node, 'name'),
          ...(typeof img === 'string' && img.length > 0 ? { img } : {}),
        },
      ]
    }
    default: {
      logUnsupportedNode(node.type, 'jsonToOpus')
      return []
    }
  }
}

/**
 * opus 结构 → PM JSON
 * 反向映射：word / link / formula / 图片段 / 卡片段 → PM 节点，
 * 未识别段落跳过并记录
 */
export function opusToJson(opus: OpusDocument): JSONContent {
  const content: JSONContent[] = []

  for (const section of opus.sections) {
    if (section.node_type === 0) {
      content.push({
        type: 'paragraph',
        content: section.words.flatMap((word) => convertOpusInlineToPM(word)),
      })
      continue
    }
    if (section.node_type === 2) {
      for (const pic of section.pics) {
        content.push({
          type: 'image',
          attrs: {
            src: pic.url,
            width: pic.width,
            caption: pic.caption,
            status: 'loaded',
            align: 'left',
            alt: null,
          },
        })
      }
      continue
    }
    if (section.node_type === 5) {
      content.push({
        type: 'latex',
        attrs: { formula: section.latex_content },
      })
      continue
    }
    if (section.node_type === 6) {
      content.push({
        type: 'card',
        attrs: {
          cardType: section.content_card.card_style,
          refId: section.content_card.card_info.ref_id,
          title: section.content_card.card_info.title,
          desc: section.content_card.card_info.desc,
          cover: section.content_card.card_info.cover,
          sourceName: '',
          extra: JSON.stringify(section.content_card.card_info.extra),
        },
      })
      continue
    }
  }

  return { type: 'doc', content }
}

/** opus 内联节点 → PM 行内节点数组 */
function convertOpusInlineToPM(word: OpusInlineNode): JSONContent[] {
  if (word.node_type === 5) {
    // 公式在 opus 中若出现于段落内，降级为独立块（与 schema 一致）
    return []
  }
  if (word.node_type === 3) {
    if (word.link_type === 'url') {
      return [
        {
          type: 'text',
          text: word.show_text,
          marks: [{ type: 'link', attrs: { href: word.url ?? '', target: '_blank', rel: 'noopener noreferrer nofollow' } }],
        },
      ]
    }
    if (word.link_type === 'mention') {
      return [
        {
          type: 'mention',
          attrs: { id: word.user_id ?? '', label: word.show_text.replace(/^@/, '') },
        },
      ]
    }
    if (word.link_type === 'topic') {
      return [{ type: 'topic', attrs: { name: word.name ?? '' } }]
    }
    return [
      {
        type: 'emoji',
        attrs: { name: word.name ?? '', char: null, img: word.img ?? null, size: null },
      },
    ]
  }

  // node_type 1 word
  const marks: JSONContent['marks'] = []
  if (word.bold === true) {
    marks.push({ type: 'bold' })
  }
  if (word.italic === true) {
    marks.push({ type: 'italic' })
  }
  if (word.strikethrough === true) {
    marks.push({ type: 'strike' })
  }
  if (word.underline === true) {
    marks.push({ type: 'underline' })
  }
  const textStyle: Record<string, unknown> = {}
  if (typeof word.font_level === 'string' && word.font_level !== 'regular') {
    textStyle['fontLevel'] = word.font_level
  }
  if (Object.keys(textStyle).length > 0) {
    marks.push({ type: 'textStyle', attrs: textStyle })
  }
  if (typeof word.color === 'string') {
    marks.push({ type: 'textColor', attrs: { value: word.color } })
  }
  if (typeof word.background_color === 'string') {
    marks.push({ type: 'backgroundColor', attrs: { value: word.background_color } })
  }

  return [
    {
      type: 'text',
      text: word.text,
      ...(marks.length > 0 ? { marks } : {}),
    },
  ]
}

/** 展示端行内节点 → PM 行内节点（行内公式降级为独立公式块，与 schema 一致） */
function displayInlineToPM(word: OpusDisplayInline): JSONContent[] {
  if (word.node_type === 5) {
    return [{ type: 'latex', attrs: { formula: word.latex_content } }]
  }
  return convertOpusInlineToPM(word)
}

/**
 * opus 展示页文档 → 编辑器 PM JSON（展示内容可在富文本编辑器中继续编辑）
 *
 * | 展示端结构            | PM 节点                                  |
 * | title                 | heading level 1（正文首块）              |
 * | 段落 heading_level    | heading（>3 级收敛为 3）                 |
 * | 段落对齐/缩进         | paragraph attrs（alignment / indent）    |
 * | node_type 2 图片段    | 每张图一个 image 节点                    |
 * | node_type 5 公式段    | latex 节点                               |
 * | node_type 6 卡片段    | card 节点（attrs 与 jsonToOpus 互逆）    |
 * | node_type 7 失效卡    | 纯文本段落保留提示语                     |
 */
export function displayToEditorDoc(doc: OpusDisplayDoc): JSONContent {
  const blocks: JSONContent[] = []

  if (doc.title.length > 0) {
    blocks.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: doc.title }],
    })
  }

  for (const section of doc.sections) {
    if (section.node_type === 7) {
      blocks.push({ type: 'paragraph', content: [{ type: 'text', text: section.tip }] })
      continue
    }
    if (section.node_type === 0) {
      const style = section.paragraph_style
      const inlines = section.words.flatMap(displayInlineToPM)
      const level = style?.heading_level
      if (typeof level === 'number' && level >= 1) {
        blocks.push({
          type: 'heading',
          attrs: { level: Math.min(3, level) },
          content: inlines.length > 0 ? inlines : [{ type: 'text', text: ' ' }],
        })
        continue
      }
      const attrs: Record<string, unknown> = {}
      if (style?.align === 'center' || style?.align === 'right') {
        attrs['alignment'] = style.align
      }
      if (typeof style?.indent === 'number' && style.indent > 0) {
        attrs['indent'] = style.indent
      }
      blocks.push({
        type: 'paragraph',
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        content: inlines,
      })
      continue
    }
    if (section.node_type === 2) {
      for (const pic of section.pics) {
        blocks.push({
          type: 'image',
          attrs: {
            src: pic.url,
            width: pic.width,
            caption: pic.caption,
            status: 'loaded',
            align: 'center',
            alt: null,
          },
        })
      }
      continue
    }
    if (section.node_type === 5) {
      blocks.push({ type: 'latex', attrs: { formula: section.latex_content } })
      continue
    }
    if (section.node_type === 6) {
      blocks.push({
        type: 'card',
        attrs: {
          cardType: section.content_card.card_style,
          refId: section.content_card.card_info.ref_id,
          title: section.content_card.card_info.title,
          desc: section.content_card.card_info.desc,
          cover: section.content_card.card_info.cover,
          sourceName: '',
          extra: JSON.stringify(section.content_card.card_info.extra),
        },
      })
    }
  }

  return { type: 'doc', content: blocks }
}
