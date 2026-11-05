/**
 * 图片 NodeView：加载/失败态、注释编辑
 * 悬停操作条（重新上传/替换/删除）由共享悬浮菜单（client/ui/hover-menu.ts）负责，
 * 本视图通过注册表暴露节点信息。
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, NodeView } from '@tiptap/pm/view'
import { t } from '../i18n'

/** 图片 NodeView 注册表：悬浮菜单经 DOM 反查节点上下文 */
export const imageViewRegistry = new WeakMap<HTMLElement, ImageView>()

/** 图片视图（依赖编辑器 API 完成替换上传） */
export class ImageView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement | undefined

  private readonly view: EditorView
  private readonly getPos: (() => number | undefined) | undefined
  private currentNode: PMNode
  private readonly img: HTMLImageElement
  private readonly caption: HTMLElement
  private readonly captionInput: HTMLInputElement

  constructor(node: PMNode, view: EditorView, getPos: (() => number | undefined) | undefined) {
    this.currentNode = node
    this.view = view
    this.getPos = getPos

    const figure = document.createElement('figure')
    figure.className = 'kala-image'

    const img = document.createElement('img')
    // B 站 CDN 防盗链：非 B 站 referer 返回 403，必须以无 referer 请求
    img.referrerPolicy = 'no-referrer'

    // 注释输入（更新属性）
    const captionInput = document.createElement('input')
    captionInput.className = 'kala-image-caption-input'
    captionInput.placeholder = t('image.captionPlaceholder')
    captionInput.style.border = 'none'
    captionInput.style.background = 'transparent'
    captionInput.style.textAlign = 'center'
    captionInput.style.fontSize = '12px'
    captionInput.style.color = 'var(--kala-text-secondary)'
    captionInput.style.outline = 'none'
    captionInput.style.marginTop = '4px'
    captionInput.style.width = '90%'
    captionInput.addEventListener('change', () => {
      this.updateNode({ caption: captionInput.value.trim().length > 0 ? captionInput.value.trim() : null })
    })

    const caption = document.createElement('figcaption')
    caption.className = 'kala-image-caption'

    figure.append(img, captionInput, caption)
    this.dom = figure
    this.img = img
    this.caption = caption
    this.captionInput = captionInput
    imageViewRegistry.set(figure, this)

    this.render(node)
  }

  /** 当前节点（悬浮菜单读取 attrs / nodeSize） */
  getNode(): PMNode {
    return this.currentNode
  }

  /** 当前文档位置（悬浮菜单执行事务用） */
  getPosition(): number | undefined {
    return this.getPos?.()
  }

  /** 更新节点属性 */
  private updateNode(attrs: Record<string, unknown>): void {
    const pos = this.getPos?.()
    if (pos !== undefined) {
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.currentNode.attrs, ...attrs }),
      )
    }
  }

  /** 按当前节点渲染视图 */
  private render(node: PMNode): void {
    this.currentNode = node
    const status = String(node.attrs['status'] ?? 'loaded')
    const align = String(node.attrs['align'] ?? 'left')
    const classes = ['kala-image']
    if (align === 'center') {
      classes.push('kala-image--center')
    }
    if (status === 'loading') {
      classes.push('kala-image--loading')
    }
    if (status === 'error') {
      classes.push('kala-image--error')
    }
    this.dom.className = classes.join(' ')

    const src = String(node.attrs['src'] ?? '')
    if (status === 'loading') {
      this.img.style.opacity = '0.5'
    } else {
      this.img.style.opacity = '1'
    }
    this.img.src = src
    this.img.alt = String(node.attrs['alt'] ?? '')
    const width = node.attrs['width']
    if (typeof width === 'number' && width > 0) {
      this.img.width = width
    } else {
      this.img.removeAttribute('width')
    }

    const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : ''
    this.captionInput.value = caption
    this.caption.textContent = caption
    this.caption.style.display = caption.length > 0 ? 'block' : 'none'
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'image') {
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
    // 注释输入事件自处理，不透传 PM
    return event.target === this.captionInput
  }

  destroy(): void {
    imageViewRegistry.delete(this.dom)
  }
}
