/**
 * 格式刷扩展：采样当前选区的标记与样式属性，应用到下一次选区
 * 对齐 eva3 格式刷：激活后光标跟随，选中新文本时自动应用并退出激活态
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/** 采样的标记类型（与 eva3 格式刷范围一致） */
const paintedMarks: readonly string[] = [
  'bold',
  'italic',
  'strike',
  'underline',
  'code',
  'textColor',
  'backgroundColor',
  'highlight',
]

/** 格式刷采样数据结构 */
export interface PaintedSample {
  [key: string]: unknown
}

/** 格式刷 storage 结构 */
export interface FormatPainterStorage {
  active: boolean
  marks: Record<string, Record<string, unknown>>
  textStyle: PaintedSample
  /** 采样时的选区，用于忽略激活瞬间的 focus 事务 */
  sourceFrom: number
  sourceTo: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formatPainter: {
      /** 切换格式刷（激活时采样当前选区） */
      toggleFormatPainter: () => ReturnType
      /** 清除选区全部标记（保留节点结构，格式刷应用前调用） */
      clearContentFormatting: () => ReturnType
    }
  }

  interface Storage {
    formatPainter: FormatPainterStorage
  }
}

export const FormatPainter = Extension.create({
  name: 'formatPainter',

  addStorage(): FormatPainterStorage {
    return {
      active: false,
      marks: {},
      textStyle: {},
      sourceFrom: 0,
      sourceTo: 0,
    }
  },

  addCommands() {
    return {
      toggleFormatPainter:
        () =>
        ({ editor }) => {
          const painter = this.storage
          if (painter.active) {
            // 再次点击：取消激活
            painter.active = false
            return true
          }
          // 激活：采样当前选区样式
          painter.active = true
          painter.marks = {}
          painter.textStyle = {}
          const { state } = editor
          const marksAtSelection = state.storedMarks ?? state.selection.$from.marks()
          painter.sourceFrom = state.selection.from
          painter.sourceTo = state.selection.to
          for (const markName of paintedMarks) {
            const mark = marksAtSelection.find((m) => m.type.name === markName)
            if (mark) {
              painter.marks[markName] = { ...mark.attrs }
            }
          }
          const textStyleMark = marksAtSelection.find((m) => m.type.name === 'textStyle')
          if (textStyleMark) {
            painter.textStyle = { ...textStyleMark.attrs }
          }
          return true
        },
      clearContentFormatting:
        () =>
        ({ state, dispatch }) => {
          const { from, to } = state.selection
          if (from === to) {
            return false
          }
          const tr = state.tr
          tr.removeMark(from, to)
          if (dispatch) {
            dispatch(tr)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('formatPainter'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const painter = this.storage
          if (!painter.active) {
            return null
          }
          // 用户完成新的非空选区 → 应用采样格式并退出激活态
          if (newState.selection.empty) {
            return null
          }
          // 激活时 focus() 触发的同选区事务不算“选择新文本”
          if (
            newState.selection.from === painter.sourceFrom &&
            newState.selection.to === painter.sourceTo
          ) {
            return null
          }
          const tr = newState.tr
          const { from, to } = tr.selection
          tr.removeMark(from, to)

          for (const [name, attrs] of Object.entries(painter.marks)) {
            const markType = newState.schema.marks[name]
            if (markType) {
              tr.addMark(from, to, markType.create(attrs?? attrs))
            }
          }
          const hasTextStyleAttrs = Object.entries(painter.textStyle).some(
            ([key, value]) => key !== 'fontLevel' && value !== null && value !== undefined,
          )
          if (hasTextStyleAttrs) {
            const textStyleType = newState.schema.marks['textStyle']
            if (textStyleType) {
              tr.addMark(from, to, textStyleType.create(painter.textStyle))
            }
          }
          painter.active = false
          return tr
        },
      }),
    ]
  },
})
