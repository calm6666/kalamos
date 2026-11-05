/**
 * 扩展装配中心：StarterKit 定制 + 自定义扩展组装
 *
 * defaultExtensions 是服务端渲染、客户端编辑器、Markdown 管线三方的唯一派生源，
 * 禁止在其他位置重复手写扩展数组（杜绝漂移）。
 */
import { StarterKit } from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Placeholder, CharacterCount } from '@tiptap/extensions'
import { common, createLowlight } from 'lowlight'
import type { AnyExtension, Extensions } from '@tiptap/core'
import type { MentionOptions } from '@tiptap/extension-mention'

import { FontLevelTextStyle } from './marks/font-level'
import { TextColor } from './marks/text-color'
import { BackgroundColor } from './marks/background-color'
import { BiliLink } from './marks/bili-link'
import { HighlightPalette } from './marks/highlight-palette'

import { HeadingWithId } from './nodes/heading-id'
import { KalamosImage } from './nodes/image'
import { Emoji } from './nodes/emoji'
import { KalamosMention } from './nodes/mention'
import { Topic } from './nodes/topic'
import { Latex } from './nodes/latex'
import { Card } from './nodes/card'
import { UserInline } from './nodes/user-inline'

import { Indent } from './behaviors/indent'
import { Align } from './behaviors/align'
import { FormatPainter } from './behaviors/format-painter'
import { MarkdownImport } from './behaviors/markdown-import'

/** createDefaultExtensions 可配置项（Client 层装配时注入） */
export interface DefaultExtensionsOptions {
  /** 正文占位文案（默认给中性文案，Client 传入 i18n 文案） */
  placeholder?: string
  /** @提及建议配置（Client 层注入用户搜索实现；不传用官方默认） */
  mentionSuggestion?: MentionOptions['suggestion']
  /** 缩进达到最大层级回调（toast 提示） */
  onIndentLimit?: () => void
  /** 粘贴检测到 Markdown 语法回调（toast 确认） */
  onMarkdownDetected?: (markdownText: string) => void
}

/**
 * 组装默认扩展集
 *
 * StarterKit 关闭项：
 * - heading → HeadingWithId（增加 id 属性）
 * - link → BiliLink（站内链接类型识别）
 * - codeBlock → CodeBlockLowlight（lowlight 高亮 + 行号）
 * - textStyle → FontLevelTextStyle（增加 fontLevel 属性）
 */
export function createDefaultExtensions(options: DefaultExtensionsOptions = {}): AnyExtension[] {
  const lowlight = createLowlight(common)

  return [
    StarterKit.configure({
      heading: false,
      link: false,
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),

    // 标记
    FontLevelTextStyle,
    FontFamily,
    FontSize,
    TextColor,
    BackgroundColor,
    HighlightPalette,
    BiliLink,

    // 节点
    HeadingWithId,
    KalamosImage,
    Emoji,
    KalamosMention.configure(
      options.mentionSuggestion ? { suggestion: options.mentionSuggestion } : {},
    ),
    Topic,
    Latex,
    Card,
    UserInline,

    // 列表 / 表格
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,

    // 行为
    Indent.configure({ onIndentLimit: options.onIndentLimit ?? (() => undefined) }),
    Align,
    FormatPainter,
    MarkdownImport.configure({
      onMarkdownDetected: options.onMarkdownDetected ?? (() => undefined),
    }),

    // 上下标
    Subscript,
    Superscript,

    // 功能扩展
    Placeholder.configure({ placeholder: options.placeholder ?? '输入正文，键入 / 唤起菜单' }),
    CharacterCount,
  ]
}

/** 单一扩展源：静态渲染 / 客户端 / Markdown 管线共同派生 */
export const defaultExtensions: Extensions = createDefaultExtensions()
