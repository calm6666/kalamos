/**
 * Markdown 语法检测启发式（粘贴 toast 用）
 *
 * 特征：ATX 标题 / 有序无序列表 / 围栏代码块 / 行内强调（**、__、~~）/
 * 链接图片语法 / 引用前缀 / 表格分隔行 / 任务列表前缀
 * 多行文档按行投票（阈值 0.6）避免误判普通文本；单行命中特征即判定
 */

/** 单行 Markdown 特征规则 */
const linePatterns: readonly RegExp[] = [
  /^#{1,6}\s+\S/, // ATX 标题
  /^\s*[-*+]\s+\S/, // 无序列表
  /^\s*\d+[.)]\s+\S/, // 有序列表
  /^\s*```/, // 围栏代码块
  /^\s*>\s/, // 引用
  /^\s*-\s\[[ xX]\]\s/, // 任务列表
  /^\|.*\|$/, // 表格行
  /\*\*[^*\n]+\*\*/, // 加粗
  /__[^_\n]+__/, // 加粗（下划线形式）
  /~~[^~\n]+~~/, // 删除线
  /\[[^\]\n]+\]\([^)\n]+\)/, // 链接 / 图片
]

/** 单行是否命中任一 Markdown 特征 */
function isMarkdownLine(line: string): boolean {
  if (line.trim().length === 0) {
    return false
  }
  return linePatterns.some((pattern) => pattern.test(line))
}

/**
 * 检测文本是否为 Markdown 语法
 * - 单行：命中特征即 true
 * - 多行：命中行占比 ≥ 0.6 判定 true
 */
export function detectMarkdown(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return false
  }
  const hits = lines.filter((line) => isMarkdownLine(line)).length
  if (lines.length === 1) {
    return hits === 1
  }
  return hits / lines.length >= 0.6
}
