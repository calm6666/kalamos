/**
 * opus 展示页渲染器：展示数据 → HTML 字符串
 *
 * 纯字符串输出，无任何 DOM 依赖，可同时用于 SSR 与客户端注入。
 * DOM 结构、类名、属性逐字对齐原站取证（docs/implementation.md §7.5 与 %TEMP% 取证文件），
 * 类名前缀统一为 kala-。
 */
import katex from 'katex'
import { paletteColorValues } from '../palette'
import type { OpusWordNode, OpusImageSection, OpusCardSection, OpusFormulaSection } from './factory'
import type { OpusDisplayDoc, OpusDisplayInline, OpusDisplaySection, OpusTocItem, OpusDisplayLinkNode, OpusDisplayAuthor, OpusDisplayCover } from './display'
import {
  authorMoreSvg,
  invalidTipSvg,
  shareDynamicSvg,
  shareQqSvg,
  shareQzoneSvg,
  shareTimelineSvg,
  shareWeiboSvg,
  tocArrowSvg,
  tocChevronSvg,
  topicSvg,
  videoHlSvg,
} from './svg'

/** HTML 文本转义 */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 调色板 key → 颜色值（非 key 的值原样输出，兼容直接传色值） */
function resolveColor(value: string | undefined): string {
  if (!value) return ''
  return paletteColorValues[value] ?? value
}

/** 字级 → 类名（仅原版三种字级） */
function fontLevelClass(level: string | undefined): string {
  if (level === 'xxLarge') return 'kala-font-xxLarge'
  if (level === 'xLarge') return 'kala-font-xLarge'
  if (level === 'small') return 'kala-font-small'
  return ''
}

/** 按原版图片组件规则生成 picture 内层：webp 源自动派生对应 avif 源 */
function renderBimgInner(url: string): string {
  let sources = ''
  if (/\.webp$/.test(url)) {
    sources += `<source type="image/avif" srcset="${esc(url.replace(/\.webp$/, '.avif'))}">`
    sources += `<source type="image/webp" srcset="${esc(url)}">`
  } else if (/\.avif$/.test(url)) {
    sources += `<source type="image/avif" srcset="${esc(url)}">`
  }
  return `<picture class="h-img__inner">${sources}<img src="${esc(url)}" referrerpolicy="no-referrer" loading="lazy" onload="bmgOnLoad(this)" onerror="bmgOnError(this)" data-onload="bmgCmptOnload" data-onerror="bmgCmptOnerror"></picture>`
}

/** 字符 run 渲染：普通态恒输出带样式（可为空值）的 span，加粗态仅在无任何色值/字级时省略内层 span（与原版证据一致） */
function renderWord(word: OpusWordNode): string {
  const color = resolveColor(word.color)
  const bg = resolveColor(word.background_color)
  const cls = fontLevelClass(word.font_level)
  const span = `<span${cls ? ` class="${cls}"` : ''} style="background:${bg};color:${color}">${esc(word.text)}</span>`
  let core = span
  if (word.bold && !color && !bg && !cls) core = esc(word.text)
  if (word.italic) core = `<em>${core}</em>`
  if (word.strikethrough) core = `<s>${core}</s>`
  if (word.underline) core = `<u>${core}</u>`
  if (word.bold) core = `<strong>${core}</strong>`
  return core
}

/** 链接节点渲染（url / mention / topic / emoji 四种形态） */
function renderLink(node: OpusDisplayLinkNode): string {
  if (node.link_type === 'url' && node.url) {
    return `<a href="${esc(node.url)}" target="_blank" class="kala-text-rich-hl${node.video ? ' video' : ''}" style="font-size:17px;background:;">${node.video ? videoHlSvg : ''}<span>${esc(node.show_text)}</span></a>`
  }
  if (node.link_type === 'mention') {
    return `<a href="https://space.bilibili.com/${esc(node.user_id ?? '')}" target="_blank" class="kala-text-rich-hl" style="font-size:17px;background:;"><span>${esc(node.show_text)}</span></a>`
  }
  if (node.link_type === 'topic') {
    return `<span class="kala-topic">${topicSvg} <span class="kala-topic__text">${esc(node.name ?? node.show_text.replace(/^#|#$/g, ''))}</span></span>`
  }
  if (node.link_type === 'emoji' && node.img) {
    return `<span class="kala-text-rich-emoji"><img src="${esc(node.img)}" referrerpolicy="no-referrer" alt="${esc(node.name ?? node.show_text)}"></span>`
  }
  return esc(node.show_text)
}

