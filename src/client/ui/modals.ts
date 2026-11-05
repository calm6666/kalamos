/**
 * 弹窗：链接 / 公式 / 图片 / 14 类卡片弹窗
 *
 * 卡片弹窗 1:1 对齐原版 eva3-toolbar-*-modal：
 * - 容器宽度：通用 352px（video/user/game 400px，vote 560×540，goods 1018×686）
 * - 通用结构：标题头（含关闭按钮）+ 内容区（padding 16px 0 40px）+ 取消/确定 footer
 * - 校验：500ms debounce 实时校验，校验中 / loading / 无效时确定禁用，错误红字 12px
 * - 评论卡带「链接地址*」标签行与「如何获得评论链接」帮助 tooltip
 */
import katex from 'katex'
import { t } from '../i18n'
import { bdcIcon } from '../../core/cards/icons'
import { isRecord } from '../../core/cards/utils'
import type { CardType, EditorApi, VideoPostItem } from '../../core/types'

/** 卡片弹窗确认结果（refId 由弹窗内解析；showText 为链接展示文字；displayMode 为名片展示形态） */
export interface CardModalResult {
  refId: string
  showText?: string
  displayMode?: 'inline'
  /** 名片 inline 插入所需的完整 info（由调用方在确认后拉取补齐） */
  userInfo?: Record<string, unknown>
}

/** 移除弹窗工具 */
function closeModal(mask: HTMLDivElement): void {
  mask.remove()
}

/** 构建 mask + modal 骨架（悬浮菜单确认弹窗等外部场景复用） */
export function buildModal(title: string): { mask: HTMLDivElement; modal: HTMLDivElement } {
  const mask = document.createElement('div')
  mask.className = 'kala-modal-mask'
  const modal = document.createElement('div')
  modal.className = 'kala-modal'
  const titleEl = document.createElement('div')
  titleEl.className = 'kala-modal__title'
  titleEl.textContent = title
  modal.appendChild(titleEl)
  mask.appendChild(modal)
  mask.addEventListener('click', (event) => {
    if (event.target === mask) {
      closeModal(mask)
    }
  })
  document.body.appendChild(mask)
  return { mask, modal }
}

/** 构建表单字段 */
function buildField(labelText: string): { field: HTMLDivElement; input: HTMLInputElement } {
  const field = document.createElement('div')
  field.className = 'kala-modal__field'
  const label = document.createElement('label')
  label.className = 'kala-modal__label'
  label.textContent = labelText
  const input = document.createElement('input')
  input.className = 'kala-modal__input'
  field.append(label, input)
  return { field, input }
}

/** 构建底部按钮组（悬浮菜单确认弹窗等外部场景复用） */
export function buildFooter(
  modal: HTMLDivElement,
  buttons: Array<{ text: string; primary: boolean; onClick: () => void }>,
): void {
  const footer = document.createElement('div')
  footer.className = 'kala-modal__footer'
  for (const btn of buttons) {
    const button = document.createElement('button')
    button.className = btn.primary ? 'kala-modal__btn kala-modal__btn--primary' : 'kala-modal__btn kala-modal__btn--ghost'
    button.textContent = btn.text
    button.addEventListener('click', btn.onClick)
    footer.appendChild(button)
  }
  modal.appendChild(footer)
}

/** 构建卡片弹窗骨架：标题头（含关闭按钮）+ 内容容器 + footer 容器 */
function buildCardModalFrame(
  title: string,
  width: number,
  options?: { hideFooter?: boolean; hideHeader?: boolean; hideBody?: boolean },
): { mask: HTMLDivElement; modal: HTMLDivElement; body: HTMLDivElement; footer: HTMLDivElement } {
  const mask = document.createElement('div')
  mask.className = 'kala-modal-mask'
  const modal = document.createElement('div')
  modal.className = 'kala-modal kala-card-modal'
  modal.style.width = `${width}px`
  if (!options?.hideHeader) {
    const header = document.createElement('div')
    header.className = 'kala-card-modal__header'
    const titleEl = document.createElement('div')
    titleEl.className = 'kala-card-modal__title'
    titleEl.textContent = title
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'kala-card-modal__close'
    closeBtn.innerHTML = bdcIcon('BDC/close_line/1')
    closeBtn.addEventListener('click', () => closeModal(mask))
    header.append(titleEl, closeBtn)
    modal.appendChild(header)
  }
  const body = document.createElement('div')
  body.className = 'kala-card-modal__body'
  if (!options?.hideBody) {
    modal.appendChild(body)
  }
  const footer = document.createElement('div')
  footer.className = 'kala-card-modal__footer'
  if (!options?.hideFooter) {
    modal.appendChild(footer)
  }
  mask.appendChild(modal)
  mask.addEventListener('click', (event) => {
    if (event.target === mask) {
      closeModal(mask)
    }
  })
  document.body.appendChild(mask)
  return { mask, modal, body, footer }
}

/** 构建 footer 的取消 / 确定按钮（确定禁用由 confirmButton.disabled 控制） */
function buildCardFooter(
  footer: HTMLDivElement,
  onCancel: () => void,
  onConfirm: () => void,
): HTMLButtonElement {
  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'kala-card-modal__btn'
  cancelBtn.textContent = t('modal.cancel')
  cancelBtn.addEventListener('click', onCancel)
  const confirmBtn = document.createElement('button')
  confirmBtn.type = 'button'
  confirmBtn.className = 'kala-card-modal__btn kala-card-modal__btn--primary'
  confirmBtn.textContent = t('hoverMenu.confirm')
  confirmBtn.disabled = true
  confirmBtn.addEventListener('click', () => {
    if (!confirmBtn.disabled) {
      onConfirm()
    }
  })
  footer.append(cancelBtn, confirmBtn)
  return confirmBtn
}

/** 构建裸输入框（除评论外的卡片均为无 label 裸 input） */
function buildInput(placeholder: string, value: string): HTMLInputElement {
  const input = document.createElement('input')
  input.className = 'kala-modal__input'
  input.placeholder = placeholder
  input.value = value
  return input
}

/** 构建错误提示行（input 下方 12px 红字） */
function buildErrorLine(): HTMLDivElement {
  const error = document.createElement('div')
  error.className = 'kala-card-modal__error'
  error.textContent = ''
  return error
}

/** 表单标签行（链接地址* / 链接展示文字* 等，14px） */
function buildFormLabel(labelText: string): HTMLDivElement {
  const label = document.createElement('div')
  label.className = 'kala-card-modal__form-label'
  label.textContent = labelText
  const required = document.createElement('span')
  required.className = 'kala-card-modal__required'
  required.textContent = '*'
  label.appendChild(required)
  return label
}

/** 校验控制器：500ms debounce，校验中禁用确定，错误写入 errorLine */
interface ValidationController {
  schedule: (rawValue: string) => void
  dispose: () => void
}

function createValidationController(
  confirmBtn: HTMLButtonElement,
  errorLine: HTMLDivElement,
  validate: (value: string) => void,
): ValidationController {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = (rawValue: string): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    errorLine.textContent = ''
    const value = rawValue.trim()
    if (value.length === 0) {
      confirmBtn.disabled = true
      return
    }
    confirmBtn.disabled = true
    timer = setTimeout(() => validate(value), 500)
  }
  const dispose = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return { schedule, dispose }
}

