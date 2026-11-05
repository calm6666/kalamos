/**
 * markdown-it-task-lists 类型声明（社区无 @types 包，手工补齐）
 */
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListsOptions {
    /** 启用后 checkbox 可交互（kalamos 固定 false，勾选由 TaskItem 节点管理） */
    enabled?: boolean
    /** label 包裹文本 */
    label?: boolean
    /** 渲染行号记录 */
    lineNumbers?: boolean
  }

  function taskLists(md: MarkdownIt, options?: TaskListsOptions): void

  export default taskLists
}
