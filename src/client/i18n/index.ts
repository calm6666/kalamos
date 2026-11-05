/**
 * i18n 框架：内置 zh-CN / en 两包，宿主可合并覆盖文案
 * 用法：setLocale('en')；t('toolbar.bold')
 */
import { zhCn } from './zh-cn'
import { en } from './en'
import type { EditorLocaleMessages } from '../../core/types'

export type Locale = 'zh-cn' | 'en'

/** 内置语言包 */
const builtinMessages: Record<Locale, Record<string, string>> = {
  'zh-cn': zhCn,
  en,
}

/** 当前生效语言包（内置 + 宿主覆盖合并结果） */
let activeMessages: Record<string, string> = { ...builtinMessages['zh-cn'] }
let currentLocale: Locale = 'zh-cn'

/** 切换语言（覆盖合并宿主文案后重建生效包） */
export function setLocale(
  locale: Locale,
  overrides?: EditorLocaleMessages,
): void {
  currentLocale = locale
  activeMessages = { ...builtinMessages[locale], ...(overrides ?? {}) }
}

/** 获取当前语言 */
export function getLocale(): Locale {
  return currentLocale
}

/** 取文案（未命中时回退 key 本身，便于发现缺失） */
export function t(key: string): string {
  const value = activeMessages[key]
  return typeof value === 'string' ? value : key
}
