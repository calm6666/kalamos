/**
 * 卡片系统公共入口（Core 层）
 */
import type { CardRenderInput, CardStatus, CardType, CardVariant } from './types'
import { cardTypes } from './types'

export { cardLabels, buildCardBody, buildCardHTML } from './templates'
export { cardTypes } from './types'
export type {
  CardRenderInput,
  CardRenderResult,
  CardStatus,
  CardStyleOptions,
  CardType,
  CardVariant,
} from './types'

/** 卡片菜单项（插入弹窗 / 斜杠菜单共用） */
export interface CardMenuItem {
  type: CardType
  label: string
  icon: string
  placeholder: string
}

/** 卡片菜单（顺序对齐原版工具栏「插入卡片」） */
export const cardMenuItems: readonly CardMenuItem[] = [
  { type: 'video', label: '视频', icon: 'BDC/video_circle_line/2', placeholder: '请输入站内视频链接或BVID' },
  { type: 'topVideo', label: '置顶视频', icon: 'BDC/video_pinned_line/1', placeholder: '请输入站内视频链接或BVID' },
  { type: 'opus', label: '图文', icon: 'BDC/column_line/1', placeholder: '请输入站内图文链接或CVID' },
  { type: 'comment', label: '评论', icon: 'BDC/bubble_comment_line/2', placeholder: '请输入站内评论链接' },
  { type: 'vote', label: '投票', icon: 'BDC/vote_line/1', placeholder: '请输入投票链接' },
  { type: 'live', label: '直播', icon: 'BDC/brandtv_live_line/2', placeholder: '请输入直播间链接或直播间房间号' },
  { type: 'bangumi', label: '番剧', icon: 'BDC/video_circle_line/2', placeholder: '请输入站内番剧链接' },
  { type: 'manga', label: '漫画', icon: 'BDC/book_comic_line/1', placeholder: '请输入站内漫画链接或mc号' },
  { type: 'game', label: '游戏', icon: 'BDC/gamepad_game_line/1', placeholder: '请输入游戏链接或游戏ID' },
  { type: 'music', label: '音乐', icon: 'BDC/note_music_line/2', placeholder: '请输入站内音乐链接或au号' },
  { type: 'mall', label: '会员购展览', icon: 'BDC/bag_member_shop_line/3', placeholder: '请输入会员购内漫展演出链接' },
  { type: 'goods', label: '商品', icon: 'BDC/bag_commodity_line/2', placeholder: '请输入商品链接' },
  { type: 'mallGoods', label: '会员购商品', icon: 'BDC/bag_member_shop_line/3', placeholder: '请输入会员购商品链接' },
  { type: 'toy', label: '玩具', icon: 'BDC/toy_line/1', placeholder: '请输入玩具链接' },
  { type: 'user', label: '名片', icon: 'BDC/person_user_line/1', placeholder: '请输入正确的用户主页链接或UID' },
  { type: 'generic', label: '通用卡片', icon: 'BDC/link_line', placeholder: '请输入链接' },
]

/** 字符串 → CardType（未识别回退 generic） */
export function toCardType(value: string): CardType {
  const found = cardTypes.find((type) => type === value)
  return found ?? 'generic'
}

/** 字符串 → CardVariant */
export function toCardVariant(value: string): CardVariant {
  const variants: readonly CardVariant[] = [
    'detailed',
    'player',
    'top',
    'basic',
    'advanced',
    'screenshot',
    'card',
    'link',
    'default',
  ]
  return variants.find((variant) => variant === value) ?? 'default'
}

/** 字符串 → CardStatus */
export function toCardStatus(value: string): CardStatus {
  if (value === 'loading' || value === 'error') {
    return value
  }
  return 'loaded'
}

/** 节点属性读取辅助 */
function attrString(attrs: Record<string, unknown>, key: string): string {
  const value = attrs[key]
  return typeof value === 'string' ? value : ''
}

/** 节点属性 → 渲染输入（编辑器 / SSR 统一入口） */
export function cardInputFromAttrs(
  attrs: Record<string, unknown>,
  inEditor: boolean,
): CardRenderInput {
  const cardStyle = attrs['cardStyle'] === 1 ? 1 : 0
  const variant = toCardVariant(attrString(attrs, 'variant'))
  return {
    cardType: toCardType(attrString(attrs, 'cardType')),
    variant,
    status: toCardStatus(attrString(attrs, 'status')),
    data: attrString(attrs, 'data'),
    title: attrString(attrs, 'title'),
    desc: attrString(attrs, 'desc'),
    cover: attrString(attrs, 'cover'),
    sourceName: attrString(attrs, 'sourceName'),
    refId: attrString(attrs, 'refId'),
    badge: attrString(attrs, 'badge'),
    style: {
      cardStyle,
      showText: attrString(attrs, 'showText'),
      inEditor,
    },
  }
}
