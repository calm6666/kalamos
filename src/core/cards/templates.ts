/**
 * 20 种卡片视图的 HTML 模板（编辑器 / SSR / 预览三端共用）
 *
 * DOM 结构与类名逐项复刻自 B 站 York 编辑器生产包（eva3-* → kala-*）：
 * - BaseCard 三态外壳：content / loading / error 三段常驻，style.display 切换
 * - 15 类基础卡片 + 置顶视频 + 视频播放视图 + 玩具链接视图 + 评论进阶/截图视图
 *
 * 本文件只做字符串拼接，不触碰 document / window，可安全用于 SSR。
 */
import {
  bdcIcon,
  ERROR_ICON_SVG,
  LIVE_BADGE_ICON_SVG,
  VIDEO_PLAY_ICON_SVG,
  VIDEO_START_ICON_SVG,
  VOTE_CHECK_ICON_SVG,
} from './icons'
import type { CardRenderInput, CardRenderResult, CardType, CardVariant } from './types'
import {
  escapeHtml,
  formatDuration,
  formatEventDateRange,
  formatLocation,
  formatNumber,
  formatVoteRemaining,
  imageUrl,
  isRecord,
  readNumber,
  readNumberOrNull,
  readRecord,
  readRecordArray,
  readString,
  readStringArray,
} from './utils'

/** 卡片中文标签（与原版 zh-CN 语言包一致） */
export const cardLabels: Record<CardType, string> = {
  video: '视频',
  topVideo: '置顶视频',
  opus: '图文',
  comment: '评论',
  vote: '投票',
  music: '音乐',
  toy: '玩具',
  mall: '会员购展览',
  mallGoods: '会员购商品',
  goods: '商品',
  manga: '漫画',
  live: '直播',
  game: '游戏',
  bangumi: '番剧',
  user: '名片',
  generic: '内容',
}

/** 卡片默认占位封面（原版同款） */
const PLACEHOLDER_COVER = '//i0.hdslb.com/bfs/vc/b8eb9637fec90527a6dc9737acdc3577e275c7b5.png'

/** 设计素材（原版静态资源） */
const DESIGN_ASSETS = {
  BILIBILI_LOGO:
    'https://s1.hdslb.com/bfs/static/jinkela/long/editor-card-static/bilibili-spiral-logo.svg',
  ARROW: 'https://s1.hdslb.com/bfs/static/jinkela/long/editor-card-static/editor-card-corner-accent.svg',
  BACKGROUND_TEXT:
    'https://s1.hdslb.com/bfs/static/jinkela/long/editor-card-static/editor-card-lettering.svg',
}

/** 解析 data JSON：{ info, showText, customText, link } */
function parseData(input: CardRenderInput): {
  info: Record<string, unknown>
  options: Record<string, unknown>
} {
  if (input.data.length > 0) {
    try {
      const parsed: unknown = JSON.parse(input.data)
      if (isRecord(parsed)) {
        const info = isRecord(parsed['info']) ? parsed['info'] : parsed
        return { info, options: parsed }
      }
    } catch {
      // 非 JSON 数据按快照渲染
    }
  }
  return { info: {}, options: {} }
}

/** 快照兜底：模板读取 info 缺失字段时回落到节点快照 */
function withSnapshot(info: Record<string, unknown>, input: CardRenderInput): Record<string, unknown> {
  return {
    title: input.title,
    desc: input.desc,
    cover: input.cover,
    sourceName: input.sourceName,
    refId: input.refId,
    badge: input.badge,
    ...info,
  }
}

/** 拼接非空片段 */
function join(parts: string[], separator = ''): string {
  return parts.filter((part) => part.length > 0).join(separator)
}

// ===== 通用骨架片段 =====

/** 缩略图（renderThumbnail 同构） */
function renderThumbnail(options: {
  className: string
  src: string
  alt: string
  overlay?: string
  badge?: { text: string; headIcon?: string }
}): string {
  const { className, src, alt, overlay, badge } = options
  const badgeHtml =
    badge !== undefined && badge.text.length > 0
      ? `<div class="video-card-badge">${
          badge.headIcon !== undefined && badge.headIcon.length > 0
            ? `<img src="${escapeHtml(badge.headIcon)}" alt="" class="badge-icon" />`
            : ''
        }<span>${escapeHtml(badge.text)}</span></div>`
      : ''
  const overlayHtml =
    overlay !== undefined && overlay.length > 0
      ? `<div class="${className.replace('-thumbnail', '-duration')}">${overlay}</div>`
      : ''
  return `<div class="${className}-wrapper"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${className}" />${badgeHtml}${overlayHtml}</div>`
}

/** 统计行（renderStats 同构） */
function renderStats(stats: { className: string; text: string }[]): string {
  return stats
    .map((stat) => `<span class="${stat.className}">${escapeHtml(stat.text)}</span>`)
    .join('')
}

/** 通用预览骨架（renderCardTemplate 同构） */
function renderCardTemplate(options: {
  className: string
  thumbnail: {
    src: string
    alt: string
    className: string
    overlay?: string
    badge?: { text: string; headIcon?: string }
  }
  title: string
  subtitle?: string
  author?: string
  stats?: { className: string; text: string }[]
  meta?: string
  badge?: { text: string; headIcon?: string }
}): string {
  const { className, thumbnail, title, subtitle, author, stats, meta, badge } = options
  if (badge !== undefined) {
    thumbnail.badge = badge
  }
  const base = className.replace(' ', '-')
  return `<div class="${base}-preview">${renderThumbnail(thumbnail)}<div class="${base}-info"><div class="${base}-title">${escapeHtml(title)}</div>${
    subtitle !== undefined && subtitle.length > 0
      ? `<div class="${base}-summary">${escapeHtml(subtitle)}</div>`
      : ''
  }${
    author !== undefined && author.length > 0
      ? `<div class="${base}-author">${escapeHtml(author)}</div>`
      : ''
  }${
    stats !== undefined && stats.length > 0
      ? `<div class="${base}-stats">${renderStats(stats)}</div>`
      : ''
  }${meta !== undefined && meta.length > 0 ? `<div class="${base}-meta">${escapeHtml(meta)}</div>` : ''}</div></div>`
}

/** 视频统计信息读取（stat_infos 优先，其次平铺字段） */
function videoStat(info: Record<string, unknown>, types: string[], fallbackKey: string): string {
  const statInfos = readRecordArray(info, 'stat_infos')
  for (const stat of statInfos) {
    const type = readString(stat, 'type')
    if (types.includes(type)) {
      return readString(stat, 'text') || readString(stat, 'value') || String(readNumber(stat, 'count') || '')
    }
  }
  return readString(info, fallbackKey)
}

/** 视频起播秒数 */
function videoStartTime(info: Record<string, unknown>): number {
  const direct = readNumber(info, 'start_time')
  if (direct > 0) {
    return direct
  }
  const ts = readRecord(info, 'video_ts')
  return ts !== null ? readNumber(ts, 'start_time') : 0
}

/** 视频时长文案 */
function videoDurationText(info: Record<string, unknown>): string {
  const seconds = readNumber(info, 'duration')
  if (seconds > 0) {
    return formatDuration(seconds)
  }
  return readString(info, 'duration_text')
}

