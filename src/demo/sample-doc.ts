/**
 * 示例文档（demo / 父应用共用，纯数据、无 DOM 依赖）
 *
 * 覆盖 20 种卡片视图与主要节点类型，供 kalamos demo 与 hilihili-components
 * 父应用同时引用，避免同一份文档维护两遍。
 */
import { createMockCardInfo } from '../client/api/mock'
import type { CardInfo, CardType, EditorDoc } from '../core'

/** CardInfo → card 节点属性 */
function cardAttrs(info: CardInfo, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cardType: info.cardType,
    variant: info.variant,
    refId: info.refId,
    title: info.title,
    desc: info.desc,
    cover: info.cover,
    sourceName: info.sourceName,
    badge: info.badge,
    data: info.data,
    status: info.status,
    cardStyle: info.cardStyle,
    showText: '',
    ...overrides,
  }
}

/** 生成一个已加载完成的卡片节点（demo 免等待） */
function card(cardType: CardType, refId: string, overrides: Record<string, unknown> = {}) {
  return { type: 'card', attrs: cardAttrs(createMockCardInfo(cardType, refId), overrides) }
}

/** 小节标题 */
function caption(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', marks: [{ type: 'bold' }], text }],
  }
}

/** 一屏 SSR 预览文档：说明文字 + 视频卡片 + 评论卡片（父程序首屏演示用） */
export const previewDoc: EditorDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'kalamos SSR 静态渲染' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '这段 HTML 由 Core 的 renderToHTML 在 Node 端生成，卡片模板与编辑态完全一致。',
        },
      ],
    },
    card('video', 'BV1kalamos01'),
    card('comment', 'comment-basic'),
  ],
}

/** 示例文档：覆盖主要节点与 20 种卡片视图 */
export const sampleDoc: EditorDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'kalamos 富文本编辑器' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'kalamos（' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'κάλαμος' },
        { type: 'text', text: '，古希腊芦苇笔）是一个纯 TypeScript 实现的富文本编辑器，支持 ' },
        { type: 'text', marks: [{ type: 'bold' }], text: '加粗' },
        { type: 'text', text: '、' },
        { type: 'text', marks: [{ type: 'underline' }], text: '下划线' },
        { type: 'text', text: '、' },
        { type: 'text', marks: [{ type: 'strike' }], text: '删除线' },
        { type: 'text', text: '、' },
        { type: 'text', marks: [{ type: 'code' }], text: '行内代码' },
        { type: 'text', text: ' 等行内格式。键入 ' },
        { type: 'text', marks: [{ type: 'code' }], text: '/' },
        { type: 'text', text: ' 可唤起命令菜单。' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '调色板示例：' },
        { type: 'text', marks: [{ type: 'textColor', attrs: { value: 'blue-03' } }], text: '蓝色文字' },
        { type: 'text', text: '、' },
        {
          type: 'text',
          marks: [{ type: 'backgroundColor', attrs: { value: 'yellow-01' } }],
          text: '黄色背景',
        },
        { type: 'text', text: '、' },
        { type: 'text', marks: [{ type: 'highlight' }], text: '高亮标记' },
        { type: 'text', text: '。' },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '列表与引用' }],
    },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '无序列表项' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '支持多级嵌套' }] }] },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '已完成：三层架构设计' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '待办：接入真实业务 API' }] }],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Server → Core ← Client：Core 层禁止运行时 DOM 依赖。' }],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '代码与表格' }],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [
        {
          type: 'text',
          text: 'const editor = createEditor({ element, locale: "zh-cn" })',
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '层' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '职责' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Core' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Schema 与纯函数管线' }] }] },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '富媒体' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'mention', attrs: { id: '3', label: '龟龟家的猫' } },
        { type: 'text', text: ' 发布了新视频，话题 ' },
        { type: 'topic', attrs: { name: 'kalamos编辑器' } },
        { type: 'text', text: ' 正在热议 ' },
        { type: 'emoji', attrs: { name: 'doge', char: '🐶', img: null, size: null } },
        { type: 'text', text: '。' },
      ],
    },
    { type: 'latex', attrs: { formula: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}' } },

    // ===== 20 种卡片视图 =====
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '20 种卡片视图' }],
    },
    caption('1. 视频卡片 · 详细视图'),
    card('video', 'BV1kalamos01'),
    caption('2. 视频卡片 · 播放视图'),
    card('video', 'BV1kalamos02player'),
    caption('3. 置顶视频'),
    card('topVideo', 'BV1kalamos03'),
    caption('4. 图文卡片'),
    card('opus', 'cv10001'),
    caption('5. 评论卡片 · 基础视图'),
    card('comment', 'comment-basic'),
    caption('6. 评论卡片 · 进阶视图'),
    card('comment', 'comment-advanced'),
    caption('7. 评论卡片 · 截图视图'),
    card('comment', 'comment-screenshot'),
    caption('8. 投票卡片'),
    card('vote', 'vote-001'),
    caption('9. 直播卡片'),
    card('live', 'live-1001'),
    caption('10. 番剧卡片'),
    card('bangumi', 'ep000001'),
    caption('11. 漫画卡片'),
    card('manga', 'mc10001'),
    caption('12. 游戏卡片'),
    card('game', 'game-1001'),
    caption('13. 音乐卡片'),
    card('music', 'au10001'),
    caption('14. 会员购展览卡片'),
    card('mall', 'mall-001'),
    caption('15. 商品卡片'),
    card('goods', 'goods-001'),
    caption('16. 会员购商品卡片'),
    card('mallGoods', 'mallgoods-001'),
    caption('17. 玩具卡片 · 链接视图'),
    card('toy', 'toy-link'),
    caption('18. 玩具卡片 · 卡片视图'),
    card('toy', 'toy-card'),
    caption('19. 用户名片'),
    card('user', '3'),
    caption('20. 通用卡片'),
    card('generic', 'https://www.bilibili.com'),
  ],
}
