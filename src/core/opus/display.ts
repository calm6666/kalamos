/**
 * opus 展示页数据模型（渲染端专用）
 *
 * 段落结构复用 factory.ts 的 opus 段落模型（结构兼容，可直接传入 OpusDocument.sections），
 * 在此基础上扩展展示端所需的链接形态（视频高亮）与失效卡段。
 */
import type { OpusWordNode, OpusFormulaNode, OpusImageSection, OpusCardSection, OpusFormulaSection } from './factory'

/** 展示端链接节点：在 opus link 基础上增加视频高亮标记 */
export interface OpusDisplayLinkNode {
  node_type: 3
  link_type: 'url' | 'mention' | 'topic' | 'emoji'
  show_text: string
  url?: string
  user_id?: string
  name?: string
  img?: string
  /** url 形态：视频高亮链接（渲染播放圆圈图标） */
  video?: boolean
}

/** 展示端行内节点联合 */
export type OpusDisplayInline = OpusWordNode | OpusDisplayLinkNode | OpusFormulaNode

/** 展示端段落 */
export interface OpusDisplayParagraph {
  node_type: 0
  words: OpusDisplayInline[]
  paragraph_style?: {
    align?: 'left' | 'center' | 'right'
    indent?: number
    heading_level?: number
  }
}

/** 失效卡段：无法解析的内容渲染为 kala-para-link-card 提示条 */
export interface OpusInvalidSection {
  node_type: 7
  tip: string
}

/** 展示端段落联合 */
export type OpusDisplaySection =
  | OpusDisplayParagraph
  | OpusImageSection
  | OpusCardSection
  | OpusFormulaSection
  | OpusInvalidSection

/** 目录项（支持二级嵌套） */
export interface OpusTocItem {
  text: string
  children?: OpusTocItem[]
}

/** 作者信息 */
export interface OpusDisplayAuthor {
  name: string
  /** 头像地址（webp 形态，渲染时自动生成 avif/webp 双源） */
  avatarUrl: string
  /** 发布时间文本 */
  pubText: string
  /** 昵称颜色（原站为品牌粉） */
  nameColor?: string
}

/** 顶部封面 */
export interface OpusDisplayCover {
  /** 封面地址（webp 形态） */
  url: string
  /** 封面高度（原站实测 419px） */
  height?: number
}

/** opus 展示页文档 */
export interface OpusDisplayDoc {
  /** 稿件 cv 号（版权模块右侧展示） */
  id: string
  title: string
  cover?: OpusDisplayCover
  author: OpusDisplayAuthor
  /** 话题名（模块级话题，渲染 kala-topic 组件） */
  topicName?: string
  /** 目录（有值时渲染固定定位的目录面板） */
  toc?: OpusTocItem[]
  /** 版权声明文本（左） */
  copyrightText?: string
  sections: OpusDisplaySection[]
}
