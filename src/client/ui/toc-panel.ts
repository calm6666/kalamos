/**
 * TOC 目录面板：标题树（H1–H3），点击滚动到锚点；无标题时显示空态
 */
import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { t } from '../i18n'

/** 创建 TOC 面板（挂载在传入容器，随编辑器文档更新刷新） */
export function createTocPanel(editor: Editor, container: HTMLElement): { el: HTMLDivElement; refresh: () => void; destroy: () => void } {
  const panel = document.createElement('div')
  panel.className = 'kala-toc-panel'
  panel.style.display = 'none'
  container.appendChild(panel)

  const title = document.createElement('div')
  title.className = 'kala-toc-panel__title'
  title.textContent = t('toolbar.toc')
  panel.appendChild(title)

  const refresh = (): void => {
    // 清空标题后的列表区域
    for (const child of Array.from(panel.children)) {
      if (child !== title) {
        child.remove()
      }
    }
    const headings = collectHeadings(editor.state.doc.toJSON())
    if (headings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'kala-toc-panel__empty'
      empty.textContent = '暂无目录'
      panel.appendChild(empty)
      return
    }
    for (const heading of headings) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = `kala-toc-panel__item${heading.level > 1 ? ` kala-toc-panel__item--lv${heading.level}` : ''}`
      item.textContent = heading.text
      item.title = heading.text
      item.addEventListener('click', () => {
        // 定位到标题位置
        let found = 0
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading' && node.attrs['level'] === heading.level) {
            const text = node.textContent
            if (text === heading.text && found === heading.order) {
              const dom = editor.view.nodeDOM(pos)
              if (dom instanceof HTMLElement) {
                dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              return false
            }
            found += 1
          }
          return true
        })
      })
      panel.appendChild(item)
    }
  }

  const updateHandler = (): void => refresh()
  editor.on('update', updateHandler)
  refresh()

  return {
    el: panel,
    refresh,
    destroy: () => {
      editor.off('update', updateHandler)
      panel.remove()
    },
  }
}

/** 文档中标题清单（level / text / order） */
interface HeadingEntry {
  level: number
  text: string
  order: number
}

function collectHeadings(doc: JSONContent): HeadingEntry[] {
  const result: HeadingEntry[] = []
  const counters = { lv1: 0, lv2: 0, lv3: 0 }
  for (const block of doc.content ?? []) {
    if (block.type !== 'heading') {
      continue
    }
    const level = typeof block.attrs?.['level'] === 'number' ? block.attrs['level'] : 1
    const text = (block.content ?? []).map((n) => (typeof n.text === 'string' ? n.text : '')).join('')
    const order =
      level === 1 ? counters.lv1++ : level === 2 ? counters.lv2++ : counters.lv3++
    result.push({ level, text, order })
  }
  return result
}