// ===== 视频卡片（detailed / player） =====

function buildVideoContent(info: Record<string, unknown>, cardStyle: 0 | 1): string {
  const fallbackTitle = readString(info, 'title') || '未知标题'
  const duration = videoDurationText(info)
  const start = videoStartTime(info)
  const startText = start > 0 ? `${VIDEO_START_ICON_SVG}${formatDuration(start)}/` : ''
  const play = videoStat(info, ['VIDEO_VIEW_INFO', 'video_view', 'play'], 'play')
  const danmaku = videoStat(info, ['VIDEO_DANMAKU_INFO', 'video_danmaku', 'danmaku'], 'danmaku')

  if (cardStyle === 0) {
    return renderCardTemplate({
      className: 'video-card-detailed',
      thumbnail: {
        src: readString(info, 'cover'),
        alt: fallbackTitle,
        className: 'video-thumbnail',
        overlay: duration.length > 0 ? `${startText}${duration}` : '',
      },
      title: fallbackTitle,
      stats: [
        { className: 'play-count', text: play },
        { className: 'danmaku-count', text: danmaku },
      ],
      badge: readRecord(info, 'badge') !== null ? badgeOf(info) : undefined,
    })
  }

  const badge = readRecord(info, 'badge')
  const badgeHtml =
    badge !== null && readString(badge, 'text').length > 0
      ? `<div class="video-card-badge">${
          readString(badge, 'head_icon').length > 0
            ? `<img src="${escapeHtml(readString(badge, 'head_icon'))}" alt="" class="badge-icon" />`
            : ''
        }<span>${escapeHtml(readString(badge, 'text'))}</span></div>`
      : ''
  const playIcon = readString(info, 'play_icon')
  return `<div class="video-card-player-preview"><div class="video-player-cover" style="background-image:url('${escapeHtml(
    readString(info, 'cover'),
  )}')">${badgeHtml}<div class="video-player-stats"><div class="video-player-duration">${startText}${escapeHtml(
    duration,
  )}</div><span class="video-player-stat play-count">${escapeHtml(play)}</span><span class="video-player-stat danmaku-count">${escapeHtml(
    danmaku,
  )}</span></div><div class="video-player-enter">${
    playIcon.length > 0
      ? `<img src="${escapeHtml(imageUrl(playIcon, 100, 100))}" alt="play" />`
      : VIDEO_PLAY_ICON_SVG
  }</div></div><div class="video-card-player-info"><div class="video-card-player-title">${escapeHtml(fallbackTitle)}</div></div></div>`
}

/** 视频角标对象 */
function badgeOf(info: Record<string, unknown>): { text: string; headIcon?: string } | undefined {
  const badge = readRecord(info, 'badge')
  if (badge === null) {
    return undefined
  }
  const text = readString(badge, 'text')
  if (text.length === 0) {
    return undefined
  }
  const headIcon = readString(badge, 'head_icon')
  return { text, headIcon: headIcon.length > 0 ? headIcon : undefined }
}

// ===== 图文卡片 =====

function buildOpusContent(info: Record<string, unknown>): string {
  const badgeText = readString(info, 'badge')
  const pics = readRecordArray(info, 'pics')
  const firstPic = pics.length > 0 ? pics[0] : null
  const cover = firstPic !== null ? readString(firstPic, 'url') || readString(firstPic, 'src') : readString(info, 'cover')
  const hasCover = cover.length > 0
  const title = readString(info, 'title')
  const content = readString(info, 'content')
  const author = readRecord(info, 'author')
  const authorName =
    (author !== null ? readString(author, 'name') : '') || readString(info, 'author_name')
  const isOnlyFans = info['is_only_fans'] === true
  const cardBadge = readRecord(info, 'card_badge')
  const iconBadge = cardBadge !== null ? readRecord(cardBadge, 'icon_badge') : null
  const onlyFansText = (iconBadge !== null ? readString(iconBadge, 'text') : '') || '充电专属'
  const onlyFansIcon = iconBadge !== null ? readString(iconBadge, 'icon_bg_url') : ''
  const view = readString(info, 'view')
  const reply = readString(info, 'reply')
  const publishText = readString(info, 'publish_text')

  const coverHtml = hasCover
    ? `<div class="opus-cover"><img src="${escapeHtml(imageUrl(cover, 64, 64))}" alt="${escapeHtml(
        title,
      )}" />${
        pics.length > 1
          ? `<span class="opus-badge badge-images"><span style="width:12px;font-size:12px">${bdcIcon(
              'BDC/image_line/4',
            )}</span>${pics.length}</span>`
          : ''
      }</div>`
    : ''
  const tagHtml = isOnlyFans
    ? `<span class="opus-tag tag-only-fans">${
        onlyFansIcon.length > 0
          ? `<img src="${escapeHtml(onlyFansIcon)}" alt="" style="width:12px;height:12px;vertical-align:middle;" />`
          : bdcIcon('BDC/battery_charge_simple_fill')
      }${escapeHtml(onlyFansText)}</span>`
    : badgeText.length > 0
      ? `<span class="opus-tag tag-dynamic">${escapeHtml(badgeText)}</span>`
      : ''
  const authorHtml =
    authorName.length > 0
      ? `<span class="opus-author"><span style="width:16px;font-size:16px;margin-right:2px;">${bdcIcon(
          'BDC/uploader_name_square_line/1',
        )}</span>${escapeHtml(authorName)}</span>`
      : ''
  const statsHtml = `<div class="opus-stats">${
    view.length > 0 ? `<span class="stat-item"><span>${escapeHtml(view)}</span></span>` : ''
  }${reply.length > 0 ? `<span class="stat-item"><span>${escapeHtml(reply)}</span></span>` : ''}</div>`
  return `<div class="opus-card-container">${coverHtml}<div class="opus-content"><div class="opus-title">${escapeHtml(
    title.length > 0 ? title : content || '未知标题',
  )}</div><div class="opus-details">${tagHtml}${authorHtml}${statsHtml}</div>${
    publishText.length > 0 ? `<div class="opus-footer">${escapeHtml(publishText)}</div>` : ''
  }</div></div>`
}

// ===== 评论卡片 =====

/** 评论来源图标（对齐原版 getSourceIcon 的线性变体） */
function commentSourceIcon(sourceType: string): string {
  if (sourceType === '1' || sourceType === 'video') return 'BDC/video_circle_line/2'
  if (sourceType === '2' || sourceType === 'opus' || sourceType === 'article') return 'BDC/column_line/1'
  if (sourceType === '3' || sourceType === 'sub_comment' || sourceType === 'dynamic') {
    return 'BDC/bubble_comment_line/2'
  }
  return 'BDC/chain_link_line/1'
}

function isVideoSource(sourceType: string): boolean {
  return sourceType === '1' || sourceType === 'video'
}

