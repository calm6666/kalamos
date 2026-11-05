/**
 * 块拖拽手柄：悬停在块上浮现 ⠿ 手柄，拖动排序（HTML5 drag & drop 语义）
 */
import type { Editor } from '@tiptap/core'

/** 查找选区位置对应的顶层块 DOM */
function findTopLevelBlockDom(editor: Editor, pos: number): HTMLElement | null {
  const domAtPos = editor.view.domAtPos(pos)
  let node: Node = domAtPos.node
  if (node.nodeType === Node.TEXT_NODE && node.parentElement !== null) {
    node = node.parentElement
  }
  if (!(node instanceof HTMLElement)) {
    return null
  }
  return node.closest('[data-pm-descendant]') ?? node
}

/** 装配拖拽手柄（返回清理函数） */
export function setupDragHandle(editor: Editor, container: HTMLElement): () => void {
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'kala-drag-handle'
  handle.title = '拖拽移动'
  handle.textContent = '⋮⋮'
  handle.style.display = 'none'
  handle.draggable = true
  container.appendChild(handle)

  let dragFromPos: number | null = null

  const onMouseMove = (event: MouseEvent): void => {
    const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (coords === null) {
      handle.style.display = 'none'
      return
    }
    const $pos = editor.state.doc.resolve(coords.pos)
    // 取顶层块位置
    const depth = 1
    if ($pos.depth < depth) {
      handle.style.display = 'none'
      return
    }
    const topPos = $pos.before(depth)
    const dom = findTopLevelBlockDom(editor, topPos + 1)
    if (dom === null) {
      handle.style.display = 'none'
      return
    }
    dragFromPos = topPos
    const rect = dom.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    handle.style.display = 'flex'
    handle.style.top = `${rect.top - containerRect.top + (rect.height - 28) / 2}px`
    handle.style.left = `${rect.left - containerRect.left - 30}px`
  }

  const onMouseLeave = (): void => {
    handle.style.display = 'none'
  }

  handle.addEventListener('dragstart', (event) => {
    if (dragFromPos === null) {
      event.preventDefault()
      return
    }
    event.dataTransfer?.setData('text/plain', String(dragFromPos))
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = 'move'
    }
  })

  container.addEventListener('dragover', (event) => {
    event.preventDefault()
  })

  container.addEventListener('drop', (event) => {
    const raw = event.dataTransfer?.getData('text/plain')
    if (raw === undefined || raw.length === 0) {
      return
    }
    const from = Number.parseInt(raw, 10)
    if (Number.isNaN(from)) {
      return
    }
    const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (coords === null) {
      return
    }
    const $to = editor.state.doc.resolve(coords.pos)
    if ($to.depth < 1) {
      return
    }
    const draggedNode = editor.state.doc.nodeAt(from)
    if (draggedNode === null) {
      return
    }
    const nodeSize = draggedNode.nodeSize
    const rawTo = $to.after(1)
    // 先删后插：落点在源块之后时需要减去节点长度修正位置
    const to = rawTo > from ? rawTo - nodeSize : rawTo
    if (to === from) {
      return
    }
    const tr = editor.state.tr
    tr.delete(from, from + nodeSize)
    tr.insert(Math.max(0, to), draggedNode)
    editor.view.dispatch(tr)
    event.preventDefault()
  })

  container.addEventListener('mousemove', onMouseMove)
  container.addEventListener('mouseleave', onMouseLeave)

  return () => {
    handle.remove()
    container.removeEventListener('mousemove', onMouseMove)
    container.removeEventListener('mouseleave', onMouseLeave)
  }
}
