/**
 * Core 扩展层公共导出
 * defaultExtensions 为唯一扩展源（§8.4），任何渲染 / 解析路径必须由此派生
 */
export { createDefaultExtensions, defaultExtensions } from './configure-kit'
export type { DefaultExtensionsOptions } from './configure-kit'

// marks
export { TextColor } from './marks/text-color'
export { BackgroundColor } from './marks/background-color'
export { FontLevelTextStyle } from './marks/font-level'
export type { FontLevel } from './marks/font-level'
export { BiliLink, detectBiliLinkType } from './marks/bili-link'
export type { BiliLinkType } from './marks/bili-link'
export { HighlightPalette } from './marks/highlight-palette'

// nodes
export { HeadingWithId } from './nodes/heading-id'
export { KalamosImage } from './nodes/image'
export type { ImageStatus, ImageAlign, ImageAttrs } from './nodes/image'
export { Emoji } from './nodes/emoji'
export type { EmojiAttrs } from './nodes/emoji'
export { KalamosMention } from './nodes/mention'
export { Topic } from './nodes/topic'
export type { TopicAttrs } from './nodes/topic'
export { Latex } from './nodes/latex'
export type { LatexAttrs } from './nodes/latex'
export { Card, emptyCardAttrs } from './nodes/card'
export type { CardAttrs } from './nodes/card'

// behaviors
export { Indent } from './behaviors/indent'
export { maxIndentLevel, indentableTypes } from './behaviors/indent-helpers'
export { Align } from './behaviors/align'
export type { AlignValue } from './behaviors/align'
export { FormatPainter } from './behaviors/format-painter'
export { MarkdownImport } from './behaviors/markdown-import'
export type { MarkdownImportOptions } from './behaviors/markdown-import'
