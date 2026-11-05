/**
 * 卡片业务类型与数据契约（Core 同构层，零 DOM 依赖）
 *
 * 逆向自 B 站 York 编辑器（eva3）的 16 个卡片节点与 20 种视觉形态：
 * - 15 类基础卡片 + 置顶视频节点
 * - 形态变体：视频 detailed/player、玩具 link/card、评论 basic/advanced/screenshot
 */

/** 卡片业务类型（与编辑器节点一一对应） */
export type CardType =
  | 'video'
  | 'topVideo'
  | 'opus'
  | 'comment'
  | 'vote'
  | 'music'
  | 'toy'
  | 'mall'
  | 'mallGoods'
  | 'goods'
  | 'manga'
  | 'live'
  | 'game'
  | 'bangumi'
  | 'user'
  | 'generic'

/** 全部卡片类型（菜单顺序与逆向得到的斜杠菜单一致） */
export const cardTypes: readonly CardType[] = [
  'topVideo',
  'video',
  'opus',
  'comment',
  'vote',
  'live',
  'bangumi',
  'manga',
  'game',
  'music',
  'mall',
  'goods',
  'mallGoods',
  'toy',
  'user',
  'generic',
]

/** 卡片视觉形态（20 种视图） */
export type CardVariant =
  | 'detailed'
  | 'player'
  | 'top'
  | 'basic'
  | 'advanced'
  | 'screenshot'
  | 'card'
  | 'link'
  | 'default'

/** 卡片加载状态 */
export type CardStatus = 'loading' | 'loaded' | 'error'

/** 卡片渲染选项 */
export interface CardStyleOptions {
  /** 0 普通（卡片视图）/ 1 进阶（播放视图），对齐原版 CardStyle */
  cardStyle: 0 | 1
  /** 自定义文案（玩具链接卡片等） */
  showText: string
  /** 编辑态（影响 data-in-editor 与投票点击态） */
  inEditor: boolean
}

/**
 * 卡片渲染输入：节点属性归一化后的完整数据
 * info 为 B 站接口返回结构（字段按卡片类型各异），模板层做防御式读取
 */
export interface CardRenderInput {
  cardType: CardType
  variant: CardVariant
  status: CardStatus
  /** 附加字段（JSON 字符串，内含 info 与展示选项） */
  data: string
  /** 快照字段（无 data 时的降级来源） */
  title: string
  desc: string
  cover: string
  sourceName: string
  refId: string
  /** 卡片角标 */
  badge: string
  style: CardStyleOptions
}

/** 渲染结果：外层类名 + 主体 HTML + 骨架 HTML */
export interface CardRenderResult {
  className: string
  content: string
  skeleton: string
}
