/**
 * 轻提示 toast：顶部居中出现，默认 2.4s 自动淡出
 * Markdown 检测确认 toast 返回 Promise（确认转换 / 取消保留）
 */
import { t } from '../i18n'

/** 根容器（懒创建单例） */
let wrapEl: HTMLDivElement | null = null

function ensureWrap(): HTMLDivElement {
  if (wrapEl === null || !document.body.contains(wrapEl)) {
    wrapEl = document.createElement('div')
    wrapEl.className = 'kala-toast-wrap'
    document.body.appendChild(wrapEl)
  }
  return wrapEl
}

/** 显示一条轻提示（默认 2.4s 自动消失） */
export function showToast(text: string, duration = 2400): void {
  const wrap = ensureWrap()
  const toast = document.createElement('div')
  toast.className = 'kala-toast'
  toast.textContent = text
  wrap.appendChild(toast)
  window.setTimeout(() => {
    toast.classList.add('kala-toast--leaving')
    window.setTimeout(() => {
      toast.remove()
    }, 220)
  }, duration)
}

/**
 * Markdown 检测确认 toast：展示「检测到 Markdown 语法」+ 转换/取消按钮
 * resolve(true) = 用户确认转换；resolve(false) = 取消保留原文
 */
export function showMarkdownConfirmToast(): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = ensureWrap()
    const toast = document.createElement('div')
    toast.className = 'kala-toast'

    const line = document.createElement('div')
    line.textContent = t('toast.markdownDetected')

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    actions.style.marginTop = '6px'
    actions.style.justifyContent = 'flex-end'

    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'kala-toast__btn'
    confirmBtn.textContent = t('toast.markdownConvert.confirm')

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'kala-toast__btn'
    cancelBtn.textContent = t('toast.markdownConvert.cancel')

    const finish = (converted: boolean) => {
      toast.classList.add('kala-toast--leaving')
      window.setTimeout(() => toast.remove(), 200)
      resolve(converted)
    }
    confirmBtn.addEventListener('click', () => finish(true))
    cancelBtn.addEventListener('click', () => finish(false))

    actions.append(confirmBtn, cancelBtn)
    toast.append(line, actions)
    wrap.appendChild(toast)
  })
}
