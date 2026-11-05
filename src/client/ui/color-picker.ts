/**
 * 色板面板：字色 / 背景色 / 高亮共用
 * 6 色 × 4 档 + 3 档灰，色值来自 core/palette（tokens.css 同源）
 */
import {
  paletteColorValues,
  paletteHues,
  paletteKeys,
  paletteTiers,
  grayTiers,
} from '../../core/palette'
import { positionFloating } from './floating'

export interface ColorPickerOptions {
  /** 当前已选 key（高亮标记） */
  selectedKey: string | null
  /** 选中回调（传 null 表示清除颜色） */
  onSelect: (key: string | null) => void
  /** 面板关闭回调 */
  onClose: () => void
}

/** 创建色板浮层并挂载到 body（调用方负责触发定位与移除） */
export function createColorPicker(
  reference: HTMLElement,
  options: ColorPickerOptions,
): HTMLDivElement {
  const panel = document.createElement('div')
  panel.className = 'kala-color-picker'

  const buildCells = (keys: readonly string[]) => {
    for (const key of keys) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'kala-color-picker__cell'
      if (key === options.selectedKey) {
        cell.classList.add('is-active')
      }
      cell.style.backgroundColor = paletteColorValues[key] ?? '#ffffff'
      cell.title = key
      cell.addEventListener('click', () => {
        options.onSelect(key)
        panel.remove()
        options.onClose()
      })
      panel.appendChild(cell)
    }
  }

  for (const hue of paletteHues) {
    buildCells(paletteTiers.map((tier) => `${hue}-${tier}`))
  }
  buildCells(grayTiers.map((tier) => `gray-${tier}`))

  // 清除颜色（恢复默认）
  const clearCell = document.createElement('button')
  clearCell.type = 'button'
  clearCell.className = 'kala-color-picker__empty'
  clearCell.textContent = '×'
  clearCell.addEventListener('click', () => {
    options.onSelect(null)
    panel.remove()
    options.onClose()
  })
  panel.appendChild(clearCell)

  document.body.appendChild(panel)
  void positionFloating(reference, panel, 'bottom-start')

  // 点击面板外部关闭
  const onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target
    if (target instanceof Node && !panel.contains(target) && target !== reference) {
      panel.remove()
      document.removeEventListener('mousedown', onDocMouseDown)
      options.onClose()
    }
  }
  document.addEventListener('mousedown', onDocMouseDown)

  return panel
}

/** 判断 key 是否为合法调色板 key（供外部过滤） */
export function isValidPaletteKey(key: string): boolean {
  return paletteKeys.includes(key)
}
