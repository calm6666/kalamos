/**
 * 卡片模板公共工具（纯字符串 / 纯逻辑，Core 与 Client 共用）
 */

/** HTML 转义（属性与文本共用） */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 未知值是否为普通对象（替代 as 断言） */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 读取字符串字段（非字符串回退空串） */
export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

/** 读取数字字段（非数字回退 0） */
export function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 读取必填数字字段（缺失返回 null） */
export function readNumberOrNull(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 读取字符串数组字段 */
export function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

/** 读取对象数组字段 */
export function readRecordArray(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is Record<string, unknown> => isRecord(item))
}

/** 读取嵌套对象字段 */
export function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key]
  return isRecord(value) ? value : null
}

/** 数字格式化为中文计数（12345 → 1.2万） */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }
  if (value < 10000) {
    return String(Math.floor(value))
  }
  if (value < 100000000) {
    const w = value / 10000
    return `${w >= 100 ? Math.floor(w) : w.toFixed(1).replace(/\.0$/, '')}万`
  }
  const y = value / 100000000
  return `${y.toFixed(1).replace(/\.0$/, '')}亿`
}

/** 秒数 → mm:ss（视频时长） */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return ''
  }
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * B 站图片 CDN 缩放参数（等价于原版 getBmgSrc 的 SSR 分支）
 * 非 hdslb 域或已有 @ 参数时原样返回
 */
export function imageUrl(url: string, width: number, height: number, dpr = 2): string {
  if (url.length === 0) {
    return ''
  }
  if (!url.includes('hdslb.com')) {
    return url
  }
  const base = url.split('@')[0] ?? url
  return `${base}@${Math.floor(width * dpr)}w_${Math.floor(height * dpr)}h_1c`
}

/** 绝对化协议相对 URL（//i0.hdslb.com → https://i0.hdslb.com） */
export function absoluteUrl(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url
}

/** 投票截止时间文案（对齐原版 formatEndTime） */
export function formatVoteRemaining(endTime: number): string {
  if (!Number.isFinite(endTime) || endTime <= 0) {
    return ''
  }
  const diff = endTime - Date.now() / 1000
  if (diff <= 0) {
    return '投票已结束'
  }
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (days > 0) {
    if (hours > 0 && minutes > 0) return `${days}天${hours}小时${minutes}分钟后截止`
    if (hours > 0) return `${days}天${hours}小时后截止`
    if (minutes > 0) return `${days}天${minutes}分钟后截止`
    return `${days}天后截止`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟后截止` : `${hours}小时后截止`
  }
  return minutes > 0 ? `${minutes}分钟后截止` : '即将截止'
}

/** 会员购展览时间范围（时间戳秒） */
export function formatEventDateRange(startTime: number, endTime: number): string {
  if (startTime <= 0 || endTime <= 0) {
    return ''
  }
  const format = (value: number): string => {
    const date = new Date(value * 1000)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${month}.${day} ${hour}:${minute}`
  }
  const start = new Date(startTime * 1000)
  const end = new Date(endTime * 1000)
  const endText =
    start.getFullYear() === end.getFullYear()
      ? format(endTime).slice(6)
      : format(endTime)
  return `${start.getFullYear()}.${format(startTime)} - ${endText}`
}

/** 地点拼接（省市区场馆，过滤空段） */
export function formatLocation(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(' · ')
}

/** 文本非空才输出对应 HTML 片段 */
export function optional(html: string, text: string): string {
  return text.trim().length > 0 ? html : ''
}
