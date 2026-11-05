/**
 * 代码块 NodeView：语言选择 / 行号 / 复制 / 自动换行切换
 * 渲染结构：div.kala-code-block > (bar + gutter + pre > code[contentDOM])
 * 高亮由 @tiptap/extension-code-block-lowlight 的默认行为处理 contentDOM 内容，
 * 本 NodeView 只负责增强部件
 */
import { createLowlight, common } from 'lowlight'
import { toHtml } from 'hast-util-to-html'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { t } from '../i18n'

/** lowlight 实例（与 configure-kit 一致使用 common 语法集） */
const lowlightInstance = createLowlight(common)

/** 语言清单（常用子集，与 lowlight common 注册表一致） */
const languages: string[] = [
  'plaintext',
  'javascript',
  'typescript',
  'html',
  'css',
  'json',
  'bash',
  'python',
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'sql',
]

/** 语言显示名 */
function languageLabel(lang: string): string {
  if (lang === 'plaintext' || lang.length === 0) {
    return t('codeBlock.language.auto')
  }
  return lang
}

/** 代码块增强视图 */
export class CodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private readonly gutter: HTMLDivElement
  private readonly langBtn: HTMLButtonElement
  private readonly wrapBtn: HTMLButtonElement
  private readonly copyBtn: HTMLButtonElement
  private currentNode: PMNode
  private readonly view: EditorView
  private readonly getPos: (() => number | undefined) | undefined

  constructor(node: PMNode, view: EditorView, getPos: (() => number | undefined) | undefined) {
    this.currentNode = node
    this.view = view
    this.getPos = getPos

    const wrapper = document.createElement('div')
    wrapper.className = 'kala-code-block kala-code-block--gutter'
    if (node.attrs['wrap'] === true) {
      wrapper.classList.add('kala-code-block--wrap')
    }

    // 工具条
    const bar = document.createElement('div')
    bar.className = 'kala-code-block__bar'
    this.langBtn = document.createElement('button')
    this.langBtn.type = 'button'
    this.langBtn.className = 'kala-code-block__lang-btn'
    this.langBtn.textContent = languageLabel(String(node.attrs['language'] ?? ''))
    this.langBtn.addEventListener('click', (event) => {
      event.preventDefault()
      this.openLanguageMenu()
    })
    const actions = document.createElement('div')
    actions.className = 'kala-code-block__actions'
    this.wrapBtn = document.createElement('button')
    this.wrapBtn.type = 'button'
    this.wrapBtn.textContent = t('codeBlock.wrap')
    this.wrapBtn.addEventListener('click', (event) => {
      event.preventDefault()
      const pos = this.getPos?.()
      if (pos !== undefined) {
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            wrap: node.attrs['wrap'] !== true,
          }),
        )
      }
    })
    this.copyBtn = document.createElement('button')
    this.copyBtn.type = 'button'
    this.copyBtn.textContent = t('codeBlock.copy')
    this.copyBtn.addEventListener('click', (event) => {
      event.preventDefault()
      void navigator.clipboard
        ?.writeText(this.contentDOM.textContent ?? '')
        .then(() => {
          this.copyBtn.textContent = t('codeBlock.copied')
          window.setTimeout(() => {
            this.copyBtn.textContent = t('codeBlock.copy')
          }, 1500)
        })
    })
    actions.append(this.wrapBtn, this.copyBtn)
    bar.append(this.langBtn, actions)

    // 行号列
    this.gutter = document.createElement('div')
    this.gutter.className = 'kala-code-block__line-numbers'

    // 代码区（contentDOM 为 code 元素）
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    pre.appendChild(code)
    wrapper.append(bar, this.gutter, pre)
    this.dom = wrapper
    this.contentDOM = code

    this.renderGutter(node)
  }

  /** 打开语言下拉 */
  private openLanguageMenu(): void {
    const menu = document.createElement('div')
    menu.className = 'kala-dropdown'
    for (const lang of languages) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className =
        lang === String(this.currentNode.attrs['language'] ?? '')
          ? 'kala-dropdown__item is-active'
          : 'kala-dropdown__item'
      item.textContent = languageLabel(lang)
      item.addEventListener('click', () => {
        const pos = this.getPos?.()
        if (pos !== undefined) {
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(pos, undefined, {
              ...this.currentNode.attrs,
              language: lang,
            }),
          )
        }
        menu.remove()
      })
      menu.appendChild(item)
    }
    const rect = this.langBtn.getBoundingClientRect()
    menu.style.position = 'fixed'
    menu.style.left = `${rect.left}px`
    menu.style.top = `${rect.bottom + 4}px`
    document.body.appendChild(menu)
    const onDocMouseDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && !menu.contains(event.target)) {
        menu.remove()
        document.removeEventListener('mousedown', onDocMouseDown)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
  }

  /** 渲染行号 */
  private renderGutter(node: PMNode): void {
    const lineCount = node.textContent.split('\n').length
    this.gutter.innerHTML = ''
    for (let i = 1; i <= lineCount; i += 1) {
      const line = document.createElement('div')
      line.textContent = String(i)
      this.gutter.appendChild(line)
    }
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'codeBlock') {
      return false
    }
    const langChanged = node.attrs['language'] !== this.currentNode.attrs['language']
    this.currentNode = node
    this.langBtn.textContent = languageLabel(String(node.attrs['language'] ?? ''))
    this.dom.classList.toggle('kala-code-block--wrap', node.attrs['wrap'] === true)
    this.renderGutter(node)
    if (langChanged) {
      this.contentDOM.className = `language-${String(node.attrs['language'] ?? '')}`
      // 语言变化时重放 lowlight 高亮（对齐 CodeBlockLowlight 行为）
      this.highlight()
    }
    return true
  }

  /** 使用 lowlight 重放高亮（contentDOM 文本 → hast → HTML） */
  private highlight(): void {
    const lang = String(this.currentNode.attrs['language'] ?? '')
    const code = this.contentDOM.textContent ?? ''
    try {
      if (lang.length > 0 && lang !== 'plaintext') {
        // lowlight v3 返回 hast Root，经 hast-util-to-html 序列化为 HTML
        this.contentDOM.innerHTML = toHtml(lowlightInstance.highlight(lang, code))
      }
    } catch {
      // 未注册语言：保持纯文本
    }
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // 行号 gutter 的变化不属于内容变更
    if (this.gutter.contains(mutation.target)) {
      return true
    }
    // 高亮产生的 DOM 变化（对齐 CodeBlockLowlight：忽略 contentDOM 内部结构变化）
    if (mutation.type === 'selection') {
      return false
    }
    return mutation.target === this.contentDOM && mutation.type === 'childList'
  }

  stopEvent(): boolean {
    // 部件按钮事件自行处理，输入事件交给 PM
    return false
  }

  destroy(): void {
    // 无定时器与监听器需清理
  }
}