/** 头像：原版是 BiliAvatar 挂载点，SSR 用 data-avatar-url + 背景图静态呈现 */
function commentAvatarHtml(url: string, name: string, size: number): string {
  const style = [`width: ${size}px`, `height: ${size}px`]
  if (url.length > 0) {
    style.push(
      `background-image: url('${url.replace(/'/g, '%27')}')`,
      'background-size: cover',
      'background-position: center',
    )
  }
  return `<div class="author-avatar avatar-placeholder" data-avatar-url="${escapeHtml(
    url,
  )}" data-avatar-size="${size}" data-avatar-name="${escapeHtml(
    name,
  )}" aria-label="用户头像" style="${escapeHtml(style.join('; '))};"></div>`
}

/** 用户等级图（原版 level_1..6 / level_h.svg） */
function commentLevelHtml(user: Record<string, unknown> | null): string {
  if (user === null) return ''
  const rawLevel = user['level']
  const level =
    typeof rawLevel === 'number'
      ? rawLevel
      : typeof rawLevel === 'string' && /^\d+$/.test(rawLevel.trim())
        ? Number(rawLevel.trim())
        : 0
  const senior = user['is_senior_member'] === true || readNumber(user, 'is_senior_member') === 1
  if (!senior && level <= 0) return ''
  const file = senior ? 'level_h' : `level_${Math.min(Math.max(Math.trunc(level), 1), 6)}`
  const label = senior ? '硬核会员' : `用户等级 ${level}`
  return `<div class="user-level"><img class="user-level" src="//i0.hdslb.com/bfs/seed/jinkela/short/webui/user-profile/img/${file}.svg" alt="${label}" width="20" height="20" loading="lazy" /></div>`
}

interface CommentPicture {
  url: string
  type: string
  width: number
  height: number
}

function commentPictures(info: Record<string, unknown>): CommentPicture[] {
  return readRecordArray(info, 'pics')
    .map((pic) => {
      const url = (readString(pic, 'url') || readString(pic, 'src')).trim()
      const declared = readString(pic, 'type').toLowerCase()
      const gif = declared === 'gif' || url.toLowerCase().endsWith('.gif') || pic['is_live_photo'] === true
      return {
        url,
        type: gif ? 'gif' : 'static',
        width: readNumber(pic, 'width'),
        height: readNumber(pic, 'height'),
      }
    })
    .filter((pic) => pic.url.length > 0)
}

function commentImageBadge(pic: CommentPicture, more: number, withBaseClass: boolean): string {
  const cls = withBaseClass ? 'comment-image__badge ' : ''
  if (more > 0) return `<div class="${cls}more-images-badge">+${more}</div>`
  if (pic.type === 'gif') return `<div class="${cls}gif-badge">动图</div>`
  if (pic.height > 0 && pic.width > 0 && pic.height / pic.width >= 3) {
    return `<div class="${cls}long-image-badge">长图</div>`
  }
  return ''
}

/** 图片网格：max=3，超出时末图叠加 +N（basic 版带 comment-image__badge 基础类） */
function commentGalleryHtml(pictures: CommentPicture[], withBaseBadgeClass: boolean): string {
  if (pictures.length === 0) return ''
  const shown = pictures.slice(0, 3)
  const rest = Math.max(0, pictures.length - shown.length)
  const variantClass = pictures.length === 1 ? 'single-image' : 'multiple-images'
  if (pictures.length === 1) {
    const pic = pictures[0]
    const badge = commentImageBadge(pic, 0, withBaseBadgeClass)
    return `<div class="comment-images single-image" data-image-gallery="true"><div class="comment-image"><img src="${escapeHtml(
      imageUrl(pic.url, 120, 120),
    )}" alt="评论图片" loading="lazy" data-image-index="0" data-image-url="${escapeHtml(
      pic.url,
    )}" data-image-type="${pic.type}" role="button" tabindex="0" aria-label="查看大图" />${badge}</div></div>`
  }
  const items = shown
    .map((pic, index) => {
      const more = index === shown.length - 1 ? rest : 0
      return `<div class="comment-image"><img src="${escapeHtml(
        imageUrl(pic.url, 120, 120),
      )}" alt="评论图片 ${index + 1}" loading="lazy" data-image-index="${index}" data-image-url="${escapeHtml(
        pic.url,
      )}" data-image-type="${pic.type}" role="button" tabindex="0" aria-label="查看大图" />${commentImageBadge(
        pic,
        more,
        withBaseBadgeClass,
      )}</div>`
    })
    .join('')
  return `<div class="comment-images ${variantClass}" data-image-gallery="true">${items}</div>`
}

interface CommentCommon {
  authorName: string
  avatar: string
  uid: string
  publishText: string
  likeCount: number
  liked: boolean
  upLiked: boolean
  text: string
  pictures: CommentPicture[]
  parentAuthor: string
  parentContent: string
  user: Record<string, unknown> | null
  sourceType: string
  sourceTitle: string
  sourceDesc: string
  sourceThumb: string
  link: string
  viewSourceText: string
}

function readCommentCommon(info: Record<string, unknown>): CommentCommon {
  const user = readRecord(info, 'user')
  const thumbup = readRecord(info, 'thumbup')
  const source = readRecord(info, 'source')
  const parent = readRecord(info, 'parent_comment')
  return {
    authorName: (user !== null ? readString(user, 'name') : '') || readString(info, 'author_name'),
    avatar: (user !== null ? readString(user, 'avatar') || readString(user, 'face') : '') || readString(info, 'avatar'),
    uid: user !== null ? (readString(user, 'uid') || readString(user, 'mid')) : '',
    publishText: user !== null ? readString(user, 'name_sub_text').trim() : '',
    likeCount: thumbup !== null ? readNumber(thumbup, 'count') : 0,
    liked: thumbup !== null && thumbup['is_thumbup'] === true,
    upLiked: thumbup !== null && thumbup['is_up_thumbup'] === true,
    text: commentText(info),
    pictures: commentPictures(info),
    parentAuthor:
      (parent !== null ? readString(parent, 'author_name') || readString(parent, 'user_name') : '').trim(),
    parentContent: parent !== null ? readString(parent, 'content').trim() : '',
    user,
    sourceType: source !== null ? readString(source, 'type') : '',
    sourceTitle: source !== null ? readString(source, 'title').trim() : '',
    sourceDesc: source !== null ? readString(source, 'desc').trim() : '',
    sourceThumb: source !== null ? readString(source, 'thumbnail') : '',
    link: readString(info, 'link').trim(),
    viewSourceText: readString(info, 'view_source_text') || '查看来源',
  }
}

