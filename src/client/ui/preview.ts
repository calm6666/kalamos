/**
 * 1:1 手机预览（lit 自定义元素，kala-* 前缀）
 *
 * 结构对齐原版 eva3-preview：右侧 214px sticky 栏，内部 iPhone 375x812 以 0.5 缩放，
 * 包含状态栏、顶栏、正文滚动区、评论胶囊与三连操作栏、夜间模式开关。
 * 正文经 Core 静态渲染（renderToHTML），与发布页同源。
 */
import type { Editor } from '@tiptap/core'
import { LitElement, css, html } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { renderToHTML } from '../../core/render/html'
import { renderLatexInto } from '../node-views/latex'
import { previewIconSvgs } from './preview-icons'
import { t } from '../i18n'

/** 自定义元素只注册一次 */
function defineOnce(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) {
    customElements.define(name, ctor)
  }
}

/** 取图标字符串（组类型按顺序拼接） */
function svgOf(name: string): string {
  const value = previewIconSvgs[name]
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.join('')
  }
  return ''
}

/** 去掉抓取时残留的 lit 注释标记 */
function cleanMarkup(markup: string): string {
  return markup.replace(/<!--\?lit\$[^>]*-->/g, '')
}

/* ============================ 基础组件 ============================ */

export class KalaToggle extends LitElement {
  static properties = {
    checked: { type: Boolean, reflect: true },
  }

  declare checked: boolean

  constructor() {
    super()
    this.checked = false
  }

  static styles = css`
    :host {
      --toggle-width: 26px;
      --toggle-height: 16px;
      --toggle-padding: 2px;
      --toggle-handle-size: calc(var(--toggle-height) - var(--toggle-padding) * 2);
      display: inline-block;
    }
    :host([checked]) .toggle {
      background: var(--brand_blue, #00aeec);
    }
    :host([checked]) .handle {
      transform: translateX(
        calc(var(--toggle-width) - var(--toggle-handle-size) - var(--toggle-padding) * 2)
      );
    }
    .toggle {
      padding: var(--toggle-padding);
      width: var(--toggle-width);
      height: var(--toggle-height);
      box-sizing: border-box;
      border-radius: var(--toggle-height);
      background: var(--Ga2, #e3e5e7);
      transition: background-color 150ms;
      cursor: pointer;
    }
    .handle {
      height: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      background: var(--Wh0_u, #ffffff);
      transition: transform 150ms;
      transform: translateX(0);
    }
  `

