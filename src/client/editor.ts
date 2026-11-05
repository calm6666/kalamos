/**
 * kalamos 编辑器装配层：扩展组装 + NodeView 注入 + UI 挂载
 *
 * 职责：
 * - 按语言包初始化 i18n，装配 Core 默认扩展（mention 建议 / Markdown 粘贴确认 / 缩进上限）
 * - 注入全部 NodeView（代码块/图片/公式/提及/话题/表情/卡片）
 * - 挂载工具栏、气泡菜单、拖拽手柄、目录面板、预览分栏、字数统计
 * - 接收自定义事件（kalamos:request-image / -latex / -emoji / -card）弹窗交互
 */
import { Editor } from '@tiptap/core'
import type { AnyExtension, Extensions, NodeViewRenderer } from '@tiptap/core'
import { createDefaultExtensions } from '../core/extensions/configure-kit'
import type {
  CardType,
  CardVariant,
  EditorApi,
  EditorDoc,
  EditorLocaleMessages,
} from '../core/types'
import { cardMenuItems } from '../core/cards'
import type { CardMenuItem } from '../core/cards'
import { bdcIcon } from '../core/cards/icons'
import { createMockApi } from './api/mock'
import { setLocale, t } from './i18n'
import type { Locale } from './i18n'
import { createToolbar } from './ui/toolbar'
import { buildSlashCommands, createSlashExtension } from './ui/slash-menu'
import { createMentionSuggestion } from './ui/mention-suggestion'
import { setupSelectionBubble } from './ui/bubble-menus'
import { setupDragHandle } from './ui/drag-handle'
import { createTocPanel } from './ui/toc-panel'
import { createPreviewSplit } from './ui/preview'
import type { KalaToolbarPreview } from './ui/toolbar'
import { showToast, showMarkdownConfirmToast } from './ui/toast'
import { openLatexModal, openImageModal, openCardModal, parseCardInfoData } from './ui/modals'
import { setupHoverMenu } from './ui/hover-menu'
import { builtinEmojis, createEmojiPicker } from './ui/emoji-picker'
import { positionFloating } from './ui/floating'
import { CodeBlockView } from './node-views/code-block'
import { ImageView } from './node-views/image'
import { LatexView } from './node-views/latex'
import { MentionView } from './node-views/mention'
import { TopicView } from './node-views/topic'
import { EmojiView } from './node-views/emoji'
import { UserInlineView } from './node-views/user-inline'
import { CardView } from './node-views/card'
import { parseDocx } from './word-import'

/** createEditor 配置项 */
export interface CreateEditorOptions {
  /** 编辑器挂载容器（内容由本函数接管） */
  element: HTMLElement
  /** 初始内容（PM JSON 或 HTML 字符串） */
  content?: EditorDoc | string
  /** 语言（默认 zh-cn） */
  locale?: Locale
  /** 宿主文案覆盖（合并进内置语言包） */
  messages?: EditorLocaleMessages
  /** 宿主注入 API（不传时使用内置 mock） */
  api?: EditorApi
  /** 追加扩展（追加在默认扩展之后） */
  extensions?: Extensions
  /** 最大字数（超出后字数统计变红，不阻断输入） */
  charCountLimit?: number
  /** 文档变更回调 */
  onChange?: (doc: EditorDoc) => void
}

/** createEditor 返回句柄 */
export interface KalamosEditorHandle {
  /** 编辑器实例（宿主可调用命令 / 读取文档） */
  editor: Editor
  /** 销毁编辑器与全部挂载 UI */
  destroy: () => void
}

/** 从 CharacterCount storage 安全读取字数（storage 类型宽松，走守卫） */
function readCharCount(editor: Editor): number {
  const storage: unknown = editor.storage['characterCount']
  if (
    typeof storage === 'object' &&
    storage !== null &&
    'characters' in storage &&
    typeof storage.characters === 'function'
  ) {
    return storage.characters()
  }
  return 0
}

