/**
 * 用户行内 NodeView（编辑态）
 *
 * DOM 与 SSR 完全一致：直接采用 Core 的 buildUserInlineInnerHTML 输出。
 * 逆向自原站：NodeView 壳为 user-inline-wrapper（携带 data-card-type/data-card-id），
 * 所有事件在本视图内消费（stopEvent 全拦截），悬停菜单经注册表读取节点信息。
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'
import { buildUserInlineInnerHTML, readUserInlineFields, userInlineInfoFromAttrs } from '../../core/cards/user-inline'

/** 用户行内 NodeView 注册表：悬浮菜单经 DOM 反查节点上下文 */
export const userInlineViewRegistry = new WeakMap<HTMLElement, UserInlineView>()

export class UserInlineView implements NodeView {
  readonly dom: HTMLElement

  private currentNode: PMNode
  private readonly getPos: (() => number | undefined) | undefined

  constructor(
    node: PMNode,
    getPos: (() => number | undefined) | undefined,
  ) {
    this.currentNode = node
    this.getPos = getPos

    const wrapper = document.createElement('span')
    wrapper.className = 'user-inline-wrapper'
    this.dom = wrapper
    userInlineViewRegistry.set(wrapper, this)
    this.render()
  }

  /** 当前节点（悬浮菜单读取 attrs / nodeSize） */
  getNode(): PMNode {
    return this.currentNode
  }

  /** 当前文档位置（悬浮菜单执行事务用） */
  getPosition(): number | undefined {
    return this.getPos?.()
  }

  /** 按当前节点渲染主体（wrapper 属性与原版一致） */
  private render(): void {
    const status = typeof this.currentNode.attrs['status'] === 'string' ? this.currentNode.attrs['status'] : 'loaded'
    const info = userInlineInfoFromAttrs(this.currentNode.attrs['info'])
    const { mid } = readUserInlineFields(info)
    this.dom.dataset['cardType'] = 'user'
    this.dom.dataset['cardId'] = mid.length > 0 ? mid : 'unknown'
    this.dom.dataset['cardStyle'] = 'inline'
    this.dom.dataset['info'] = JSON.stringify(info)
    this.dom.dataset['status'] = status
    this.dom.innerHTML = buildUserInlineInnerHTML(info, status)
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'userInline') {
      return false
    }
    this.currentNode = node
    this.render()
    return true
  }

  ignoreMutation(): boolean {
    return true
  }

  /** 原站行为：视图内事件全部消费，不透传编辑器 */
  stopEvent(): boolean {
    return true
  }

  destroy(): void {
    userInlineViewRegistry.delete(this.dom)
  }
}
