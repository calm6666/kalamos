/**
 * kalamos 核心公共类型定义
 *
 * 本文件为同构层（Node 与浏览器均可运行）的公共类型：
 * - 文档结构类型（ProseMirror JSON 的别名与扩展）
 * - 卡片系统类型（快照 / 完整信息 / 类型枚举，详见 core/cards）
 * - 宿主注入 API 契约（卡片信息 / 用户搜索 / 图片上传）
 */
import type { JSONContent } from '@tiptap/core'
import type { CardStatus, CardType, CardVariant } from './cards/types'

export type { CardStatus, CardType, CardVariant } from './cards/types'
export { cardTypes } from './cards/types'

/** 编辑器文档结构：ProseMirror JSON（与 Tiptap JSONContent 同形） */
export type EditorDoc = JSONContent

/**
 * 卡片快照：冗余存储在 card 节点属性中的最小信息集
 * 静态渲染（SSR）只依赖快照输出骨架，Client NodeView 拉取成功后回写快照
 */
export interface CardSnapshot {
  /** 卡片业务类型 */
  cardType: CardType
  /** 视觉形态（detailed/player/link/advanced 等） */
  variant: CardVariant
  /** 业务对象 id（BV 号 / ep 号 / 房间号等） */
  refId: string
  /** 标题（如视频标题、商品名） */
  title: string
  /** 描述（UP主 / 歌手 / 签名等） */
  desc: string
  /** 封面图 URL */
  cover: string
  /** 来源名（如「哔哩哔哩视频」） */
  sourceName: string
  /** 角标文案（如「3.9万 弹幕」「已结束」） */
  badge: string
  /** 附加数据（JSON 序列化字符串：完整 info + 展示选项） */
  data: string
  /** 加载状态 */
  status: CardStatus
  /** 0 卡片视图 / 1 播放视图 */
  cardStyle: 0 | 1
}

/** 卡片完整信息：API 返回的完整数据 = 快照 + 渲染扩展字段 */
export interface CardInfo extends CardSnapshot {
  /** 来源图标 URL（卡片头部小图标） */
  icon: string
  /** 兼容旧接口的附加字段（等价 data） */
  extra: string
}

/** 用户信息：@提及搜索结果与用户名片卡片共用 */
export interface UserInfo {
  /** 用户唯一 id */
  id: string
  /** 昵称 */
  name: string
  /** 头像 URL */
  avatar: string
  /** 个性签名（名片卡片用） */
  sign: string
  /** 粉丝数文案（名片卡片用） */
  fans: string
}

/** 图片上传结果 */
export interface ImageUploadResult {
  /** 上传后的图片 URL */
  src: string
}

/** 视频条目：弹窗「我的投稿」「我的收藏」列表与视频下拉复用 */
export interface VideoPostItem {
  /** 视频 avid */
  aid: string
  /** 视频 bvid（确认插入时作为 refId） */
  bvid: string
  /** 视频标题 */
  title: string
  /** 封面图 URL */
  cover: string
  /** 时长（秒） */
  duration: number
  /** UP 主名 */
  author: string
  /** 观看数文案（如 25.8万） */
  view: string
  /** 发布日期 YYYY-MM-DD */
  pubdate: string
  /** 缩略图角标文案（如「充电专属」） */
  cornerBadge: string
}

/** 收藏夹条目：弹窗「我的收藏」左侧导航 */
export interface FavoriteFolder {
  /** 收藏夹 id */
  id: string
  /** 收藏夹标题 */
  title: string
  /** 收藏视频数 */
  count: number
}

/** 游戏搜索结果：游戏弹窗「搜索添加」tab */
export interface GameSearchItem {
  /** 游戏 base id（确认插入时拼为 gm{id}） */
  gameBaseId: string
  /** 游戏名 */
  name: string
  /** 图标 URL */
  icon: string
}

/**
 * 宿主注入 API 契约
 *
 * 库内置 mock 实现（模拟 600ms 延迟与「无法识别该链接」错误），
 * 宿主可通过 createEditor({ api }) 注入真实实现
 */
export interface EditorApi {
  /** 按类型与 refId 拉取卡片信息（无法识别时 reject） */
  fetchCardInfo: (cardType: CardType, refId: string) => Promise<CardInfo>
  /** 按关键词搜索用户（@提及下拉） */
  searchUser: (keyword: string) => Promise<UserInfo[]>
  /** 上传图片文件（File 为纯类型标注，运行时仅由 Client 层调用） */
  uploadImage: (file: File) => Promise<ImageUploadResult>
  /** 我的投稿列表（视频弹窗「我的投稿」tab） */
  fetchMyPosts: () => Promise<VideoPostItem[]>
  /** 收藏夹列表（视频弹窗「我的收藏」tab 左侧导航） */
  fetchMyFavorites: () => Promise<FavoriteFolder[]>
  /** 收藏夹内视频列表（视频弹窗「我的收藏」tab 右侧列表） */
  fetchFavoriteVideos: (folderId: string) => Promise<VideoPostItem[]>
  /** 按名称搜索游戏（游戏弹窗「搜索添加」tab） */
  searchGames: (keyword: string) => Promise<GameSearchItem[]>
}

/** createEditor 客户端配置（完整定义见 client/editor.ts） */
export interface EditorLocaleMessages {
  /** 以 key → 文案 的扁平结构合并进内置语言包 */
  [key: string]: string
}