/** 在光标处创建 1px fixed 定位锚点（表情选择器 / 卡片菜单的定位参照） */
function createCursorAnchor(editor: Editor): HTMLDivElement {
  const coords = editor.view.coordsAtPos(editor.state.selection.from)
  const anchor = document.createElement('div')
  anchor.style.position = 'fixed'
  anchor.style.left = `${coords.left}px`
  anchor.style.top = `${coords.top}px`
  anchor.style.width = '1px'
  anchor.style.height = '1px'
  document.body.appendChild(anchor)
  return anchor
}

/** 卡片类型下拉菜单（工具栏卡片按钮 / 斜杠卡片命令共用） */
function openCardTypeMenu(editor: Editor, api: EditorApi, anchor: HTMLElement, onDone: () => void): void {
  const menu = document.createElement('div')
  menu.className = 'kala-dropdown kala-card-menu'
  for (const item of cardMenuItems) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'kala-dropdown__item'
    button.innerHTML = `${bdcIcon(item.icon)}<span class="kala-card-menu__label">${item.label}</span>`
    button.addEventListener('click', () => {
      cleanup()
      void insertCardOfType(editor, api, item)
    })
    menu.appendChild(button)
  }
  document.body.appendChild(menu)
  void positionFloating(anchor, menu, 'bottom-start')

  const onDocMouseDown = (event: MouseEvent): void => {
    if (event.target instanceof Node && !menu.contains(event.target)) {
      cleanup()
    }
  }
  const cleanup = (): void => {
    menu.remove()
    document.removeEventListener('mousedown', onDocMouseDown)
    onDone()
  }
  document.addEventListener('mousedown', onDocMouseDown)
}

/** 新插入卡片的默认视图形态（对齐原版各类型默认 CardStyle） */
function defaultCardState(cardType: CardType): { variant: CardVariant; cardStyle: 0 | 1 } {
  if (cardType === 'topVideo') {
    return { variant: 'top', cardStyle: 1 }
  }
  if (cardType === 'video') {
    return { variant: 'detailed', cardStyle: 0 }
  }
  if (cardType === 'comment') {
    return { variant: 'advanced', cardStyle: 0 }
  }
  if (cardType === 'toy') {
    return { variant: 'card', cardStyle: 1 }
  }
  return { variant: 'default', cardStyle: 0 }
}

/** 选择卡片类型后弹窗输入链接 / ID，插入卡片节点 */
async function insertCardOfType(editor: Editor, api: EditorApi, item: CardMenuItem): Promise<void> {
  const result = await openCardModal(item.type, '', api)
  if (result === null || result.refId.length === 0) {
    return
  }
  // 名片：确认即行内极简形态（原版 insertUserInline），先拉取完整名片信息
  if (item.type === 'user') {
    try {
      const cardInfo = await api.fetchCardInfo('user', result.refId)
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'userInline',
          attrs: { status: 'loaded', info: parseCardInfoData(cardInfo.data) },
        })
        .run()
    } catch {
      showToast(t('verifyUserInfoFailed'))
    }
    return
  }
  const state = defaultCardState(item.type)
  editor
    .chain()
    .focus()
    .insertCard({
      cardType: item.type,
      refId: result.refId,
      variant: state.variant,
      cardStyle: state.cardStyle,
      status: 'loading',
      showText: result.showText ?? '',
    })
    .run()
}

/**
 * 创建 kalamos 编辑器
 * 装配默认扩展、NodeView、工具栏与全部交互 UI，返回销毁句柄
 */
