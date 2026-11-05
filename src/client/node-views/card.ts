/**
 * 业务卡片 NodeView（编辑态）
 *
 * DOM 与 SSR 完全一致：直接采用 Core 的 buildCardHTML 输出。
 * 状态机：loading（快照为空时拉取）→ loaded（模板渲染）
 *                              ↘ error（拉取失败，重新加载）
 * 拉取成功仅回写快照属性（meta 更新），不改变文档结构。
 * 悬停操作条由共享悬浮菜单（client/ui/hover-menu.ts）负责，本视图通过注册表暴露节点信息。
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, NodeView } from '@tiptap/pm/view'
import {
  buildCardHTML,
  buildCardBody,
  cardInputFromAttrs,
  toCardType,
} from '../../core/cards'
import type { EditorApi } from '../../core/types'

/** 卡片 NodeView 注册表：悬浮菜单经 DOM 反查节点上下文 */
export const cardViewRegistry = new WeakMap<HTMLElement, CardView>()

/** 属性读取 */
function attrString(node: PMNode, key: string): string {
  const value = node.attrs[key]
  return typeof value === 'string' ? value : ''
}

export class CardView implements NodeView {
  readonly dom: HTMLElement

  private readonly view: EditorView
  private readonly getPos: (() => number | undefined) | undefined
  private readonly api: EditorApi
  private currentNode: PMNode

  /** 拉取请求令牌（编辑 refId 后防止旧响应竞态覆盖） */
  private fetchToken = 0

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: (() => number | undefined) | undefined,
    api: EditorApi,
  ) {
    this.view = view
    this.getPos = getPos
    this.api = api
    this.currentNode = node

    const root = document.createElement('div')
    root.className = 'kala-card-node-view'
    this.dom = root
    cardViewRegistry.set(root, this)
    this.render()

    if (attrString(node, 'status') === 'loading') {
      this.fetch()
    }
  }

  /** 当前节点（悬浮菜单读取 attrs / nodeSize） */
  getNode(): PMNode {
    return this.currentNode
  }

  /** 当前文档位置（悬浮菜单执行事务用） */
  getPosition(): number | undefined {
    return this.getPos?.()
  }

  /** 渲染卡片主体（悬停操作条由共享悬浮菜单负责） */
  private render(): void {
    const input = cardInputFromAttrs(this.currentNode.attrs, true)
    this.dom.innerHTML = buildCardHTML(input)
    this.bindEvents()
  }

  /** 仅在内容变化时局部刷新卡片主体 */
  private refreshBody(): void {
    const input = cardInputFromAttrs(this.currentNode.attrs, true)
    const body = buildCardBody(input)
    const wrapper = this.dom.querySelector<HTMLElement>('.kala-card-wrapper')
    if (wrapper === null) {
      this.render()
      return
    }
    wrapper.className = `kala-card-wrapper ${body.className}`
    wrapper.setAttribute('data-in-editor', 'true')
    const content = wrapper.querySelector<HTMLElement>('.kala-card-content')
    const loading = wrapper.querySelector<HTMLElement>('.kala-card-loading')
    const error = wrapper.querySelector<HTMLElement>('.kala-card-error')
    if (content === null || loading === null || error === null) {
      this.render()
      return
    }
    content.innerHTML = body.content
    loading.innerHTML = body.skeleton
    const status = input.status
    content.style.display = status === 'loaded' ? 'block' : 'none'
    loading.style.display = status === 'loading' ? 'flex' : 'none'
    error.style.display = status === 'error' ? 'flex' : 'none'
    this.bindEvents()
  }

  /** 绑定模板内交互（重试） */
  private bindEvents(): void {
    const retry = this.dom.querySelector<HTMLElement>('.retry-link')
    retry?.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.fetch()
    })
  }

  /** 拉取卡片信息并回写快照 */
  private fetch(): void {
    const token = ++this.fetchToken
    const cardType = toCardType(attrString(this.currentNode, 'cardType'))
    const refId = attrString(this.currentNode, 'refId')
    this.setStatus('loading', false)
    this.api
      .fetchCardInfo(cardType, refId)
      .then((info) => {
        if (token !== this.fetchToken) {
          return
        }
        const pos = this.getPos?.()
        if (pos === undefined) {
          return
        }
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.currentNode.attrs,
            cardType: info.cardType,
            variant: info.variant,
            title: info.title,
            desc: info.desc,
            cover: info.cover,
            sourceName: info.sourceName,
            badge: info.badge,
            data: info.data.length > 0 ? info.data : info.extra,
            status: 'loaded',
            cardStyle: info.cardStyle,
          }),
        )
      })
      .catch(() => {
        if (token !== this.fetchToken) {
          return
        }
        this.setStatus('error', true)
      })
  }

  /** 写入状态属性（可选强制刷新，避免重复 dispatch） */
  private setStatus(status: 'loading' | 'error', dispatch: boolean): void {
    const pos = this.getPos?.()
    if (pos === undefined || !dispatch) {
      this.currentNode = this.currentNode.type.create({
        ...this.currentNode.attrs,
        status,
      })
      this.refreshBody()
      return
    }
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.currentNode.attrs,
        status,
      }),
    )
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'card') {
      return false
    }
    const prevRefId = attrString(this.currentNode, 'refId')
    const prevType = attrString(this.currentNode, 'cardType')
    this.currentNode = node

    // 类型或 refId 变更：整卡重渲染，必要时重新拉取
    if (attrString(node, 'refId') !== prevRefId || attrString(node, 'cardType') !== prevType) {
      this.render()
      if (attrString(node, 'status') === 'loading') {
        this.fetch()
      }
      return true
    }

    this.refreshBody()
    return true
  }

  ignoreMutation(): boolean {
    return true
  }

  stopEvent(event: Event): boolean {
    const target = event.target
    return target instanceof Element && target.closest('.retry-link') !== null
  }

  destroy(): void {
    cardViewRegistry.delete(this.dom)
  }
}
