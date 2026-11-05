/**
 * 气泡菜单：选区格式气泡 / 链接悬停气泡
 * 选中非空文本时浮现格式气泡；悬停链接时浮现链接气泡（打开/复制）
 */
import type { Editor } from '@tiptap/core'
import { positionFloating } from './floating'
import { t } from '../i18n'
import { openLinkModal } from './modals'

/** 创建并管理格式气泡（挂在编辑器容器上） */
export function setupSelectionBubble(editor: Editor, container: HTMLElement): () => void {
  const bubble = document.createElement('div')
  bubble.className = 'kala-bubble'
  bubble.style.display = 'none'

  const makeBubbleBtn = (label: string, isActive: () => boolean, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'kala-bubble__btn'
    btn.textContent = label
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      onClick()
      btn.classList.toggle('is-active', isActive())
    })
    return btn
  }

  bubble.append(
    makeBubbleBtn('B', () => editor.isActive('bold'), () => editor.chain().focus().toggleBold().run()),
    makeBubbleBtn('I', () => editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run()),
    makeBubbleBtn('S', () => editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run()),
    makeBubbleBtn('U', () => editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run()),
    makeBubbleBtn('<>', () => editor.isActive('code'), () => editor.chain().focus().toggleCode().run()),
    makeBubbleBtn(
      t('toolbar.link'),
      () => editor.isActive('link'),
      () => {
        const href = editor.getAttributes('link')['href']
        void openLinkModal(
          typeof href === 'string' ? { href, text: '' } : null,
        ).then((result) => {
          if (result === null || result.remove) {
            editor.chain().focus().unsetLink().run()
            return
          }
          editor.chain().focus().setLink({ href: result.href }).run()
        })
      },
    ),
  )
  container.appendChild(bubble)

  const update = (): void => {
    const { state } = editor
    const { empty } = state.selection
    if (empty || !editor.isFocused) {
      bubble.style.display = 'none'
      return
    }
    // 选区内包含图片/卡片等原子块时不出气泡（与原版一致）
    const { from, to } = state.selection
    let hasAtom = false
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isAtom && !node.isText) {
        hasAtom = true
      }
      return !hasAtom
    })
    if (hasAtom) {
      bubble.style.display = 'none'
      return
    }
    bubble.style.display = 'flex'
    // 参照选区的实际矩形（虚拟元素），而不是整个编辑区
    void positionFloating(
      {
        getBoundingClientRect: () => {
          const { from: start, to: end } = editor.state.selection
          const a = editor.view.coordsAtPos(start)
          const b = editor.view.coordsAtPos(end)
          const left = Math.min(a.left, b.left)
          const top = Math.min(a.top, b.top)
          const right = Math.max(a.right, b.right)
          const bottom = Math.max(a.bottom, b.bottom)
          return {
            x: left,
            y: top,
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
          }
        },
      },
      bubble,
      'top',
    )
  }

  const hide = (): void => {
    bubble.style.display = 'none'
  }

  editor.on('selectionUpdate', update)
  editor.on('transaction', update)
  editor.on('blur', hide)

  return () => {
    bubble.remove()
  }
}
