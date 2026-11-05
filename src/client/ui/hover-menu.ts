/**
 * 悬浮操作菜单（卡片 / 链接 / 图片共用）
 *
 * 逆向自原站编辑器生产包的 eva-link-hover-menu 与 eva-image-hover-menu：
 * - 浮动操作条：左侧按钮组（data-action 命名与原版一致），间隔 divider
 * - 右侧视图切换下拉：按卡片/链接类型生成选项，面板宽度含置顶项 208px、否则 124px
 * - 悬停 300ms 显示、移出 200ms 隐藏，fadeIn 120ms；删除按钮悬停变 #fb7299
 * - 各类型按钮组：视频/图文/直播/评论/番剧/音乐/玩具/游戏/漫画/名片 = 访问+编辑+删除；
 *   投票 = 编辑+删除；商品/会员购 = 访问+删除；图片 = 重新上传(失败态)+替换+删除
 * - 视图行为：链接视图（卡片转文本链接）、卡片/播放视图（cardStyle 0/1）、
 *   图片视图（评论卡基础视图）、极简视图（名片转行内提及）、置顶视图（文档顶部插入置顶视频）
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { t } from '../i18n'
import { positionFloating } from './floating'
import { buildFooter, buildModal, openLinkModal } from './modals'
import type { CardModalResult } from './modals'
import { bdcIcon } from '../../core/cards/icons'
import { isRecord, readNumber, readRecord, readString } from '../../core/cards/utils'
import { readUserInlineFields, userInlineInfoFromAttrs } from '../../core/cards/user-inline'
import { toCardType } from '../../core/cards'
import { detectBiliLinkType } from '../../core/extensions/marks/bili-link'
import { cardViewRegistry } from '../node-views/card'
import { imageViewRegistry } from '../node-views/image'
import { userInlineViewRegistry } from '../node-views/user-inline'
import type { CardType, EditorApi } from '../../core/types'

/** 装配悬浮菜单所需的外部能力 */
export interface HoverMenuOptions {
  /** 播放器级 API（卡片信息拉取、图片上传） */
  api: EditorApi
  /** 编辑卡片来源（打开对应类型编辑弹窗；取消返回 null，确认返回 refId / showText / displayMode） */
  editCard: (cardType: CardType, refId: string) => Promise<CardModalResult | null>
}

/** 菜单按钮项 */
interface MenuButtonItem {
  action: string
  text: string
  icon: string
  tooltip: string
  onClick: () => void
}

/** 视图切换选项 */
interface ViewOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
  tooltip?: string
}

/** 悬停目标类型 */
type HoverType = 'card' | 'link' | 'image' | 'inline'

/** 卡片节点上下文（由 NodeView 注册表解析） */
interface CardContext {
  node: PMNode
  pos: number
  cardType: CardType
  refId: string
  info: Record<string, unknown>
  /** 名片极简视图（userInline 节点） */
  isInline?: boolean
}

/** 链接上下文（mark 渲染出的 a 元素） */
interface LinkContext {
  from: number
  to: number
  href: string
  text: string
  linkType: string
}

/** 悬停显示延迟 */
const HOVER_DELAY = 300
/** 移出隐藏延迟 */
const HIDE_DELAY = 200

/** 按钮组含「访问」的类型 */
const VISITABLE_TYPES = new Set<CardType>([
  'video',
  'topVideo',
  'opus',
  'live',
  'comment',
  'bangumi',
  'music',
  'toy',
  'game',
  'manga',
  'user',
  'goods',
  'mall',
  'mallGoods',
])

/** 按钮组含「编辑」的类型 */
const EDITABLE_TYPES = new Set<CardType>([
  'video',
  'topVideo',
  'opus',
  'live',
  'comment',
  'bangumi',
  'music',
  'toy',
  'game',
  'manga',
  'user',
  'vote',
  'generic',
])

/** 「访问」按钮 tooltip（各类型独立文案） */
const VISIT_TOOLTIPS: Partial<Record<CardType, string>> = {
  video: 'hoverMenu.visitVideo',
  opus: 'hoverMenu.visitArticle',
  live: 'hoverMenu.visitLive',
  comment: 'hoverMenu.visitComment',
  bangumi: 'hoverMenu.visitBangumi',
  music: 'hoverMenu.visitMusic',
  toy: 'hoverMenu.visitToy',
  game: 'hoverMenu.visitGame',
  manga: 'hoverMenu.visitManga',
  user: 'hoverMenu.visitUser',
}

/** 「编辑」按钮 tooltip（各类型独立文案） */
const EDIT_TOOLTIPS: Partial<Record<CardType, string>> = {
  video: 'hoverMenu.editVideo',
  opus: 'hoverMenu.editArticle',
  live: 'hoverMenu.editLive',
  comment: 'hoverMenu.editComment',
  bangumi: 'hoverMenu.editBangumi',
  music: 'hoverMenu.editMusic',
  toy: 'hoverMenu.editToy',
  game: 'hoverMenu.editGame',
  manga: 'hoverMenu.editManga',
  user: 'hoverMenu.editUser',
  vote: 'hoverMenu.editVote',
  generic: 'hoverMenu.editCard',
}

