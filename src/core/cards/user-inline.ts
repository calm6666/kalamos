/**
 * 用户行内节点模板（Core 层）
 *
 * 逆向自原站 userInline 节点与渲染页样式：
 * - 编辑态 NodeView 与 SSR 共用同一模板，DOM 完全一致
 * - loading 态输出骨架（圆形缩略图 + 标题条），error/空态名字降为灰色
 * - 容器复用卡片外壳（kala-card / kala-card-content），由样式覆盖为透明胶囊
 */
import { escapeHtml, isRecord, readRecord, readString } from './utils'

/** 从 info 中提取用户基础字段（mid / name / face） */
export function readUserInlineFields(info: Record<string, unknown>): { mid: string; name: string; face: string } {
  const user = readRecord(info, 'user')
  return {
    mid: (user !== null ? readString(user, 'mid') : '') || readString(info, 'mid') || readString(info, 'uid'),
    name: (user !== null ? readString(user, 'name') : '') || readString(info, 'name'),
    face: (user !== null ? readString(user, 'face') : '') || readString(info, 'face'),
  }
}

/** info 属性值 → 对象（attrs.info 可能是对象或 JSON 字符串） */
export function userInlineInfoFromAttrs(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/** 行内用户主体（wrapper 内部结构）：loading 骨架 或 头像+名字胶囊 */
export function buildUserInlineInnerHTML(info: Record<string, unknown>, status: string): string {
  if (status === 'loading') {
    return (
      '<span class="user-inline-skeleton"><span class="skeleton-thumbnail"></span>' +
      '<span class="skeleton-content"><span class="skeleton-title"></span><span class="skeleton-desc"></span></span></span>'
    )
  }
  const { name, face } = readUserInlineFields(info)
  const stateClass = name.length === 0 ? ' user-inline-empty' : status === 'error' ? ' user-inline-error' : ''
  const avatar =
    face.length > 0
      ? `<span class="user-avatar"><img src="${escapeHtml(face)}" alt="" referrerpolicy="no-referrer" /></span>`
      : '<span class="user-avatar user-avatar-placeholder"></span>'
  return (
    `<span class="user-inline${stateClass}">` +
    '<span class="kala-card"><span class="kala-card-content">' +
    `<span class="user-inline-container">${avatar}<span class="user-name">${escapeHtml(name)}</span></span>` +
    '</span></span></span>'
  )
}

/** 完整结构（SSR / 静态渲染）：外层 wrapper 携带 data-card-type / data-card-id */
export function buildUserInlineHTML(info: Record<string, unknown>, status: string): string {
  const { mid } = readUserInlineFields(info)
  return (
    `<span class="user-inline-wrapper" data-card-type="user" data-card-id="${escapeHtml(mid.length > 0 ? mid : 'unknown')}">` +
    `${buildUserInlineInnerHTML(info, status)}</span>`
  )
}
