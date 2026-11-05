/**
 * 编辑器自定义事件类型：斜杠命令触发的弹窗交互请求
 * 载荷为空元组 → emit('kalamos:request-xxx') 无需参数
 */
declare module '@tiptap/core' {
  interface EditorEvents {
    /** 请求打开图片弹窗 */
    'kalamos:request-image': []
    /** 请求打开公式弹窗 */
    'kalamos:request-latex': []
    /** 请求打开表情选择器 */
    'kalamos:request-emoji': []
    /** 请求打开卡片类型菜单 */
    'kalamos:request-card': []
  }
}

export {}