/** 图标：编辑 */
const ICON_EDIT = 'BDC/pen_write_square_line/2'
/** 图标：删除 */
const ICON_TRASH = 'BDC/trash_delete_line/2'
/** 图标：重新上传 */
const ICON_RETRY = 'BDC/arrow_replay_line/2'
/** 图标：替换 */
const ICON_REPLACE = 'BDC/arrow_refresh_line/3'
/** 图标：下拉箭头 */
const ICON_ARROW = 'BDC/arrow_expand_line/4'

/** 类型 + refId 兜底跳转链接 */
function fallbackCardUrl(cardType: CardType, refId: string): string {
  if (refId.length === 0) {
    return ''
  }
  switch (cardType) {
    case 'video':
    case 'topVideo':
      return `https://www.bilibili.com/video/${refId}`
    case 'opus':
      return `https://www.bilibili.com/opus/${refId}`
    case 'live':
      return `https://live.bilibili.com/${refId}`
    case 'bangumi':
      return refId.startsWith('ep') || refId.startsWith('ss')
        ? `https://www.bilibili.com/bangumi/play/${refId}`
        : `https://www.bilibili.com/bangumi/play/ss${refId}`
    case 'manga':
      return `https://manga.bilibili.com/detail/mc${refId}`
    case 'music':
      return `https://www.bilibili.com/audio/au${refId}`
    case 'user':
      return `https://space.bilibili.com/${refId}`
    case 'game':
      return `https://www.bilibili.com/game/${refId}`
    default:
      return ''
  }
}

/** 卡片跳转链接：优先 info.jump_url / info.link，追加视频起始时间参数 */
function cardJumpUrl(info: Record<string, unknown>, cardType: CardType, refId: string): string {
  let url = readString(info, 'jump_url') || readString(info, 'link') || fallbackCardUrl(cardType, refId)
  const ts = readRecord(info, 'video_ts')
  const startTime = ts !== null ? readNumber(ts, 'start_time') : 0
  if (url.length > 0 && startTime > 0) {
    url += `${url.includes('?') ? '&' : '?'}t=${startTime}`
  }
  return url
}

/** 从 data JSON 中解析 info 对象 */
function infoFromJson(json: string): Record<string, unknown> | null {
  if (json.length === 0) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(json)
    if (isRecord(parsed)) {
      const nested = parsed['info']
      return isRecord(nested) ? nested : parsed
    }
    return null
  } catch {
    return null
  }
}

/** 从链接 URL 解析 B 站资源 id */
function refIdFromUrl(linkType: string, href: string): string {
  const rules: ReadonlyArray<{ type: string; pattern: RegExp }> = [
    { type: 'video', pattern: /\/video\/(BV\w+|av\d+)/i },
    { type: 'opus', pattern: /\/opus\/(\d+)|\/read\/cv(\d+)/i },
    { type: 'vote', pattern: /\/vote\/(\d+)/ },
    { type: 'bangumi', pattern: /\/bangumi\/play\/(ep\d+|ss\d+)/i },
    { type: 'manga', pattern: /\/manga\/detail\/(mc\d+)/i },
    { type: 'music', pattern: /\/audio\/(au\d+)/i },
    { type: 'live', pattern: /live\.bilibili\.com\/(\d+)/ },
    { type: 'game', pattern: /\/game\/(\d+)/ },
    { type: 'user', pattern: /space\.bilibili\.com\/(\d+)/ },
  ]
  for (const rule of rules) {
    if (rule.type !== linkType) {
      continue
    }
    const matched = rule.pattern.exec(href)
    if (matched === null) {
      continue
    }
    for (let index = 1; index < matched.length; index += 1) {
      const group = matched[index]
      if (group !== undefined) {
        return group
      }
    }
  }
  return ''
}

/** 链接类型对应的卡片类型 */
function linkCardType(linkType: string): CardType | null {
  switch (linkType) {
    case 'video':
      return 'video'
    case 'opus':
      return 'opus'
    case 'comment':
      return 'comment'
    case 'bangumi':
      return 'bangumi'
    case 'manga':
      return 'manga'
    case 'music':
      return 'music'
    case 'live':
      return 'live'
    case 'game':
      return 'game'
    case 'vote':
      return 'vote'
    case 'user':
      return 'user'
    default:
      return null
  }
}

/** 转卡片时的初始视图形态 */
function cardVariantFor(cardType: CardType, cardStyle: 0 | 1): string {
  if (cardType === 'video') {
    return cardStyle === 1 ? 'player' : 'detailed'
  }
  if (cardType === 'comment') {
    return cardStyle === 1 ? 'advanced' : 'basic'
  }
  return 'default'
}

/**
 * 装配悬浮菜单（卡片 / 链接 / 图片共用一个浮动操作条）
 * 返回清理函数（销毁编辑器时调用）
 */
