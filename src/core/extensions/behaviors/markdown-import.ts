/**
 * Markdown 导入行为扩展
 * - importMarkdown 命令（对齐原版同名命令：isImporting 并发守卫 + 空解析报错 markdownParseEmpty）
 * - 粘贴检测：handlePaste 中以启发式判定后回调 onMarkdownDetected（Client 层弹 toast 确认）
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { markdownToJSON } from '../../markdown/parse'
import { detectMarkdown } from '../../markdown/detect'

export interface MarkdownImportOptions {
  /** 粘贴检测到 Markdown 语法时回调（Client 层弹 toast「检测到 Markdown 语法」） */
  onMarkdownDetected: (markdownText: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    markdownImport: {
      /**
       * 导入 Markdown
       * @param content Markdown 文本
       * @param options.replace true 整体替换文档（导入命令）；false 光标处插入（粘贴转换）
       */
      importMarkdown: (content: string, options?: { replace?: boolean }) => ReturnType
    }
  }
}

export const MarkdownImport = Extension.create<MarkdownImportOptions>({
  name: 'markdownImport',

  addOptions() {
    return {
      onMarkdownDetected: () => undefined,
    }
  },

  addStorage() {
    return {
      /** 导入并发守卫（对齐原版 isImporting） */
      isImporting: false,
    }
  },

  addCommands() {
    return {
      importMarkdown:
        (content, options) =>
        ({ commands }) => {
          if (this.storage.isImporting) {
            return false
          }
          const json = markdownToJSON(content)
          if (json === null) {
            // 对齐原版 markdownParseEmpty：空解析直接失败
            return false
          }
          this.storage.isImporting = true
          const result =
            options?.replace === true
              ? commands.setContent(json)
              : commands.insertContent(json)
          this.storage.isImporting = false
          return result
        },
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: new PluginKey('markdownPasteDetect'),
        props: {
          handlePaste: (_view, event) => {
            const clipboardData = event.clipboardData
            if (clipboardData === null) {
              return false
            }
            // 已复制富文本（text/html）时跳过检测：仅处理纯文本粘贴
            if (clipboardData.types.includes('text/html')) {
              return false
            }
            const text = clipboardData.getData('text/plain')
            if (text.length === 0) {
              return false
            }
            if (detectMarkdown(text)) {
              options.onMarkdownDetected(text)
              // 返回 true 拦截默认粘贴，等待用户确认转换 / 取消保留原文
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})
