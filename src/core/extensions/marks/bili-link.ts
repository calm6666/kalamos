/**
 * 站内链接标记：基于官方 Link 扩展，输出 kala-link kala-link--{type} 类名
 * 对齐 eva3 站内链接类型识别：视频（BV/av 号）、图文、番剧（ep）、漫画（mc）、
 * 音乐（au）、直播（房间号）、游戏、用户空间、投票，未识别为 unknown
 */
import { Link } from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'

/** 站内链接类型枚举 */
export type BiliLinkType =
  | 'video'
  | 'opus'
  | 'comment'
  | 'emoji'
  | 'vote'
  | 'bangumi'
  | 'manga'
  | 'music'
  | 'live'
  | 'game'
  | 'user'
  | 'unknown'

/** 识别规则表：按优先级依次匹配 href */
const linkTypeRules: ReadonlyArray<{ type: BiliLinkType; pattern: RegExp }> = [
  { type: 'video', pattern: /\/video\/(BV[\w]+|av\d+)/i },
  { type: 'bangumi', pattern: /\/bangumi\/play\/ep\d+/i },
  { type: 'manga', pattern: /\/manga\/detail\/mc\d+/i },
  { type: 'music', pattern: /\/audio\/au\d+/i },
  { type: 'live', pattern: /\/live\/\d+/ },
  { type: 'game', pattern: /\/game\/\d+/ },
  { type: 'opus', pattern: /\/opus\/\d+|\/read\/cv\d+/i },
  { type: 'comment', pattern: /#commentTab|#reply/i },
  { type: 'vote', pattern: /\/vote\/\d+/ },
  { type: 'user', pattern: /space\.bilibili\.com\/\d+/ },
]

/** 识别站内链接类型（未匹配返回 unknown） */
export function detectBiliLinkType(href: string): BiliLinkType {
  for (const rule of linkTypeRules) {
    if (rule.pattern.test(href)) {
      return rule.type
    }
  }
  return 'unknown'
}

/** 站内链接标记（替换默认 Link 使用） */
export const BiliLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      linkType: {
        default: null,
        parseHTML: (element) => {
          const explicit = element.getAttribute('data-link-type')
          if (explicit) {
            return explicit
          }
          const href = element.getAttribute('href')
          return href ? detectBiliLinkType(href) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const linkType = attributes['linkType']
          return typeof linkType === 'string' && linkType.length > 0
            ? { 'data-link-type': linkType }
            : {}
        },
      },
    }
  },

  renderHTML({ mark, HTMLAttributes }) {
    const linkType = typeof mark.attrs['linkType'] === 'string' ? mark.attrs['linkType'] : 'unknown'
    return [
      'a',
      mergeAttributes(HTMLAttributes, { class: `kala-link kala-link--${linkType}` }),
      0,
    ]
  },
})