/** 视频时长格式化：>=3600 用 hh:mm:ss（小时最多 3 位），否则 mm:ss */
function formatVideoTime(totalSeconds: number): string {
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const hourText = hours < 100 ? String(hours).padStart(2, '0') : String(hours)
    return `${hourText}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 站内链接正则工具 */
const URL_PATTERNS = {
  video: /(?:https?:\/\/(?:www\.)?bilibili\.com\/video\/)?(BV\w+|av\d+)/i,
  opus: /(?:https?:\/\/(?:www\.)?bilibili\.com\/(?:opus\/(\d+)|read\/cv(\d+)))|^\d+$/i,
  bangumi: /(?:https?:\/\/(?:www\.)?bilibili\.com\/bangumi\/play\/)?((?:ep|ss)\d+)/i,
  b23: /^https?:\/\/b23\.tv\/\w+/i,
  manga: /(?:https?:\/\/manga\.bilibili\.com\/detail\/)?mc(\d+)/i,
  music: /(?:https?:\/\/(?:www\.|m\.)?bilibili\.com\/audio\/)?au(\d+)/i,
  live: /(?:https?:\/\/live\.bilibili\.com\/)?(\d+)/,
  game: /(?:https?:\/\/(?:www\.)?bilibili\.com\/h5\/game-gateway\/home\?.*?game_base_id=(\d+))|gm(\d+)/i,
  comment: /^https?:\/\//,
}

/** 简单链接弹窗的规格 */
interface SimpleLinkSpec {
  /** 插入 / 编辑标题的 i18n key */
  insertTitleKey: string
  editTitleKey: string
  placeholderKey: string
  /** 校验失败时的错误 i18n key */
  invalidKey?: string
  /** 输入 → refId（返回空串表示无效） */
  extract: (raw: string) => string
  fetchType: CardType
  /** 拉取卡片信息（校验通过后调用，成功才启用确定） */
  fetch: (cardType: CardType, refId: string) => Promise<unknown>
}

/** 简单类型（裸 input + regex 校验 + 拉取信息启用确定）的通用弹窗 */
function openSimpleModal(spec: SimpleLinkSpec, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t(spec.editTitleKey) : t(spec.insertTitleKey), 352)
    const input = buildInput(t(spec.placeholderKey), existingRefId)
    const errorLine = buildErrorLine()
    body.append(input, errorLine)

    const finish = (result: CardModalResult | null): void => {
      controller.dispose()
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        const refId = spec.extract(input.value.trim())
        if (refId.length > 0) {
          finish({ refId })
        }
      },
    )

    const controller = createValidationController(confirmBtn, errorLine, (value) => {
      const refId = spec.extract(value)
      if (refId.length === 0) {
        errorLine.textContent = spec.invalidKey === undefined ? t('unrecognizedLink') : t(spec.invalidKey)
        return
      }
      spec
        .fetch(spec.fetchType, refId)
        .then(() => {
          errorLine.textContent = ''
          confirmBtn.disabled = false
        })
        .catch(() => {
          errorLine.textContent = t('networkRequestFailed')
        })
    })
    input.addEventListener('input', () => controller.schedule(input.value))
    if (isEdit) {
      controller.schedule(existingRefId)
    }
    input.focus()
  })
}

/** 自定义文案输入（图文 / 视频链接展示文字共用；受限内容禁改并包 tooltip） */
function buildCustomTextInput(
  restricted: boolean,
  value: string,
  onChange: (value: string) => void,
): { wrapper: HTMLDivElement; input: HTMLInputElement } {
  const wrapper = document.createElement('div')
  wrapper.className = 'kala-card-modal__form-item kala-card-modal__form-item--custom'
  const label = buildFormLabel(t('linkText'))
  const input = buildInput(t('linkTextPlaceholder'), value)
  if (restricted) {
    input.disabled = true
    wrapper.title = t('paidContentNoEdit')
    wrapper.classList.add('kala-card-modal__form-item--restricted')
  } else {
    input.addEventListener('input', () => onChange(input.value))
  }
  wrapper.append(label, input)
  return { wrapper, input }
}

/** 评论卡弹窗：链接地址* + 帮助 tooltip + 校验 */
function openCommentModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editComment') : t('insertComment'), 352)
    body.classList.add('kala-card-modal__body--labeled')

    // 标题行：链接地址* + 帮助入口（悬停弹出 430px tooltip）
    const titleRow = document.createElement('div')
    titleRow.className = 'kala-card-modal__title-row'
    const labelWrap = document.createElement('div')
    labelWrap.className = 'kala-card-modal__title-text'
    labelWrap.textContent = t('linkAddress')
    const required = document.createElement('span')
    required.className = 'kala-card-modal__required'
    required.textContent = '*'
    labelWrap.appendChild(required)

    const helpSection = document.createElement('div')
    helpSection.className = 'kala-card-modal__help'
    const helpIcon = document.createElement('span')
    helpIcon.className = 'kala-card-modal__help-icon'
    helpIcon.innerHTML = bdcIcon('BDC/question_help_circle_line/2')
    const helpText = document.createElement('span')
    helpText.className = 'kala-card-modal__help-text'
    helpText.textContent = t('howToGetCommentLink')
    helpSection.append(helpIcon, helpText)
    const tooltip = document.createElement('div')
    tooltip.className = 'kala-card-modal__tooltip'
    const tipText = document.createElement('div')
    tipText.className = 'kala-card-modal__tooltip-text'
    tipText.textContent = t('copyCommentLinkSteps')
    const tipImage = document.createElement('img')
    tipImage.src = '//s1.hdslb.com/bfs/static/jinkela/long/editor-card-static/show-copy-link.png'
    tipImage.alt = t('copyCommentLinkGuide')
    tooltip.append(tipText, tipImage)
    helpSection.appendChild(tooltip)
    titleRow.append(labelWrap, helpSection)

    const input = buildInput(t('commentLinkPlaceholder'), existingRefId)
    const errorLine = buildErrorLine()
    body.append(titleRow, input, errorLine)

    const finish = (result: CardModalResult | null): void => {
      controller.dispose()
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        const refId = input.value.trim()
        if (refId.length > 0) {
          finish({ refId })
        }
      },
    )

    const controller = createValidationController(confirmBtn, errorLine, (value) => {
      if (!URL_PATTERNS.comment.test(value)) {
        // 原版：非评论链接时错误文案复用 placeholder 文案
        errorLine.textContent = t('commentLinkPlaceholder')
        return
      }
      api
        .fetchCardInfo('comment', value)
        .then(() => {
          errorLine.textContent = ''
          confirmBtn.disabled = false
        })
        .catch(() => {
          errorLine.textContent = t('networkRequestFailed')
        })
    })
    input.addEventListener('input', () => controller.schedule(input.value))
    if (isEdit) {
      controller.schedule(existingRefId)
    }
    input.focus()
  })
}

/** 图文弹窗：裸 input + 编辑态自定义文案（充电内容禁改） */
function openArticleModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editArticle') : t('insertArticle'), 352)
    const input = buildInput(t('articleLinkPlaceholder'), existingRefId)
    const errorLine = buildErrorLine()
    body.append(input, errorLine)

    let customText = ''
    const finish = (result: CardModalResult | null): void => {
      controller.dispose()
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        const raw = input.value.trim()
        const matched = URL_PATTERNS.opus.exec(raw)
        const refId = matched === null ? '' : (matched[1] ?? matched[2] ?? matched[0])
        if (refId.length > 0) {
          finish({ refId, showText: customText.trim().length > 0 ? customText.trim() : undefined })
        }
      },
    )

    // 编辑态追加自定义文案输入（原版仅编辑纯链接时出现）
    if (isEdit) {
      const custom = buildCustomTextInput(false, '', (value) => {
        customText = value
      })
      body.appendChild(custom.wrapper)
    }

    const controller = createValidationController(confirmBtn, errorLine, (value) => {
      const matched = URL_PATTERNS.opus.exec(value)
      const refId = matched === null ? '' : (matched[1] ?? matched[2] ?? matched[0])
      if (refId.length === 0) {
        errorLine.textContent = t('articleLinkPlaceholder')
        return
      }
      api
        .fetchCardInfo('opus', refId)
        .then(() => {
          errorLine.textContent = ''
          confirmBtn.disabled = false
        })
        .catch(() => {
          errorLine.textContent = t('networkRequestFailed')
        })
    })
    input.addEventListener('input', () => controller.schedule(input.value))
    if (isEdit) {
      controller.schedule(existingRefId)
    }
    input.focus()
  })
}

/** Toy 弹窗：裸 input + 校验成功后的预览条（poster 120×120 + 标题） */
function openToyModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editToy') : t('insertToy'), 352)
    const input = buildInput(t('toyLinkPlaceholder'), existingRefId)
    const errorLine = buildErrorLine()
    body.append(input, errorLine)

    const finish = (result: CardModalResult | null): void => {
      controller.dispose()
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        const raw = input.value.trim()
        const matched = /(\d+)/.exec(raw)
        if (matched !== null) {
          finish({ refId: matched[1] })
        }
      },
    )

    const controller = createValidationController(confirmBtn, errorLine, (value) => {
      const matched = /(\d+)/.exec(value)
      if (matched === null) {
        errorLine.textContent = t('unrecognizedLink')
        return
      }
      api
        .fetchCardInfo('toy', matched[1])
        .then((info) => {
          errorLine.textContent = ''
          confirmBtn.disabled = false
          const old = body.querySelector('.kala-card-modal__toy-preview')
          if (old !== null) {
            old.remove()
          }
          const preview = document.createElement('div')
          preview.className = 'kala-card-modal__toy-preview'
          const poster = document.createElement('img')
          poster.className = 'kala-card-modal__toy-poster'
          poster.src = info.cover
          poster.alt = ''
          const title = document.createElement('div')
          title.className = 'kala-card-modal__toy-title'
          title.textContent = info.title
          preview.append(poster, title)
          body.appendChild(preview)
        })
        .catch(() => {
          errorLine.textContent = t('networkRequestFailed')
        })
    })
    input.addEventListener('input', () => controller.schedule(input.value))
    if (isEdit) {
      controller.schedule(existingRefId)
    }
    input.focus()
  })
}

/** 视频条目（下拉 / 收藏面板共用）：缩略图 128×72 + 角标 + 时长 + 标题 + 两行 meta */
function buildVideoItem(item: VideoPostItem, selected: boolean, onClick: () => void): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `kala-video-item${selected ? ' selected' : ''}`
  const thumb = document.createElement('div')
  thumb.className = 'kala-video-item__thumbnail'
  if (item.cornerBadge.length > 0) {
    const badge = document.createElement('div')
    badge.className = 'kala-video-item__corner-badge'
    badge.textContent = item.cornerBadge
    thumb.appendChild(badge)
  }
  const img = document.createElement('img')
  img.src = item.cover
  img.alt = ''
  thumb.appendChild(img)
  const duration = document.createElement('div')
  duration.className = 'kala-video-item__duration'
  duration.textContent = formatVideoTime(item.duration)
  thumb.appendChild(duration)
  const info = document.createElement('div')
  info.className = 'kala-video-item__info'
  const title = document.createElement('div')
  title.className = 'kala-video-item__title'
  title.textContent = item.title
  const meta1 = document.createElement('div')
  meta1.className = 'kala-video-item__meta'
  meta1.innerHTML = `${bdcIcon('BDC/uploader_name_square_line/1')}<span></span>`
  const meta1Text = meta1.querySelector('span')
  if (meta1Text !== null) {
    meta1Text.textContent = item.author
  }
  const meta2 = document.createElement('div')
  meta2.className = 'kala-video-item__meta'
  meta2.innerHTML = `${bdcIcon('BDC/playdata_square_line/1')}<span></span> · <i class="kala-video-item__date"></i>`
  const meta2Text = meta2.querySelector('span')
  if (meta2Text !== null) {
    meta2Text.textContent = `${item.view}观看`
  }
  const dateEl = meta2.querySelector('.kala-video-item__date')
  if (dateEl !== null) {
    dateEl.textContent = item.pubdate
  }
  info.append(title, meta1, meta2)
  el.append(thumb, info)
  el.addEventListener('click', onClick)
  return el
}

/** 从 data JSON 解析 info 对象（供视频时长 / 受限判断与名片插入使用） */
export function parseCardInfoData(data: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(data.length > 0 ? data : '{}')
    if (parsed !== null && typeof parsed === 'object' && 'info' in parsed) {
      const info = (parsed as { info: unknown })['info']
      return info !== null && typeof info === 'object' ? (info as Record<string, unknown>) : {}
    }
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** tab 栏条目 */
interface TabItem {
  key: string
  label: string
  el: HTMLDivElement
}

/** 构建 tab 栏并绑定切换（renderTab 由各弹窗提供，切 tab 后刷新确定禁用态） */
function buildTabs(
  tabsEl: HTMLDivElement,
  items: Array<{ key: string; label: string }>,
  getActive: () => string,
  onSwitch: (key: string) => void,
): TabItem[] {
  const tabItems: TabItem[] = []
  for (const item of items) {
    const el = document.createElement('div')
    el.className = 'kala-card-modal__tab'
    el.textContent = item.label
    el.addEventListener('click', () => {
      onSwitch(item.key)
    })
    tabItems.push({ key: item.key, label: item.label, el })
    tabsEl.appendChild(el)
  }
  const sync = (): void => {
    for (const item of tabItems) {
      item.el.classList.toggle('active', item.key === getActive())
    }
  }
  sync()
  return tabItems
}

/** 视频弹窗（video / topVideo 共用）：链接添加 / 我的投稿 / 我的收藏 三个 tab */
function openVideoModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editVideo') : t('insertVideo'), 400)
    body.classList.add('kala-card-modal__body--tabs')

    const tabs = document.createElement('div')
    tabs.className = 'kala-card-modal__tabs'
    const content = document.createElement('div')
    content.className = 'kala-card-modal__tab-content'
    body.append(tabs, content)

    let activeTab = 'link'
    let disposed = false

    const finish = (result: CardModalResult | null): void => {
      if (disposed) {
        return
      }
      disposed = true
      linkController.dispose()
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        if (activeTab === 'link') {
          const raw = linkInput.value.trim()
          const matched = URL_PATTERNS.video.exec(raw)
          if (matched !== null) {
            const refId = matched[1] + timeSuffix
            finish({ refId, showText: linkCustomText.trim().length > 0 ? linkCustomText.trim() : undefined })
          }
        } else if (activeTab === 'my-posts' && selectedPost !== null) {
          finish({ refId: selectedPost.bvid + timeSuffix })
        } else if (activeTab === 'my-favorites' && selectedFavoriteVideo !== null) {
          finish({ refId: selectedFavoriteVideo.bvid + timeSuffix })
        }
      },
    )

    /** 由 refId 中的 ?t= 解析起始时间（编辑态预填） */
    const parseTimeSuffix = (refId: string): number => {
      const matched = /\?t=(\d+)/.exec(refId)
      return matched === null ? 0 : Number(matched[1])
    }
    let timeSuffix = ''
    const initialTime = isEdit ? parseTimeSuffix(existingRefId) : 0

    // ===== 链接 tab =====
    let linkCustomText = ''
    let currentDuration = 0
    let startTime = initialTime
    let restricted = false
    let customInput: HTMLInputElement | null = null
    const linkPane = document.createElement('div')
    linkPane.className = 'kala-card-modal__pane'

    const linkItem = document.createElement('div')
    linkItem.className = 'kala-card-modal__form-item'
    linkItem.appendChild(buildFormLabel(t('linkAddress')))
    const linkInput = buildInput(t('videoLinkPlaceholder'), isEdit ? (existingRefId.split('?')[0] ?? existingRefId) : '')
    const linkError = buildErrorLine()
    const linkInputWrap = document.createElement('div')
    linkInputWrap.className = 'kala-card-modal__input-wrap'
    linkInputWrap.append(linkInput, linkError)
    linkItem.appendChild(linkInputWrap)
    linkPane.appendChild(linkItem)

    // 起始时间选择器（duration<=0 时禁用；hh:mm:ss / mm:ss 自适应）
    const timeItem = document.createElement('div')
    timeItem.className = 'kala-card-modal__form-item'
    timeItem.appendChild(buildFormLabel(t('videoStartTime')))
    const timeInput = buildInput('', '')
    timeInput.disabled = true
    const timeError = buildErrorLine()
    const timeWrap = document.createElement('div')
    timeWrap.className = 'kala-card-modal__input-wrap'
    timeWrap.append(timeInput, timeError)
    timeItem.appendChild(timeWrap)
    linkPane.appendChild(timeItem)

    const syncTimeState = (): void => {
      timeInput.disabled = currentDuration <= 0
      timeInput.value = startTime > 0 ? formatVideoTime(startTime) : ''
    }
    syncTimeState()

    timeInput.addEventListener('input', () => {
      const raw = timeInput.value.trim()
      timeError.textContent = ''
      timeSuffix = ''
      if (raw.length === 0) {
        startTime = 0
        syncTimeState()
        confirmBtn.disabled = linkInput.value.trim().length === 0
        return
      }
      if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(raw)) {
        const expect = currentDuration >= 3600 ? 'hh:mm:ss' : 'mm:ss'
        timeError.textContent = t('invalidTimeFormat').replace('{$0}', expect)
        return
      }
      const parts = raw.split(':').map((part) => Number(part))
      const seconds =
        parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + (parts[2] ?? 0) : parts[0] * 60 + (parts[1] ?? 0)
      if (currentDuration > 0 && seconds > currentDuration - 1) {
        timeError.textContent = t('startTimeExceed').replace('{$0}', formatVideoTime(currentDuration - 1))
        return
      }
      startTime = seconds
      timeSuffix = `?t=${seconds}`
      confirmBtn.disabled = linkInput.value.trim().length === 0
    })

    const linkController = createValidationController(confirmBtn, linkError, (value) => {
      const matched = URL_PATTERNS.video.exec(value)
      const refId = matched === null ? '' : matched[1]
      if (refId.length === 0) {
        linkError.textContent = t('invalidVideoLink')
        return
      }
      api
        .fetchCardInfo('video', refId)
        .then((info) => {
          const infoObj = parseCardInfoData(info.data)
          const videoTs = infoObj['video_ts']
          currentDuration =
            videoTs !== null && typeof videoTs === 'object' && 'duration' in videoTs
              ? Number((videoTs as { duration: unknown })['duration'])
              : Number(infoObj['duration'] ?? 0)
          restricted =
            infoObj['is_only_fans'] === true ||
            infoObj['isOnlyFans'] === true ||
            Number(infoObj['media_type'] ?? 0) === 2
          linkError.textContent = ''
          syncTimeState()
          confirmBtn.disabled = false
          // 校验成功后追加链接展示文字输入（受限内容禁改）
          if (customInput === null) {
            const custom = buildCustomTextInput(restricted, linkCustomText, (inputValue) => {
              linkCustomText = inputValue
            })
            customInput = custom.input
            linkPane.appendChild(custom.wrapper)
          } else if (restricted) {
            customInput.disabled = true
          }
        })
        .catch(() => {
          linkError.textContent = t('networkRequestFailed')
        })
    })
    linkInput.addEventListener('input', () => {
      linkController.schedule(linkInput.value)
      startTime = 0
      timeSuffix = ''
      currentDuration = 0
      syncTimeState()
    })
    if (isEdit && linkInput.value.trim().length > 0) {
      linkController.schedule(linkInput.value)
    }

    // ===== 我的投稿 tab =====
    let selectedPost: VideoPostItem | null = null
    let postsList: VideoPostItem[] = []
    const postsPane = document.createElement('div')
    postsPane.className = 'kala-card-modal__pane'

    const postsItem = document.createElement('div')
    postsItem.className = 'kala-card-modal__form-item'
    postsItem.appendChild(buildFormLabel(t('selectVideo')))
    const postsSelector = document.createElement('div')
    postsSelector.className = 'kala-card-modal__dropdown-selector'
    const postsSelectorText = document.createElement('span')
    postsSelectorText.textContent = t('pleaseSelect')
    const postsArrow = document.createElement('span')
    postsArrow.className = 'kala-card-modal__dropdown-arrow'
    postsArrow.innerHTML = bdcIcon('BDC/arrow_collapse_line/5')
    postsSelector.append(postsSelectorText, postsArrow)
    const postsDropdown = document.createElement('div')
    postsDropdown.className = 'kala-card-modal__dropdown-list'
    postsDropdown.style.display = 'none'
    const postsWrap = document.createElement('div')
    postsWrap.className = 'kala-card-modal__dropdown-container'
    postsWrap.append(postsSelector, postsDropdown)
    postsItem.appendChild(postsWrap)
    postsPane.appendChild(postsItem)

    const renderPostsList = (): void => {
      postsDropdown.replaceChildren()
      for (const post of postsList) {
        postsDropdown.appendChild(
          buildVideoItem(post, selectedPost !== null && post.bvid === selectedPost.bvid, () => {
            selectedPost = post
            postsSelectorText.textContent = post.title
            postsDropdown.style.display = 'none'
            postsArrow.classList.remove('open')
            confirmBtn.disabled = false
          }),
        )
      }
      const more = document.createElement('div')
      more.className = 'kala-card-modal__list-more'
      more.textContent = t('noMore')
      postsDropdown.appendChild(more)
    }

    postsSelector.addEventListener('click', () => {
      const open = postsDropdown.style.display === 'none'
      postsDropdown.style.display = open ? 'block' : 'none'
      postsArrow.classList.toggle('open', open)
      if (open && postsList.length === 0) {
        postsDropdown.replaceChildren()
        const loading = document.createElement('div')
        loading.className = 'kala-card-modal__list-loading'
        loading.textContent = t('loadingPosts')
        postsDropdown.appendChild(loading)
        api
          .fetchMyPosts()
          .then((list) => {
            if (disposed) {
              return
            }
            postsList = list
            renderPostsList()
          })
          .catch(() => {
            postsDropdown.replaceChildren()
            const failed = document.createElement('div')
            failed.className = 'kala-card-modal__list-loading'
            failed.textContent = t('postsLoadFailed')
            postsDropdown.appendChild(failed)
          })
      }
    })

    // ===== 我的收藏 tab =====
    let selectedFavoriteVideo: VideoPostItem | null = null
    const favoritesPane = document.createElement('div')
    favoritesPane.className = 'kala-card-modal__pane'

    const favSelector = document.createElement('div')
    favSelector.className = 'kala-card-modal__dropdown-selector'
    const favSelectorText = document.createElement('span')
    favSelectorText.textContent = t('selectFavorite')
    const favArrow = document.createElement('span')
    favArrow.className = 'kala-card-modal__dropdown-arrow'
    favArrow.innerHTML = bdcIcon('BDC/arrow_collapse_line/5')
    favSelector.append(favSelectorText, favArrow)
    const favPanel = document.createElement('div')
    favPanel.className = 'kala-card-modal__favorite-panel'
    favPanel.style.display = 'none'
    const favNav = document.createElement('div')
    favNav.className = 'kala-card-modal__favorite-nav'
    const favVideos = document.createElement('div')
    favVideos.className = 'kala-card-modal__favorite-videos'
    favPanel.append(favNav, favVideos)
    const favWrap = document.createElement('div')
    favWrap.className = 'kala-card-modal__dropdown-container'
    favWrap.append(favSelector, favPanel)
    favoritesPane.appendChild(favWrap)

    const renderFavoriteVideos = (folderId: string): void => {
      favVideos.replaceChildren()
      const loading = document.createElement('div')
      loading.className = 'kala-card-modal__list-loading'
      loading.textContent = t('loadingVideos')
      favVideos.appendChild(loading)
      api
        .fetchFavoriteVideos(folderId)
        .then((list) => {
          if (disposed) {
            return
          }
          favVideos.replaceChildren()
          if (list.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'kala-card-modal__list-loading'
            empty.textContent = t('favoriteEmpty')
            favVideos.appendChild(empty)
            return
          }
          for (const video of list) {
            favVideos.appendChild(
              buildVideoItem(video, selectedFavoriteVideo !== null && video.bvid === selectedFavoriteVideo.bvid, () => {
                selectedFavoriteVideo = video
                confirmBtn.disabled = false
                favPanel.style.display = 'none'
                favArrow.classList.remove('open')
              }),
            )
          }
          const more = document.createElement('div')
          more.className = 'kala-card-modal__list-more'
          more.textContent = t('noMore')
          favVideos.appendChild(more)
        })
        .catch(() => {
          favVideos.replaceChildren()
          const failed = document.createElement('div')
          failed.className = 'kala-card-modal__list-loading'
          failed.textContent = t('favoritesLoadFailed')
          favVideos.appendChild(failed)
        })
    }

    favSelector.addEventListener('click', () => {
      const open = favPanel.style.display === 'none'
      favPanel.style.display = open ? 'flex' : 'none'
      favArrow.classList.toggle('open', open)
      if (open && favNav.children.length === 0) {
        favNav.replaceChildren()
        const loading = document.createElement('div')
        loading.className = 'kala-card-modal__list-loading'
        loading.textContent = t('loadingFavorites')
        favNav.appendChild(loading)
        api
          .fetchMyFavorites()
          .then((folders) => {
            if (disposed) {
              return
            }
            favNav.replaceChildren()
            for (const folder of folders) {
              const item = document.createElement('div')
              item.className = 'kala-card-modal__favorite-item'
              const title = document.createElement('span')
              title.className = 'kala-card-modal__favorite-title'
              title.textContent = folder.title
              const count = document.createElement('span')
              count.className = 'kala-card-modal__favorite-count'
              count.textContent = String(folder.count)
              item.append(title, count)
              item.addEventListener('click', (event) => {
                event.stopPropagation()
                for (const sibling of Array.from(favNav.children)) {
                  sibling.classList.remove('selected')
                }
                item.classList.add('selected')
                favSelectorText.textContent = folder.title
                renderFavoriteVideos(folder.id)
              })
              favNav.appendChild(item)
            }
          })
          .catch(() => {
            favNav.replaceChildren()
            const failed = document.createElement('div')
            failed.className = 'kala-card-modal__list-loading'
            failed.textContent = t('favoritesLoadFailed')
            favNav.appendChild(failed)
          })
      }
    })

    // tab 切换与确定禁用态联动
    const renderTab = (): void => {
      content.replaceChildren()
      content.appendChild(
        activeTab === 'link' ? linkPane : activeTab === 'my-posts' ? postsPane : favoritesPane,
      )
      confirmBtn.disabled =
        activeTab === 'link'
          ? linkInput.value.trim().length === 0
          : activeTab === 'my-posts'
            ? selectedPost === null
            : selectedFavoriteVideo === null
    }
    buildTabs(tabs, [
      { key: 'link', label: t('addByLink') },
      { key: 'my-posts', label: t('myPosts') },
      { key: 'my-favorites', label: t('myFavorites') },
    ], () => activeTab, (key) => {
      activeTab = key
      renderTab()
    })
    renderTab()
  })
}

export interface LinkModalResult {
  href: string
  text: string
  remove: boolean
}

/** 链接弹窗（插入 / 编辑共用；editing 时预填并显示移除按钮） */
export function openLinkModal(existing: { href: string; text: string } | null): Promise<LinkModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existing !== null
    const { mask, modal } = buildModal(isEdit ? t('modal.link.editTitle') : t('modal.link.title'))

    const urlField = buildField(t('modal.link.urlLabel'))
    urlField.input.placeholder = t('modal.link.urlPlaceholder')
    if (isEdit) {
      urlField.input.value = existing.href
    }
    const textField = buildField(t('modal.link.textLabel'))
    if (isEdit) {
      textField.input.value = existing.text
    }
    const error = document.createElement('div')
    error.className = 'kala-modal__error'
    error.textContent = ''
    modal.append(urlField.field, textField.field, error)

    const finish = (result: LinkModalResult | null) => {
      closeModal(mask)
      resolve(result)
    }

    buildFooter(modal, [
      {
        text: t('modal.cancel'),
        primary: false,
        onClick: () => finish(null),
      },
      ...(isEdit
        ? [
            {
              text: t('modal.link.remove'),
              primary: false,
              onClick: () => finish({ href: '', text: '', remove: true }),
            },
          ]
        : []),
      {
        text: isEdit ? t('modal.save') : t('modal.insert'),
        primary: true,
        onClick: () => {
          const href = urlField.input.value.trim()
          if (href.length === 0) {
            error.textContent = t('modal.error.emptyUrl')
            return
          }
          finish({
            href,
            text: textField.input.value.trim(),
            remove: false,
          })
        },
      },
    ])

    urlField.input.focus()
  })
}

/** 公式弹窗（katex 实时预览；编辑时预填 formula） */
export function openLatexModal(existingFormula: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    const isEdit = existingFormula !== null
    const { mask, modal } = buildModal(isEdit ? t('modal.latex.editTitle') : t('modal.latex.title'))

    const field = document.createElement('div')
    field.className = 'kala-modal__field'
    const label = document.createElement('label')
    label.className = 'kala-modal__label'
    label.textContent = 'LaTeX'
    const textarea = document.createElement('textarea')
    textarea.className = 'kala-modal__textarea'
    textarea.rows = 4
    textarea.spellcheck = false
    if (isEdit) {
      textarea.value = existingFormula
    }
    field.append(label, textarea)

    const previewTitle = document.createElement('div')
    previewTitle.className = 'kala-modal__label'
    previewTitle.textContent = t('modal.latex.preview')
    const preview = document.createElement('div')
    preview.className = 'kala-modal__preview'

    const renderPreview = (): void => {
      try {
        preview.innerHTML = katex.renderToString(textarea.value, {
          displayMode: true,
          throwOnError: false,
        })
      } catch {
        preview.textContent = textarea.value
      }
    }
    textarea.addEventListener('input', renderPreview)
    renderPreview()

    const error = document.createElement('div')
    error.className = 'kala-modal__error'

    modal.append(field, previewTitle, preview, error)

    const finish = (formula: string | null) => {
      closeModal(mask)
      resolve(formula)
    }

    buildFooter(modal, [
      { text: t('modal.cancel'), primary: false, onClick: () => finish(null) },
      {
        text: isEdit ? t('modal.save') : t('modal.insert'),
        primary: true,
        onClick: () => {
          const formula = textarea.value.trim()
          if (formula.length === 0) {
            error.textContent = t('modal.error.emptyFormula')
            return
          }
          finish(formula)
        },
      },
    ])

    textarea.focus()
  })
}

export interface ImageModalResult {
  src: string
  caption: string
  align: 'left' | 'center'
}

/** 图片弹窗：URL 输入 + 本地上传 + 注释 + 对齐 */
export function openImageModal(uploadImage: (file: File) => Promise<{ src: string }>): Promise<ImageModalResult | null> {
  return new Promise((resolve) => {
    const { mask, modal } = buildModal(t('modal.image.title'))

    const urlField = buildField(t('modal.image.urlLabel'))
    const uploadRow = document.createElement('div')
    uploadRow.className = 'kala-modal__field'
    const uploadBtn = document.createElement('button')
    uploadBtn.className = 'kala-modal__btn kala-modal__btn--ghost'
    uploadBtn.textContent = t('modal.image.upload')
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    uploadBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (file !== undefined) {
        uploadBtn.textContent = t('image.uploading')
        uploadBtn.disabled = true
        uploadImage(file)
          .then((result) => {
            urlField.input.value = result.src
          })
          .catch(() => {
            uploadBtn.textContent = t('image.uploadFailed')
          })
          .finally(() => {
            uploadBtn.disabled = false
            uploadBtn.textContent = t('modal.image.upload')
          })
      }
    })
    uploadRow.append(uploadBtn, fileInput)

    const captionField = buildField(t('modal.image.caption'))

    const alignField = document.createElement('div')
    alignField.className = 'kala-modal__field'
    const alignLabel = document.createElement('label')
    alignLabel.className = 'kala-modal__label'
    alignLabel.textContent = t('modal.image.align')
    const select = document.createElement('select')
    select.className = 'kala-modal__input'
    for (const [value, text] of [
      ['left', t('modal.image.alignLeft')],
      ['center', t('modal.image.alignCenter')],
    ] as const) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      select.appendChild(option)
    }
    alignField.append(alignLabel, select)

    const error = document.createElement('div')
    error.className = 'kala-modal__error'
    modal.append(urlField.field, uploadRow, captionField.field, alignField, error)

    const finish = (result: ImageModalResult | null) => {
      closeModal(mask)
      resolve(result)
    }

    buildFooter(modal, [
      { text: t('modal.cancel'), primary: false, onClick: () => finish(null) },
      {
        text: t('modal.insert'),
        primary: true,
        onClick: () => {
          const src = urlField.input.value.trim()
          if (src.length === 0) {
            error.textContent = t('modal.error.emptyUrl')
            return
          }
          finish({
            src,
            caption: captionField.input.value.trim(),
            align: select.value === 'center' ? 'center' : 'left',
          })
        },
      },
    ])

    urlField.input.focus()
  })
}

/** 游戏弹窗：链接添加 / 搜索添加 两个 tab（搜索 300ms debounce） */
function openGameModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editGame') : t('insertGame'), 400)
    body.classList.add('kala-card-modal__body--tabs')

    const tabs = document.createElement('div')
    tabs.className = 'kala-card-modal__tabs'
    const content = document.createElement('div')
    content.className = 'kala-card-modal__tab-content'
    body.append(tabs, content)

    let activeTab = 'link'
    let disposed = false
    let gameId = ''

    const finish = (result: CardModalResult | null): void => {
      if (disposed) {
        return
      }
      disposed = true
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        if (activeTab === 'link' && gameId.length > 0) {
          finish({ refId: gameId })
        } else if (activeTab === 'search' && selectedGame !== null) {
          finish({ refId: `gm${selectedGame.gameBaseId}` })
        }
      },
    )

    // ===== 链接 tab =====
    const linkPane = document.createElement('div')
    linkPane.className = 'kala-card-modal__pane'
    const linkInput = buildInput(t('inputGameLink'), isEdit ? existingRefId : '')
    const linkError = buildErrorLine()
    linkPane.append(linkInput, linkError)

    /** gm123 或站内 / biligame 游戏链接 → gm123 */
    const validateGameLink = (value: string): string => {
      const gmMatch = /^gm(\d+)$/i.exec(value)
      if (gmMatch !== null) {
        return `gm${gmMatch[1]}`
      }
      const urlMatch = URL_PATTERNS.game.exec(value)
      if (urlMatch !== null) {
        const id = urlMatch[1] ?? urlMatch[2] ?? ''
        return id.length > 0 ? `gm${id}` : ''
      }
      return ''
    }
    linkInput.addEventListener('input', () => {
      linkError.textContent = ''
      confirmBtn.disabled = true
      gameId = ''
      const raw = linkInput.value.trim()
      if (raw.length === 0) {
        return
      }
      const id = validateGameLink(raw)
      if (id.length === 0) {
        linkError.textContent = t('invalidGameLink')
        return
      }
      gameId = id
      api
        .fetchCardInfo('game', id)
        .then(() => {
          linkError.textContent = ''
          confirmBtn.disabled = false
        })
        .catch(() => {
          linkError.textContent = t('gameInfoFailed')
        })
    })
    if (isEdit && linkInput.value.trim().length > 0) {
      linkInput.dispatchEvent(new Event('input'))
    }

    // ===== 搜索 tab =====
    let selectedGame: { gameBaseId: string; name: string; icon: string } | null = null
    let searchTimer: ReturnType<typeof setTimeout> | null = null
    const searchPane = document.createElement('div')
    searchPane.className = 'kala-card-modal__pane kala-card-modal__search-container'
    const searchInput = buildInput(t('searchGameName'), '')
    const searchList = document.createElement('div')
    searchList.className = 'kala-card-modal__search-list'
    searchList.style.display = 'none'
    searchPane.append(searchInput, searchList)

    const renderSelectedGame = (): void => {
      searchList.style.display = 'none'
      const old = searchPane.querySelector('.kala-card-modal__selected-wrapper')
      if (old !== null) {
        old.remove()
      }
      if (selectedGame === null) {
        return
      }
      const wrapper = document.createElement('div')
      wrapper.className = 'kala-card-modal__selected-wrapper'
      const contentEl = document.createElement('div')
      contentEl.className = 'kala-card-modal__selected-content'
      const icon = document.createElement('img')
      icon.className = 'kala-card-modal__selected-thumb'
      icon.src = selectedGame.icon
      icon.alt = selectedGame.name
      const name = document.createElement('div')
      name.className = 'kala-card-modal__selected-name'
      name.textContent = selectedGame.name
      contentEl.append(icon, name)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'kala-card-modal__selected-remove'
      remove.innerHTML = bdcIcon('BDC/xmark_close_circle_fill/1')
      remove.addEventListener('click', () => {
        selectedGame = null
        confirmBtn.disabled = true
        renderSelectedGame()
      })
      wrapper.append(contentEl, remove)
      searchPane.appendChild(wrapper)
    }

    searchInput.addEventListener('input', () => {
      if (searchTimer !== null) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
      const raw = searchInput.value.trim()
      if (raw.length === 0) {
        searchList.style.display = 'none'
        return
      }
      searchTimer = setTimeout(() => {
        searchList.replaceChildren()
        searchList.style.display = 'block'
        const loading = document.createElement('div')
        loading.className = 'kala-card-modal__list-loading'
        loading.textContent = t('searching')
        searchList.appendChild(loading)
        api
          .searchGames(raw)
          .then((list) => {
            if (disposed) {
              return
            }
            searchList.replaceChildren()
            if (list.length === 0) {
              const empty = document.createElement('div')
              empty.className = 'kala-card-modal__list-loading'
              empty.textContent = t('noSearchResults')
              searchList.appendChild(empty)
              return
            }
            for (const game of list) {
              const item = document.createElement('div')
              item.className = `kala-card-modal__game-item${selectedGame !== null && game.gameBaseId === selectedGame.gameBaseId ? ' selected' : ''}`
              const icon = document.createElement('img')
              icon.className = 'kala-card-modal__game-icon'
              icon.src = game.icon
              icon.alt = game.name
              const info = document.createElement('div')
              info.className = 'kala-card-modal__game-info'
              const title = document.createElement('div')
              title.className = 'kala-card-modal__game-title'
              title.textContent = game.name
              info.appendChild(title)
              item.append(icon, info)
              item.addEventListener('click', () => {
                selectedGame = { gameBaseId: game.gameBaseId, name: game.name, icon: game.icon }
                confirmBtn.disabled = false
                renderSelectedGame()
              })
              searchList.appendChild(item)
            }
          })
          .catch(() => {
            searchList.replaceChildren()
          })
      }, 300)
    })

    const renderTab = (): void => {
      content.replaceChildren()
      content.appendChild(activeTab === 'link' ? linkPane : searchPane)
      confirmBtn.disabled = activeTab === 'link' ? gameId.length === 0 : selectedGame === null
    }
    buildTabs(tabs, [
      { key: 'link', label: t('addByLink') },
      { key: 'search', label: t('searchAdd') },
    ], () => activeTab, (key) => {
      activeTab = key
      renderTab()
    })
    renderTab()
  })
}

/** 名片弹窗：链接添加（粘贴主页链接 / UID）/ 搜索添加；确认固定 inline 形态 */
function openUserModal(api: EditorApi, existingRefId: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editUser') : t('insertUser'), 400)
    body.classList.add('kala-card-modal__body--tabs')

    const tabs = document.createElement('div')
    tabs.className = 'kala-card-modal__tabs'
    const content = document.createElement('div')
    content.className = 'kala-card-modal__tab-content'
    body.append(tabs, content)

    // 编辑态强制 manual tab（原版：编辑态 manual + inline）
    let activeTab = 'manual'
    let disposed = false

    const finish = (result: CardModalResult | null): void => {
      if (disposed) {
        return
      }
      disposed = true
      closeModal(mask)
      resolve(result === null ? null : { ...result, displayMode: 'inline' })
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        if (activeTab === 'manual' && manualUid.length > 0) {
          finish({ refId: manualUid })
        } else if (activeTab === 'search' && selectedUser !== null) {
          finish({ refId: selectedUser.id })
        }
      },
    )

    // ===== 链接添加 tab：粘贴用户主页链接或输入 UID =====
    let manualUid = ''
    const manualPane = document.createElement('div')
    manualPane.className = 'kala-card-modal__pane'
    const manualInput = buildInput(t('pasteUserLink'), isEdit ? existingRefId : '')
    const manualError = buildErrorLine()
    manualPane.append(manualInput, manualError)

    /** 从输入解析 UID：纯数字 / space.bilibili.com/123 */
    const extractUid = (raw: string): string => {
      const space = /space\.bilibili\.com\/(\d+)/i.exec(raw)
      if (space !== null) {
        return space[1]
      }
      if (/^\d+$/.test(raw)) {
        return raw
      }
      return ''
    }
    manualInput.addEventListener('input', () => {
      manualError.textContent = ''
      confirmBtn.disabled = true
      manualUid = ''
      const raw = manualInput.value.trim()
      if (raw.length === 0) {
        return
      }
      const uid = extractUid(raw)
      if (uid.length === 0) {
        manualError.textContent = t('invalidUserLink')
        return
      }
      api
        .fetchCardInfo('user', uid)
        .then(() => {
          manualUid = uid
          manualError.textContent = ''
          confirmBtn.disabled = false
        })
        .catch(() => {
          manualError.textContent = t('verifyUserInfoFailed')
        })
    })
    if (isEdit && manualInput.value.trim().length > 0) {
      manualInput.dispatchEvent(new Event('input'))
    }

    // ===== 搜索添加 tab：搜索框 + 下拉 + 已选条目 =====
    let selectedUser: { id: string; name: string; avatar: string; fans: string } | null = null
    const searchPane = document.createElement('div')
    searchPane.className = 'kala-card-modal__pane kala-card-modal__search-container'
    const searchForm = document.createElement('div')
    searchForm.className = 'kala-card-modal__user-searchform'
    const searchContent = document.createElement('div')
    searchContent.className = 'kala-card-modal__user-search-content'
    const searchInputEl = document.createElement('input')
    searchInputEl.type = 'text'
    searchInputEl.className = 'kala-card-modal__user-search-input'
    searchInputEl.placeholder = t('searchUserNickname')
    const cleanBtn = document.createElement('button')
    cleanBtn.type = 'button'
    cleanBtn.className = 'kala-card-modal__user-search-clean'
    cleanBtn.innerHTML = bdcIcon('BDC/close_circle_fill/1')
    cleanBtn.style.display = 'none'
    const searchBtn = document.createElement('span')
    searchBtn.className = 'kala-card-modal__user-search-btn'
    searchBtn.innerHTML = bdcIcon('BDC/search_line/1')
    searchContent.append(searchInputEl, cleanBtn)
    searchForm.append(searchContent, searchBtn)
    const dropdown = document.createElement('div')
    dropdown.className = 'kala-card-modal__user-dropdown'
    dropdown.style.display = 'none'
    searchPane.append(searchForm, dropdown)
    void manualError

    const renderSelectedUser = (): void => {
      const old = searchPane.querySelector('.kala-card-modal__selected-user-item')
      if (old !== null) {
        old.remove()
      }
      searchForm.style.display = selectedUser !== null ? 'none' : 'flex'
      if (selectedUser === null) {
        return
      }
      const item = document.createElement('div')
      item.className = 'kala-card-modal__selected-user-item'
      const contentEl = document.createElement('div')
      contentEl.className = 'kala-card-modal__selected-user-content'
      const avatar = document.createElement('img')
      avatar.className = 'kala-card-modal__selected-user-avatar'
      avatar.src = selectedUser.avatar
      avatar.alt = ''
      const text = document.createElement('div')
      text.className = 'kala-card-modal__selected-user-text'
      const name = document.createElement('div')
      name.className = 'kala-card-modal__selected-user-name'
      name.textContent = selectedUser.name
      const stats = document.createElement('div')
      stats.className = 'kala-card-modal__selected-user-stats'
      stats.textContent = selectedUser.fans
      text.append(name, stats)
      contentEl.append(avatar, text)
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'kala-card-modal__selected-user-close'
      close.innerHTML = bdcIcon('BDC/xmark_close_circle_fill/1')
      close.addEventListener('click', () => {
        selectedUser = null
        confirmBtn.disabled = true
        renderSelectedUser()
      })
      item.append(contentEl, close)
      searchPane.appendChild(item)
    }

    const renderUserDropdown = (users: Array<{ id: string; name: string; avatar: string; fans: string }>): void => {
      dropdown.replaceChildren()
      dropdown.style.display = 'block'
      if (users.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'kala-card-modal__list-loading'
        empty.textContent = t('noSearchResults')
        dropdown.appendChild(empty)
        return
      }
      for (const user of users) {
        const item = document.createElement('div')
        item.className = 'kala-card-modal__user-option'
        const avatar = document.createElement('img')
        avatar.className = 'kala-card-modal__user-option-avatar'
        avatar.src = user.avatar
        avatar.alt = ''
        const text = document.createElement('div')
        text.className = 'kala-card-modal__user-option-text'
        const name = document.createElement('div')
        name.className = 'kala-card-modal__user-option-name'
        name.textContent = user.name
        const fans = document.createElement('div')
        fans.className = 'kala-card-modal__user-option-fans'
        fans.textContent = user.fans
        text.append(name, fans)
        item.append(avatar, text)
        item.addEventListener('click', () => {
          selectedUser = user
          confirmBtn.disabled = false
          dropdown.style.display = 'none'
          renderSelectedUser()
        })
        dropdown.appendChild(item)
      }
    }

    searchInputEl.addEventListener('input', () => {
      cleanBtn.style.display = searchInputEl.value.length > 0 ? 'block' : 'none'
      const raw = searchInputEl.value.trim()
      if (raw.length === 0) {
        dropdown.style.display = 'none'
        return
      }
      api
        .searchUser(raw)
        .then((users) => {
          if (disposed) {
            return
          }
          renderUserDropdown(users.map((user) => ({ id: user.id, name: user.name, avatar: user.avatar, fans: user.fans })))
        })
        .catch(() => {
          dropdown.style.display = 'none'
        })
    })
    cleanBtn.addEventListener('click', () => {
      searchInputEl.value = ''
      cleanBtn.style.display = 'none'
      dropdown.style.display = 'none'
    })

    const renderTab = (): void => {
      content.replaceChildren()
      content.appendChild(activeTab === 'manual' ? manualPane : searchPane)
      confirmBtn.disabled = activeTab === 'manual' ? manualUid.length === 0 : selectedUser === null
    }
    buildTabs(tabs, [
      { key: 'manual', label: t('addByLink') },
      { key: 'search', label: t('searchAdd') },
    ], () => activeTab, (key) => {
      activeTab = key
      renderTab()
    })
    renderTab()
  })
}

/** 通用链接卡弹窗（ToolbarLinkModal）：链接地址* + 链接展示文字* */
function openGenericLinkModal(existingRefId: string, existingShowText: string): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const isEdit = existingRefId.length > 0
    const { mask, body, footer } = buildCardModalFrame(isEdit ? t('editLink') : t('addLink'), 352)
    body.classList.add('kala-card-modal__body--labeled')

    const linkItem = document.createElement('div')
    linkItem.className = 'kala-card-modal__form-item'
    linkItem.appendChild(buildFormLabel(t('linkAddress')))
    const linkInput = buildInput(t('linkPlaceholder'), existingRefId)
    const linkError = buildErrorLine()
    const linkWrap = document.createElement('div')
    linkWrap.className = 'kala-card-modal__input-wrap'
    linkWrap.append(linkInput, linkError)
    linkItem.appendChild(linkWrap)
    body.appendChild(linkItem)

    const textItem = document.createElement('div')
    textItem.className = 'kala-card-modal__form-item kala-card-modal__form-item--custom'
    textItem.appendChild(buildFormLabel(t('linkText')))
    const textInput = buildInput(t('linkTextPlaceholder'), existingShowText)
    textItem.appendChild(textInput)
    body.appendChild(textItem)

    const finish = (result: CardModalResult | null): void => {
      closeModal(mask)
      resolve(result)
    }
    const confirmBtn = buildCardFooter(
      footer,
      () => finish(null),
      () => {
        const href = linkInput.value.trim()
        if (href.length > 0) {
          finish({ refId: href, showText: textInput.value.trim().length > 0 ? textInput.value.trim() : undefined })
        }
      },
    )

    linkInput.addEventListener('input', () => {
      linkError.textContent = ''
      const href = linkInput.value.trim()
      confirmBtn.disabled = href.length === 0
      if (href.length > 0 && !/^https?:\/\//i.test(href)) {
        linkError.textContent = t('invalidLink')
        confirmBtn.disabled = true
      }
    })
    confirmBtn.disabled = true
    linkInput.focus()
  })
}

/** 投票弹窗：560×540 iframe（t.bilibili.com 投票创建页），postMessage 回传创建结果 */
function openVoteModal(): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const { mask, modal } = buildCardModalFrame(t('createVote'), 560, { hideFooter: true, hideBody: true })
    const iframe = document.createElement('iframe')
    iframe.className = 'kala-card-modal__iframe'
    iframe.src = '//t.bilibili.com/vote/h5/index/#/create?isWeb=1&onlyfans_enable=2&theme_blue=1'
    modal.appendChild(iframe)

    const finish = (result: CardModalResult | null): void => {
      window.removeEventListener('message', onMessage)
      closeModal(mask)
      resolve(result)
    }
    const onMessage = (event: MessageEvent): void => {
      const data: unknown = event.data
      if (isRecord(data) && data['type'] === 'bp-vote-create-callback') {
        const voteId = String(data['vote_id'] ?? '')
        if (voteId.length > 0) {
          finish({ refId: voteId })
        }
      }
    }
    window.addEventListener('message', onMessage)
  })
}

/** 商品弹窗：1018×686 iframe（无头无尾），cm.bilibili.com 商品选择插件 */
function openGoodsModal(): Promise<CardModalResult | null> {
  return new Promise((resolve) => {
    const { mask, modal } = buildCardModalFrame('', 1018, { hideFooter: true, hideHeader: true, hideBody: true })
    modal.classList.add('kala-card-modal--headless')
    const iframe = document.createElement('iframe')
    iframe.className = 'kala-card-modal__iframe'
    iframe.src = '//cm.bilibili.com/goods-plugin/pc#/goods-modal?isWeb=1&cloud_hub=1'
    modal.appendChild(iframe)

    const finish = (result: CardModalResult | null): void => {
      window.removeEventListener('message', onMessage)
      closeModal(mask)
      resolve(result)
    }
    const onMessage = (event: MessageEvent): void => {
      const data: unknown = event.data
      if (isRecord(data) && data['type'] === 'on-confirm') {
        const goodsId = String(data['goodsId'] ?? data['goods_id'] ?? '')
        if (goodsId.length > 0) {
          finish({ refId: goodsId })
        }
      } else if (isRecord(data) && data['type'] === 'close') {
        finish(null)
      }
    }
    window.addEventListener('message', onMessage)
  })
}

/** 简单类型弹窗规格表（正则 / 文案 / 拉取类型） */
function simpleSpecOf(cardType: CardType, fetch: (cardType: CardType, refId: string) => Promise<unknown>): SimpleLinkSpec | null {
  switch (cardType) {
    case 'bangumi':
      return {
        insertTitleKey: 'insertBangumi',
        editTitleKey: 'editBangumi',
        placeholderKey: 'bangumiLinkPlaceholder',
        invalidKey: 'invalidBangumiLink',
        fetchType: 'bangumi',
        extract: (raw) => {
          const matched = URL_PATTERNS.bangumi.exec(raw)
          return matched === null ? '' : matched[1]
        },
        fetch,
      }
    case 'live':
      return {
        insertTitleKey: 'insertLive',
        editTitleKey: 'editLive',
        placeholderKey: 'liveLinkPlaceholder',
        invalidKey: 'invalidLiveLink',
        fetchType: 'live',
        extract: (raw) => {
          const matched = URL_PATTERNS.live.exec(raw)
          return matched === null ? '' : matched[1]
        },
        fetch,
      }
    case 'mall':
      return {
        insertTitleKey: 'insertMallShow',
        editTitleKey: 'editMallShow',
        placeholderKey: 'mallLinkPlaceholder',
        invalidKey: 'invalidMallLink',
        fetchType: 'mall',
        extract: (raw) => {
          const show = /id=(\d+)/.exec(raw)
          if (show !== null && /(?:show\.bilibili\.com|mall\.bilibili\.com\/neul-next\/ticket)/i.test(raw)) {
            return show[1]
          }
          return ''
        },
        fetch,
      }
    case 'mallGoods':
      return {
        insertTitleKey: 'insertMallGoods',
        editTitleKey: 'editMallGoods',
        placeholderKey: 'mallGoodsLinkPlaceholder',
        invalidKey: 'invalidMallLink',
        fetchType: 'mallGoods',
        extract: (raw) => {
          const shop = /itemsId=(\d+)/.exec(raw)
          if (shop !== null && /mall\.bilibili\.com/i.test(raw)) {
            return shop[1]
          }
          return ''
        },
        fetch,
      }
    case 'manga':
      return {
        insertTitleKey: 'insertManga',
        editTitleKey: 'editManga',
        placeholderKey: 'mangaLinkPlaceholder',
        invalidKey: 'invalidMangaLink',
        fetchType: 'manga',
        extract: (raw) => {
          const matched = URL_PATTERNS.manga.exec(raw)
          return matched === null ? '' : matched[1]
        },
        fetch,
      }
    case 'music':
      return {
        insertTitleKey: 'insertMusic',
        editTitleKey: 'editMusic',
        placeholderKey: 'musicLinkPlaceholder',
        invalidKey: 'invalidMusicLink',
        fetchType: 'music',
        extract: (raw) => {
          const matched = URL_PATTERNS.music.exec(raw)
          return matched === null ? '' : matched[1]
        },
        fetch,
      }
    default:
      return null
  }
}

/**
 * 卡片弹窗统一入口：按类型分发 14 类原版弹窗
 * 取消返回 null；确认返回 refId（视频含 ?t= 起始时间）与可选 showText / displayMode
 */
export function openCardModal(
  cardType: CardType,
  existingRefId: string,
  api: EditorApi,
  existingShowText = '',
): Promise<CardModalResult | null> {
  const fetchCard = (type: CardType, refId: string): Promise<unknown> => api.fetchCardInfo(type, refId)
  switch (cardType) {
    case 'video':
    case 'topVideo':
      return openVideoModal(api, existingRefId)
    case 'comment':
      return openCommentModal(api, existingRefId)
    case 'opus':
      return openArticleModal(api, existingRefId)
    case 'toy':
      return openToyModal(api, existingRefId)
    case 'game':
      return openGameModal(api, existingRefId)
    case 'user':
      return openUserModal(api, existingRefId)
    case 'vote':
      return openVoteModal()
    case 'goods':
      return openGoodsModal()
    case 'generic':
      return openGenericLinkModal(existingRefId, existingShowText)
    default: {
      const spec = simpleSpecOf(cardType, fetchCard)
      if (spec !== null) {
        return openSimpleModal(spec, existingRefId)
      }
      // 兜底：未知类型走通用链接弹窗
      return openGenericLinkModal(existingRefId, existingShowText)
    }
  }
}
