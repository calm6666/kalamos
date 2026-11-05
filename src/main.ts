/**
 * kalamos demo 页面入口：装配完整编辑器并预置示例文档
 *
 * 示例覆盖 20 种卡片视图（与 B 站 York 编辑器 1:1 的 15 类卡片 + 变体），
 * 以及标题 / 列表 / 引用 / 代码块 / 表格 / 图片 / 公式 / 提及 / 话题 / 表情等核心能力。
 */
import './styles/index.css'
import { createEditor } from './client'
import { sampleDoc } from './demo/sample-doc'

/** 挂载编辑器 */
const appEl = document.querySelector<HTMLDivElement>('#app')
if (appEl !== null) {
  appEl.style.maxWidth = '920px'
  appEl.style.margin = '24px auto'
  createEditor({
    element: appEl,
    content: sampleDoc,
    locale: 'zh-cn',
    charCountLimit: 5000,
  })
}
