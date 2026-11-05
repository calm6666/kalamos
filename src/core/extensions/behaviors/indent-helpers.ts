/**
 * 缩进辅助函数：DOM 无关的 ProseMirror 文档遍历工具
 */
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

/** 支持缩进属性的节点类型集合（与 indent.ts 的 globalAttributes types 保持一致） */
export const indentableTypes: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
])

/** 缩进最大层级（超过后命令失效并提示） */
export const maxIndentLevel = 8

/**
 * 收集选区范围内所有「顶层可缩进块」的位置
 * 只取每个块链最顶层的可缩进节点（避免 paragraph 与其父 list 重复缩进）
 */
export function collectIndentTargets(
  state: EditorState,
): Array<{ pos: number; node: PMNode }> {
  const targets: Array<{ pos: number; node: PMNode }> = []
  const { from, to } = state.selection
  const parentTypes: ReadonlySet<string> = new Set(['bulletList', 'orderedList', 'taskList'])

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.eq(state.doc)) {
      return true
    }
    if (indentableTypes.has(node.type.name)) {
      // 列表容器：父链上若已是可缩进块则跳过（取顶层）
      const $pos = state.doc.resolve(pos)
      let isNested = false
      for (let depth = $pos.depth - 1; depth >= 1; depth -= 1) {
        const ancestor = $pos.node(depth)
        if (indentableTypes.has(ancestor.type.name)) {
          isNested = true
          break
        }
        if (parentTypes.has(ancestor.type.name)) {
          isNested = true
          break
        }
      }
      if (!isNested) {
        targets.push({ pos, node })
      }
      return false
    }
    return true
  })

  return targets
}

/** 读取节点当前缩进级别 */
export function getIndentLevel(node: PMNode): number {
  const value = node.attrs['indent']
  return typeof value === 'number' ? value : 0
}