/** 基础视图：粉色浮雕海报卡 + 右下角来源信息 + 外层查看来源按钮 */
function buildBasicComment(common: CommentCommon): string {
  const { authorName, uid, user } = common
  const avatarLink =
    uid.length > 0
      ? ` role="link" tabindex="0" data-user-mid="${escapeHtml(uid)}" aria-label="访问${escapeHtml(authorName)}的空间"`
      : ''
  const nameLink = uid.length > 0 ? ` role="link" tabindex="0" data-user-mid="${escapeHtml(uid)}"` : ''
  const publishInfo = common.publishText.match(/\s(\S+)$/)?.[1] ?? '发布了评论'
  const header = `<div class="comment-header"><div class="author-avatar-wrapper"${avatarLink}>${commentAvatarHtml(
    common.avatar,
    authorName,
    36,
  )}</div><div class="author-info"><div class="author-name-line"${nameLink}><span class="author-name">${escapeHtml(
    authorName,
  )}</span>${commentLevelHtml(user)}</div><div class="publish-info">${escapeHtml(publishInfo)}</div></div></div>`
  const reply =
    common.parentAuthor.length > 0 || common.parentContent.length > 0
      ? `<div class="reply-reference" role="blockquote"><div class="reply-border"></div><div class="reply-content"><div class="reply-author">${escapeHtml(
          common.parentAuthor,
        )}</div><div class="reply-text">${escapeHtml(common.parentContent)}</div></div></div>`
      : ''
  const body = `<div class="comment-content"><div class="comment-text">${escapeHtml(
    common.text,
  )}</div>${commentGalleryHtml(common.pictures, true)}</div>`
  const footerParts: string[] = []
  if (common.likeCount >= 0) {
    footerParts.push(
      `<div class="like-info ${common.liked ? 'liked' : ''}" aria-label="点赞数"><span class="like-count"><span style="width: 16px; height: 16px; margin-right: 2px;">${bdcIcon(
        common.liked ? 'BDC/hand_thumbsup_fill/2' : 'BDC/hand_thumbsup_line/2',
      )}</span>${formatNumber(common.likeCount)}</span></div>`,
    )
  }
  if (common.upLiked) footerParts.push('<div class="up-liked">UP觉得很赞</div>')
  const footer = footerParts.length > 0 ? `<div class="comment-footer">${footerParts.join('')}</div>` : ''
  const source = `<div class="video-source${isVideoSource(common.sourceType) ? ' video-type' : ''}" role="complementary" aria-label="查看评论来源">${
    common.sourceThumb.length > 0
      ? `<div class="source-thumbnail"><img src="${escapeHtml(
          common.sourceThumb,
        )}" alt="稿件封面" loading="lazy" /></div>`
      : ''
  }<div class="source-info"><div class="source-meta">${escapeHtml(common.sourceDesc)} · 分享于${new Date().toLocaleDateString(
    'zh-CN',
  )}</div><div class="source-title">${escapeHtml(common.sourceTitle)}</div></div></div>`
  const viewSourceText = common.viewSourceText
  return `<div class="comment-card-container basic styled"><div class="comment-card-surface"><div class="background-text" aria-hidden="true"><img src="${
    DESIGN_ASSETS.BACKGROUND_TEXT
  }" alt="" /></div><div class="surface-inner"><div class="bilibili-logo" aria-hidden="true"><img src="${
    DESIGN_ASSETS.BILIBILI_LOGO
  }" alt="bilibili" /></div><div class="main-content">${header}${reply}${body}${footer}</div><div class="comment-arrow-wrapper"><img class="comment-arrow" src="${
    DESIGN_ASSETS.ARROW
  }" alt="" /></div>${source}</div></div></div>${buildViewSourceButton(common.sourceType, viewSourceText, common.link)}`
}

/** 评论正文（content 可能是 PM JSON 或纯文本） */
function commentText(info: Record<string, unknown>): string {
  const content = info['content']
  if (typeof content === 'string') {
    return content
  }
  if (isRecord(content)) {
    const nodes = content['nodes']
    if (Array.isArray(nodes)) {
      const texts: string[] = []
      const walk = (node: unknown): void => {
        if (!isRecord(node)) return
        if (typeof node['text'] === 'string') texts.push(node['text'])
        const children = node['content']
        if (Array.isArray(children)) children.forEach(walk)
      }
      nodes.forEach(walk)
      return texts.join('')
    }
  }
  return readString(info, 'desc')
}

function buildViewSourceButton(sourceType: string, text: string, link: string): string {
  return `<div class="view-source-btn" role="button" tabindex="0" aria-label="${escapeHtml(text)}"${
    link.length > 0 ? ` data-source-url="${escapeHtml(link)}"` : ''
  }><span class="view-source-icon">${bdcIcon(
    commentSourceIcon(sourceType),
  )}</span><span class="view-source-text">${escapeHtml(text)}</span></div>`
}

/** 正文展开阈值与原版一致：超过 100 字或超过 4 行 */
function commentExpandable(text: string): boolean {
  return text.length > 100 || text.split('\n').length > 4
}

/** 进阶视图：灰底横向信息卡，右侧圆角点赞，底部来源分割线 */
function buildAdvancedComment(common: CommentCommon): string {
  const { authorName, uid, user } = common
  const avatarLink =
    uid.length > 0
      ? ` role="link" tabindex="0" data-user-mid="${escapeHtml(uid)}" aria-label="访问${escapeHtml(authorName)}的空间"`
      : ''
  const nameLink = uid.length > 0 ? ` role="link" tabindex="0" data-user-mid="${escapeHtml(uid)}"` : ''
  const header = `<div class="comment-header"><div class="author-avatar-wrapper"${avatarLink}>${commentAvatarHtml(
    common.avatar,
    authorName,
    30,
  )}</div><div class="author-info"><div class="author-name-line"${nameLink}><div class="author-name">${escapeHtml(
    authorName,
  )}</div>${commentLevelHtml(user)}</div><div class="publish-info">${escapeHtml(
    common.publishText.length > 0 ? common.publishText : '发布了评论',
  )}</div></div></div>`
  const reply =
    common.parentAuthor.length > 0 || common.parentContent.length > 0
      ? `<div class="reply-reference" role="blockquote" aria-label="回复引用"><div class="reply-border" aria-hidden="true"></div><div class="reply-content"><div class="reply-author">${escapeHtml(
          common.parentAuthor,
        )}</div><div class="reply-text">${escapeHtml(common.parentContent)}</div></div></div>`
      : ''
  const expandable = commentExpandable(common.text)
  const textClass = expandable ? 'comment-text truncated' : 'comment-text expanded'
  const textStyle = expandable ? ' style="-webkit-line-clamp: 4; line-clamp: 4"' : ''
  const expandControl = expandable
    ? '<div class="comment-expand-control"><button class="expand-button" aria-label="展开评论全文" aria-expanded="false">...<span class="expand-text">展开</span></button></div>'
    : ''
  const textHtml =
    common.text.length > 0
      ? `<div class="comment-text-wrapper${expandable ? ' is-expandable' : ''}"><div class="${textClass}"${
          expandable ? ' aria-expanded="false"' : ''
        }${textStyle}>${escapeHtml(common.text).replace(/\n/g, '<br>')}${expandControl}</div></div>`
      : ''
  const gallery = commentGalleryHtml(common.pictures, false)
  const body = `<div class="comment-body">${reply}<div class="comment-content-area">${textHtml}${gallery}</div></div>`
  const likeButton = `<div class="like-section"><div class="like-button ${
    common.liked ? 'liked' : ''
  }" role="button" tabindex="0" aria-label="点赞评论" aria-pressed="${String(common.liked)}" data-liked="${String(
    common.liked,
  )}">${bdcIcon(common.liked ? 'BDC/hand_thumbsup_fill/2' : 'BDC/hand_thumbsup_line/2')}</div>${
    common.likeCount > 0 ? `<div class="like-count">${formatNumber(common.likeCount)}</div>` : ''
  }</div>`
  const sourceRole = common.link.length > 0 ? 'link' : 'complementary'
  const sourceAttrs =
    common.link.length > 0 ? ` tabindex="0" data-source-url="${escapeHtml(common.link)}"` : ''
  const footer = `<div class="comment-footer"><div class="divider" aria-hidden="true"></div><div class="source-info" role="${sourceRole}" aria-label="查看评论来源"${sourceAttrs}><div class="source-content">${bdcIcon(
    commentSourceIcon(common.sourceType),
  )}<div class="source-label">${escapeHtml(common.sourceTitle)}</div></div><div class="source-title">${escapeHtml(
    common.sourceDesc,
  )}</div></div></div>`
  return `<div class="comment-card-container advanced"><div class="comment-card-surface"><div class="comment-main-content"><div class="comment-left-content">${header}${body}</div>${likeButton}</div>${footer}</div></div>`
}

