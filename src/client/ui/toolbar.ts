/**
 * 1:1 工具栏（lit / lit-element 自定义元素）
 *
 * 结构对齐原版 eva3 工具栏：28 个 item（含 splitter），组件名统一 kala-* 前缀。
 * 每个 item 自主订阅 editor 事务刷新激活态；下拉浮层经 floating-ui fixed 定位。
 */
import type { Editor } from '@tiptap/core'
import type { Placement } from '@floating-ui/dom'
import { LitElement, css, html, nothing } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import type { EmojiItem } from './emoji-picker'
import { openLinkModal, openImageModal, openLatexModal } from './modals'
import { positionFloating } from './floating'
import { toolbarIconSvgs } from './toolbar-icons'
import { t } from '../i18n'

/** 工具栏回调集合 */
export interface ToolbarCallbacks {
  onPreview: () => void
  onToggleToc: () => void
  onToggleFullscreen: () => void
  onImportWord: (file: File) => void
  onOpenCardMenu: (anchor: HTMLElement) => void
  emojiList: EmojiItem[]
  uploadImage: (file: File) => Promise<{ src: string }>
}

/** 自定义元素只注册一次（HMR / 多次 createEditor 安全） */
function defineOnce(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) {
    customElements.define(name, ctor)
  }
}

/** 读取图标 SVG（原版 fwb / BDC 图标原样导出） */
function iconSvg(name: string, subcolor?: string): string {
  const svg = toolbarIconSvgs[name]
  if (svg === undefined) {
    return ''
  }
  if (subcolor === undefined || subcolor.length === 0) {
    return svg
  }
  return svg.replace('fill="currentColor"', `fill="${subcolor}"`)
}

/* ============================ 基础组件 ============================ */

export class KalaIcon extends LitElement {
  static properties = {
    name: { type: String },
    subcolor: { type: String },
  }

  declare name: string
  declare subcolor: string

  constructor() {
    super()
    this.name = ''
    this.subcolor = ''
  }

  static styles = css`
    :host {
      display: inline-block;
      width: 20px;
      height: 20px;
      font-size: 0;
      line-height: 0;
      color: inherit;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `

  render() {
    const svg = iconSvg(this.name, this.subcolor)
    return html`${svg.length > 0 ? unsafeHTML(svg) : nothing}`
  }
}
defineOnce('kala-icon', KalaIcon)

export class KalaTooltip extends LitElement {
  static properties = {
    content: { type: String },
    beta: { type: Boolean },
  }

  declare content: string
  declare beta: boolean