  private onClick = (): void => {
    this.checked = !this.checked
    this.dispatchEvent(
      new CustomEvent<boolean>('checked-change', {
        detail: this.checked,
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    return html`<div class="toggle" @click=${this.onClick}><div class="handle"></div></div>`
  }
}
defineOnce('kala-toggle', KalaToggle)

export class KalaAvatar extends LitElement {
  static properties = {
    src: { type: String },
    name: { type: String },
  }

  declare src: string
  declare name: string

  constructor() {
    super()
    this.src = ''
    this.name = ''
  }

  static styles = css`
    :host {
      display: inline-block;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(135deg, #00aeec, #fb7299);
      color: #fff;
      font-size: 16px;
      line-height: 36px;
      text-align: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `

  render() {
    if (this.src.length > 0) {
      return html`<img src=${this.src} referrerpolicy="no-referrer" alt=${this.name} />`
    }
    return html`${this.name.slice(0, 1) || 'B'}`
  }
}
defineOnce('kala-avatar', KalaAvatar)

/* ============================ 预览部件 ============================ */

export class KalaPreviewContent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `

  render() {
    return html`<slot></slot>`
  }
}
defineOnce('kala-preview-content', KalaPreviewContent)

export class KalaPreviewUser extends LitElement {
  static properties = {
    name: { type: String },
    date: { type: String },
    avatar: { type: String },
  }

  declare name: string
  declare date: string
  declare avatar: string

  constructor() {
    super()
    this.name = ''
    this.date = ''
    this.avatar = ''
  }

  static styles = css`
    :host {
      display: block;
      margin-top: 10px;
    }
    .user {
      display: flex;
      align-items: center;
      height: 48px;
    }
    .avatar {
      margin-right: 14px;
      width: 36px;
      height: 36px;
    }
    .nickname {
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text1, #18191c);
    }
    .date {
      font-size: 12px;
      line-height: 17px;
      color: var(--text3, #9499a0);
    }
  `

  render() {
    return html`
      <div class="user">
        <kala-avatar class="avatar" .src=${this.avatar} .name=${this.name}></kala-avatar>
        <div>
          <div class="nickname">${this.name}</div>
          <div class="date">${this.date}</div>
        </div>
      </div>
    `
  }
}
defineOnce('kala-preview-user', KalaPreviewUser)

export class KalaPreviewInteract extends LitElement {
  static properties = {
    comment: { type: String },
  }

  declare comment: string

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    .interact {
      display: flex;
      flex-direction: column;
      height: 100%;
      color: var(--text2, #61666d);
    }
    .content {
      flex-grow: 1;
      overflow: auto;
      scroll-behavior: smooth;
    }
    .content::-webkit-scrollbar {
      display: none;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      height: 44px;
      flex-shrink: 0;
      color: var(--text1, #18191c);
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 40px;
      flex-shrink: 0;
    }
    .comment {
      padding: 7px 12px;
      width: 110px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 13px;
      line-height: 18px;
      box-sizing: border-box;
      border: 1px solid var(--line_regular, #e3e5e7);
      border-radius: 20px;
      background-color: var(--bg2, #f6f7f8);
      color: var(--text3, #9499a0);
    }
    .action {
      display: flex;
      gap: 4px;
    }
    .action_item {
      width: 50px;
      text-align: center;
    }
    .action_icon {
      display: block;
      margin: 0 auto;
      width: 22px;
      height: 22px;
      color: var(--text2, #61666d);
    }
    .action_count {
      font-size: 11px;
      line-height: 15px;
      color: var(--text3, #9499a0);
    }
  `

  constructor() {
    super()
    this.comment = t('preview.comment')
  }

  render() {
    return html`
      <div class="interact">
        <div class="topbar">${unsafeHTML(cleanMarkup(svgOf('topbar')))}</div>
        <div class="content"><slot></slot></div>
        <div class="toolbar">
          <div class="comment">${this.comment}</div>
          <div class="action">${unsafeHTML(cleanMarkup(svgOf('action')))}</div>
        </div>
      </div>
    `
  }
}
defineOnce('kala-preview-interact', KalaPreviewInteract)

export class KalaPreviewIphone extends LitElement {
  static styles = css`
    :host {
      --iphone-border: 8px;
      --iphone-scale: 0.5;
      --iphone-content-width: 375px;
      --iphone-content-height: 812px;
      --iphone-border-radius: 48px;
      --iphone-width: calc(var(--iphone-content-width) + var(--iphone-border) * 2);
      --iphone-height: calc(var(--iphone-content-height) + var(--iphone-border) * 2);
      display: block;
      width: calc(var(--iphone-width) * var(--iphone-scale));
      height: calc(var(--iphone-height) * var(--iphone-scale));
    }
    .iphone {
      position: relative;
      width: var(--iphone-content-width);
      height: var(--iphone-content-height);
      box-sizing: content-box;
      border: var(--iphone-border) solid #e1e1e1;
      border-radius: var(--iphone-border-radius);
      background: var(--bg1, #ffffff);
      transform-origin: left top;
      transform: scale(var(--iphone-scale));
    }
    .content {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: var(--iphone-border-radius);
    }
    .button-1,
    .button-2,
    .button-3,
    .button-4 {
      position: absolute;
    }
    .button-1,
    .button-2,
    .button-3 {
      left: -12px;
    }
    .button-1 { top: 90px; }
    .button-2 { top: 170px; }
    .button-3 { top: 264px; }
    .button-4 { right: -12px; top: 136px; }
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 44px;
      flex-shrink: 0;
    }
    .time {
      width: 96px;
      text-align: center;
      font-size: 15px;
      font-weight: 600;
      color: var(--Ba0_s, #000);
    }
    .info { margin-right: 15px; }
    .footer {
      height: 40px;
      flex-shrink: 0;
    }
    .indicator {
      margin: 27px auto 0;
      width: 134px;
      height: 5px;
      border-radius: 3px;
      background: var(--indicator, #18191c);
    }
    .viewport {
      flex-grow: 1;
      overflow: hidden;
    }
  `

  render() {
    return html`
      <div class="iphone">
        <svg class="button-1" width="6" height="44" viewBox="0 0 3 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.25 3L2.25 0V22L0.25 19V3Z" fill="#E0E0E0"></path>
        </svg>
        <svg class="button-2" width="6" height="84" viewBox="0 0 3 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.25 3L2.25 0V42L0.25 39V3Z" fill="#E0E0E0"></path>
        </svg>
        <svg class="button-3" width="6" height="84" viewBox="0 0 3 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.25 3L2.25 0V42L0.25 39V3Z" fill="#E0E0E0"></path>
        </svg>
        <svg class="button-4" width="6" height="144" viewBox="0 0 3 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.25 69L0.25 72L0.250003 -1.74846e-07L2.25 3L2.25 69Z" fill="#E0E0E0"></path>
        </svg>
        <div class="content">
          <div class="status-bar">${unsafeHTML(cleanMarkup(svgOf('statusBar')))}</div>
          <div class="viewport"><slot></slot></div>
          <div class="footer"><div class="indicator"></div></div>
        </div>
      </div>
    `
  }
}
defineOnce('kala-preview-iphone', KalaPreviewIphone)

export class KalaPreviewTheme extends LitElement {
  static properties = {
    theme: { type: String, reflect: true },
  }

  declare theme: string

  constructor() {
    super()
    this.theme = 'light'
  }

  static styles = css`
    :host {
      display: block;
      /* 预览内卡片族依赖的 B 站全局变量补齐（浅色取值，随 slot 内容继承） */
      --bg1_float: #ffffff;
      --bg3: #f1f2f3;
      --graph_bg_thin: #f6f7f8;
      --graph_bg_regular: #f1f2f3;
      --graph_bg_regular_float: #ffffff;
      --graph_bg_thick: #e3e5e7;
      --brand_blue: #00aeec;
      --brand_blue_hover: #00a7e8;
      --brand_blue_thin: #dff6fd;
      --line_light: #f1f2f3;
      --norm-brand-pink: #fb7299;
      --Lb4: #40c5f1;
      --b_radius_md: 8px;
    }
    :host([theme='dark']) {
      --bg1: #18191c;
      --bg2: #2f3238;
      --text1: #f1f2f3;
      --text2: #c9ccd0;
      --text3: #9499a0;
      --text4: #61666d;
      --line_regular: #2f3238;
      --Ba0_s: #ffffff;
      --indicator: #ffffff;
      --Ga2: #61666d;
      --Ga9: #f1f2f3;
      --bg1_float: #18191c;
      --bg3: #2f3238;
      --graph_bg_thin: #2f3238;
      --graph_bg_regular: #32373d;
      --graph_bg_regular_float: #2f3238;
      --graph_bg_thick: #4e5666;
      --line_light: #2f3238;
      --brand_blue_thin: #24303c;
    }
  `

  render() {
    return html`<slot></slot>`
  }
}
defineOnce('kala-preview-theme', KalaPreviewTheme)

export class KalaPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 196px;
    }
    .top {
      text-align: right;
    }
    .close {
      display: inline-block;
      margin-bottom: 4px;
      margin-right: 8px;
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .close svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    .bottom-settings {
      margin-top: 12px;
      padding-bottom: 40px;
      text-align: center;
    }
    .setting-item {
      color: var(--text3, #9499a0);
      font-size: 12px;
      line-height: 17px;
      margin-bottom: 8px;
    }
    .setting-item:last-child {
      margin-bottom: 0;
    }
    .toggle {
      margin-left: 6px;
      vertical-align: sub;
    }
  `

  private onClose = (): void => {
    this.dispatchEvent(new CustomEvent('kala-preview-close', { bubbles: true, composed: true }))
  }

  private onToggle = (event: Event): void => {
    const target = event.target
    if (!(target instanceof KalaToggle)) {
      return
    }
    const themeEl = this.querySelector('kala-preview-theme')
    themeEl?.setAttribute('theme', target.checked ? 'dark' : 'light')
  }

  render() {
    return html`
      <div class="top">
        <span
          class="close"
          role="button"
          aria-label=${t('preview.close')}
          title=${t('preview.close')}
          @click=${this.onClose}
        >
          ${unsafeHTML(cleanMarkup(svgOf('close')))}
        </span>
      </div>
      <slot></slot>
      <div class="bottom-settings">
        <div class="setting-item">
          ${t('preview.nightMode')}<kala-toggle class="toggle" @checked-change=${this.onToggle}></kala-toggle>
        </div>
      </div>
    `
  }
}
defineOnce('kala-preview', KalaPreview)

/* ============================ 装配 ============================ */

/** 取文档首个标题文本（无标题时返回空串） */
function firstHeadingText(editor: Editor): string {
  let found = ''
  editor.state.doc.descendants((node) => {
    if (found.length > 0) {
      return false
    }
    if (node.type.name === 'heading') {
      found = node.textContent.trim()
      return false
    }
    return true
  })
  return found
}

export interface PreviewController {
  /** 预览列容器 */
  splitEl: HTMLDivElement
  /** 正文渲染容器 */
  previewBody: HTMLDivElement
  /** 开关预览 */
  setEnabled: (on: boolean) => void
  /** 销毁监听与 DOM */
  destroy: () => void
}

/** 创建右侧手机预览列（默认隐藏） */
export function createPreviewSplit(
  editor: Editor,
  editorEl: HTMLElement,
  onClose?: () => void,
): PreviewController {
  const parent = editorEl.parentElement
  if (parent === null) {
    throw new Error('createPreviewSplit: editor element has no parent')
  }

  const panel = document.createElement('div')
  panel.className = 'kala-preview-panel'
  panel.hidden = true

  const preview = document.createElement('kala-preview') as KalaPreview
  const theme = document.createElement('kala-preview-theme') as KalaPreviewTheme
  theme.setAttribute('theme', 'light')
  const iphone = document.createElement('kala-preview-iphone')
  const interact = document.createElement('kala-preview-interact') as KalaPreviewInteract

  const container = document.createElement('div')
  container.className = 'kala-preview-container'
  const title = document.createElement('div')
  title.className = 'kala-preview-title'
  const user = document.createElement('kala-preview-user') as KalaPreviewUser
  user.name = t('preview.defaultUser')
  user.date = t('preview.defaultDate')
  const content = document.createElement('kala-preview-content')
  content.className = 'kala-preview-content'
  const previewBody = document.createElement('div')
  previewBody.className = 'kala-content'
  content.appendChild(previewBody)
  container.append(title, user, content)

  interact.appendChild(container)
  iphone.appendChild(interact)
  theme.appendChild(iphone)
  preview.appendChild(theme)
  panel.appendChild(preview)
  parent.appendChild(panel)

  const sync = (): void => {
    if (panel.hidden) {
      return
    }
    previewBody.innerHTML = renderToHTML(editor.state.doc.toJSON())
    renderPreviewLatex(previewBody)
    if (editor.isEmpty) {
      const placeholder = document.createElement('div')
      placeholder.className = 'kala-preview-placeholder'
      placeholder.textContent = t('preview.bodyPlaceholder')
      previewBody.replaceChildren(placeholder)
    }
    const heading = firstHeadingText(editor)
    const hasHeading = heading.length > 0
    title.textContent = hasHeading ? heading : t('preview.titlePlaceholder')
    title.classList.toggle('kala-preview-title--placeholder', !hasHeading)
  }

  const setEnabled = (on: boolean): void => {
    panel.hidden = !on
    parent.classList.toggle('kala-editor-body--preview', on)
    if (on) {
      sync()
    }
  }

  const closeHandler = (): void => {
    setEnabled(false)
    onClose?.()
  }
  preview.addEventListener('kala-preview-close', closeHandler)

  editor.on('update', sync)

  return {
    splitEl: panel,
    previewBody,
    setEnabled,
    destroy: () => {
      editor.off('update', sync)
      preview.removeEventListener('kala-preview-close', closeHandler)
      parent.classList.remove('kala-editor-body--preview')
      panel.remove()
    },
  }
}

/** 静态渲染只输出 kala-latex 骨架（data-latex 存公式原文），预览侧用 katex 就地渲染 */
function renderPreviewLatex(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.kala-latex[data-latex]').forEach((el) => {
    renderLatexInto(el, el.getAttribute('data-latex') ?? '')
  })
}
