/**
 * @提及 NodeView：chips 视图（span.kala-mention）
 * 结构与 core renderHTML 一致，仅承担编辑态的属性同步渲染
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

export class MentionView implements NodeView {
  readonly dom: HTMLElement

  constructor(node: PMNode) {
    const span = document.createElement('span')
    span.className = 'kala-mention'
    this.dom = span
    this.render(node)
  }

  private render(node: PMNode): void {
    const id = typeof node.attrs['id'] === 'string' ? node.attrs['id'] : ''
    const label = typeof node.attrs['label'] === 'string' && node.attrs['label'].length > 0
      ? node.attrs['label']
      : id
    this.dom.setAttribute('data-mention-id', id)
    this.dom.setAttribute('data-mention-label', label)
    this.dom.textContent = `@${label}`
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'mention') {
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
