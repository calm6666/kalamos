/**
 * 缩进行为扩展：globalAttributes 注入 indent（0-8），类名驱动 kala-indent-{n}
 * - Tab / Shift-Tab 快捷键：列表内为 sink / lift 列表项，其余为块缩进 / 反缩进
 * - 达到最大层级时触发 onIndentLimit 回调（Client 层用于 toast 提示）
 */
import { Extension } from '@tiptap/core'
import type { Command } from '@tiptap/core'
import { collectIndentTargets, getIndentLevel, maxIndentLevel } from './indent-helpers'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /** 增加选区块缩进 */
      indentBlock: () => ReturnType
      /** 减少选区块缩进 */
      outdentBlock: () => ReturnType
    }
  }
}

export interface IndentOptions {
  /** 缩进达到最大层级时的回调（Client 层提示用） */
  onIndentLimit: () => void
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      onIndentLimit: () => undefined,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const classAttr = element.getAttribute('class') ?? ''
              const match = /(?:^|\s)kala-indent-([1-8])(?:\s|$)/.exec(classAttr)
              return match !== null ? Number.parseInt(match[1] ?? '0', 10) : 0
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const indent = attributes['indent']
              if (typeof indent === 'number' && indent > 0 && indent <= 8) {
                return { class: `kala-indent-${indent}` }
              }
              return {}
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const changeIndent =
      (delta: number): Command =>
      ({ state, dispatch }) => {
        const targets = collectIndentTargets(state)
        if (targets.length === 0) {
          return false
        }

        const tr = state.tr
        let changed = false
        let limited = false

        for (const { pos, node } of targets) {
          const current = getIndentLevel(node)
          const next = current + delta
          if (delta > 0 && current >= maxIndentLevel) {
            limited = true
            continue
          }
          const clamped = Math.max(0, next)
          if (clamped === current) {
            continue
          }
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: clamped })
          changed = true
        }

        if (limited) {
          this.options.onIndentLimit()
        }
        if (!changed) {
          return false
        }
        if (dispatch) {
          dispatch(tr)
        }
        return true
      }

    return {
      indentBlock: () => changeIndent(1),
      outdentBlock: () => changeIndent(-1),
    }
  },

  addKeyboardShortcuts() {
    const isInsideList = (): boolean => {
      const { $from } = this.editor.state.selection
      for (let depth = $from.depth; depth >= 1; depth -= 1) {
        const name = $from.node(depth).type.name
        if (name === 'listItem' || name === 'taskItem') {
          return true
        }
      }
      return false
    }

    return {
      Tab: ({ editor }) => {
        if (isInsideList()) {
          const taskActive = editor.isActive('taskItem')
          if (taskActive) {
            return editor.commands.sinkListItem('taskItem')
          }
          return editor.commands.sinkListItem('listItem')
        }
        return editor.commands.indentBlock()
      },
      'Shift-Tab': ({ editor }) => {
        if (isInsideList()) {
          const taskActive = editor.isActive('taskItem')
          if (taskActive) {
            return editor.commands.liftListItem('taskItem')
          }
          return editor.commands.liftListItem('listItem')
        }
        return editor.commands.outdentBlock()
      },
    }
  },
})
