/**
 * kalamos Core 层公共导出（同构：Node 与浏览器均可运行，零 DOM 依赖）
 */
import type { JSONContent } from '@tiptap/core'
import { markdownToJSON } from './markdown/parse'
import { renderToHTML } from './render/html'

export type { JSONContent }

// 类型与常量
export type {
  EditorDoc,
  CardType,
  CardVariant,
  CardStatus,
  CardSnapshot,
  CardInfo,
  UserInfo,
  ImageUploadResult,
  EditorApi,
  EditorLocaleMessages,
} from './types'
export { cardTypes } from './types'

// 卡片模板（SSR / 编辑态共用）
export {
  buildCardHTML,
  buildCardBody,
  cardLabels,
  cardMenuItems,
  cardInputFromAttrs,
  toCardType,
  toCardVariant,
  toCardStatus,
} from './cards'
export type { CardMenuItem, CardRenderInput, CardRenderResult, CardStyleOptions } from './cards'

export {
  paletteHues,
  paletteTiers,
  grayTiers,
  paletteKeys,
  paletteColorValues,
  isPaletteKey,
  textColorClassName,
  bgColorClassName,
  markClassName,
  paletteKeyFromClassName,
} from './palette'
export type { PaletteHue, PaletteTier, GrayTier } from './palette'

export { generateHeadingIds } from './heading-ids'

// 扩展
export {
  createDefaultExtensions,
  defaultExtensions,
  TextColor,
  BackgroundColor,
  FontLevelTextStyle,
  BiliLink,
  detectBiliLinkType,
  HighlightPalette,
  HeadingWithId,
  KalamosImage,
  Emoji,
  KalamosMention,
  Topic,
  Latex,
  Card,
  emptyCardAttrs,
  Indent,
  maxIndentLevel,
  Align,
  FormatPainter,
  MarkdownImport,
} from './extensions'
export type {
  DefaultExtensionsOptions,
  FontLevel,
  BiliLinkType,
  ImageStatus,
  ImageAlign,
  ImageAttrs,
  EmojiAttrs,
  TopicAttrs,
  LatexAttrs,
  CardAttrs,
  AlignValue,
  MarkdownImportOptions,
} from './extensions'

// Markdown 管线
export { getMarkdownIt, markdownToJSON, htmlToJSON } from './markdown/parse'
export { docToMarkdown } from './markdown/serialize'
export { detectMarkdown } from './markdown/detect'

// 静态渲染
export { renderToHTML } from './render/html'
export { renderToMarkdown } from './render/markdown'

// Opus 转换
export {
  jsonToOpus,
  opusToJson,
  displayToEditorDoc,
  defaultFontSize as opusDefaultFontSize,
} from './opus/factory'
export type {
  OpusWordNode,
  OpusLinkNode,
  OpusFormulaNode,
  OpusInlineNode,
  OpusParagraph,
  OpusPic,
  OpusImageSection,
  OpusCardSection,
  OpusFormulaSection,
  OpusSection,
  OpusDocument,
} from './opus/factory'
// Opus 展示页渲染（展示数据模型与 SSR/客户端共用渲染器，无 DOM 依赖）
export { renderOpusDisplay } from './opus/render'
export type {
  OpusDisplayDoc,
  OpusDisplaySection,
  OpusDisplayInline,
  OpusDisplayLinkNode,
  OpusDisplayAuthor,
  OpusDisplayCover,
  OpusTocItem,
} from './opus/display'

/** Markdown 文本 → HTML 字符串（服务端与客户端共用的组合管线） */
export function markdownToHTML(markdown: string): string {
  const json: JSONContent | null = markdownToJSON(markdown)
  if (json === null) {
    return ''
  }
  return renderToHTML(json)
}
