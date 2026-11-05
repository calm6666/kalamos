/**
 * kalamos 颜色调色板
 *
 * 结构：6 色系（blue/cyan/green/yellow/red/purple）× 4 档 + 3 档灰
 * 类名驱动：字色 `kala-color-{key}`、背景色 `kala-bg-{key}`、高亮 `kala-mark-{key}`
 * 实际色值同时收敛到 styles/tokens.css 的 CSS 变量（--kala-color-* / --kala-bg-*），
 * 本表为同构侧的唯一数据源（供 Client 色板 UI 与校验使用）
 */

/** 色系枚举 */
export const paletteHues = ['blue', 'cyan', 'green', 'yellow', 'red', 'purple'] as const
export type PaletteHue = (typeof paletteHues)[number]

/** 彩色档位（01 最浅 → 04 最深） */
export const paletteTiers = ['01', '02', '03', '04'] as const
export type PaletteTier = (typeof paletteTiers)[number]

/** 灰色档位（3 档） */
export const grayTiers = ['01', '02', '03'] as const
export type GrayTier = (typeof grayTiers)[number]

/** 完整调色板 key 列表（彩色 24 + 灰 3） */
export const paletteKeys: string[] = [
  ...paletteHues.flatMap((hue) => paletteTiers.map((tier) => `${hue}-${tier}`)),
  ...grayTiers.map((tier) => `gray-${tier}`),
]

/**
 * 每个 key 的实际色值
 * 与 tokens.css 中 --kala-color-{key} 变量值保持一致（手工同步，注释互指）
 */
export const paletteColorValues: Record<string, string> = {
  'blue-01': '#e3f4fd',
  'blue-02': '#b8e2fb',
  'blue-03': '#6fc2f2',
  'blue-04': '#00aeec',
  'cyan-01': '#ddf6f4',
  'cyan-02': '#aeeae6',
  'cyan-03': '#63d8d2',
  'cyan-04': '#0fb3ae',
  'green-01': '#e3f6e7',
  'green-02': '#bcebc5',
  'green-03': '#7eda8e',
  'green-04': '#2dbf4a',
  'yellow-01': '#fdf3d7',
  'yellow-02': '#fae5a3',
  'yellow-03': '#f5cf5f',
  'yellow-04': '#e6a23c',
  'red-01': '#fbe5e5',
  'red-02': '#f6c3c3',
  'red-03': '#ef8f8f',
  'red-04': '#e35d5d',
  'purple-01': '#f1e8fb',
  'purple-02': '#dcc6f5',
  'purple-03': '#bd95ea',
  'purple-04': '#8f5fd6',
  'gray-01': '#c9cdd4',
  'gray-02': '#8a919f',
  'gray-03': '#4e5666',
}

/** 判断给定字符串是否为合法调色板 key（类型守卫，替代 as 断言） */
export function isPaletteKey(key: string): key is string {
  return paletteKeys.includes(key)
}

/** 生成字色类名：kala-color-{key} */
export function textColorClassName(key: string): string {
  return `kala-color-${key}`
}

/** 生成背景色类名：kala-bg-{key} */
export function bgColorClassName(key: string): string {
  return `kala-bg-${key}`
}

/** 生成高亮类名：kala-mark-{key} */
export function markClassName(key: string): string {
  return `kala-mark-${key}`
}

/**
 * 从 class 列表中提取调色板 key
 * @param className 完整 class 属性值
 * @param prefix 类名前缀（如 kala-color / kala-bg / kala-mark）
 * @returns 调色板 key（如 blue-01），未匹配返回 null
 */
export function paletteKeyFromClassName(className: string | null | undefined, prefix: string): string | null {
  if (!className) {
    return null
  }
  for (const part of className.split(/\s+/)) {
    if (part.startsWith(`${prefix}-`)) {
      const key = part.slice(prefix.length + 1)
      if (isPaletteKey(key)) {
        return key
      }
    }
  }
  return null
}