/** 行内节点分发 */
function renderInline(node: OpusDisplayInline): string {
  if (node.node_type === 1) return renderWord(node)
  if (node.node_type === 3) return renderLink(node)
  if (node.node_type === 5) {
    return `<span class="kala-text-rich-katex">${katex.renderToString(node.latex_content, { throwOnError: false })}</span>`
  }
  return ''
}

/** 失效卡：原版分发 ITEM_NULL 形态，输出 kala-para-link-card 提示条 */
function renderInvalidCard(tip: string): string {
  return `<div class="kala-para-link-card"><div class="kala-tip">${invalidTipSvg}<span class="kala-ellipsis">${esc(tip)}</span></div></div>`
}

/** 卡片段：各类真实卡片的展示模板按取证在实测阶段逐类补齐，未实现类型按原版分发默认行为输出提示条 */
function renderCardSection(_section: OpusCardSection): string {
  return renderInvalidCard(`无法展示的卡片类型: ${_section.content_card.card_style}`)
}

/** 图片段：单图走 kala-pic-view，多图走 kala-album 预览网格 */
function renderImageSection(section: OpusImageSection): string {
  const pics = section.pics
  if (pics.length === 0) return ''
  const first = pics[0]
  if (pics.length === 1 && first) {
    const caption = first.caption ? `<div class="kala-pic-view__caption">${esc(first.caption)}</div>` : ''
    return `<div class="kala-para-pic center"><div class="kala-pic-view"><div class="kala-pic"><div class="kala-pic__img"><div class="h-img">${renderBimgInner(first.url)}</div></div></div>${caption}</div></div>`
  }
  const mode = pics.length === 2 ? 'grid2' : 'grid3'
  const items = pics
    .slice(0, 9)
    .map((pic) => `<div class="kala-album__preview__picture"><div class="kala-album__preview__picture__img"><div class="h-img">${renderBimgInner(pic.url)}</div></div></div>`)
    .join('')
  return `<div class="kala-para-pic center"><div class="kala-album"><div class="kala-album__preview ${mode}">${items}</div></div></div>`
}

/** 公式段（块级，katex 静态渲染） */
function renderFormulaSection(section: OpusFormulaSection): string {
  return `<div class="kala-para-katex">${katex.renderToString(section.latex_content, { throwOnError: false, displayMode: true })}</div>`
}

/** 目录项（支持二级嵌套，深度决定 d0/d1 行类） */
function renderTocItem(item: OpusTocItem, depth: number): string {
  const hasChildren = item.children !== undefined && item.children.length > 0
  const children = hasChildren && item.children
    ? `<div class="kala-toc-item__children">${item.children.map((child) => renderTocItem(child, depth + 1)).join('')}</div>`
    : ''
  const arrowCls = hasChildren ? ' kala-toc-item__arrow--has-children' : ''
  return `<div class="kala-toc-item"><div class="kala-toc-item__row kala-toc-item__row--d${depth}"><span class="kala-toc-item__arrow${arrowCls}">${tocArrowSvg}</span> <span class="kala-toc-item__content"><span title="${esc(item.text)}" class="kala-toc-item__text">${esc(item.text)}</span></span></div>${children}</div>`
}

/** 目录面板（默认展开态，固定定位与面板宽度按原版实测内联样式） */
function renderToc(toc: OpusTocItem[], title: string): string {
  const items = toc.map((item) => renderTocItem(item, 0)).join('')
  return `<div class="kala-toc kala-toc--expanded" style="left:-84px; top:72px; width:240px; --toc-panel-max-height:calc(100vh - 72px - 12px)"><div class="kala-toc__panel" style=""><div class="kala-toc__header"><span class="kala-toc__label">目录</span> <button class="kala-toc__collapse-btn"><span class="kala-toc__chevron">${tocChevronSvg}</span></button></div> <div class="kala-toc__list"><div title="${esc(title)}" class="kala-toc__title">${esc(title)}</div> ${items}</div></div></div>`
}

/** 顶部封面模块 */
function renderTop(cover: OpusDisplayCover): string {
  const height = cover.height ?? 419
  return `<div class="kala-module-top"><div class="kala-module-top__display"><div class="kala-module-top__album"><div class="kala-module-top__album__cover" style="height:${height}px;"><div class="h-img">${renderBimgInner(cover.url)}</div></div></div></div></div>`
}

/** 标题模块 */
function renderTitle(title: string): string {
  return `<div class="kala-module-title"><div class="kala-module-title__inner"><div class="kala-module-title__inner-mask" data-title-anchor><div class="kala-module-title__content"><div class="kala-module-title__text">${esc(title)}</div></div></div></div></div>`
}