function buildCommentContent(info: Record<string, unknown>, variant: CardVariant): string {
  const common = readCommentCommon(info)
  return variant === 'advanced' ? buildAdvancedComment(common) : buildBasicComment(common)
}

// ===== 投票卡片 =====

function buildVoteContent(info: Record<string, unknown>): string {
  const options = readRecordArray(info, 'options')
  const title = readString(info, 'title')
  const joinNum = readNumber(info, 'join_num')
  const endTime = readNumber(info, 'end_time')
  const myVotes = readStringArray(info, 'my_votes').length > 0
    ? readStringArray(info, 'my_votes')
    : readRecordArray(info, 'my_votes').map((vote) => String(readNumber(vote, 'opt_idx')))
  const voted = myVotes.length > 0
  const ended = endTime > 0 && Date.now() / 1000 > endTime
  const total = options.reduce((sum, option) => sum + readNumber(option, 'cnt'), 0)
  const highest = options.reduce((max, option) => Math.max(max, readNumber(option, 'cnt')), 0)
  const hasImages = options.some((option) => readString(option, 'img_url').length > 0)
  const choiceCount = readNumber(info, 'choice_cnt') || 1
  const multi = choiceCount > 1
  const collapse = options.length > 9
  const ownerMode = info['owner_mode'] === true

  const optionHtml = options
    .map((option, index) => buildVoteOption(option, index, voted || ownerMode || ended, myVotes, total, highest))
    .join('')
  const desc = readString(info, 'desc')
  const descHtml = desc.trim().length > 0
    ? `<div class="vote-card-desc"><span class="vote-card-desc-text" title="${escapeHtml(desc)}">${escapeHtml(desc)}</span><span class="vote-card-desc-toggle" hidden>展开</span></div>`
    : ''
  const expandHtml = collapse
    ? `<div class="vote-card-options-expand"><button class="vote-card-options-expand-btn" type="button"><span class="vote-card-options-expand-text">展开全部选项</span><i class="vote-card-options-expand-arrow">${bdcIcon(
        'BDC/arrow_expand_line',
      )}</i></button></div>`
    : ''

  return `<div class="vote-card-container${voted ? ' voted' : ''}${ended ? ' ended' : ''}${ownerMode ? ' owner-mode' : ''}"><div class="vote-card-header"><div class="vote-card-title" title="${escapeHtml(
    title,
  )}">${multi ? '<span class="vote-card-multi-tag">多选</span>' : ''}${escapeHtml(
    title,
  )}</div>${descHtml}</div><div class="vote-card-options${hasImages ? ' has-images' : ''}${
    collapse ? ' collapsed' : ''
  }">${optionHtml}</div>${expandHtml}<div class="vote-card-footer">${buildVoteFooter(
    voted,
    ended,
    joinNum || total,
    endTime,
    ownerMode,
  )}</div></div>`
}

function buildVoteOption(
  option: Record<string, unknown>,
  index: number,
  showResult: boolean,
  myVotes: string[],
  total: number,
  highest: number,
): string {
  const optionIndex = readNumber(option, 'opt_idx')
  const desc = readString(option, 'opt_desc') || readString(option, 'title')
  const image = readString(option, 'img_url')
  const count = readNumber(option, 'cnt')
  const selected = myVotes.includes(String(optionIndex)) || myVotes.includes(String(index))
  const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  const isHighest = showResult && count === highest && highest > 0

  if (image.length > 0) {
    const resultHtml = showResult
      ? `${selected ? '<div class="vote-option-overlay"></div><div class="vote-option-check-badge"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10.5" fill="currentColor" stroke="#FFFFFF" stroke-width="1"/><path d="M7 11L10 14L15 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : ''}<div class="vote-option-result-overlay"><div class="vote-option-gradient"></div><div class="vote-option-stats"><div class="vote-option-number">${percent.split('.')[0]}</div><div class="vote-option-unit"><span class="vote-option-percent">%</span><div class="vote-option-bar" style="width: ${percent}%"></div></div></div></div>`
      : `${selected ? '<div class="vote-option-overlay"></div><div class="vote-option-checkbox-badge checked"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.5" stroke="white" stroke-width="1"/><path d="M6 11L9.5 14.5L16 7.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : '<div class="vote-option-checkbox-badge"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.5" fill="rgba(0,0,0,0.25)" stroke="white" stroke-width="1"/></svg></div>'}`
    return `<div class="vote-card-option with-image${selected ? ' selected' : ''}" data-option-index="${index}"><div class="vote-option-image-container"><img class="vote-option-image" src="${escapeHtml(
      imageUrl(image, 240, 240),
    )}" alt="" />${resultHtml}</div><div class="vote-option-label"><div class="vote-option-label-desc" title="${escapeHtml(
      desc,
    )}">${escapeHtml(desc)}</div></div></div>`
  }

  return `<div class="vote-card-option${selected ? ' selected' : ''}" data-option-index="${index}">${
    showResult
      ? `<div class="vote-option-progress-bg${isHighest ? ' highest-vote' : ''}" style="width: ${percent}%"></div>`
      : ''
  }<div class="vote-option-content"><div class="vote-option-text"><div class="vote-option-desc" title="${escapeHtml(
    desc,
  )}">${escapeHtml(desc)}${
    showResult && selected ? `<span class="vote-option-check-icon">${VOTE_CHECK_ICON_SVG}</span>` : ''
  }</div></div>${
    showResult
      ? ''
      : `<div class="vote-option-checkbox${selected ? ' checked' : ''}">${
          selected
            ? '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="11"/><path d="M6 11L9.5 14.5L16 7.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.5" fill="transparent" stroke="#C9CCD0" stroke-width="1"/></svg>'
        }</div>`
  }</div>${
    showResult ? `<span class="vote-option-percentage${isHighest ? ' highest-vote' : ''}">${percent}%</span>` : ''
  }</div>`
}

