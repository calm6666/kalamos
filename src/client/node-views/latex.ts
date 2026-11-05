/**
 * LaTeX 公式 NodeView：katex 本地渲染 + 悬停工具条（编辑 / 删除）
 * 结构对齐 ui.css：div.kala-latex-wrap > div.kala-latex + div.kala-latex-toolbar
 */
import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, NodeView } from '@tiptap/pm/view'
import { t } from '../i18n'

/** LatexView 宿主钩子（editor.ts 装配时注入弹窗实现） */
export interface LatexViewHooks {
  /** 请求编辑公式（打开弹窗，返回新公式文本；取消时返回 null） */
  onEdit: (currentFormula: string) => Promise<string | null>
}

/**
 * katex 渲染公式到目标元素（NodeView 编辑态与预览分栏共用）
 * 空公式显示错误文案；throwOnError:false 保证非法公式输出红色原文而非抛错
 */
export function renderLatexInto(target: HTMLElement, formula: string): void {
  if (formula.length === 0) {
    target.textContent = t('modal.error.emptyFormula')
    return
  }
  try {
    target.innerHTML = katex.renderToString(formula, { throwOnError: false, displayMode: true })
  } catch {
    // 兜底：渲染异常时显示公式原文
    target.textContent = formula
  }
}

export class LatexView implements NodeView {
  readonly dom: HTMLElement

  private readonly view: EditorView
  private readonly getPos: (() => number | undefined) | undefined
  private readonly hooks: LatexViewHooks
  private currentNode: PMNode
  private readonly body: HTMLElement
  private readonly toolbar: HTMLDivElement

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: (() => number | undefined) | undefined,
    hooks: LatexViewHooks,
  ) {
    this.view = view
    this.getPos = getPos
    this.hooks = hooks
    this.currentNode = node

    const wrap = document.createElement('div')
    wrap.className = 'kala-latex-wrap'

    this.body = document.createElement('div')
    this.body.className = 'kala-latex'

    this.toolbar = document.createElement('div')
    this.toolbar.className = 'kala-latex-toolbar'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.textContent = t('card.edit')
    editBtn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      void this.openEdit()
    })

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.textContent = t('card.delete')
    removeBtn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const pos = this.getPos?.()
      if (pos !== undefined) {
        this.view.dispatch(this.view.state.tr.delete(pos, pos + this.currentNode.nodeSize))
      }
    })

    this.toolbar.append(editBtn, removeBtn)
    wrap.append(this.body, this.toolbar)
    this.dom = wrap

    this.render(node)
  }

  /** 打开编辑弹窗并将结果写回节点属性 */
  private openEdit(): void {
    const formula = typeof this.currentNode.attrs['formula'] === 'string' ? this.currentNode.attrs['formula'] : ''
    void this.hooks.onEdit(formula).then((next) => {
      if (next === null) {
        return
      }
      const pos = this.getPos?.()
      if (pos !== undefined) {
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.currentNode.attrs,
            formula: next,
          }),
        )
      }
    })
  }

  /** katex 渲染公式（行为见 renderLatexInto） */
  private render(node: PMNode): void {
    this.currentNode = node
    const formula = typeof node.attrs['formula'] === 'string' ? node.attrs['formula'] : ''
    this.dom.setAttribute('data-latex', formula)
    renderLatexInto(this.body, formula)
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'latex') {
      return false
    }
    this.render(node)
    return true
  }

  ignoreMutation(): boolean {
    // 视图内无可编辑 contentDOM，忽略一切 mutation
    return true
  }

  stopEvent(event: Event): boolean {
    // 工具条事件自处理，不透传 PM
    return event.target instanceof Node && this.toolbar.contains(event.target)
  }
}