/** 作者模块（66px 头像容器，头像层 37.776px 圆形居中） */
function renderAuthor(author: OpusDisplayAuthor): string {
  const nameStyle = author.nameColor ? ` style="color:${author.nameColor};"` : ''
  return `<div class="kala-module-author"><div class="kala-module-author__left"><div class="kala-module-author__avatar" style="width:66px;height:66px;"><div class="h-avatar"><div class="h-avatar__canvas"><div class="h-avatar__layers"><div class="h-avatar__layer center" style="width:37.776px;height:37.776px;">${renderBimgInner(author.avatarUrl)}</div></div></div></div></div></div><div class="kala-module-author__center"><div class="kala-module-author__name-row"><div class="kala-module-author__name"${nameStyle}>${esc(author.name)}</div></div><div class="kala-module-author__pub"><div class="kala-module-author__pub__text">${esc(author.pubText)}</div></div></div><div class="kala-module-author__right"><div class="kala-module-author__more"><div class="kala-more"><div class="kala-more__container kala-more__btn" data-type="more">${authorMoreSvg}</div></div></div></div></div>`
}

/** 话题模块 */
function renderTopicModule(name: string): string {
  return `<div class="kala-module-topic"><div class="kala-topic">${topicSvg} <div class="kala-topic__text">${esc(name)}</div></div></div>`
}

/** 正文模块（标题段转 h 标签并分配 data-heading-id） */
function renderContent(sections: OpusDisplaySection[]): string {
  let headingCount = 0
  const parts = sections.map((section) => {
    if (section.node_type === 2) return renderImageSection(section)
    if (section.node_type === 5) return renderFormulaSection(section)
    if (section.node_type === 6) return renderCardSection(section)
    if (section.node_type === 7) return renderInvalidCard(section.tip)
    const level = section.paragraph_style?.heading_level
    if (level) {
      headingCount += 1
      const fontCls = level === 1 ? 'kala-font-xxLarge' : level === 2 ? 'kala-font-xLarge' : ''
      const inner = section.words
        .map((word) => (word.node_type === 1 && word.bold ? `<strong>${esc(word.text)}</strong>` : renderInline(word)))
        .join('')
      return `<h${level} data-heading-id="heading-${headingCount}"><span${fontCls ? ` class="${fontCls}"` : ''} style="background:;color:;">${inner}</span></h${level}>`
    }
    const align = section.paragraph_style?.align
    const pStyle = align && align !== 'left' ? ` style="text-align:${align};"` : ''
    return `<p${pStyle}>${section.words.map(renderInline).join('')}</p>`
  })
  return `<div class="kala-module-content kala-paragraph-children">${parts.join('')}</div>`
}

/** 版权模块 */
function renderCopyright(text: string, id: string): string {
  return `<div class="kala-module-copyright"><div class="kala-module-copyright__left">${esc(text)}</div> <div class="kala-module-copyright__right">${esc(id)}</div></div>`
}

/** 底部模块（分享列表 + 投诉入口） */
function renderBottom(): string {
  const items: Array<[string, string]> = [
    ['dynamic', shareDynamicSvg],
    ['weibo', shareWeiboSvg],
    ['timeline', shareTimelineSvg],
    ['qzone', shareQzoneSvg],
    ['qq', shareQqSvg],
  ]
  const list = items.map(([type, svg]) => `<div class="kala-module-bottom__share__item ${type}">${svg}</div>`).join('')
  return `<div class="kala-module-bottom"><div class="kala-module-bottom__share">分享至<div class="kala-module-bottom__share__list">${list}</div></div><div class="kala-module-bottom__feedback">投诉或建议</div></div>`
}

/** opus 展示页整页渲染入口（外层 opus-detail 容器由宿主页面提供） */
export function renderOpusDisplay(doc: OpusDisplayDoc): string {
  const parts: string[] = ['<div class="kala-opus-view-wrap">']
  if (doc.toc && doc.toc.length > 0) parts.push(renderToc(doc.toc, doc.title))
  parts.push('<div class="kala-opus-view">')
  if (doc.cover) parts.push(renderTop(doc.cover))
  parts.push(renderTitle(doc.title))
  parts.push(renderAuthor(doc.author))
  if (doc.topicName) parts.push(renderTopicModule(doc.topicName))
  parts.push(renderContent(doc.sections))
  if (doc.copyrightText) parts.push(renderCopyright(doc.copyrightText, doc.id))
  parts.push(renderBottom())
  parts.push('</div></div>')
  return parts.join('')
}