export function setupHoverMenu(editor: Editor, options: HoverMenuOptions): () => void {
  const { api } = options
  const menu = document.createElement('div')
  menu.className = 'kala-hover-menu'
  menu.style.display = 'none'
  document.body.appendChild(menu)

  let currentEl: HTMLElement | null = null
  let currentType: HoverType | null = null
  let visible = false
  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let selectOpen = false

  const clearTimers = (): void => {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  const scheduleShow = (el: HTMLElement, type: HoverType): void => {
    clearTimers()
    hoverTimer = setTimeout(() => {
      showMenu(el, type)
    }, HOVER_DELAY)
  }

  const scheduleHide = (): void => {
    clearTimers()
    hideTimer = setTimeout(() => {
      hideMenu()
    }, HIDE_DELAY)
  }

  const hideMenu = (): void => {
    clearTimers()
    visible = false
    currentEl = null
    currentType = null
    selectOpen = false
    menu.style.display = 'none'
  }

  /** 悬停目标解析：链接 > 卡片 > 图片（与原版优先级一致） */
  const resolveHoverTarget = (target: EventTarget | null): { el: HTMLElement; type: HoverType } | null => {
    if (!(target instanceof Element)) {
      return null
    }
    const link = target.closest('a.kala-link')
    if (link instanceof HTMLElement && link.closest('.kala-card-wrapper, .kala-image') === null) {
      return { el: link, type: 'link' }
    }
    const card = target.closest('.kala-card-wrapper')
    if (card instanceof HTMLElement) {
      return { el: card, type: 'card' }
    }
    const image = target.closest('.kala-image')
    if (image instanceof HTMLElement) {
      return { el: image, type: 'image' }
    }
    const inline = target.closest('.user-inline-wrapper')
    if (inline instanceof HTMLElement) {
      return { el: inline, type: 'inline' }
    }
    return null
  }

  /** 指针是否仍在当前悬停元素内 */
  const stillInside = (el: Element): boolean => {
    if (currentEl === null || currentType === null) {
      return false
    }
    const selector =
      currentType === 'card'
        ? '.kala-card-wrapper'
        : currentType === 'link'
          ? 'a.kala-link'
          : currentType === 'inline'
            ? '.user-inline-wrapper'
            : '.kala-image'
    return el.closest(selector) === currentEl
  }

  /** 卡片 NodeView 上下文（经注册表获取节点，避免 DOM 位置反推） */
  const readCardContext = (el: HTMLElement): CardContext | null => {
    const root = el.closest('.kala-card-node-view')
    if (root instanceof HTMLElement) {
      const cardView = cardViewRegistry.get(root)
      if (cardView === undefined) {
        return null
      }
      const pos = cardView.getPosition()
      if (pos === undefined) {
        return null
      }
      const node = cardView.getNode()
      const cardType = toCardType(typeof node.attrs['cardType'] === 'string' ? node.attrs['cardType'] : 'generic')
      const refId = typeof node.attrs['refId'] === 'string' ? node.attrs['refId'] : ''
      const info = infoFromJson(typeof node.attrs['data'] === 'string' ? node.attrs['data'] : '')
      return { node, pos, cardType, refId, info: info ?? {} }
    }
    // 名片极简视图：userInline 节点（info 为对象属性）
    const inlineRoot = el.closest('.user-inline-wrapper')
    if (!(inlineRoot instanceof HTMLElement)) {
      return null
    }
    const inlineView = userInlineViewRegistry.get(inlineRoot)
    if (inlineView === undefined) {
      return null
    }
    const pos = inlineView.getPosition()
    if (pos === undefined) {
      return null
    }
    const node = inlineView.getNode()
    const info = userInlineInfoFromAttrs(node.attrs['info'])
    const { mid } = readUserInlineFields(info)
    return { node, pos, cardType: 'user', refId: mid, info, isInline: true }
  }

  /** 链接上下文（mark 渲染出的 a 元素 → 文档区间） */
  const readLinkContext = (el: HTMLElement): LinkContext | null => {
    let from: number
    try {
      from = editor.view.posAtDOM(el, 0)
    } catch {
      return null
    }
    let to: number
    try {
      to = editor.view.posAtDOM(el, el.childNodes.length)
    } catch {
      return null
    }
    if (from < 0 || to < from) {
      return null
    }
    return {
      from,
      to,
      href: el.getAttribute('href') ?? '',
      text: el.textContent ?? '',
      linkType: el.getAttribute('data-link-type') ?? '',
    }
  }

  /** 图片 NodeView 上下文 */
  const readImageContext = (figure: HTMLElement): { node: PMNode; pos: number } | null => {
    const imageView = imageViewRegistry.get(figure)
    if (imageView === undefined) {
      return null
    }
    const pos = imageView.getPosition()
    if (pos === undefined) {
      return null
    }
    return { node: imageView.getNode(), pos }
  }

  /** 编辑卡片来源（确认后按 displayMode 决定 refId 更新或名片转行内极简视图） */
  const editCard = async (ctx: CardContext): Promise<void> => {
    const next = await options.editCard(ctx.cardType, ctx.refId)
    if (next === null || next.refId.length === 0) {
      return
    }
    // 名片：编辑态强制 manual + inline，确认后原位写入行内极简视图
    if (ctx.cardType === 'user' && next.displayMode === 'inline') {
      if (ctx.isInline === true) {
        if (next.userInfo === undefined) {
          return
        }
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(ctx.pos, undefined, {
            ...ctx.node.attrs,
            info: next.userInfo,
          }),
        )
      } else {
        // 卡片形态的名片：替换为 userInline 节点（信息拉取失败则退回 refId 更新）
        if (next.userInfo === undefined) {
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(ctx.pos, undefined, {
              ...ctx.node.attrs,
              refId: next.refId,
              status: 'loading',
            }),
          )
        } else {
          editor
            .chain()
            .focus()
            .insertContentAt(
              { from: ctx.pos, to: ctx.pos + ctx.node.nodeSize },
              { type: 'userInline', attrs: { status: 'loaded', info: next.userInfo } },
            )
            .run()
        }
      }
      hideMenu()
      return
    }
    if (next.refId === ctx.refId && next.showText === undefined) {
      return
    }
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(ctx.pos, undefined, {
        ...ctx.node.attrs,
        refId: next.refId,
        showText: next.showText ?? ctx.node.attrs['showText'],
        title: '',
        desc: '',
        cover: '',
        sourceName: '',
        badge: '',
        data: '',
        status: 'loading',
      }),
    )
    hideMenu()
  }

  /** 编辑链接（复用链接弹窗：更新 href/文本或移除链接） */
  const editLink = async (link: LinkContext): Promise<void> => {
    const result = await openLinkModal({ href: link.href, text: link.text })
    if (result === null) {
      return
    }
    if (result.remove) {
      removeLinkMark(link)
      hideMenu()
      return
    }
    const markType = editor.schema.marks['link']
    if (markType === undefined) {
      return
    }
    const attrs = { href: result.href, linkType: detectBiliLinkType(result.href) }
    if (result.text.length > 0 && result.text !== link.text) {
      editor.view.dispatch(
        editor.view.state.tr.replaceWith(link.from, link.to, editor.schema.text(result.text, [markType.create(attrs)])),
      )
    } else {
      editor.view.dispatch(editor.view.state.tr.addMark(link.from, link.to, markType.create(attrs)))
    }
    hideMenu()
  }

  /** 移除链接 mark */
  const removeLinkMark = (link: LinkContext): void => {
    const markType = editor.schema.marks['link']
    if (markType === undefined) {
      return
    }
    editor.view.dispatch(editor.view.state.tr.removeMark(link.from, link.to, markType))
  }

  /** 卡片是否包含置顶视频节点 */
  const docHasTopVideo = (): boolean => {
    let found = false
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'card' && node.attrs['cardType'] === 'topVideo') {
        found = true
      }
      return !found
    })
    return found
  }

  /** 是否替换当前置顶视频确认弹窗 */
  const showTopVideoConfirm = (onConfirm: () => void): void => {
    const { mask, modal } = buildModal(t('hoverMenu.topConfirmTitle'))
    const desc = document.createElement('div')
    desc.className = 'kala-modal__desc'
    desc.textContent = t('hoverMenu.topConfirmDesc')
    modal.appendChild(desc)
    buildFooter(modal, [
      { text: t('hoverMenu.cancel'), primary: false, onClick: () => mask.remove() },
      {
        text: t('hoverMenu.confirm'),
        primary: true,
        onClick: () => {
          mask.remove()
          onConfirm()
        },
      },
    ])
    document.body.appendChild(mask)
  }

  /** 在文档最前插入置顶视频卡，并删除原卡片 / 链接 */
  const insertTopVideo = (refId: string, info: Record<string, unknown>, range: { from: number; to: number }): void => {
    const cardNodeType = editor.schema.nodes['card']
    if (cardNodeType === undefined) {
      return
    }
    const cardNode = cardNodeType.create({
      cardType: 'topVideo',
      variant: 'top',
      refId,
      title: readString(info, 'title'),
      desc: readString(info, 'desc'),
      cover: readString(info, 'cover'),
      sourceName: '',
      badge: '',
      data: JSON.stringify({ info }),
      status: 'loaded',
      cardStyle: 1,
    })
    const tr = editor.state.tr
    tr.insert(0, cardNode)
    tr.delete(range.from + cardNode.nodeSize, range.to + cardNode.nodeSize)
    editor.view.dispatch(tr)
  }

  /** 置顶请求入口：已有置顶视频时先弹替换确认 */
  const requestTopVideo = (
    refId: string,
    info: Record<string, unknown> | null,
    range: { from: number; to: number },
  ): void => {
    const execute = (): void => {
      if (info !== null) {
        insertTopVideo(refId, info, range)
        return
      }
      void api
        .fetchCardInfo('video', refId)
        .then((cardInfo) => {
          insertTopVideo(
            refId,
            infoFromJson(cardInfo.data) ?? { title: cardInfo.title, desc: cardInfo.desc, cover: cardInfo.cover },
            range,
          )
        })
        .catch(() => undefined)
    }
    if (docHasTopVideo()) {
      showTopVideoConfirm(execute)
      return
    }
    execute()
  }

  /** 置顶视图：卡片来源直接复用快照 info；链接来源从 URL 解析后拉取 */
  const handleTopVideo = (source: { kind: 'card'; ctx: CardContext } | { kind: 'link'; link: LinkContext }): void => {
    if (source.kind === 'card') {
      const refId = readString(source.ctx.info, 'bvid') || readString(source.ctx.info, 'avid') || source.ctx.refId
      if (refId.length === 0) {
        return
      }
      requestTopVideo(refId, source.ctx.info, {
        from: source.ctx.pos,
        to: source.ctx.pos + source.ctx.node.nodeSize,
      })
      return
    }
    const refId = refIdFromUrl('video', source.link.href)
    if (refId.length === 0) {
      return
    }
    requestTopVideo(refId, null, { from: source.link.from, to: source.link.to })
  }

  /** 卡片 → 文本链接：删除卡片，插入带链接 mark 的标题文本 */
  const convertCardToLink = (ctx: CardContext): void => {
    const href = cardJumpUrl(ctx.info, ctx.cardType, ctx.refId)
    if (href.length === 0) {
      return
    }
    const text = readString(ctx.info, 'title') || ctx.refId || href
    editor.chain()
      .insertContentAt(
        { from: ctx.pos, to: ctx.pos + ctx.node.nodeSize },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text,
              marks: [{ type: 'link', attrs: { href, linkType: detectBiliLinkType(href) } }],
            },
          ],
        },
      )
      .run()
  }

  /** 名片卡 → 行内极简视图：转换为 userInline 节点（info 原样传递） */
  const convertUserCardToInline = (ctx: CardContext): void => {
    editor.chain()
      .insertContentAt(
        { from: ctx.pos, to: ctx.pos + ctx.node.nodeSize },
        {
          type: 'paragraph',
          content: [{ type: 'userInline', attrs: { status: 'loaded', info: ctx.info } }],
        },
      )
      .run()
  }

  /** 行内极简视图 → 名片卡：复用原 info 快照直接回卡，不重新拉取 */
  const convertUserInlineToCard = (ctx: CardContext): void => {
    const { name } = readUserInlineFields(ctx.info)
    editor.chain()
      .insertContentAt(
        { from: ctx.pos, to: ctx.pos + ctx.node.nodeSize },
        {
          type: 'card',
          attrs: {
            cardType: 'user',
            refId: ctx.refId,
            variant: 'default',
            cardStyle: 0,
            title: name,
            desc: '',
            cover: '',
            sourceName: '',
            badge: '',
            data: JSON.stringify({ info: ctx.info }),
            status: 'loaded',
          },
        },
      )
      .run()
  }

  /** 卡片视图切换 */
  const applyCardView = (ctx: CardContext, view: string): void => {
    const setAttrs = (attrs: Record<string, unknown>): void => {
      editor.view.dispatch(editor.view.state.tr.setNodeMarkup(ctx.pos, undefined, { ...ctx.node.attrs, ...attrs }))
    }
    switch (view) {
      case 'card':
        if (ctx.cardType === 'video') {
          setAttrs({ cardStyle: 0, variant: 'detailed' })
        } else if (ctx.cardType === 'comment') {
          setAttrs({ cardStyle: 1, variant: 'advanced' })
        } else if (ctx.cardType === 'user' && ctx.isInline === true) {
          convertUserInlineToCard(ctx)
        }
        break
      case 'player':
        if (ctx.cardType === 'video') {
          setAttrs({ cardStyle: 1, variant: 'player' })
        }
        break
      case 'image':
        if (ctx.cardType === 'comment') {
          setAttrs({ cardStyle: 0, variant: 'basic' })
        }
        break
      case 'link':
        convertCardToLink(ctx)
        break
      case 'inline':
        if (ctx.cardType === 'user' && ctx.isInline !== true) {
          convertUserCardToInline(ctx)
        }
        break
      case 'top':
        handleTopVideo({ kind: 'card', ctx })
        break
    }
    hideMenu()
  }

  /** 链接 → 卡片（cardStyle 0 = 卡片视图 / 1 = 播放视图） */
  const convertLinkToCard = (link: LinkContext, cardStyle: 0 | 1): void => {
    const cardType = linkCardType(link.linkType)
    const refId = refIdFromUrl(link.linkType, link.href)
    if (cardType === null || refId.length === 0) {
      return
    }
    editor.chain()
      .insertContentAt(
        { from: link.from, to: link.to },
        {
          type: 'card',
          attrs: { cardType, refId, variant: cardVariantFor(cardType, cardStyle), cardStyle, status: 'loading' },
        },
      )
      .run()
  }

  /** 评论链接 → 图片视图评论卡 */
  const convertLinkToCommentImage = (link: LinkContext): void => {
    const refId = refIdFromUrl('comment', link.href)
    if (refId.length === 0) {
      return
    }
    editor.chain()
      .insertContentAt(
        { from: link.from, to: link.to },
        {
          type: 'card',
          attrs: { cardType: 'comment', refId, variant: 'basic', cardStyle: 0, status: 'loading' },
        },
      )
      .run()
  }

  /** 链接视图切换 */
  const applyLinkView = (link: LinkContext, view: string): void => {
    switch (view) {
      case 'card':
        convertLinkToCard(link, 0)
        break
      case 'player':
        convertLinkToCard(link, 1)
        break
      case 'image':
        convertLinkToCommentImage(link)
        break
      case 'top':
        handleTopVideo({ kind: 'link', link })
        break
    }
    hideMenu()
  }

  /** 卡片按钮组（按类型生成） */
  const cardButtons = (ctx: CardContext): MenuButtonItem[] => {
    const items: MenuButtonItem[] = []
    if (VISITABLE_TYPES.has(ctx.cardType)) {
      items.push({
        action: 'openCard',
        text: t('hoverMenu.visit'),
        icon: '',
        tooltip: t(VISIT_TOOLTIPS[ctx.cardType] ?? 'hoverMenu.visitCard'),
        onClick: () => {
          const url = cardJumpUrl(ctx.info, ctx.cardType, ctx.refId)
          if (url.length > 0) {
            window.open(url, '_blank')
          }
        },
      })
    }
    if (EDITABLE_TYPES.has(ctx.cardType)) {
      items.push({
        action: 'editCard',
        text: t('hoverMenu.edit'),
        icon: ICON_EDIT,
        tooltip: t(EDIT_TOOLTIPS[ctx.cardType] ?? 'hoverMenu.editCard'),
        onClick: () => {
          void editCard(ctx)
        },
      })
    }
    items.push({
      action: 'deleteCard',
      text: t('hoverMenu.delete'),
      icon: ICON_TRASH,
      tooltip: t('hoverMenu.deleteCard'),
      onClick: () => {
        editor.view.dispatch(editor.view.state.tr.delete(ctx.pos, ctx.pos + ctx.node.nodeSize))
        hideMenu()
      },
    })
    return items
  }

  /** 链接按钮组：访问 + 编辑 + 删除 */
  const linkButtons = (link: LinkContext): MenuButtonItem[] => {
    const items: MenuButtonItem[] = []
    if (link.href.length > 0) {
      items.push({
        action: 'openLink',
        text: t('hoverMenu.visit'),
        icon: '',
        tooltip: t('hoverMenu.visitLink'),
        onClick: () => {
          window.open(link.href, '_blank')
        },
      })
    }
    items.push({
      action: 'editLink',
      text: t('hoverMenu.edit'),
      icon: ICON_EDIT,
      tooltip: t('hoverMenu.editLink'),
      onClick: () => {
        void editLink(link)
      },
    })
    items.push({
      action: 'removeLink',
      text: t('hoverMenu.delete'),
      icon: ICON_TRASH,
      tooltip: t('hoverMenu.deleteLink'),
      onClick: () => {
        removeLinkMark(link)
        hideMenu()
      },
    })
    return items
  }

  /** 图片按钮组：重新上传（失败态）+ 替换 + 删除 */
  const imageButtons = (figure: HTMLElement): MenuButtonItem[] => {
    const ctx = readImageContext(figure)
    if (ctx === null) {
      return []
    }
    const status = typeof ctx.node.attrs['status'] === 'string' ? ctx.node.attrs['status'] : 'loaded'
    const items: MenuButtonItem[] = []
    if (status === 'error') {
      items.push({
        action: 'retryUpload',
        text: t('hoverMenu.reupload'),
        icon: ICON_RETRY,
        tooltip: t('hoverMenu.reuploadImage'),
        onClick: () => {
          replaceImageFile(figure)
        },
      })
    }
    if (status !== 'loading') {
      items.push({
        action: 'replaceImage',
        text: t('hoverMenu.replace'),
        icon: ICON_REPLACE,
        tooltip: t('hoverMenu.replaceImage'),
        onClick: () => {
          replaceImageFile(figure)
        },
      })
      items.push({
        action: 'deleteImage',
        text: t('hoverMenu.delete'),
        icon: ICON_TRASH,
        tooltip: t('hoverMenu.deleteImage'),
        onClick: () => {
          editor.view.dispatch(editor.view.state.tr.delete(ctx.pos, ctx.pos + ctx.node.nodeSize))
          hideMenu()
        },
      })
    }
    return items
  }

  /** 选择图片文件上传并回写节点 */
  const replaceImageFile = (figure: HTMLElement): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png, image/jpeg, image/gif, image/webp'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      document.body.removeChild(input)
      const file = input.files?.[0]
      if (file === undefined) {
        return
      }
      void api
        .uploadImage(file)
        .then((result) => updateImageNode(figure, { src: result.src, status: 'loaded' }))
        .catch(() => updateImageNode(figure, { status: 'error' }))
    })
    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
    })
    document.body.appendChild(input)
    input.click()
  }

  /** 更新图片节点属性 */
  const updateImageNode = (figure: HTMLElement, attrs: Record<string, unknown>): void => {
    const ctx = readImageContext(figure)
    if (ctx === null) {
      return
    }
    editor.view.dispatch(editor.view.state.tr.setNodeMarkup(ctx.pos, undefined, { ...ctx.node.attrs, ...attrs }))
  }

  /** 置顶视图选项（播放禁用条件与置顶一致） */
  const topViewOption = (disabled: boolean, onlyFans: boolean): ViewOption => ({
    value: 'top',
    label: t('hoverMenu.topView'),
    description: t('hoverMenu.topViewDesc'),
    disabled,
    tooltip: disabled
      ? t(onlyFans ? 'hoverMenu.onlyFansTopNotSupported' : 'hoverMenu.topNotSupported')
      : undefined,
  })

  /** 卡片视图选项（按类型生成） */
  const cardViewOptions = (ctx: CardContext): ViewOption[] => {
    const linkView: ViewOption = { value: 'link', label: t('hoverMenu.linkView') }
    const cardView: ViewOption = { value: 'card', label: t('hoverMenu.cardView') }
    if (ctx.cardType === 'video') {
      const mediaType = readNumber(ctx.info, 'media_type')
      const onlyFans = ctx.info['is_only_fans'] === true
      const noPlayer = mediaType === 2 || (onlyFans && mediaType === 1)
      return [
        linkView,
        cardView,
        {
          value: 'player',
          label: t('hoverMenu.playerView'),
          disabled: noPlayer,
          tooltip: noPlayer
            ? t(onlyFans ? 'hoverMenu.onlyFansPlayerNotSupported' : 'hoverMenu.playerNotSupported')
            : undefined,
        },
        topViewOption(noPlayer, onlyFans),
      ]
    }
    if (ctx.cardType === 'comment') {
      return [linkView, cardView, { value: 'image', label: t('hoverMenu.imageView') }]
    }
    if (ctx.cardType === 'user') {
      return [cardView, { value: 'inline', label: t('hoverMenu.inlineView') }]
    }
    return [linkView, cardView]
  }

  /** 卡片当前视图（用于下拉高亮） */
  const cardCurrentView = (ctx: CardContext): string => {
    if (ctx.isInline === true) {
      return 'inline'
    }
    if (ctx.cardType === 'video') {
      return ctx.node.attrs['cardStyle'] === 1 ? 'player' : 'card'
    }
    if (ctx.cardType === 'comment') {
      return ctx.node.attrs['variant'] === 'basic' ? 'image' : 'card'
    }
    return 'card'
  }

  /** 链接视图选项（按链接类型生成；未识别类型不显示下拉） */
  const linkViewOptions = (link: LinkContext): ViewOption[] => {
    const linkView: ViewOption = { value: 'link', label: t('hoverMenu.linkView') }
    const cardView: ViewOption = { value: 'card', label: t('hoverMenu.cardView') }
    switch (link.linkType) {
      case 'video':
        return [linkView, cardView, { value: 'player', label: t('hoverMenu.playerView') }, topViewOption(false, false)]
      case 'comment':
        return [linkView, cardView, { value: 'image', label: t('hoverMenu.imageView') }]
      case 'opus':
      case 'bangumi':
      case 'manga':
      case 'music':
      case 'live':
      case 'game':
      case 'vote':
      case 'user':
        return [linkView, cardView]
      default:
        return []
    }
  }

  /** 构建视图切换下拉（触发器 + 选项面板） */
  const buildViewSelect = (viewOptions: ViewOption[], currentView: string, onChange: (value: string) => void): HTMLDivElement => {
    const wrapper = document.createElement('div')
    wrapper.className = 'view-selector'
    const select = document.createElement('div')
    select.className = 'kala-view-select'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'kala-view-select__trigger'
    const labelWrap = document.createElement('div')
    labelWrap.className = 'kala-view-select__label'
    const label = document.createElement('span')
    label.textContent = viewOptions.find((option) => option.value === currentView)?.label ?? t('hoverMenu.selectView')
    const arrowHolder = document.createElement('span')
    arrowHolder.innerHTML = bdcIcon(ICON_ARROW)
    const arrowIcon = arrowHolder.firstElementChild
    if (arrowIcon !== null) {
      arrowIcon.classList.add('arrow-icon')
    }
    labelWrap.append(label, arrowHolder)
    trigger.appendChild(labelWrap)

    const panel = document.createElement('div')
    panel.className = 'kala-view-select__panel'
    panel.style.width = viewOptions.some((option) => option.value === 'top') ? '208px' : '124px'
    panel.style.display = 'none'
    for (const option of viewOptions) {
      const item = document.createElement('div')
      item.className = `kala-view-select__option${option.value === currentView ? ' active' : ''}${
        option.disabled === true ? ' disabled' : ''
      }`
      if (option.tooltip !== undefined) {
        item.title = option.tooltip
      }
      const main = document.createElement('div')
      main.className = 'kala-view-select__option-main'
      main.textContent = option.label
      item.appendChild(main)
      if (option.description !== undefined) {
        const desc = document.createElement('div')
        desc.className = 'kala-view-select__option-desc'
        desc.textContent = option.description
        item.appendChild(desc)
      }
      if (option.disabled === true) {
        item.addEventListener('click', (event) => {
          event.stopPropagation()
        })
      } else {
        item.addEventListener('click', (event) => {
          event.stopPropagation()
          onChange(option.value)
        })
      }
      panel.appendChild(item)
    }
    trigger.addEventListener('click', (event) => {
      event.stopPropagation()
      selectOpen = !selectOpen
      panel.style.display = selectOpen ? 'block' : 'none'
      arrowIcon?.classList.toggle('open', selectOpen)
    })
    select.append(trigger, panel)
    wrapper.appendChild(select)
    return wrapper
  }

  /** 视图切换回调 */
  const onViewChange = (view: string): void => {
    if ((currentType === 'card' || currentType === 'inline') && currentEl !== null) {
      const ctx = readCardContext(currentEl)
      if (ctx !== null) {
        applyCardView(ctx, view)
        return
      }
    } else if (currentType === 'link' && currentEl !== null) {
      const link = readLinkContext(currentEl)
      if (link !== null) {
        applyLinkView(link, view)
        return
      }
    }
    hideMenu()
  }

  /** 构建菜单内容；返回 false 表示无可展示项 */
  const buildMenu = (el: HTMLElement, type: HoverType): boolean => {
    selectOpen = false
    let items: MenuButtonItem[]
    let viewOptions: ViewOption[]
    let currentView = ''
    if (type === 'card' || type === 'inline') {
      const ctx = readCardContext(el)
      if (ctx === null) {
        return false
      }
      items = cardButtons(ctx)
      viewOptions = []
      if (items.length === 0) {
        return false
      }
      // 置顶视频已是置顶形态，不再提供视图切换
      if (ctx.cardType !== 'topVideo') {
        viewOptions = cardViewOptions(ctx)
        currentView = cardCurrentView(ctx)
      }
    } else if (type === 'link') {
      const link = readLinkContext(el)
      if (link === null) {
        return false
      }
      items = linkButtons(link)
      viewOptions = linkViewOptions(link)
      currentView = 'link'
    } else {
      items = imageButtons(el)
      viewOptions = []
      if (items.length === 0) {
        return false
      }
    }

    menu.replaceChildren()
    const inner = document.createElement('div')
    inner.className = 'kala-hover-menu__inner'
    items.forEach((item, index) => {
      if (index > 0) {
        const divider = document.createElement('span')
        divider.className = 'divider'
        inner.appendChild(divider)
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'menu-btn'
      button.dataset['action'] = item.action
      button.title = item.tooltip
      if (item.icon.length > 0) {
        button.innerHTML = bdcIcon(item.icon)
      }
      const label = document.createElement('span')
      label.textContent = item.text
      button.appendChild(label)
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        item.onClick()
      })
      inner.appendChild(button)
    })
    if (viewOptions.length > 1) {
      const divider = document.createElement('span')
      divider.className = 'divider'
      inner.appendChild(divider)
      inner.appendChild(buildViewSelect(viewOptions, currentView, onViewChange))
    }
    menu.appendChild(inner)
    currentEl = el
    currentType = type
    return true
  }

  const showMenu = (el: HTMLElement, type: HoverType): void => {
    clearTimers()
    if (!buildMenu(el, type)) {
      return
    }
    visible = true
    menu.style.display = 'block'
    void positionFloating(el, menu, 'top', 4)
  }

  const handleMouseOver = (event: MouseEvent): void => {
    const target = resolveHoverTarget(event.target)
    if (target === null) {
      return
    }
    if (visible && target.el === currentEl && target.type === currentType) {
      return
    }
    scheduleShow(target.el, target.type)
  }

  const handleMouseOut = (event: MouseEvent): void => {
    if (currentEl === null) {
      return
    }
    const related = event.relatedTarget
    if (related instanceof Node && (related === menu || menu.contains(related))) {
      return
    }
    if (related instanceof Element && stillInside(related)) {
      return
    }
    clearTimers()
    if (visible) {
      scheduleHide()
    }
  }

  const handleMenuMouseOver = (): void => {
    clearTimers()
  }

  const handleMenuMouseOut = (event: MouseEvent): void => {
    const related = event.relatedTarget
    if (related instanceof Node && (related === menu || menu.contains(related))) {
      return
    }
    if (related instanceof Element && currentEl !== null && currentEl.contains(related)) {
      return
    }
    scheduleHide()
  }

  const handleGlobalClick = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    if (menu.contains(target)) {
      return
    }
    if (currentEl !== null && stillInside(target)) {
      return
    }
    if (visible) {
      hideMenu()
    }
  }

  /** 文档变化后若悬停元素已被移除则立即收起 */
  const handleTransaction = (): void => {
    if (visible && currentEl !== null && !currentEl.isConnected) {
      hideMenu()
    }
  }

  const viewDom = editor.view.dom
  viewDom.addEventListener('mouseover', handleMouseOver)
  viewDom.addEventListener('mouseout', handleMouseOut)
  menu.addEventListener('mouseover', handleMenuMouseOver)
  menu.addEventListener('mouseout', handleMenuMouseOut)
  document.addEventListener('click', handleGlobalClick)
  editor.on('transaction', handleTransaction)

  return () => {
    editor.off('transaction', handleTransaction)
    viewDom.removeEventListener('mouseover', handleMouseOver)
    viewDom.removeEventListener('mouseout', handleMouseOut)
    menu.removeEventListener('mouseover', handleMenuMouseOver)
    menu.removeEventListener('mouseout', handleMenuMouseOut)
    document.removeEventListener('click', handleGlobalClick)
    menu.remove()
  }
}
