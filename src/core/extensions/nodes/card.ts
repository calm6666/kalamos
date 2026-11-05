/**
 * 通用业务卡片节点（单一 card 节点承载 16 类卡片 + 20 种视图）
 *
 * - cardType / variant 决定模板（Core 共享 buildCardHTML）
 * - 快照属性（title/desc/cover/data）支撑静态渲染与加载前占位
 * - 静态渲染经 core/render/html.ts 的 nodeMapping 输出与编辑态一致的 DOM
 * - renderHTML 仅作为剪贴板/降级输出（完整 HTML 由 nodeMapping 生成）
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { CardStatus, CardType, CardVariant } from '../../../core/cards/types'

/** 卡片节点属性结构 */
export interface CardAttrs {
  cardType: CardType
  variant: CardVariant
  refId: string
  title: string
  desc: string
  cover: string
  sourceName: string
  badge: string
  /** 完整卡片数据（JSON 序列化字符串） */
  data: string
  status: CardStatus
  cardStyle: 0 | 1
  showText: string
}

/** 默认空快照 */
export const emptyCardAttrs: CardAttrs = {
  cardType: 'generic',
  variant: 'default',
  refId: '',
  title: '',
  desc: '',
  cover: '',
  sourceName: '',
  badge: '',
  data: '',
  status: 'loaded',
  cardStyle: 0,
  showText: '',
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    card: {
      /** 插入卡片 */
      insertCard: (attrs: Partial<CardAttrs>) => ReturnType
      /** 更新卡片快照（NodeView 拉取成功后回写，仅 meta 更新） */
      updateCardSnapshot: (attrs: Partial<CardAttrs>) => ReturnType
    }
  }
}

/** 从包裹元素类名推断卡片类型（静态 HTML 回解析） */
function cardTypeFromElement(element: HTMLElement): CardType {
  const classMap: Record<string, CardType> = {
    'video-card': 'video',
    'top-video-card-wrapper': 'topVideo',
    'opus-card': 'opus',
    'comment-card': 'comment',
    'vote-card': 'vote',
    'music-card': 'music',
    'toy-card': 'toy',
    'mall-card': 'mall',
    'mall-goods-card': 'mallGoods',
    'goods-card': 'goods',
    'manga-card': 'manga',
    'live-card': 'live',
    'game-card': 'game',
    'bangumi-card': 'bangumi',
    'user-card': 'user',
    'generic-card': 'generic',
  }
  for (const [className, cardType] of Object.entries(classMap)) {
    if (element.classList.contains(className)) {
      return cardType
    }
  }
  return emptyCardAttrs.cardType
}

/** 从包裹元素类名推断形态（video player / toy link / comment advanced） */
function variantFromElement(element: HTMLElement, cardType: CardType): CardVariant {
  if (cardType === 'video') {
    return element.classList.contains('video-card--player') ? 'player' : 'detailed'
  }
  if (cardType === 'topVideo') {
    return 'top'
  }
  if (cardType === 'toy') {
    return element.classList.contains('toy-card--link') ? 'link' : 'card'
  }
  if (cardType === 'comment') {
    return element.querySelector('.comment-card-container.advanced') !== null ? 'advanced' : 'basic'
  }
  return emptyCardAttrs.variant
}

/** 读取文本节点的内容（防御空值） */
function textOf(element: Element | null): string {
  return element?.textContent ?? ''
}

export const Card = Node.create({
  name: 'card',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      cardType: {
        default: emptyCardAttrs.cardType,
        parseHTML: (element) => element.getAttribute('data-card-type') ?? cardTypeFromElement(element),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-card-type': typeof attributes['cardType'] === 'string' ? attributes['cardType'] : 'generic',
        }),
      },
      variant: {
        default: emptyCardAttrs.variant,
        parseHTML: (element) => {
          const explicit = element.getAttribute('data-variant')
          if (explicit !== null) {
            return explicit
          }
          return variantFromElement(element, cardTypeFromElement(element))
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-variant': typeof attributes['variant'] === 'string' ? attributes['variant'] : 'default',
        }),
      },
      refId: {
        default: emptyCardAttrs.refId,
        parseHTML: (element) => element.getAttribute('data-ref-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-ref-id': typeof attributes['refId'] === 'string' ? attributes['refId'] : '',
        }),
      },
      title: {
        default: emptyCardAttrs.title,
        parseHTML: (element) => textOf(element.querySelector('.video-card-detailed-title, .opus-title, .music-title, .toy-card-title, .mall-card-title, .game-card-title, .goods-card-title, .manga-title, .live-title, .bangumi-card-title, .generic-card-title, .author-name')),
        renderHTML: () => ({}),
      },
      desc: {
        default: emptyCardAttrs.desc,
        parseHTML: (element) => textOf(element.querySelector('.video-card-detailed-description, .opus-details, .music-intro, .manga-summary, .game-card-summary, .generic-card-description, .comment-text')),
        renderHTML: () => ({}),
      },
      cover: {
        default: emptyCardAttrs.cover,
        parseHTML: (element) => element.querySelector('.video-thumbnail, .opus-cover img, .music-cover img, .toy-card-cover img, .mall-card-cover img, .game-card-cover img, .goods-card-image img, .manga-cover, .live-cover img, .bangumi-card-cover img, .user-avatar-fallback, .generic-card-media img')?.getAttribute('src') ?? '',
        renderHTML: () => ({}),
      },
      sourceName: {
        default: emptyCardAttrs.sourceName,
        parseHTML: () => '',
        renderHTML: () => ({}),
      },
      badge: {
        default: emptyCardAttrs.badge,
        parseHTML: (element) => textOf(element.querySelector('.video-card-badge span, .music-badge, .manga-badge, .live-badge, .game-card-badge, .bangumi-card-badge, .vote-card-multi-tag')),
        renderHTML: () => ({}),
      },
      data: {
        default: emptyCardAttrs.data,
        parseHTML: (element) => element.getAttribute('data-card') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => {
          const data = attributes['data']
          return typeof data === 'string' && data.length > 0 ? { 'data-card': data } : {}
        },
      },
      status: {
        default: emptyCardAttrs.status,
        parseHTML: (element) => element.getAttribute('data-status') ?? 'loaded',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-status': typeof attributes['status'] === 'string' ? attributes['status'] : 'loaded',
        }),
      },
      cardStyle: {
        default: emptyCardAttrs.cardStyle,
        parseHTML: (element) => (element.getAttribute('data-style') === '1' ? 1 : 0),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-style': attributes['cardStyle'] === 1 ? '1' : '0',
        }),
      },
      showText: {
        default: emptyCardAttrs.showText,
        parseHTML: (element) => textOf(element.querySelector('.toy-card-link__text')),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div.kala-card-wrapper' },
      { tag: 'div.kala-card' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const get = (key: string): string => {
      const value = node.attrs[key]
      return typeof value === 'string' ? value : ''
    }
    const attrs = mergeAttributes(HTMLAttributes, { class: 'kala-card kala-card--clipboard' })
    const title = get('title')
    const desc = get('desc')
    return [
      'div',
      attrs,
      ['div', { class: 'kala-card-title' }, title],
      ['div', { class: 'kala-card-desc' }, desc],
    ]
  },

  renderText({ node }) {
    const title = typeof node.attrs['title'] === 'string' ? node.attrs['title'] : ''
    const cardType = typeof node.attrs['cardType'] === 'string' ? node.attrs['cardType'] : 'generic'
    return `[卡片：${cardType} ${title}]`
  },

  addCommands() {
    return {
      insertCard:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs })
        },
      updateCardSnapshot:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attrs)
        },
    }
  },
})