function buildVoteFooter(
  voted: boolean,
  ended: boolean,
  joinNum: number,
  endTime: number,
  ownerMode: boolean,
): string {
  const joinText = `${formatNumber(joinNum)}人参与`
  const remaining = formatVoteRemaining(endTime)
  if (voted || ended) {
    return `<span class="vote-card-footer-left"><span class="vote-card-join-num">${joinText}</span>${
      remaining.length > 0 ? `<span class="vote-card-end-time">${remaining}</span>` : ''
    }</span>${voted && !ownerMode ? '<span class="vote-card-status-tip">已投票</span>' : ''}`
  }
  return `<div class="vote-card-footer-actions"><div class="vote-card-footer-options"><label class="vote-footer-option"><input type="checkbox" class="vote-footer-checkbox" data-action="anonymous" /><span class="vote-footer-option-icon">${bdcIcon(
    'BDC/checkmark_line',
  )}</span><span class="vote-footer-option-text">匿名</span></label><label class="vote-footer-option"><input type="checkbox" class="vote-footer-checkbox" data-action="share" /><span class="vote-footer-option-icon">${bdcIcon(
    'BDC/checkmark_line',
  )}</span><span class="vote-footer-option-text">同时分享至动态</span></label></div><button class="vote-card-submit-btn">投票</button></div>`
}

// ===== 音乐卡片 =====

function buildMusicContent(info: Record<string, unknown>): string {
  const title = readString(info, 'title') || '未知标题'
  const artist = readString(info, 'up_name') || '未知艺术家'
  const cover = readString(info, 'cover_url') || readString(info, 'cover')
  const intro = readString(info, 'intro')
  const duration = readString(info, 'duration_text')
  return `<div class="music-card-container"><div class="music-cover"><img src="${escapeHtml(
    imageUrl(cover.length > 0 ? cover : PLACEHOLDER_COVER, 64, 64),
  )}" alt="${escapeHtml(title)}" /></div><div class="music-content"><div class="music-title">${escapeHtml(
    title,
  )}</div><div class="music-details"><span class="music-badge">音乐</span>${
    artist.length > 0
      ? `<span class="music-artist">${bdcIcon('BDC/uploader_name_square_line/1')}${escapeHtml(artist)}</span>`
      : ''
  }${duration.length > 0 ? `<span class="music-duration">${escapeHtml(duration)}</span>` : ''}</div>${
    intro.length > 0 ? `<div class="music-intro">${escapeHtml(intro)}</div>` : ''
  }</div></div>`
}

// ===== 玩具卡片 =====

