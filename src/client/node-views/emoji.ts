/**
 * 表情 NodeView：图片表情 / Unicode 字符双形态渲染（span.kala-emoji 容器）
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

export class EmojiView implements NodeView {
  readonly dom: HTMLElement

  constructor(node: PMNode) {
    const span = document.createElement('span')
    span.className = 'kala-emoji'
    this.dom = span
    this.render(node)
  }

  private render(node: PMNode): void {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : ''
    const img = node.attrs['img']
    const char = node.attrs['char']
    const size = node.attrs['size']

    this.dom.setAttribute('data-emoji-name', name)
    this.dom.textContent = ''

    if (typeof img === 'string' && img.length > 0) {
      const imgEl = document.createElement('img')
      imgEl.className = 'kala-emoji-img'
      imgEl.referrerPolicy = 'no-referrer'
      imgEl.src = img
      imgEl.alt = name
      if (typeof size === 'number' && size > 0) {
        imgEl.width = size
        imgEl.height = size
      }
      this.dom.appendChild(imgEl)
      return
    }

    this.dom.setAttribute('data-emoji-char', typeof char === 'string' ? char : '')
    this.dom.textContent =
      typeof char === 'string' && char.length > 0 ? char : `:${name}:`
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'emoji') {
      return false
    }
    this.render(node)
    return true
  }

  ignoreMutation(): boolean {
    // 行内原子节点，无用户可编辑内容
    return true
  }
}
