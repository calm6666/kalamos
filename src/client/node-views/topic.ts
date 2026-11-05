/**
 * #话题# NodeView：chips 视图（span.kala-topic）
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

export class TopicView implements NodeView {
  readonly dom: HTMLElement

  constructor(node: PMNode) {
    const span = document.createElement('span')
    span.className = 'kala-topic'
    this.dom = span
    this.render(node)
  }

  private render(node: PMNode): void {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : ''
    this.dom.setAttribute('data-topic-name', name)
    this.dom.textContent = `#${name}#`
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'topic') {
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