export function createEditor(options: CreateEditorOptions): KalamosEditorHandle {
  const {
    element,
    content,
    locale = 'zh-cn',
    messages,
    charCountLimit,
    onChange,
  } = options
  const api: EditorApi = options.api ?? createMockApi()

  // 1. i18n 初始化（后续 UI 全部经由 t() 取文案）
  setLocale(locale, messages)

  // 2. 宿主 DOM 结构：toolbar + body(content) + 字数统计
  const host = element
  host.classList.add('kala-editor')
  host.textContent = ''
  const bodyEl = document.createElement('div')
  bodyEl.className = 'kala-editor-body'
  const contentEl = document.createElement('div')
  contentEl.className = 'kala-content'
  contentEl.id = 'kalamos-content'
  bodyEl.appendChild(contentEl)
  host.appendChild(bodyEl)

  // 3. 扩展装配（mention 建议 / Markdown 粘贴确认 / 缩进上限回调）
  //    Markdown 粘贴确认需要 editor 实例，经引用占位在回调中延迟读取
  let editorRef: Editor | null = null

  /** 客户端 NodeView 工厂表（key 为 PM 节点名）。tiptap v3 的 createView 用 extensionManager.nodeViews 覆盖 editorProps.nodeViews，必须经扩展 addNodeView 注册 */
  const nodeViewFactories: Record<string, NodeViewRenderer> = {
    codeBlock: ({ node, view, getPos }) => new CodeBlockView(node, view, getPos),
    image: ({ node, view, getPos }) => new ImageView(node, view, getPos),
    latex: ({ node, view, getPos }) =>
      new LatexView(node, view, getPos, {
        onEdit: (currentFormula) => openLatexModal(currentFormula),
      }),
    mention: ({ node }) => new MentionView(node),
    topic: ({ node }) => new TopicView(node),
    emoji: ({ node }) => new EmojiView(node),
    card: ({ node, view, getPos }) => new CardView(node, view, getPos, api),
    userInline: ({ node, getPos }) => new UserInlineView(node, getPos),
  }

  /** 把 NodeView 挂到同名默认扩展上（extend 保留 configure 的选项） */
  const withNodeViews = (extension: AnyExtension): AnyExtension => {
    const nodeView = nodeViewFactories[extension.name]
    return nodeView === undefined ? extension : extension.extend({ addNodeView: () => nodeView })
  }

  const extensions: Extensions = [
    ...createDefaultExtensions({
      placeholder: t('placeholder.body'),
      mentionSuggestion: createMentionSuggestion(api),
      onIndentLimit: () => showToast(t('toast.indentLimit')),
      onMarkdownDetected: (markdownText) => {
        void showMarkdownConfirmToast().then((confirmed) => {
          if (!confirmed || editorRef === null) {
            return
          }
          const ok = editorRef.chain().focus().importMarkdown(markdownText, { replace: false }).run()
          showToast(ok ? t('toast.markdownImported') : t('toast.markdownImportFailed'))
        })
      },
    }).map(withNodeViews),
    createSlashExtension(
      buildSlashCommands((editor) => {
        editor.emit('kalamos:request-card')
      }),
    ),
    ...(options.extensions ?? []),
  ]

  // 4. 编辑器实例
  const editor = new Editor({
    element: contentEl,
    content,
    extensions,
    editorProps: {
      attributes: {
        class: 'kala-content',
        spellcheck: 'false',
      },
    },
  })
  editorRef = editor

  // 5. 工具栏 + 预览分栏 + 目录面板 + 气泡菜单 + 拖拽手柄
  let fullscreen = false
  let previewOn = false
  const preview = createPreviewSplit(editor, contentEl, () => {
    previewOn = false
    const toggle = host.querySelector<KalaToolbarPreview>('kala-toolbar-preview')
    if (toggle !== null) {
      toggle.active = false
    }
  })
  const tocPanel = createTocPanel(editor, bodyEl)
  const toolbar = createToolbar(editor, {
    onPreview: () => {
      previewOn = !previewOn
      preview.setEnabled(previewOn)
    },
    onToggleToc: () => {
      const visible = tocPanel.el.style.display !== 'none'
      tocPanel.el.style.display = visible ? 'none' : 'block'
      if (!visible) {
        tocPanel.refresh()
      }
    },
    onToggleFullscreen: () => {
      fullscreen = !fullscreen
      host.classList.toggle('kala-editor--fullscreen', fullscreen)
    },
    onImportWord: (file) => {
      showToast(t('toast.wordImporting'))
      parseDocx(file)
        .then((doc) => {
          editor.chain().focus().setContent(doc).run()
          showToast(t('toast.wordImported'))
        })
        .catch(() => {
          showToast(t('toast.wordImportFailed'))
        })
    },
    onOpenCardMenu: (anchor) => {
      openCardTypeMenu(editor, api, anchor, () => undefined)
    },
    emojiList: builtinEmojis,
    uploadImage: (file) => api.uploadImage(file),
  })
  host.insertBefore(toolbar, bodyEl)
  const destroyBubble = setupSelectionBubble(editor, bodyEl)
  const destroyDragHandle = setupDragHandle(editor, bodyEl)
  const destroyHoverMenu = setupHoverMenu(editor, {
    api,
    editCard: async (cardType, refId) => {
      const result = await openCardModal(cardType, refId, api)
      // 名片确认固定 inline 形态：补齐完整名片信息供原位替换
      if (result !== null && cardType === 'user' && result.refId.length > 0) {
        try {
          const cardInfo = await api.fetchCardInfo('user', result.refId)
          result.userInfo = parseCardInfoData(cardInfo.data)
        } catch {
          // 信息拉取失败时保留 refId 更新，由悬浮菜单侧兜底
        }
      }
      return result
    },
  })

  // 6. 字数统计（fixed 角标）
  const charCountEl = document.createElement('div')
  charCountEl.className = 'kala-char-count'
  host.appendChild(charCountEl)
  const refreshCharCount = (): void => {
    const count = readCharCount(editor)
    charCountEl.textContent = `${t('toolbar.charCount')} ${count}`
    charCountEl.classList.toggle(
      'kala-char-count--over',
      charCountLimit !== undefined && count > charCountLimit,
    )
  }
  refreshCharCount()

  // 7. 自定义事件接线（斜杠命令触发的弹窗交互）
  editor.on('kalamos:request-image', () => {
    void openImageModal((file) => api.uploadImage(file)).then((result) => {
      if (result === null) {
        return
      }
      editor
        .chain()
        .focus()
        .insertKalamosImage({
          src: result.src,
          caption: result.caption,
          align: result.align,
          status: 'loaded',
        })
        .run()
    })
  })

  editor.on('kalamos:request-latex', () => {
    void openLatexModal(null).then((formula) => {
      if (formula === null) {
        return
      }
      editor.chain().focus().insertLatex({ formula }).run()
    })
  })

  editor.on('kalamos:request-emoji', () => {
    const anchor = createCursorAnchor(editor)
    createEmojiPicker(anchor, {
      onSelect: (item) => {
        editor
          .chain()
          .focus()
          .insertEmoji({ name: item.name, char: item.char, img: item.img })
          .run()
      },
      onClose: () => anchor.remove(),
    })
  })

  editor.on('kalamos:request-card', () => {
    const anchor = createCursorAnchor(editor)
    openCardTypeMenu(editor, api, anchor, () => anchor.remove())
  })

  // 8. 文档变更：字数统计 + onChange 回调 + 目录刷新
  const syncDoc = (): void => {
    refreshCharCount()
    if (tocPanel.el.style.display !== 'none') {
      tocPanel.refresh()
    }
    if (onChange !== undefined) {
      onChange(editor.state.doc.toJSON())
    }
  }
  editor.on('update', syncDoc)

  return {
    editor,
    destroy: () => {
      editor.off('update', syncDoc)
      destroyBubble()
      destroyDragHandle()
      destroyHoverMenu()
      preview.destroy()
      tocPanel.destroy()
      editor.destroy()
      host.textContent = ''
      host.classList.remove('kala-editor--fullscreen')
    },
  }
}