function buildToyContent(
  info: Record<string, unknown>,
  cardStyle: 0 | 1,
  options: Record<string, unknown>,
  inEditor: boolean,
): { content: string; className: string } {
  const jumpUrl = readString(info, 'jump_uri') || readString(info, 'jump_url') || readString(info, 'url')
  const wrap = (className: string, inner: string): string => {
    if (jumpUrl.length === 0) {
      return `<div class="${className}">${inner}</div>`
    }
    return inEditor
      ? `<div class="${className}" data-href="${escapeHtml(jumpUrl)}">${inner}</div>`
      : `<a class="${className}" href="${escapeHtml(jumpUrl)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
  }
  if (cardStyle === 0) {
    const text =
      readString(options, 'customText') ||
      readString(options, 'showText') ||
      readString(info, 'show_text') ||
      readString(info, 'title') ||
      'Toy'
    return {
      className: 'toy-card toy-card--link',
      content: wrap(
        'toy-card-link',
        `${bdcIcon('BDC/toy_line/1')}<span class="toy-card-link__text">${escapeHtml(text)}</span>`,
      ),
    }
  }
  const title = readString(info, 'title') || '未知内容'
  const poster = readString(info, 'poster')
  const tag = readString(info, 'tag_text') || 'Toy'
  const up = readRecord(info, 'up')
  const upName = (up !== null ? readString(up, 'name') : '') || readString(info, 'up_name')
  const statText = readString(info, 'stat_text')
  const btnText = readString(info, 'btn_text')
  const upHtml =
    upName.length > 0
      ? `<span class="toy-card-up">${bdcIcon('BDC/uploader_name_square_line/1')}<span class="toy-card-up-name">${escapeHtml(
          upName,
        )}</span></span>`
      : ''
  const statHtml = statText.length > 0 ? `<span class="toy-card-play-count">${escapeHtml(statText)}</span>` : ''
  const infoHtml = upHtml.length > 0 || statHtml.length > 0 ? `<div class="toy-card-info">${upHtml}${statHtml}</div>` : ''
  const inner = `<div class="toy-card-container"><div class="toy-card-main"><div class="toy-card-cover"><img src="${escapeHtml(
    imageUrl(poster.length > 0 ? poster : PLACEHOLDER_COVER, 64, 64),
  )}" alt="${escapeHtml(title)}" /></div><div class="toy-card-content"><div class="toy-card-title">${escapeHtml(
    title,
  )}</div><div class="toy-card-meta"><span class="toy-card-badge">${escapeHtml(
    tag,
  )}</span>${infoHtml}</div></div></div>${
    btnText.length > 0
      ? `<div class="toy-card-button"><span class="toy-card-button-text">${escapeHtml(btnText)}</span></div>`
      : ''
  }</div>`
  return { className: 'toy-card', content: wrap('toy-card-action', inner) }
}

// ===== 会员购展览 =====

function buildMallContent(info: Record<string, unknown>): string {
  const title = readString(info, 'name') || '未知活动'
  const cover = readString(info, 'performance_image')
  const dateText = formatEventDateRange(readNumber(info, 'start_time'), readNumber(info, 'end_time'))
  const location = formatLocation([
    readString(info, 'province_name'),
    readString(info, 'city_name'),
    readString(info, 'district_name'),
    readString(info, 'venue_name'),
  ])
  const price = readNumberOrNull(info, 'price_low') ?? 0
  return `<div class="mall-card-container"><div class="mall-card-cover"><img src="${escapeHtml(
    imageUrl(cover.length > 0 ? cover : PLACEHOLDER_COVER, 48, 64),
  )}" alt="${escapeHtml(title)}" /></div><div class="mall-card-info"><div class="mall-card-title">${escapeHtml(
    title,
  )}</div>${
    dateText.length > 0 || location.length > 0
      ? `<div class="mall-card-details">${dateText.length > 0 ? `<span class="mall-card-datetime">${escapeHtml(dateText)}</span>` : ''}${
          location.length > 0 ? `<span class="mall-card-location">${escapeHtml(location)}</span>` : ''
        }</div>`
      : ''
  }<div class="mall-card-price"><span class="price-unit">¥</span><span class="price-value">${price}</span><span class="price-suffix"> 起</span></div></div></div>`
}

// ===== 游戏卡片 =====

function buildGameContent(info: Record<string, unknown>): string {
  const title = readString(info, 'game_name') || '未知游戏'
  const icon = readString(info, 'game_icon')
  const tags = readString(info, 'game_tags')
  const summary = readString(info, 'summary')
  const cover =
    icon.length > 0
      ? `<img src="${escapeHtml(imageUrl(icon, 64, 64))}" alt="${escapeHtml(title)}" class="game-card-cover-img" />`
      : `<img src="${escapeHtml(imageUrl(PLACEHOLDER_COVER, 64, 64))}" alt="默认封面" class="game-card-cover-placeholder" />`
  return `<div class="game-card-container"><div class="game-card-cover">${cover}</div><div class="game-card-content"><div class="game-card-title">${escapeHtml(
    title,
  )}</div><div class="game-card-meta"><span class="game-card-badge">游戏</span>${
    tags.length > 0 ? `<span class="game-card-tags">${escapeHtml(tags)}</span>` : ''
  }</div>${summary.length > 0 ? `<div class="game-card-summary">${escapeHtml(summary)}</div>` : ''}</div><div class="game-card-button"><span class="game-card-button-text">进入</span></div></div>`
}

// ===== 商品卡片 =====

function buildGoodsContent(info: Record<string, unknown>, cents: boolean): string {
  const title = readString(info, 'goodsName') || readString(info, 'name') || '未知商品'
  const price = cents ? Number(readNumber(info, 'price')) / 100 : readNumber(info, 'price')
  const priceText = cents ? price.toFixed(2) : String(price)
  const image = readString(info, 'mainImgUrl') || readString(info, 'img')
  return `<div class="goods-card-container"><div class="goods-card-image"><img src="${escapeHtml(
    imageUrl(image.length > 0 ? image : PLACEHOLDER_COVER, 64, 64),
  )}" alt="${escapeHtml(title)}" /></div><div class="goods-card-info"><div class="goods-card-title">${escapeHtml(
    title,
  )}</div>${
    price > 0 ? `<div class="goods-card-price">¥${escapeHtml(priceText)} <span>起</span></div>` : ''
  }</div><button class="goods-card-button" type="button">去看看</button></div>`
}

// ===== 漫画卡片 =====

function buildMangaContent(info: Record<string, unknown>): string {
  const title = readString(info, 'title') || '未知漫画'
  const authors = readStringArray(info, 'author')
  const author = authors.length > 0 ? authors.join(' / ') : '未知作者'
  const cover = readString(info, 'vertical_cover')
  const evaluate = readString(info, 'evaluate')
  return `<div class="manga-card-container"><img class="manga-cover" src="${escapeHtml(
    imageUrl(cover.length > 0 ? cover : PLACEHOLDER_COVER, 48, 64),
  )}" alt="${escapeHtml(title)}" /><div class="manga-content"><div class="manga-title">${escapeHtml(
    title,
  )}</div><div class="manga-details"><span class="manga-badge">漫画</span><span class="manga-author">${escapeHtml(
    author,
  )}</span></div>${
    evaluate.length > 0 ? `<div class="manga-summary">${escapeHtml(evaluate)}</div>` : ''
  }</div><div class="manga-follow-button">${bdcIcon('BDC/heart_collect_line/2')}<span class="manga-follow-text">追漫</span></div></div>`
}

// ===== 直播卡片 =====

function buildLiveContent(info: Record<string, unknown>): string {
  const title = readString(info, 'title') || '未知直播'
  const uname = readString(info, 'uname') || '未知主播'
  const cover = readString(info, 'cover')
  const area = readString(info, 'area_v2_name')
  const online = readNumber(info, 'online')
  const onlineText = online > 0 ? `${formatNumber(online)}人气` : ''
  const status = readNumber(info, 'live_status')
  const badge =
    status === 1
      ? `<div class="live-badge live-badge-live">${LIVE_BADGE_ICON_SVG}直播中</div>`
      : status === 0
        ? '<div class="live-badge live-badge-ended">直播结束</div>'
        : ''
  return `<div class="live-card-container"><div class="live-cover"><img src="${escapeHtml(
    imageUrl(cover.length > 0 ? cover : PLACEHOLDER_COVER, 114, 64),
  )}" alt="${escapeHtml(title)}" />${badge}</div><div class="live-content"><div class="live-title">${escapeHtml(
    title,
  )}</div><div class="live-uploader"><div class="live-uploader-icon">${bdcIcon(
    'BDC/uploader_name_square_line/1',
  )}</div><span class="live-uploader-name">${escapeHtml(uname)}</span></div><div class="live-meta">${
    onlineText.length > 0 ? `<span class="live-online">${escapeHtml(onlineText)}</span>` : ''
  }${area.length > 0 ? `<span class="live-area">${escapeHtml(area)}</span>` : ''}</div></div></div>`
}

// ===== 番剧卡片 =====

function buildBangumiContent(info: Record<string, unknown>): string {
  const title = readString(info, 'title') || readString(info, 'season_title') || '未知番剧'
  const cover = readString(info, 'cover') || readString(info, 'square_cover')
  const badgeText = readString(info, 'badgeText') || readString(info, 'progress') || '番剧'
  const followText = readString(info, 'followText') || readString(info, 'follow')
  const followAction = readString(info, 'followActionText') || '追番'
  return `<div class="bangumi-card-container"><div class="bangumi-card-cover"><img src="${escapeHtml(
    imageUrl(cover.length > 0 ? cover : PLACEHOLDER_COVER, 48, 64),
  )}" alt="${escapeHtml(title)}" /></div><div class="bangumi-card-info"><div class="bangumi-card-title">${escapeHtml(
    title,
  )}</div><div class="bangumi-card-meta"><span class="bangumi-card-badge">${escapeHtml(
    badgeText,
  )}</span>${escapeHtml(followText)}</div></div><button class="bangumi-card-action" type="button">${bdcIcon(
    'BDC/heart_collect_line/2',
  )}<span class="bangumi-card-action-text">${escapeHtml(followAction)}</span></button></div>`
}

// ===== 用户名片 =====

function buildUserContent(info: Record<string, unknown>): string {
  const user = readRecord(info, 'user')
  const mid = user !== null ? readString(user, 'mid') : readString(info, 'mid')
  const name = (user !== null ? readString(user, 'name') : '') || readString(info, 'name') || '未知用户'
  const face = (user !== null ? readString(user, 'face') : '') || readString(info, 'face')
  const follower = readString(info, 'follower')
  const like = readString(info, 'like')
  const desc = readString(info, 'desc')
  const removeAccount = info['is_remove_account'] === true
  const relation = user !== null ? readRecord(user, 'relation') : null
  const relationStatus = relation !== null ? readNumber(relation, 'status') : 0
  const followed = relationStatus > 0
  const stats = join([follower, like], '  ')
  const nameStyle = removeAccount ? ' style="color: var(--text3)"' : ''
  const btn = removeAccount
    ? ''
    : `<button class="user-follow-btn${followed ? ' user-follow-btn-followed' : ''}" type="button" aria-label="${
        followed ? `取消关注${name}` : `关注${name}`
      }" data-uid="${escapeHtml(mid)}" data-followed="${followed}" data-status="${relationStatus}"><span class="user-follow-icon">${
        followed ? '' : bdcIcon('BDC/plus_add_line/2')
      }</span><span class="user-follow-text">${followed ? '已关注' : '关注'}</span></button>`
  return `<div class="user-card-container"><div class="user-avatar-wrapper"><div class="user-avatar" data-avatar-mounted="false"><img class="user-avatar-fallback" src="${escapeHtml(
    face,
  )}" alt="${escapeHtml(name)}" loading="lazy" /></div></div><div class="user-info"><div class="user-header"><span class="user-name"${nameStyle}>${escapeHtml(
    name,
  )}</span></div>${stats.length > 0 ? `<div class="user-stats-line">${escapeHtml(stats)}</div>` : ''}${
    desc.length > 0 ? `<div class="user-sign">${escapeHtml(desc)}</div>` : ''
  }</div><div class="user-card-actions">${btn}</div></div>`
}

// ===== 通用卡片 =====

function buildGenericContent(info: Record<string, unknown>): string {
  const title = readString(info, 'title') || readString(info, 'name') || readString(info, 'text') || '无标题'
  const description =
    readString(info, 'description') ||
    readString(info, 'desc') ||
    readString(info, 'intro') ||
    readString(info, 'summary')
  const cover =
    readString(info, 'cover') ||
    readString(info, 'pic') ||
    readString(info, 'avatar') ||
    readString(info, 'face') ||
    readString(info, 'icon')
  return `<div class="generic-card-preview"><div class="generic-card-media"><img src="${escapeHtml(
    cover,
  )}" alt="${escapeHtml(title)}" /></div><div class="generic-card-info"><div class="generic-card-title">${escapeHtml(
    title,
  )}</div>${
    description.length > 0 ? `<div class="generic-card-description">${escapeHtml(description)}</div>` : ''
  }</div></div>`
}

// ===== 骨架屏 =====

function buildSkeleton(cardType: CardType): string {
  if (cardType === 'comment') {
    return '<div class="skeleton-header"><div class="skeleton-avatar"></div><div class="skeleton-info"><div class="skeleton-name"></div><div class="skeleton-time"></div></div></div><div class="skeleton-content"><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>'
  }
  return '<div class="skeleton-thumbnail"></div><div class="skeleton-content"><div class="skeleton-title"></div><div class="skeleton-desc"></div></div>'
}

/** 骨架附加类名（与原版 getSkeletonClassName 对应） */
function skeletonClassName(cardType: CardType): string {
  const map: Record<CardType, string> = {
    video: 'video-card-skeleton',
    topVideo: 'video-card-skeleton',
    opus: 'opus-card-skeleton',
    comment: 'comment-card-skeleton',
    vote: 'vote-card-skeleton',
    music: 'music-card-skeleton',
    toy: 'toy-card-skeleton',
    mall: 'mall-card-skeleton',
    mallGoods: 'mall-goods-card-skeleton',
    goods: 'goods-card-skeleton',
    manga: 'manga-card-skeleton',
    live: 'live-card-skeleton',
    game: 'game-card-skeleton',
    bangumi: 'bangumi-card-skeleton',
    user: 'user-card-skeleton',
    generic: 'generic-card-skeleton',
  }
  return map[cardType]
}

// ===== 外层外壳 =====

/** 卡片内容体（不含三态外壳），供 NodeView 局部刷新复用 */
export function buildCardBody(input: CardRenderInput): CardRenderResult {
  const { info: rawInfo, options } = parseData(input)
  const info = withSnapshot(rawInfo, input)
  const cardStyle = input.style.cardStyle

  switch (input.cardType) {
    case 'video':
      return {
        className: `video-card video-card--${cardStyle === 1 ? 'player' : 'detailed'}`,
        content: buildVideoContent(info, cardStyle),
        skeleton: buildSkeleton('video'),
      }
    case 'topVideo':
      return {
        className: 'top-video-card-wrapper',
        content: `<div class="top-video-card-container"><div class="kala-card-wrapper video-card video-card--player" style="display: block; width: 100%; text-align: center;" data-in-editor="${String(
          input.style.inEditor,
        )}"><div class="kala-card"><div class="kala-card-content" style="display: block">${buildVideoContent(
          info,
          1,
        )}</div></div></div></div>`,
        skeleton: `<div class="top-video-card-container"><div class="kala-card-loading video-card-skeleton" style="display:flex">${buildSkeleton('video')}</div></div>`,
      }
    case 'opus':
      return {
        className: 'opus-card',
        content: buildOpusContent(info),
        skeleton: buildSkeleton('opus'),
      }
    case 'comment':
      return {
        className: 'comment-card',
        content: buildCommentContent(info, input.variant),
        skeleton: buildSkeleton('comment'),
      }
    case 'vote':
      return {
        className: 'vote-card',
        content: buildVoteContent(info),
        skeleton: buildSkeleton('vote'),
      }
    case 'music':
      return {
        className: 'music-card',
        content: buildMusicContent(info),
        skeleton: buildSkeleton('music'),
      }
    case 'toy': {
      const toy = buildToyContent(info, cardStyle, options, input.style.inEditor)
      return { className: toy.className, content: toy.content, skeleton: buildSkeleton('toy') }
    }
    case 'mall':
      return {
        className: 'mall-card',
        content: buildMallContent(info),
        skeleton: buildSkeleton('mall'),
      }
    case 'mallGoods':
      return {
        className: 'mall-goods-card',
        content: buildGoodsContent(info, true),
        skeleton: buildSkeleton('mallGoods'),
      }
    case 'goods':
      return {
        className: 'goods-card',
        content: buildGoodsContent(info, false),
        skeleton: buildSkeleton('goods'),
      }
    case 'manga':
      return {
        className: 'manga-card',
        content: buildMangaContent(info),
        skeleton: buildSkeleton('manga'),
      }
    case 'live':
      return {
        className: 'live-card',
        content: buildLiveContent(info),
        skeleton: buildSkeleton('live'),
      }
    case 'game':
      return {
        className: 'game-card',
        content: buildGameContent(info),
        skeleton: buildSkeleton('game'),
      }
    case 'bangumi':
      return {
        className: 'bangumi-card',
        content: buildBangumiContent(info),
        skeleton: buildSkeleton('bangumi'),
      }
    case 'user':
      return {
        className: 'user-card',
        content: buildUserContent(info),
        skeleton: buildSkeleton('user'),
      }
    default:
      return {
        className: 'generic-card',
        content: buildGenericContent(info),
        skeleton: buildSkeleton('generic'),
      }
  }
}

/**
 * 完整卡片 HTML（BaseCard.renderToString 同构）
 * 三态常驻，style.display 控制显隐，保证 SSR 与编辑态 DOM 一致
 */
export function buildCardHTML(input: CardRenderInput): string {
  const body = buildCardBody(input)
  const status = input.status
  const inEditor = input.style.inEditor
  // 卡片内图片统一带 no-referrer：B 站 CDN 防盗链拒绝非 B 站 referer 的请求
  const withReferrer = (html: string): string =>
    html.replace(/<img(?![^>]*\breferrerpolicy=)/g, '<img referrerpolicy="no-referrer"')
  return withReferrer(`<div class="kala-card-wrapper ${body.className}" style="display: block; width: 100%; text-align: center;" data-in-editor="${String(
    inEditor,
  )}"><div class="kala-card"><div class="kala-card-content" style="display: ${
    status === 'loaded' ? 'block' : 'none'
  }">${body.content}</div><div class="kala-card-loading ${skeletonClassName(
    input.cardType,
  )}" style="display: ${
    status === 'loading' ? 'flex' : 'none'
  }">${body.skeleton}</div><div class="kala-card-error" style="display: ${
    status === 'error' ? 'flex' : 'none'
  }"><div class="error-content">${ERROR_ICON_SVG}<span><span class="error-text">此内容无法展示，请</span><span class="retry-link">重新加载</span></span></div></div></div></div>`)
}
