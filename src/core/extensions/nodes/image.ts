/**
 * 图片节点：figure.kala-image > img + figcaption
 * - status 属性表达加载态（loading / loaded / error），NodeView 依据其切换视图
 * - caption 为附注文本（属性存储，NodeView 中编辑）
 * - align 为对齐（left / center），类名驱动
 * 对齐 eva3 图片：上传/粘贴/拖拽由 Client 层实现，本节点只负责 schema 与静态渲染
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'

/** 图片加载状态 */
export type ImageStatus = 'loading' | 'loaded' | 'error'

/** 图片对齐 */
export type ImageAlign = 'left' | 'center'

/** 图片节点属性结构 */
export interface ImageAttrs {
  src: string
  alt: string | null
  caption: string | null
  status: ImageStatus
  align: ImageAlign
  width: number | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    kalamosImage: {
      /** 插入图片节点 */
      insertKalamosImage: (attrs: Partial<ImageAttrs>) => ReturnType
      /** 更新图片节点属性（NodeView 编辑 caption / 替换 src 用） */
      updateKalamosImage: (attrs: Partial<ImageAttrs>) => ReturnType
    }
  }
}

export const KalamosImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('src'),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('alt'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const alt = attributes['alt']
          return typeof alt === 'string' && alt.length > 0 ? { alt } : {}
        },
      },
      caption: {
        default: null,
        parseHTML: (element) => {
          const captionEl = element.querySelector('figcaption')
          const text = captionEl?.textContent
          return typeof text === 'string' && text.length > 0 ? text : null
        },
        renderHTML: () => ({}),
      },
      status: {
        default: 'loaded',
        parseHTML: () => 'loaded',
        renderHTML: () => ({}),
      },
      align: {
        default: 'left',
        parseHTML: (element) => {
          const classAttr = element.getAttribute('class') ?? ''
          return classAttr.includes('kala-image--center') ? 'center' : 'left'
        },
        renderHTML: () => ({}),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.querySelector('img')?.getAttribute('width')
          if (raw === null || raw === undefined) {
            return null
          }
          const parsed = Number.parseInt(raw, 10)
          return Number.isNaN(parsed) ? null : parsed
        },
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure.kala-image',
        getAttrs: (element) => (element.querySelector('img') !== null ? {} : false),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const status = typeof node.attrs['status'] === 'string' ? node.attrs['status'] : 'loaded'
    const align = node.attrs['align'] === 'center' ? 'center' : 'left'
    const classParts = ['kala-image']
    if (align === 'center') {
      classParts.push('kala-image--center')
    }
    if (status === 'loading') {
      classParts.push('kala-image--loading')
    }
    if (status === 'error') {
      classParts.push('kala-image--error')
    }

    const imgAttrs: Record<string, unknown> = { ...HTMLAttributes }
    const width = node.attrs['width']
    if (typeof width === 'number' && width > 0) {
      imgAttrs['width'] = width
    }

    const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : ''
    const src = typeof node.attrs['src'] === 'string' ? node.attrs['src'] : ''
    const children: DOMOutputSpec[] = [
      // referrerpolicy 与原站一致：CDN 防盗链要求无 referer 请求
      ['img', mergeAttributes(imgAttrs, { src, referrerpolicy: 'no-referrer' })],
    ]
    if (caption.length > 0) {
      children.push(['figcaption', { class: 'kala-image-caption' }, caption])
    }

    // 子元素必须逐个展开为 figure 的直接子节点（嵌套包裹数组会被 renderSpec 拒绝）
    return ['figure', { class: classParts.join(' ') }, ...children]
  },

  renderText() {
    return ''
  },

  addCommands() {
    return {
      insertKalamosImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs })
        },
      updateKalamosImage:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attrs)
        },
    }
  },
})