  constructor() {
    super()
    this.content = ''
    this.beta = false
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      width: 24px;
      height: 24px;
    }
    .tooltip {
      position: absolute;
      top: calc(100% + 9px);
      left: 50%;
      transform: translateX(-50%) translateY(-2px);
      z-index: 1200;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: 6px;
      background: rgba(47, 50, 56, 0.9);
      color: #fff;
      font-size: 13px;
      line-height: 18px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
    }
    .tooltip::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-bottom: 6px solid rgba(47, 50, 56, 0.9);
    }
    :host(:hover) .tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
    .beta {
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.16);
      font-size: 11px;
      line-height: 16px;
    }
  `

  render() {
    return html`
      <slot></slot>
      ${this.content.length > 0
        ? html`<span class="tooltip">${this.content}${this.beta ? html`<span class="beta">beta</span>` : nothing}</span>`
        : nothing}
    `
  }
}
defineOnce('kala-tooltip', KalaTooltip)

export class KalaButton extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    active: { type: Boolean },
  }

  declare disabled: boolean
  declare active: boolean

  constructor() {
    super()
    this.disabled = false
    this.active = false
  }

  static styles = css`
    :host {
      display: block;
      width: 24px;
      height: 24px;
    }
    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 2px;
      box-sizing: border-box;
      border-radius: 4px;
      color: var(--text1, #18191c);
      transition: background-color 0.3s;
      cursor: pointer;
    }
    .button:hover {
      background: var(--bg3, #f1f2f3);
    }
    .button__active {
      background: var(--graph_bg_thick, #e3e5e7);
    }
    .button__disabled {
      color: var(--text4, #c9ccd0);
      cursor: not-allowed;
      background: transparent;
    }
  `

  render() {
    return html`
      <div
        class="button ${this.active ? 'button__active' : ''} ${this.disabled ? 'button__disabled' : ''}"
      >
        <slot></slot>
      </div>
    `
  }
}
defineOnce('kala-button', KalaButton)

export class KalaPopover extends LitElement {
  static properties = {
    placement: { type: String },
    open: { state: true },
  }

  declare placement: Placement
  declare open: boolean

  constructor() {
    super()
    this.placement = 'bottom-start'
    this.open = false
  }

  static styles = css`
    :host {
      display: block;
    }
    .popover-trigger {
      display: block;
    }
    .popover-content {
      display: none;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1000;
    }
    .popover-content.open {
      display: block;
    }
  `

  private readonly onDocMouseDown = (event: MouseEvent): void => {
    if (!this.open) {
      return
    }
    if (!event.composedPath().includes(this)) {
      this.hide()
    }
  }

  private readonly onDocKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide()
    }
  }

  private readonly onOtherOpen = (event: Event): void => {
    if ((event as CustomEvent<KalaPopover>).detail !== this) {
      this.hide()
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('mousedown', this.onDocMouseDown)
    document.addEventListener('keydown', this.onDocKeyDown)
    document.addEventListener('kala-popover-open', this.onOtherOpen)
  }

  disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown)
    document.removeEventListener('keydown', this.onDocKeyDown)
    document.removeEventListener('kala-popover-open', this.onOtherOpen)
    super.disconnectedCallback()
  }

  show(): void {
    if (this.open) {
      return
    }
    document.dispatchEvent(new CustomEvent('kala-popover-open', { detail: this }))
    this.open = true
    void this.updateComplete.then(() => {
      const content = this.renderRoot.querySelector<HTMLElement>('.popover-content')
      if (content !== null) {
        void positionFloating(this, content, this.placement)
      }
    })
  }

  hide(): void {
    this.open = false
  }

  private toggle = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    if (this.open) {
      this.hide()
      return
    }
    this.show()
  }

  render() {
    return html`
      <div class="popover-trigger" @click=${this.toggle}><slot></slot></div>
      <div class="popover-content ${this.open ? 'open' : ''}"><slot name="content"></slot></div>
    `
  }
}
defineOnce('kala-popover', KalaPopover)

export class KalaDropdown extends LitElement {
  static properties = {
    showIndicator: { type: Boolean, attribute: 'show-indicator' },
    contentStyles: { type: String, attribute: 'content-styles' },
    placement: { type: String },
  }

  declare showIndicator: boolean
  declare contentStyles: string
  declare placement: Placement

  constructor() {
    super()
    this.showIndicator = false
    this.contentStyles = ''
    this.placement = 'bottom-start'
  }

  static styles = css`
    :host {
      --kala-dropdown-selector-padding: 2px;
      display: block;
    }
    .dropdown__selector {
      padding: var(--kala-dropdown-selector-padding);
    }
    .dropdown__button {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-radius: 4px;
      transition: background-color 0.3s;
      color: var(--text1, #18191c);
      cursor: pointer;
    }
    .dropdown__button:hover {
      background: var(--bg3, #f1f2f3);
    }
    .dropdown__button_show-indicator::before {
      content: "";
      position: absolute;
      z-index: 10;
      bottom: 0;
      right: 0;
      width: 4px;
      height: 4px;
      background: linear-gradient(
        -45deg,
        var(--text1, #18191c),
        var(--text1, #18191c) 50%,
        transparent 50%,
        transparent 100%
      );
    }
    .dropdown__content {
      background: var(--bg1_float, #fff);
      border: 1px solid var(--line_regular, #e3e5e7);
      border-radius: var(--b_radius_md, 8px);
      box-sizing: border-box;
      padding: 8px;
      box-shadow: rgba(0, 0, 0, 0.1) 0 12px 20px 0, rgba(0, 0, 0, 0.06) 0 0 4px 0;
      max-height: calc(100vh - 80px);
      overflow-y: auto;
    }
  `

  close(): void {
    this.renderRoot.querySelector<KalaPopover>('kala-popover')?.hide()
  }

  render() {
    return html`
      <kala-popover .placement=${this.placement}>
        <div class="dropdown__selector">
          <div class="dropdown__button ${this.showIndicator ? 'dropdown__button_show-indicator' : ''}">
            <slot></slot>
          </div>
        </div>
        <div slot="content" class="dropdown__content" style=${this.contentStyles}>
          <slot name="content"></slot>
        </div>
      </kala-popover>
    `
  }
}
defineOnce('kala-dropdown', KalaDropdown)

export interface KalaSelectOption {
  value: string
  icon: string
  label: string
  bold?: boolean
}

export class KalaToolbarSelect extends LitElement {
  static properties = {
    value: { type: String },
    options: { attribute: false },
    contentWidth: { type: Number, attribute: 'content-width' },
  }

  declare value: string
  declare options: KalaSelectOption[]
  declare contentWidth: number

  constructor() {
    super()
    this.value = ''
    this.options = []
    this.contentWidth = 164
  }

  static styles = css`
    :host {
      display: block;
      width: 24px;
      height: 24px;
    }
    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      color: var(--text1, #18191c);
    }
    .button:hover {
      background: var(--bg3, #f1f2f3);
      border-radius: 4px;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: var(--kala-select-content-width, 164px);
    }
    .option {
      position: relative;
      display: flex;
      align-items: center;
      height: 42px;
      padding: 0 8px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 20px;
      color: var(--text1, #18191c);
      cursor: pointer;
    }
    .option:hover {
      background: var(--bg2, #f6f7f8);
    }
    .option-active {
      color: var(--brand_blue, #00aeec);
    }
    .option-label {
      flex: 1;
      margin-left: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .option-check {
      position: absolute;
      right: 8px;
      top: 11px;
      color: var(--brand_blue, #00aeec);
    }
    .option:not(.option-active) .option-check {
      display: none;
    }
  `

  private currentIcon(): string {
    const found = this.options.find((option) => option.value === this.value)
    return found?.icon ?? this.options[0]?.icon ?? ''
  }

  private choose(value: string): void {
    this.dispatchEvent(new CustomEvent('kala-select', { detail: value, bubbles: true, composed: true }))
    this.renderRoot.querySelector<KalaDropdown>('kala-dropdown')?.close()
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('contentWidth')) {
      this.style.setProperty('--kala-select-content-width', `${this.contentWidth}px`)
    }
  }

  render() {
    return html`
      <kala-dropdown>
        <div class="button"><kala-icon .name=${this.currentIcon()}></kala-icon></div>
        <div slot="content" class="content">
          ${this.options.map(
            (option) => html`
              <div
                class="option ${option.value === this.value ? 'option-active' : ''}"
                @click=${() => this.choose(option.value)}
              >
                <kala-icon .name=${option.icon}></kala-icon>
                <span class="option-label" style=${option.bold === true ? 'font-weight:500' : ''}
                  >${option.label}</span
                >
                <kala-icon class="option-check" name="BDC/checkmark_line/4"></kala-icon>
              </div>
            `,
          )}
        </div>
      </kala-dropdown>
    `
  }
}
defineOnce('kala-toolbar-select', KalaToolbarSelect)

export class KalaMenu extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-width: 160px;
      padding: 4px;
      border-radius: 8px;
      background: var(--bg1_float, #fff);
      border: 1px solid var(--line_regular, #e3e5e7);
      box-shadow: rgba(0, 0, 0, 0.1) 0 12px 20px 0, rgba(0, 0, 0, 0.06) 0 0 4px 0;
    }
  `

  render() {
    return html`<slot></slot>`
  }
}
defineOnce('kala-menu', KalaMenu)

export class KalaMenuItem extends LitElement {
  static properties = {
    glyph: { type: String },
    label: { type: String },
  }

  declare glyph: string
  declare label: string

  constructor() {
    super()
    this.glyph = ''
    this.label = ''
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 6px 8px;
      box-sizing: border-box;
      border-radius: 4px;
      font-size: 14px;
      line-height: 20px;
      color: var(--text1, #18191c);
      cursor: pointer;
    }
    :host(:hover) {
      background: var(--bg2, #f6f7f8);
    }
    .glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      font-size: 15px;
      line-height: 20px;
    }
    .label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `

  render() {
    return html`<span class="glyph">${this.glyph}</span><span class="label">${this.label}</span>`
  }
}
defineOnce('kala-menu-item', KalaMenuItem)

/* ============================ 编辑器上下文基类 ============================ */

export class KalaEditorElement extends LitElement {
  private _editor: Editor | null = null

  private readonly sync = (): void => {
    this.requestUpdate()
  }

  get editor(): Editor | null {
    return this._editor
  }

  set editor(value: Editor | null) {
    if (this._editor === value) {
      return
    }
    if (this._editor !== null && this.isConnected) {
      this._editor.off('transaction', this.sync)
      this._editor.off('selectionUpdate', this.sync)
    }
    this._editor = value
    if (this._editor !== null && this.isConnected) {
      this._editor.on('transaction', this.sync)
      this._editor.on('selectionUpdate', this.sync)
    }
    this.requestUpdate()
  }

  connectedCallback(): void {
    super.connectedCallback()
    if (this._editor !== null) {
      this._editor.on('transaction', this.sync)
      this._editor.on('selectionUpdate', this.sync)
    }
  }

  disconnectedCallback(): void {
    if (this._editor !== null) {
      this._editor.off('transaction', this.sync)
      this._editor.off('selectionUpdate', this.sync)
    }
    super.disconnectedCallback()
  }
}

const itemStyles = css`
  :host {
    display: block;
    width: 24px;
    height: 24px;
  }
`

abstract class KalaCommandItem extends KalaEditorElement {
  static styles = itemStyles

  protected abstract icon: string
  protected abstract label: string

  protected isActive(): boolean {
    return false
  }

  protected isDisabled(): boolean {
    return false
  }

  protected abstract run(): void

  private press = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    const editor = this.editor
    if (editor === null || this.isDisabled()) {
      return
    }
    this.run()
    editor.view.focus()
  }

  render() {
    return html`
      <kala-tooltip .content=${this.label}>
        <kala-button ?disabled=${this.isDisabled()} ?active=${this.isActive()} @click=${this.press}>
          <kala-icon .name=${this.icon}></kala-icon>
        </kala-button>
      </kala-tooltip>
    `
  }
}

/* ============================ 基础按钮 item ============================ */

class KalaToolbarSplitter extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 0;
      height: 24px;
    }
  `

  render() {
    return nothing
  }
}
defineOnce('kala-toolbar-splitter', KalaToolbarSplitter)

class KalaToolbarUndo extends KalaCommandItem {
  protected icon = 'fwb/shangyibu/1'
  protected label = t('toolbar.undo')

  protected isDisabled(): boolean {
    return this.editor?.can().undo() !== true
  }

  protected run(): void {
    this.editor?.chain().focus().undo().run()
  }
}
defineOnce('kala-toolbar-undo', KalaToolbarUndo)

class KalaToolbarRedo extends KalaCommandItem {
  protected icon = 'fwb/xiayibu/1'
  protected label = t('toolbar.redo')

  protected isDisabled(): boolean {
    return this.editor?.can().redo() !== true
  }

  protected run(): void {
    this.editor?.chain().focus().redo().run()
  }
}
defineOnce('kala-toolbar-redo', KalaToolbarRedo)

class KalaToolbarFormatPainter extends KalaCommandItem {
  protected icon = 'fwb/qingchu/1'
  protected label = t('toolbar.formatPainter')

  protected isActive(): boolean {
    const storage = this.editor?.storage['formatPainter'] as { active?: boolean } | undefined
    return storage?.active === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleFormatPainter().run()
  }
}
defineOnce('kala-toolbar-format-painter', KalaToolbarFormatPainter)

class KalaToolbarFormatClear extends KalaCommandItem {
  protected icon = 'fwb/chexiao/1'
  protected label = t('toolbar.clearFormat')

  protected run(): void {
    this.editor?.chain().focus().clearNodes().unsetAllMarks().run()
  }
}
defineOnce('kala-toolbar-format-clear', KalaToolbarFormatClear)

class KalaToolbarFontSmall extends KalaCommandItem {
  protected icon = 'fwb/small/2'
  protected label = t('toolbar.fontSmall')

  protected isActive(): boolean {
    return this.editor?.getAttributes('textStyle')['fontLevel'] === 'small'
  }

  protected run(): void {
    this.editor?.chain().focus().setFontLevel(this.isActive() ? 'regular' : 'small').run()
  }
}
defineOnce('kala-toolbar-font-small', KalaToolbarFontSmall)

class KalaToolbarBold extends KalaCommandItem {
  protected icon = 'fwb/jiacu/1'
  protected label = t('toolbar.bold.tooltip')

  protected isActive(): boolean {
    return this.editor?.isActive('bold') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleBold().run()
  }
}
defineOnce('kala-toolbar-bold', KalaToolbarBold)

class KalaToolbarItalic extends KalaCommandItem {
  protected icon = 'fwb/xieti/1'
  protected label = t('toolbar.italic')

  protected isActive(): boolean {
    return this.editor?.isActive('italic') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleItalic().run()
  }
}
defineOnce('kala-toolbar-italic', KalaToolbarItalic)

class KalaToolbarUnderline extends KalaCommandItem {
  protected icon = 'fwb/xiahuaxian/1'
  protected label = t('toolbar.underline')

  protected isActive(): boolean {
    return this.editor?.isActive('underline') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleUnderline().run()
  }
}
defineOnce('kala-toolbar-underline', KalaToolbarUnderline)

class KalaToolbarStrike extends KalaCommandItem {
  protected icon = 'fwb/huaxian/1'
  protected label = t('toolbar.strike')

  protected isActive(): boolean {
    return this.editor?.isActive('strike') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleStrike().run()
  }
}
defineOnce('kala-toolbar-strike', KalaToolbarStrike)

class KalaToolbarOrderedList extends KalaCommandItem {
  protected icon = 'fwb/jiaxuhao/1'
  protected label = t('toolbar.orderedList')

  protected isActive(): boolean {
    return this.editor?.isActive('orderedList') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleOrderedList().run()
  }
}
defineOnce('kala-toolbar-ordered-list', KalaToolbarOrderedList)

class KalaToolbarBulletList extends KalaCommandItem {
  protected icon = 'fwb/jiadian/1'
  protected label = t('toolbar.bulletList')

  protected isActive(): boolean {
    return this.editor?.isActive('bulletList') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleBulletList().run()
  }
}
defineOnce('kala-toolbar-bullet-list', KalaToolbarBulletList)

class KalaToolbarHr extends KalaCommandItem {
  protected icon = 'fwb/fengexian/1'
  protected label = t('toolbar.horizontalRule')

  protected run(): void {
    this.editor?.chain().focus().setHorizontalRule().run()
  }
}
defineOnce('kala-toolbar-hr', KalaToolbarHr)

class KalaToolbarBlockquote extends KalaCommandItem {
  protected icon = 'fwb/yingyong/1'
  protected label = t('toolbar.quote')

  protected isActive(): boolean {
    return this.editor?.isActive('blockquote') === true
  }

  protected run(): void {
    this.editor?.chain().focus().toggleBlockquote().run()
  }
}
defineOnce('kala-toolbar-blockquote', KalaToolbarBlockquote)

class KalaToolbarLink extends KalaCommandItem {
  protected icon = 'fwb/lianjie/1'
  protected label = t('toolbar.linkAdd')

  protected isActive(): boolean {
    return this.editor?.isActive('link') === true
  }

  protected run(): void {
    const editor = this.editor
    if (editor === null) {
      return
    }
    const linkMark = editor.state.selection.$from.marks().find((mark) => mark.type.name === 'link')
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' ',
    )
    const existing =
      linkMark !== undefined && typeof linkMark.attrs['href'] === 'string'
        ? { href: linkMark.attrs['href'], text: selectedText }
        : null
    void openLinkModal(existing).then((result) => {
      if (result === null) {
        return
      }
      if (result.remove) {
        editor.chain().focus().unsetLink().run()
        return
      }
      const text = result.text.length > 0 ? result.text : result.href
      if (editor.state.selection.empty) {
        editor
          .chain()
          .focus()
          .insertContent([
            {
              type: 'text',
              text,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: result.href,
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                  },
                },
              ],
            },
          ])
          .run()
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: result.href, target: '_blank', rel: 'noopener noreferrer nofollow' })
          .run()
      }
    })
  }
}
defineOnce('kala-toolbar-link', KalaToolbarLink)

/* ============================ 标题 / 对齐下拉 ============================ */

const headOptions = (): KalaSelectOption[] => [
  { value: 'h1', icon: 'fwb/biaoti1/1', label: t('toolbar.select.heading'), bold: true },
  { value: 'h2', icon: 'fwb/biaoti2/1', label: t('toolbar.select.heading'), bold: true },
  { value: 'h3', icon: 'fwb/biaoti3/1', label: t('toolbar.select.heading'), bold: true },
  { value: 'text', icon: 'fwb/wenben/1', label: t('toolbar.select.body') },
]

class KalaToolbarHead extends KalaEditorElement {
  static styles = itemStyles

  private current(): string {
    const editor = this.editor
    if (editor === null) {
      return 'text'
    }
    if (editor.isActive('heading', { level: 1 })) {
      return 'h1'
    }
    if (editor.isActive('heading', { level: 2 })) {
      return 'h2'
    }
    if (editor.isActive('heading', { level: 3 })) {
      return 'h3'
    }
    return 'text'
  }

  private onSelect = (event: Event): void => {
    const value = (event as CustomEvent<string>).detail
    const editor = this.editor
    if (editor === null) {
      return
    }
    if (value === 'text') {
      editor.chain().focus().setParagraph().run()
      return
    }
    const level = value === 'h1' ? 1 : value === 'h2' ? 2 : 3
    editor.chain().focus().setHeading({ level }).run()
  }

  render() {
    return html`
      <kala-toolbar-select
        .value=${this.current()}
        .options=${headOptions()}
        @kala-select=${this.onSelect}
      ></kala-toolbar-select>
    `
  }
}
defineOnce('kala-toolbar-head', KalaToolbarHead)

const alignOptions = (): KalaSelectOption[] => [
  { value: 'left', icon: 'fwb/zuoduiqi/1', label: t('toolbar.alignLeft') },
  { value: 'center', icon: 'fwb/juzhongduiqi/1', label: t('toolbar.alignCenter') },
  { value: 'right', icon: 'fwb/youduiqi/1', label: t('toolbar.alignRight') },
]

class KalaToolbarAlign extends KalaEditorElement {
  static styles = itemStyles

  private current(): string {
    const editor = this.editor
    if (editor === null) {
      return 'left'
    }
    if (editor.isActive({ textAlign: 'center' })) {
      return 'center'
    }
    if (editor.isActive({ textAlign: 'right' })) {
      return 'right'
    }
    return 'left'
  }

  private onSelect = (event: Event): void => {
    const value = (event as CustomEvent<string>).detail
    const align = value === 'center' ? 'center' : value === 'right' ? 'right' : 'left'
    this.editor?.chain().focus().setAlign(align).run()
  }

  render() {
    return html`
      <kala-toolbar-select
        .value=${this.current()}
        .options=${alignOptions()}
        @kala-select=${this.onSelect}
      ></kala-toolbar-select>
    `
  }
}
defineOnce('kala-toolbar-align', KalaToolbarAlign)

/* ============================ 颜色 ============================ */

const textColorValues = [
  '#2f3238',
  '#61666d',
  '#9499a0',
  '#c9ccd0',
  '#89e1e1',
  '#95e4af',
  '#ffdb93',
  '#ffb68c',
  '#fcafaa',
  '#d8b6ff',
  '#88a4ff',
  '#4fd3d1',
  '#2ac864',
  '#ffcc00',
  '#ff661a',
  '#f85a54',
  '#ac6dff',
  '#6188ff',
  '#018488',
  '#089043',
  '#aa7d00',
  '#bb3800',
  '#c9272c',
  '#723ecc',
  '#3752c8',
]

const backgroundColorValues = [
  null,
  '#bfedfa',
  '#ffeec9',
  '#ffd9e4',
  '#caf1d6',
  '#ffdcc6',
  '#d7dfff',
  '#efe7e0',
  '#ebeff4',
]

class KalaTextColorPicker extends LitElement {
  static properties = { selected: { type: String } }

  declare selected: string

  constructor() {
    super()
    this.selected = '#2f3238'
  }

  static styles = css`
    :host {
      display: block;
      width: 236px;
    }
    .section {
      padding: 8px;
      margin-bottom: 8px;
    }
    .title {
      margin-bottom: 8px;
      font-size: 13px;
      line-height: 18px;
      color: var(--text3, #9499a0);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .item-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      box-sizing: border-box;
      cursor: pointer;
    }
    .item-wrapper:hover {
      border: 1px solid var(--Lb4, #40c5f1);
    }
    .item-wrapper--selected {
      background: var(--brand_blue_thin, #dff6fd);
      border: 1px solid var(--brand_blue, #00aeec);
    }
    .item {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      transition: 0.2s;
      box-sizing: border-box;
    }
    .splitter {
      height: 1px;
      margin: 8px 0;
      border-radius: 12px;
      background: var(--line_light, #f1f2f3);
    }
    .footer {
      border-top: 1px solid var(--line_light, #f1f2f3);
    }
    .reset {
      margin-top: 8px;
      padding: 0 8px;
      width: 100%;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--Ga9, #2f3238);
      font-size: 14px;
      line-height: 24px;
      text-align: center;
      transition: 0.2s;
      cursor: pointer;
    }
    .reset:hover {
      background: var(--graph_bg_regular, #f1f2f3);
    }
  `

  private choose(color: string | null): void {
    this.dispatchEvent(new CustomEvent('kala-color-select', { detail: color, bubbles: true, composed: true }))
  }

  render() {
    const gray = textColorValues.slice(0, 4)
    const colors = textColorValues.slice(4)
    return html`
      <div class="section">
        <div class="title">${t('toolbar.color.text')}</div>
        <div class="grid">
          ${gray.map(
            (color) => html`
              <div
                class="item-wrapper ${color === this.selected ? 'item-wrapper--selected' : ''}"
                @click=${() => this.choose(color)}
              >
                <div class="item" style="background-color:${color}"></div>
              </div>
            `,
          )}
        </div>
        <div class="splitter"></div>
        <div class="grid">
          ${colors.map(
            (color) => html`
              <div
                class="item-wrapper ${color === this.selected ? 'item-wrapper--selected' : ''}"
                @click=${() => this.choose(color)}
              >
                <div class="item" style="background-color:${color}"></div>
              </div>
            `,
          )}
        </div>
      </div>
      <div class="footer">
        <button class="reset" @click=${() => this.choose(null)}>${t('toolbar.color.reset')}</button>
      </div>
    `
  }
}
defineOnce('kala-text-color-picker', KalaTextColorPicker)

class KalaBackgroundColorPicker extends LitElement {
  static properties = { selected: { attribute: false } }

  declare selected: string | null

  constructor() {
    super()
    this.selected = null
  }

  static styles = css`
    :host {
      display: block;
      width: 236px;
      padding-bottom: 8px;
    }
    .section {
      padding: 8px;
    }
    .title {
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 18px;
      color: var(--text3, #9499a0);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .item-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      box-sizing: border-box;
      cursor: pointer;
    }
    .item-wrapper:hover {
      border: 1px solid var(--Lb4, #40c5f1);
    }
    .item-wrapper--selected {
      background: var(--brand_blue_thin, #dff6fd);
      border: 1px solid var(--brand_blue, #00aeec);
    }
    .item {
      position: relative;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      transition: 0.2s;
      box-sizing: border-box;
    }
    .item--no-color {
      background: var(--bg1, #fff);
      border: 1px solid var(--line_light, #f1f2f3);
    }
    .item--no-color::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 20px;
      height: 1px;
      transform: translate(-50%, -50%) rotate(-45deg);
      background: var(--line_regular, #e3e5e7);
    }
  `

  private choose(color: string | null): void {
    this.dispatchEvent(new CustomEvent('kala-color-select', { detail: color, bubbles: true, composed: true }))
  }

  render() {
    return html`
      <div class="section">
        <div class="title">${t('toolbar.backgroundColor')}</div>
        <div class="grid">
          ${backgroundColorValues.map(
            (color) => html`
              <div
                class="item-wrapper ${color === this.selected ? 'item-wrapper--selected' : ''}"
                @click=${() => this.choose(color)}
              >
                ${color === null
                  ? html`<div class="item item--no-color"></div>`
                  : html`<div class="item" style="background-color:${color}"></div>`}
              </div>
            `,
          )}
        </div>
      </div>
    `
  }
}
defineOnce('kala-background-color-picker', KalaBackgroundColorPicker)

function readColorMark(editor: Editor, kind: 'textColor' | 'backgroundColor'): string | null {
  const marks = editor.state.selection.$from.marks()
  const mark = marks.find((item) => item.type.name === kind)
  if (mark === undefined) {
    return null
  }
  const value = mark.attrs['value'] ?? mark.attrs['color']
  return typeof value === 'string' ? value : null
}

class KalaToolbarTextColor extends KalaEditorElement {
  static styles = itemStyles

  private apply = (event: Event): void => {
    const color = (event as CustomEvent<string | null>).detail
    const editor = this.editor
    if (editor === null) {
      return
    }
    if (color === null) {
      editor.chain().focus().unsetTextColor().run()
    } else {
      editor.chain().focus().setTextColor(color).run()
    }
    this.renderRoot.querySelector<KalaDropdown>('kala-dropdown')?.close()
  }

  render() {
    const selected = this.editor === null ? null : readColorMark(this.editor, 'textColor')
    return html`
      <kala-dropdown>
        <kala-icon name="fwb/wenbenyanse/1" subcolor="var(--Ga9, #2f3238)"></kala-icon>
        <kala-text-color-picker
          slot="content"
          .selected=${selected ?? '#2f3238'}
          @kala-color-select=${this.apply}
        ></kala-text-color-picker>
      </kala-dropdown>
    `
  }
}
defineOnce('kala-toolbar-text-color', KalaToolbarTextColor)

class KalaToolbarBackgroundColor extends KalaEditorElement {
  static styles = itemStyles

  private apply = (event: Event): void => {
    const color = (event as CustomEvent<string | null>).detail
    const editor = this.editor
    if (editor === null) {
      return
    }
    if (color === null) {
      editor.chain().focus().unsetBackgroundColor().run()
    } else {
      editor.chain().focus().setBackgroundColor(color).run()
    }
    this.renderRoot.querySelector<KalaDropdown>('kala-dropdown')?.close()
  }

  render() {
    const selected = this.editor === null ? null : readColorMark(this.editor, 'backgroundColor')
    return html`
      <kala-dropdown>
        <div class="bg-color-icon">
          <kala-icon name="fwb/text_color/1" subcolor="var(--Ga2, #e3e5e7)"></kala-icon>
        </div>
        <kala-background-color-picker
          slot="content"
          .selected=${selected}
          @kala-color-select=${this.apply}
        ></kala-background-color-picker>
      </kala-dropdown>
    `
  }
}
defineOnce('kala-toolbar-background-color', KalaToolbarBackgroundColor)

/* ============================ 图片 / 表情 / 加号 / 导入 / 预览 ============================ */

interface WithCallbacks {
  callbacks?: ToolbarCallbacks
}

class KalaToolbarImage extends KalaEditorElement implements WithCallbacks {
  static styles = css`
    ${itemStyles}
    .item {
      padding: 8px;
      width: 126px;
      border-radius: 4px;
      color: var(--text1, #18191c);
      font-size: 14px;
      line-height: 24px;
      cursor: pointer;
    }
    .item:hover {
      background: var(--bg2, #f6f7f8);
    }
  `

  callbacks?: ToolbarCallbacks

  private upload = async (): Promise<void> => {
    const callbacks = this.callbacks
    const editor = this.editor
    if (callbacks === undefined || editor === null) {
      return
    }
    this.renderRoot.querySelector<KalaDropdown>('kala-dropdown')?.close()
    const result = await openImageModal(callbacks.uploadImage)
    if (result === null) {
      return
    }
    editor
      .chain()
      .focus()
      .insertKalamosImage({
        src: result.src,
        caption: result.caption.length > 0 ? result.caption : null,
        align: result.align,
        status: 'loaded',
        alt: null,
        width: null,
      })
      .run()
  }

  render() {
    return html`
      <kala-dropdown>
        <kala-icon name="fwb/tupian/1"></kala-icon>
        <div slot="content">
          <div class="item" @click=${() => void this.upload()}>${t('toolbar.image.upload')}</div>
          <div class="item" @click=${() => void this.upload()}>${t('toolbar.image.uploadWatermark')}</div>
        </div>
      </kala-dropdown>
    `
  }
}
defineOnce('kala-toolbar-image', KalaToolbarImage)

class KalaToolbarEmoji extends KalaEditorElement implements WithCallbacks {
  static styles = css`
    ${itemStyles}
    .panel {
      display: grid;
      grid-template-columns: repeat(8, 40px);
      gap: 2px;
      width: 342px;
      padding: 8px;
      background: var(--bg1, #fff);
    }
    .emoji {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 4px;
      background: transparent;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }
    .emoji:hover {
      background: var(--graph_bg_thick, #e3e5e7);
    }
    .emoji img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
  `

  callbacks?: ToolbarCallbacks

  private choose(item: EmojiItem): void {
    const editor = this.editor
    if (editor === null) {
      return
    }
    editor
      .chain()
      .focus()
      .insertEmoji({ name: item.name, char: item.char, img: item.img, size: 24 })
      .run()
    this.renderRoot.querySelector<KalaDropdown>('kala-dropdown')?.close()
  }

  render() {
    const emojis = this.callbacks?.emojiList ?? []
    return html`
      <kala-dropdown content-styles="padding:0;border:none;background:transparent;box-shadow:none">
        <kala-icon name="fwb/biaoqing/1"></kala-icon>
        <div slot="content" class="panel">
          ${emojis.map(
            (item) => html`
              <button class="emoji" type="button" title=${item.name} @click=${() => this.choose(item)}>
                ${typeof item.img === 'string' && item.img.length > 0
                  ? html`<img src=${item.img} referrerpolicy="no-referrer" alt=${item.name} />`
                  : item.char}
              </button>
            `,
          )}
        </div>
      </kala-dropdown>
    `
  }
}
defineOnce('kala-toolbar-emoji', KalaToolbarEmoji)

interface PlusAction {
  glyph: string
  label: string
  run: (editor: Editor, callbacks: ToolbarCallbacks, anchor: HTMLElement) => void
}

const plusActions = (): PlusAction[] => [
  {
    glyph: '⊞',
    label: t('toolbar.table'),
    run: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    glyph: '☑',
    label: t('toolbar.taskList'),
    run: (editor) => {
      editor.chain().focus().toggleTaskList().run()
    },
  },
  {
    glyph: '{}',
    label: t('toolbar.codeBlock'),
    run: (editor) => {
      editor.chain().focus().toggleCodeBlock().run()
    },
  },
  {
    glyph: 'x₂',
    label: t('toolbar.sub'),
    run: (editor) => {
      editor.chain().focus().toggleSubscript().run()
    },
  },
  {
    glyph: 'x²',
    label: t('toolbar.sup'),
    run: (editor) => {
      editor.chain().focus().toggleSuperscript().run()
    },
  },
  {
    glyph: '∑',
    label: t('toolbar.latex'),
    run: (editor) => {
      void openLatexModal(null).then((formula) => {
        if (formula !== null) {
          editor.chain().focus().insertLatex({ formula }).run()
        }
      })
    },
  },
  {
    glyph: '@',
    label: t('toolbar.mention'),
    run: (editor) => {
      editor.chain().focus().insertContent('@').run()
    },
  },
  {
    glyph: '#',
    label: t('toolbar.topic'),
    run: (editor) => {
      editor.chain().focus().insertContent('#').run()
    },
  },
  {
    glyph: '▦',
    label: t('toolbar.card'),
    run: (_editor, callbacks, anchor) => {
      callbacks.onOpenCardMenu(anchor)
    },
  },
  {
    glyph: '☰',
    label: t('toolbar.toc'),
    run: (_editor, callbacks) => {
      callbacks.onToggleToc()
    },
  },
  {
    glyph: '⛶',
    label: t('toolbar.fullscreen'),
    run: (_editor, callbacks) => {
      callbacks.onToggleFullscreen()
    },
  },
]

class KalaToolbarPlus extends KalaEditorElement implements WithCallbacks {
  static styles = css`
    ${itemStyles}
    :host {
      position: relative;
    }
    .plus-button {
      position: relative;
      display: block;
      width: 24px;
      height: 24px;
    }
    .menu {
      padding: 4px;
    }
  `

  callbacks?: ToolbarCallbacks

  private select(action: PlusAction): void {
    const editor = this.editor
    const callbacks = this.callbacks
    if (editor === null || callbacks === undefined) {
      return
    }
    this.renderRoot.querySelector<KalaPopover>('kala-popover')?.hide()
    action.run(editor, callbacks, this)
    editor.view.focus()
  }

  render() {
    return html`
      <kala-popover placement="bottom-start">
        <div class="plus-button">
          <kala-button><kala-icon name="BDC/plus_add_circle_line/2"></kala-icon></kala-button>
        </div>
        <div slot="content">
          <kala-menu class="menu">
            ${plusActions().map(
              (action) => html`
                <kala-menu-item
                  .glyph=${action.glyph}
                  .label=${action.label}
                  @click=${() => this.select(action)}
                ></kala-menu-item>
              `,
            )}
          </kala-menu>
        </div>
      </kala-popover>
    `
  }
}
defineOnce('kala-toolbar-plus', KalaToolbarPlus)

class KalaToolbarImport extends KalaEditorElement implements WithCallbacks {
  static styles = itemStyles

  callbacks?: ToolbarCallbacks

  private pick = (): void => {
    const input = this.renderRoot.querySelector<HTMLInputElement>('input[type=file]')
    input?.click()
  }

  private onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file !== undefined) {
      this.callbacks?.onImportWord(file)
    }
    input.value = ''
  }

  render() {
    return html`
      <kala-tooltip content=${t('toolbar.importDoc')} beta>
        <kala-button @click=${this.pick}>
          <kala-icon name="fwb/daoru/1"></kala-icon>
        </kala-button>
      </kala-tooltip>
      <input type="file" accept=".docx" hidden @change=${this.onChange} />
    `
  }
}
defineOnce('kala-toolbar-import', KalaToolbarImport)

const previewButtonSvg = `<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12.5" cy="12" r="12" fill="#9499A0"></circle>
  <path d="M15 5C16.1046 5 17 5.89543 17 7V18C17 19.1046 16.1046 20 15 20H10C8.89543 20 8 19.1046 8 18V7C8 5.89543 8.89543 5 10 5H15ZM12.5 17C11.9477 17 11.5 17.4477 11.5 18C11.5 18.5523 11.9477 19 12.5 19C13.0523 19 13.5 18.5523 13.5 18C13.5 17.4477 13.0523 17 12.5 17ZM10 7C9.44772 7 9 7.44772 9 8V15C9 15.5523 9.44772 16 10 16H15C15.5523 16 16 15.5523 16 15V8C16 7.44772 15.5523 7 15 7H10ZM11.25 6C11.1119 6 11 6.11193 11 6.25C11 6.38807 11.1119 6.5 11.25 6.5H13.75C13.8881 6.5 14 6.38807 14 6.25C14 6.11193 13.8881 6 13.75 6H11.25Z" fill="white"></path>
</svg>`

export class KalaToolbarPreview extends KalaEditorElement implements WithCallbacks {
  static properties = {
    active: { type: Boolean },
  }

  declare active: boolean

  static styles = css`
    :host {
      display: block;
      width: 25px;
      height: 24px;
      cursor: pointer;
    }
    svg {
      display: block;
    }
    .on {
      filter: brightness(0.9);
    }
  `

  callbacks?: ToolbarCallbacks

  constructor() {
    super()
    this.active = false
  }

  private press = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    this.active = !this.active
    this.callbacks?.onPreview()
  }

  render() {
    return html`
      <div
        class=${this.active ? 'on' : ''}
        @click=${this.press}
      >
        ${unsafeHTML(previewButtonSvg)}
      </div>
    `
  }
}
defineOnce('kala-toolbar-preview', KalaToolbarPreview)

/* ============================ 组装 ============================ */

const toolbarItemNames = [
  'undo',
  'redo',
  'splitter',
  'format-painter',
  'format-clear',
  'splitter',
  'head',
  'font-small',
  'bold',
  'italic',
  'underline',
  'strike',
  'text-color',
  'background-color',
  'splitter',
  'align',
  'ordered-list',
  'bullet-list',
  'splitter',
  'image',
  'link',
  'hr',
  'blockquote',
  'emoji',
  'plus',
  'splitter',
  'import',
  'preview',
] as const

interface ToolbarElement extends HTMLElement {
  editor: Editor | null
  callbacks?: ToolbarCallbacks
}

/** 组装 1:1 工具栏 DOM */
export function createToolbar(editor: Editor, callbacks: ToolbarCallbacks): HTMLDivElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'kala-toolbar'
  for (const name of toolbarItemNames) {
    const item = document.createElement(`kala-toolbar-${name}`) as ToolbarElement
    item.classList.add('kala-toolbar-item')
    if (name === 'preview') {
      item.classList.add('kala-toolbar-item--preview')
    }
    item.editor = editor
    if ('callbacks' in item) {
      item.callbacks = callbacks
    }
    toolbar.appendChild(item)
  }
  return toolbar
}
