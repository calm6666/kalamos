/**
 * kalamos Client 层公共导出：createEditor 装配 + 类型 + mock API + i18n
 * styles 单独经 package.json 的 ./styles 子路径导出（SSR 永远不会打包本层）
 */
export { createEditor } from './editor'
export type { CreateEditorOptions, KalamosEditorHandle } from './editor'

export { createMockApi } from './api/mock'
export { setLocale, getLocale } from './i18n'
export type { Locale } from './i18n'

export { builtinEmojis } from './ui/emoji-picker'
export type { EmojiItem } from './ui/emoji-picker'

export { parseDocx } from './word-import'

export { CodeBlockView } from './node-views/code-block'
export { ImageView } from './node-views/image'
export { LatexView } from './node-views/latex'
export { MentionView } from './node-views/mention'
export { TopicView } from './node-views/topic'
export { EmojiView } from './node-views/emoji'
export { CardView } from './node-views/card'

export { createMockCardInfo } from './api/mock'

export {
  buildCardHTML,
  buildCardBody,
  cardMenuItems,
  cardLabels,
  cardInputFromAttrs,
} from '../core/cards'
export type { CardMenuItem } from '../core/cards'
