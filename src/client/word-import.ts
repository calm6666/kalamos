/**
 * Word（.docx）导入：mammoth → HTML → PM JSON
 * 对齐 eva3 importDocx 的管线（仅支持 .docx，不支持旧版 .doc）
 */
import * as mammoth from 'mammoth'
import { htmlToJSON } from '../core/markdown/parse'
import type { EditorDoc } from '../core/types'

/**
 * 解析 .docx 文件为编辑器文档结构
 * 解析失败（格式不符 / 损坏文档）时抛出错误，由调用方提示 toast
 */
export async function parseDocx(file: File): Promise<EditorDoc> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlToJSON(result.value)
}
