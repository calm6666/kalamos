/**
 * Floating-UI 定位封装：气泡菜单 / 斜杠菜单 / 下拉面板共用
 * 对齐原版 Popper 系定位（preventOverflow + offset + flip）
 */
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Placement, ReferenceElement } from '@floating-ui/dom'

/**
 * 将浮动元素定位到参照元素旁（fixed 策略，与菜单 position:fixed 配合）
 * 定位失败静默忽略（元素可能已从 DOM 移除）
 */
export async function positionFloating(
  reference: ReferenceElement,
  floating: HTMLElement,
  placement: Placement = 'top-start',
  distance = 6,
): Promise<void> {
  try {
    const { x, y } = await computePosition(reference, floating, {
      strategy: 'fixed',
      placement,
      middleware: [
        offset(distance),
        flip(),
        // @floating-ui/dom 1.8 起 preventOverflow 已移除，shift 负责视口内收敛
        shift({ padding: 8 }),
      ],
    })
    floating.style.left = `${x}px`
    floating.style.top = `${y}px`
  } catch {
    // 参照元素已被移除时 computePosition 抛错，静默忽略
  }
}
