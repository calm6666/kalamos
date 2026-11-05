# kalamos 富文本编辑器设计文档

> 版本：v0.1.0 ｜ 日期：2026-10-27
>
> 本文档基于两份输入产物的融合设计：
> 1. `front/富文本编辑器设计文档.md` —— Tiptap 3 + ProseMirror 的 SSR 三层同构架构方案；
> 2. 对 B站图文编辑器（eva3）生产构建产物 `index-DU2LMQ9s.js`（5.4MB）的逆向分析。
>
> 目标：以**纯 TypeScript** 实现一个与 eva3 **功能一致**的富文本编辑器库，沿用设计文档的三层 SSR 架构与类名驱动样式体系。

---

## 1. 逆向分析结论

### 1.1 原版技术栈

| 维度 | 结论 | 证据 |
|:---|:---|:---|
| UI 框架 | Vue 3 + B站 V 组件库（VButton/VPopover/VDialog/VImageCrop 等） | `createApp`、`VPopover`、`VDialog` 组件名 |
| 编辑器内核 | Tiptap 3 + ProseMirror | `[tiptap warn]` 运行时警告、`prosemirror` 内部符号 317 处 |
| Markdown 管线 | markdown-it（`renderMarkdownToHtml` + `importMarkdown` 命令） | `MarkdownIt.prototype.configure`、`markdown-it 未初始化` 错误文案 |
| 代码高亮 | lowlight（highlight.js）+ 行号 | `className:"keyword"` 等 hljs 类名、`eva3-code-block-line-number` |
| 定位引擎 | Popper/Floating-UI 系 | `computeStyles`、`preventOverflow`、`autoPlacement` |
| 公式 | latex 节点存 `latex_content`，未内置渲染库（服务端出图） | `createFormulaNode`、`node_type: 5` |
| 业务数据 | OpusNodeFactory：PM JSON ⇄ opus 结构双向转换 | `convertFormulaNodeToContent`、`node_type 1/3/5` |

### 1.2 功能清单（逆向提取，为本库实现范围）

**文本与标记**：加粗、斜体、删除线、下划线、行内代码、链接（含站内链接类型识别：视频/图文/评论/表情/投票）、字体族、字号、字级（极小字号 font_level）、字体颜色（6 色 × 4 档 + 3 档灰）、背景颜色、高亮、上标、下标、对齐（左/中/右）、缩进/反缩进（含最大层级提示）、格式刷、清除格式。

**块级结构**：标题（H1–H3）、引用、无序列表、有序列表、任务列表（勾选框）、代码块（语言选择、行号、复制、自动换行切换）、分割线、表格（行/列/表头）、硬换行。

**自定义节点**：图片（上传/粘贴/拖拽、注释 caption、悬停工具条：替换/删除/重试/查看大图、加载/失败态）、表情 emoji、@提及（用户搜索下拉）、#话题#、LaTeX 公式（编辑弹窗 + katex 实时预览 + 悬停编辑/删除）、业务卡片（16 类 / 20 种视觉形态）。

**业务卡片**：视频（详细/播放）、置顶视频、图文、评论（基础/进阶/截图）、投票、直播、番剧、漫画、游戏、音乐、会员购展览、商品、会员购商品、玩具（链接/卡片）、用户名片、通用（共 16 个节点名、20 种视觉形态）。卡片具备：加载态、错误态（重试）、悬停操作（编辑/删除）、双端一致渲染。

**交互系统**：全功能工具栏、斜杠命令菜单（`/` 唤起）、块拖拽手柄（拖动排序 + 块菜单）、气泡菜单（选区格式气泡 / 链接悬停气泡 / 图片悬停气泡）、预览分栏（手机框预览 + 可拖拽分隔线）、TOC 目录面板（空态提示）、字数统计（含上限警告）、全屏。

**内容管线**：Markdown 粘贴检测（toast「检测到 Markdown 语法」→ 确认转换 / 取消保留）、Markdown 导入命令、Word 导入（importDocx）、撤销/重做、Placeholder、静态渲染（SSR）。

**辅助系统**：国际化（zh-CN 为主，多语言 key 结构）、CSS 主题（`eva3-*` 类名 → 本库 `kala-*`）、CSS 变量主题令牌。

---

## 2. 总体架构

沿用设计文档的三层分离模型，依赖方向：**Server → Core ← Client**，Server 与 Client 零交叉依赖。

| 层 | 职责 | 运行环境 | 是否依赖 DOM |
|:---|:---|:---|:---|
| **Core 层**（同构） | Schema 定义、扩展注册、Markdown ⇄ JSON、静态渲染、Opus 结构转换 | Node.js 和浏览器 | ❌ 纯逻辑 |
| **Server 层** | 接收 Markdown / JSON，调用 Core 输出 HTML / Markdown 字符串 | 仅 Node.js | ❌ |
| **Client 层** | 编辑器实例化、NodeView、工具栏/菜单/弹窗等交互 UI | 仅浏览器 | ✅ |

**硬约束**：Core 层与 Server 层禁止 import 任何 DOM 相关代码（`document`、`window`、`HTMLElement`）；Client 层只能被动态 `import()` 引用，避免被打进服务端包。

```
┌────────────────────────────────────────────────────┐
│                    宿主应用                          │
│   SSR: @kalamos/server      CSR: /client   │
└──────────────┬─────────────────────┬───────────────┘
               │                     │
          ┌────▼─────┐         ┌─────▼──────┐
          │  Server  │         │   Client   │
          │ renderTo │         │ createEditor│
          │ String() │         │ NodeView/UI │
          └────┬─────┘         └─────┬──────┘
               │    零交叉依赖        │
          ┌────▼─────────────────────▼─────┐
          │             Core               │
          │  schema / extensions / markdown │
          │  render / opus / types          │
          └────────────────────────────────┘
```

---

## 3. 目录结构

```text
kalamos/
├── package.json                  # exports: "." / "./server" / "./client" / "./styles"
├── tsconfig.json                 # strict + verbatimModuleSyntax
├── tsup.config.ts                # 三入口分层构建
├── eslint.config.js
├── docs/
│   └── design.md                 # 本文档
├── index.html                    # Vite demo 页
├── src/
│   ├── core/                     # 同构核心 —— 零 DOM 依赖
│   │   ├── index.ts              # 公共导出
│   │   ├── types.ts              # EditorDoc / CardInfo / 上传句柄等公共类型
│   │   ├── palette.ts            # 颜色调色板常量（6 色 × 4 档 + 3 档灰）
│   │   ├── extensions/
│   │   │   ├── index.ts          # 唯一的 defaultExtensions 数组（杜绝漂移）
│   │   │   ├── marks/            # 文本标记扩展
│   │   │   │   ├── background-color.ts   # 背景色 → kala-bg-* 类名
│   │   │   │   ├── text-color.ts         # 字色 → kala-color-* 类名
│   │   │   │   ├── font-level.ts         # 字级（regular/small）
│   │   │   │   ├── bili-link.ts          # 链接 + 站内链接类型识别
│   │   │   │   └── highlight-palette.ts  # 高亮（调色板类名驱动）
│   │   │   ├── nodes/            # 自定义节点扩展
│   │   │   │   ├── heading-id.ts         # Heading + id 属性（TOC 锚点）
│   │   │   │   ├── image.ts              # 图片（caption/加载态/对齐）
│   │   │   │   ├── emoji.ts              # 表情
│   │   │   │   ├── mention.ts            # @提及
│   │   │   │   ├── topic.ts              # #话题#
│   │   │   │   ├── latex.ts              # LaTeX 公式块
│   │   │   │   └── card.ts               # 通用业务卡片（16 类）
│   │   │   ├── behaviors/        # 行为扩展（命令/粘贴规则）
│   │   │   │   ├── indent.ts             # 缩进/反缩进（Tab/Shift-Tab、最大层级）
│   │   │   │   ├── format-painter.ts     # 格式刷
│   │   │   │   ├── markdown-import.ts    # Markdown 粘贴检测与导入
│   │   │   │   └── indent-helpers.ts
│   │   │   └── configure-kit.ts  # StarterKit 定制（关闭重复项、注入 lowlight）
│   │   ├── markdown/
│   │   │   ├── parse.ts          # markdown-it → HTML → generateJSON
│   │   │   ├── serialize.ts      # JSON → Markdown 序列化器
│   │   │   └── detect.ts         # Markdown 语法检测（粘贴 toast 用）
│   │   ├── render/
│   │   │   ├── html.ts           # renderToHTMLString 封装（含 TOC id 预处理）
│   │   │   └── markdown.ts       # renderToMarkdown 封装
│   │   ├── opus/
│   │   │   └── factory.ts        # OpusNodeFactory：JSON ⇄ opus 数据结构
│   │   └── heading-ids.ts        # generateHeadingIds（静态渲染前预处理）
│   ├── server/
│   │   ├── index.ts              # renderMarkdownToString / renderJSONToString / renderJSONToMarkdown
│   │   └── guard.ts              # Node 环境守卫
│   ├── client/                   # 仅浏览器
│   │   ├── index.ts              # createEditor 入口
│   │   ├── editor.ts             # 编辑器实例化 + 模块装配
│   │   ├── i18n/
│   │   │   ├── index.ts          # i18n 框架（zh-CN / en）
│   │   │   ├── zh-cn.ts
│   │   │   └── en.ts
│   │   ├── api/
│   │   │   └── mock.ts           # 卡片信息 / 用户搜索 / 图片上传 mock API
│   │   ├── ui/
│   │   │   ├── toolbar.ts        # 全功能工具栏
│   │   │   ├── slash-menu.ts     # 斜杠命令菜单
│   │   │   ├── bubble-menus.ts   # 选区/链接/图片三种气泡菜单
│   │   │   ├── drag-handle.ts    # 块拖拽手柄 + 块菜单
│   │   │   ├── preview.ts        # 预览分栏（手机框 + 可拖分隔线）
│   │   │   ├── toc-panel.ts      # 目录面板
│   │   │   ├── modals.ts         # 链接/公式/图片弹窗
│   │   │   ├── emoji-picker.ts   # 表情选择器
│   │   │   ├── color-picker.ts   # 字色/背景色调色板
│   │   │   ├── toast.ts          # 轻提示
│   │   │   └── floating.ts       # Floating-UI 定位封装
│   │   ├── node-views/
│   │   │   ├── code-block.ts     # 行号/语言选择/复制/换行切换
│   │   │   ├── image.ts          # 悬停工具条/注释/大图预览
│   │   │   ├── latex.ts          # katex 渲染 + 编辑/删除
│   │   │   ├── mention.ts        # @提及 chips
│   │   │   ├── topic.ts          # 话题 chips
│   │   │   ├── emoji.ts          # 表情渲染
│   │   │   └── card.ts           # 卡片 NodeView（加载/错误/悬停菜单）
│   │   ├── cards/
│   │   │   ├── registry.ts       # 卡片类型注册表
│   │   │   └── renderers.ts      # 20 种卡片视图渲染器
│   │   └── word-import.ts        # importDocx（mammoth）
│   └── styles/
│       ├── index.css             # 汇总入口
│       ├── tokens.css            # CSS 变量主题令牌
│       ├── content.css           # 正文内容样式（.kala-content 作用域）
│       ├── ui.css                # 工具栏/菜单/弹窗
│       └── cards.css             # 卡片样式
└── docs/design.md
```

---

## 4. 依赖清单与理由

### 4.1 文档既有依赖（沿用设计文档）

| 依赖 | 用途 |
|:---|:---|
| `@tiptap/core` `@tiptap/pm` | 编辑器内核（peerDependencies） |
| `@tiptap/starter-kit` `@tiptap/extensions` | 基础节点/标记 + Placeholder/CharacterCount/TrailingNode/UndoRedo 等 |
| `@tiptap/extension-*` | list / table / text-style / color / highlight / text-align / subscript / superscript / font-family / image / mention / link |
| `@tiptap/static-renderer` | SSR 静态渲染（`renderToHTMLString` / `renderToMarkdown`，均不依赖 DOM） |
| `@tiptap/html` | `generateJSON`（Markdown → JSON 管线终点） |
| markdown-it 生态 | Markdown → HTML（与 eva3 同款管线） |

### 4.2 功能对齐新增依赖（含理由）

| 依赖 | 理由 |
|:---|:---|
| `lowlight` | eva3 代码块语法高亮同款实现（highlight.js），Tiptap CodeBlock 原生支持注入 |
| `katex` | LaTeX 公式渲染（原版服务端出图，独立库改为本地渲染，纯 JS 无 DOM 依赖，Core 也可用） |
| `markdown-it-task-lists` | 任务列表语法支持（markdown-it 默认不支持 `- [ ]`） |
| `mammoth` | Word（.docx）导入，对齐 eva3 importDocx |
| `@floating-ui/dom` | 气泡菜单/斜杠菜单/下拉定位（对齐原版 Popper 方案） |

---

## 5. 数据模型与 Schema 契约

### 5.1 标记（Marks）

| 名称 | 属性 | 渲染输出 | 备注 |
|:---|:---|:---|:---|
| `bold` `italic` `strike` `underline` `code` | — | `<strong>/<em>/<s>/<u>/<code>` | StarterKit 内置 |
| `link` | `href` `target` `rel` | `<a class="kala-link kala-link--{type}">` | 站内链接类型识别（视频/图文/评论/表情/投票/未知） |
| `textStyle` | `fontFamily` `fontSize` `fontLevel` | `class="kala-font-small"` / 必要的任意值内联 | 字号为任意值，白名单例外允许内联 |
| `textColor` | `value` | `class="kala-color-blue-01"` | 调色板 6×4 + 灰 3，类名驱动 |
| `backgroundColor` | `value` | `class="kala-bg-blue-01"` | 同上 |
| `highlight` | — | `<mark>` | StarterKit 内置 |
| `subscript` `superscript` | — | `<sub>/<sup>` | 官方扩展 |

### 5.2 节点（Nodes）

| 名称 | 属性 | 渲染输出 | 备注 |
|:---|:---|:---|:---|
| `doc` `paragraph` `text` `hardBreak` | — | 标准 | StarterKit |
| `heading` | `level` `id` `align` `indent` | `<h1-h3 id>` | id 供 TOC/锚点，静态渲染前由 `generateHeadingIds` 补齐 |
| `blockquote` `bulletList` `orderedList` `listItem` `taskList` `taskItem` `codeBlock` `horizontalRule` | 标准 | 标准 | CodeBlock 注入 lowlight |
| `table` 系列 | 标准 | `<table>` + `data-colwidth` | 官方 Table |
| `image` | `src` `alt` `caption` `status` `align` | `<figure class="kala-image">` | caption 为附注文本 |
| `emoji` | `name` `char` `img` `size` | `<span class="kala-emoji" data-emoji-name>` | 支持图片表情与 Unicode 双形态 |
| `mention` | `id` `name` | `<span class="kala-mention" data-mention-id>` | @用户 |
| `topic` | `name` | `<span class="kala-topic">` | #话题# |
| `latex` | `formula` | `<div class="kala-latex" data-latex>` + katex HTML | 块级原子节点，Core 静态渲染与 Client NodeView 均用 katex |
| `card` | `cardType` `refId` `title` `desc` `cover` `extra` | `<div class="kala-card" data-type="{cardType}-card" data-ref-id>` | 通用业务卡片，见 §7 |

### 5.3 属性继承

`indent`（0–8 级）、`textAlign` 通过 globalAttributes 注入 paragraph/heading/blockquote/list 等，渲染为 `class="kala-indent-{n}"` / `class="kala-align-center"`，**禁止内联样式**。

---

## 6. 自定义元素双端契约表（合入标准）

新增自定义元素时必须**同时**完成下表四项，缺一不可：

| 节点名 | Core `renderHTML` 输出 | Client NodeView（编辑态） | Markdown 语法 | CSS 类名 |
|:---|:---|:---|:---|:---|
| `image` | `<figure class="kala-image"><img><figcaption>` | 悬停工具条/加载/失败/大图 | `![alt](src)` | `.kala-image` |
| `emoji` | `<span class="kala-emoji" data-emoji-name>` | 字符/图片渲染 | `:name:` | `.kala-emoji` |
| `mention` | `<span class="kala-mention" data-mention-id>` | @chip + 搜索弹层 | `@name` | `.kala-mention` |
| `topic` | `<span class="kala-topic">#name#</span>` | 话题 chip + #输入规则 | `#name#` | `.kala-topic` |
| `latex` | `<div class="kala-latex" data-latex>` | katex 渲染 + 编辑/删除悬停 | `$$...$$` | `.kala-latex` |
| `card` | `<div class="kala-card" data-type="...">` 骨架 | 拉取 mock API 填充 + 加载/错误态 + 悬停菜单 | 不支持（粘贴链接自动转换） | `.kala-card` `.kala-{type}-card` |

**静态渲染一致性**：卡片在 Core `renderHTML` 时基于 `title/desc/cover` 快照属性输出完整内容；Client NodeView 拉取成功后**回写快照属性**（仅 `meta` 更新，不触发文档内容版本变化），保证编辑态与静态态 DOM 结构一致。

---

## 7. 卡片系统

### 7.1 通用卡片框架

- 单一 `card` 节点承载 16 类业务卡片（20 种视觉形态），`cardType` 决定渲染器；
- 注册表模式：`CardRegistry.register(type, { title, icon, fetch, render, editFields })`，新增卡片 = 注册一个渲染器 + 一个 mock 数据源，零侵入；
- 三态渲染：加载中（`kala-card-loading`）、错误（`kala-card-error` + 重试）、正常（`kala-card` 主体：头部 icon+来源名、标题、描述、媒体封面、角标）；
- 悬停操作：编辑（`kala-card-hover-menu`）、删除；
- 数据源：`EditorApi` 接口（`fetchCardInfo` / `searchUser` / `uploadImage`），库内置 mock 实现（模拟 600ms 延迟与「无法识别该链接」错误），宿主可注入真实实现。

### 7.2 卡片类型与 mock 数据

| cardType | 名称 | 视觉形态 | mock 数据关键字段 |
|:---|:---|:---|:---|
| `video` | 视频 | 详细视图 / 播放视图 | 标题/UP主/封面/时长/播放量/弹幕数 |
| `topVideo` | 置顶视频 | 置顶 | 标题/UP主/封面/时长/播放量 |
| `opus` | 图文 | 图文 | 标题/作者/封面/摘要 |
| `comment` | 评论 | 基础 / 进阶 / 截图 | 内容/用户/头像/点赞数/来源 |
| `vote` | 投票 | 投票 | 问题/选项/进度条/参与人数/截止时间 |
| `music` | 音乐 | 音乐 | 歌名/歌手/封面/时长 |
| `toy` | 玩具 | 链接视图 / 卡片视图 | 名称/形象图 |
| `mall` | 会员购展览 | 展览 | 展名/时间/地点/封面 |
| `goods` / `mallGoods` | 商品 | 商品 | 名称/价格/封面 |
| `manga` | 漫画 | 漫画 | 标题/作者/封面/更新话数 |
| `live` | 直播 | 直播 | 房间号/主播/标题/人气/状态 |
| `game` | 游戏 | 游戏 | 名称/评分/标签/封面 |
| `bangumi` | 番剧 | 番剧 | 标题/季度/评分/封面/追番数 |
| `user` | 名片 | 名片 | 昵称/头像/签名/粉丝数 |
| `generic` | 通用 | 通用 | 标题/描述/封面/链接 |

解析规则对齐原版 i18n 文案：视频（BV 号）、番剧（ep 链接）、漫画（mc 号）、音乐（au 号）、直播（房间号）、游戏（游戏 ID）等，非法输入返回「无法识别该链接」。

---

## 8. Markdown 管线

### 8.1 方向一：Markdown → JSON（导入/粘贴）

```text
markdown 文本 ──markdown-it(+task-lists)──► HTML ──generateJSON──► ProseMirror JSON
```

- markdown-it 预设 `default` + `markdown-it-task-lists`，与 eva3 同款管线；
- `importMarkdown(content, { replace })` 命令（对齐原版同名命令，含 `isImporting` 并发守卫、空解析报错 `markdownParseEmpty`）；
- 粘贴检测：`handlePaste` 中以 §8.3 启发式判定 → toast「检测到 Markdown 语法」→ 确认转换 / 取消保留原文（对齐 `markdownDetected` / `markdownConvertConfirm`）。

### 8.2 方向二：JSON → Markdown（导出/静态渲染）

- 优先使用 `@tiptap/static-renderer` 的 `renderToMarkdown`；
- 自定义序列化器补齐自定义节点：`image → ![caption](src)`、`latex → $$...$$`、`mention → @name`、`topic → #name#`、`emoji → :name:`、`taskItem → - [x]`、代码块 → 围栏 + 语言标注、表格 → GFM 管道表格；卡片不参与 Markdown 往返（保留占位说明）。

### 8.3 Markdown 检测启发式（detect.ts）

满足以下任一特征即判定为 Markdown：ATX 标题、有序/无序列表前缀、围栏代码块、行内强调（`**`/`__`/`~~`）、链接/图片语法、引用前缀、表格分隔行、任务列表前缀。多行文档按行投票（阈值 0.6）避免误判普通文本。

### 8.4 往返一致性保障

- **唯一扩展源**：`defaultExtensions` 数组是服务端渲染、客户端编辑器、Markdown 序列化三方的唯一派生源；
- 往返测试口径：Markdown → JSON → Markdown 语义无损（标题/列表/任务/代码/引用/表格/图片/公式/话题/@）；
- 卡片、对齐、缩进等 Markdown 表达力之外的信息在往返中显式声明丢失（设计取舍，非缺陷）。

---

## 9. 静态渲染与 SSR 安全清单

### 9.1 渲染入口

```text
Markdown → markdownToJSON → renderHTML(JSON) → HTML 字符串
JSON ─────────────────────► renderHTML(JSON) → HTML 字符串
JSON ─────────────────────► renderMarkdown(JSON) → Markdown 字符串
```

`@tiptap/static-renderer` 不实例化 Editor、不执行事务钩子，以下机制静态渲染不可用：

| 不可用机制 | 影响 | 替代方案 |
|:---|:---|:---|
| `addProseMirrorPlugins` | 插件逻辑不执行 | JSON 预处理阶段完成 |
| `onCreate` / `onUpdate` | 生命周期钩子不触发 | 纯 `renderHTML` 输出 |
| 事务驱动属性（Heading id、卡片快照） | 属性为空 | 渲染前调用 `generateHeadingIds` / 快照回写 |
| Decorations | 视觉装饰丢失 | 静态 HTML 中通过类名预置 |

### 9.2 SSR 安全清单

- [ ] Core/Server 层不出现 `document`、`window`、`HTMLElement`（Lint + 评审双重把关）；
- [ ] `generateJSON`/`generateHTML` 一律从 `@tiptap/html` 导入（同构实现），禁止从 `@tiptap/core` 导入同名函数；
- [ ] Client 层入口只暴露 `createEditor`，宿主 SSR 侧不得静态 import；
- [ ] 依赖事务属性的扩展在静态渲染前完成 JSON 预处理；
- [ ] NodeView 内禁止操作 `contentDOM` 之外的编辑器文档状态（防编辑态/静态态结构漂移）。

---

## 10. Opus 数据结构转换层（core/opus）

对齐 eva3 `OpusNodeFactory` 的双向映射，作为宿主对接 B站后端数据格式的参考实现：

| PM 节点/标记 | opus 结构 |
|:---|:---|
| `paragraph` 内文本 + marks | `node_type: 1` word 节点（`font_size` 默认 17、`bold/italic/strikethrough/underline`、`font_level`） |
| `link` / `mention` / `topic` / `emoji` | `node_type: 3` link 节点（`link_type` 枚举，`show_text`） |
| `latex` | `node_type: 5` formula 节点（`latex_content`） |
| `image` | pics 数组（宽高/注释） |
| `card` | `content_card`（`card_style` / `card_info`） |

提供 `jsonToOpus(json)` 与 `opusToJson(opus)`，未识别节点记录 `logUnsupportedNode` 并跳过（与原版行为一致）。

---

## 11. 客户端交互系统

### 11.1 工具栏（kala-toolbar）

按登录态原版编辑器 1:1 复刻，采用 lit 自定义元素实现，全部组件为 `kala-*` 前缀：

- 根容器：高 41px，flex 排布，gap 14px，padding 8px 16px，背景 `#f6f7f8`，底边 `0.8px solid #e3e5e7`；
- 28 个 item 顺序：撤销、重做、分隔、格式刷、清除格式、分隔、标题下拉、极小字号、加粗、斜体、下划线、删除线、字色、背景色、分隔、对齐、有序列表、无序列表、分隔、图片、链接、分割线、引用、表情、加号、分隔、导入、预览（预览项 `margin-left:auto` 靠右）；
- 基础组件：`kala-icon`、`kala-tooltip`、`kala-button`、`kala-popover`、`kala-dropdown`、`kala-toolbar-select`、`kala-menu`、`kala-menu-item`、`kala-toolbar-splitter`；
- 图标 SVG 从登录态原版 shadow DOM 原样导出（`toolbar-icons.ts`），标题下拉 164px 宽、选项 42px 高，字色/背景色面板 236px 宽，表情面板 8 列 40px；
- 每个 item 自主订阅编辑器 `transaction` / `selectionUpdate` 刷新激活态，浮层统一由 floating-ui fixed 策略定位。


### 11.2 斜杠菜单（kala-slash-menu）

`/` 触发，键盘上下选择 + Enter 确认 + Esc 关闭；分组：基础（正文/H1–H3/列表/任务/引用/代码块/分割线）、媒体（图片/公式/表格）、卡片（16 类）。

### 11.3 气泡菜单

- 选区气泡（kala-bubble-menu）：加粗/斜体/删除线/下划线/行内代码/链接/清除格式；
- 链接悬停气泡：打开/编辑/删除；
- 图片悬停气泡：替换/注释/删除/重试/查看大图。

### 11.4 拖拽手柄（kala-drag-handle）

悬停块左侧出现手柄按钮，点击展开块菜单（复制副本/删除）；按住拖动以 NodeSelection 实现 Block 这一层级的排序，拖拽过程显示目标位置指示线。

### 11.5 手机预览（kala-preview）

点击工具栏预览按钮后，编辑区右侧出现 214px sticky 预览列，内部为 iPhone 375×812 机身，通过 `--iphone-scale: 0.5` 缩放为 195.5×414：

- 组件：`kala-preview`（关闭按钮 + 夜间模式开关）、`kala-preview-theme`、`kala-preview-iphone`（边框、侧键、状态栏、Home 指示条）、`kala-preview-interact`（顶栏、滚动正文、评论胶囊、三连操作栏）、`kala-preview-user`、`kala-preview-content`、`kala-avatar`、`kala-toggle`；
- 正文经 Core `renderToHTML` 静态渲染后写入 `.kala-content`，排版对齐原版手机端 17px / 1.7，标题 19/18/17px，块间距 24px，标题上间距 36px；
- 文档为空时显示「这是正文提示语」，标题取文档首个 heading，无 heading 时显示「标题在手，三连我有」；
- 关闭按钮与夜间模式开关均为组件内部交互，关闭时同步工具栏预览状态。


### 11.6 其他

- 目录面板（kala-toc）：从文档实时提取 heading 树，点击滚动定位，空态文案「对文档内容应用“标题”样式即可生成目录」；
- 弹窗系统（kala-modal）：链接、公式（katex 实时预览）、图片（URL/上传/caption）、@用户搜索；遮罩 + Esc 关闭 + 焦点管理；
- 表情选择器：Unicode 分类数据静态表；
- Toast：Markdown 检测、图片上限、缩进上限等轻提示。

---

## 12. 样式体系（类名驱动）

- **前缀映射**：原版 `eva3-*` → 本库 `kala-*`（如 `eva3-toolbar-item` → `kala-toolbar-item`），结构对齐原版 DOM 分层；
- **tokens.css**：颜色/字号/间距/圆角/阴影全部收敛为 CSS 变量（`--kala-color-*`、`--kala-bg-*` 调色板 6×4+3、`--kala-editor-max-width` 等），主题定制仅需覆盖变量；
- **content.css**：`.kala-content` 作用域下的正文排版（标题/列表/引用/代码块/表格/图片/公式等），配合 ProseMirror 伪元素（`p.is-editor-empty::before` 等）；
- **零行内样式**：渲染 HTML 仅含语义类名与 data 属性；**唯一例外**为任意值属性（字号 px、图片对齐等无法枚举的动态值），以 CSS 自定义属性形式注入并在注释中标注；
- **代码高亮样式**：hljs 类名（`.hljs-keyword` 等）以 token 变量着色，不引入整包主题 CSS。

---

## 13. 国际化

- key 结构对齐 eva3 i18n（`bulletList=无序列表`、`markdownDetected=检测到 Markdown 语法`、`tocEmpty=对文档内容应用“标题”样式` 等）；
- 内置 `zh-CN`（默认）与 `en`，`createEditor({ locale })` 切换，支持宿主扩展 `messages` 合并；
- 所有 UI 文案（工具栏 tooltip、菜单、弹窗、toast）禁止硬编码，必须走 `t(key)`。

---

## 14. 构建与分发

- **tsup 三入口**：`core`（esm + d.ts，platform neutral）、`server`（platform: node）、`client`（platform: browser）；CSS 通过 `sideEffects: ["**/*.css"]` 保护不被 tree-shaking 误删；
- **exports 映射**：`.` → core；`./server`；`./client`；`./styles` / `./styles/tokens` —— 服务端永远不会意外打包客户端 NodeView 代码；
- Vite demo 直接引用 `src/` 源码开发调试，`build:lib` 产物用于发布。

---

## 15. 验收标准

1. `pnpm typecheck` 零错误（strict 模式，禁止 `as` 断言泛滥）；
2. `pnpm lint`（ESLint）零错误；
3. `pnpm build` / `pnpm build:lib` 成功；
4. Demo 页完成 §1.2 功能清单的可视验收：工具栏全功能、斜杠菜单、三种气泡、拖拽手柄、预览分栏、目录、字数统计、20 种卡片视图 mock、公式渲染、Markdown 导入/导出/粘贴转换、Word 导入；
5. Markdown → JSON → Markdown 往返语义无损（§8.4 范围）；
6. Markdown → JSON → HTML 静态渲染输出与编辑态渲染 DOM 结构一致（双端契约表逐项核对）；
7. Core/Server 层 grep 无 `document`/`window` 引用。

---

## 16. 宿主集成（hilihili-components）

父程序位于同仓库 `hilihili-components`（Solid 应用），通过 Vite alias 直接引用 kalamos 源码，避免依赖预构建产物：

```ts
// hilihili-components/vite.config.ts 与 demo-ssr/vite.config.ts
{ find: /^kalamos\/client$/, replacement: '.../kalamos/src/client/index.ts' }
{ find: /^kalamos\/styles$/, replacement: '.../kalamos/src/styles/index.css' }
{ find: /^kalamos\/demo$/,   replacement: '.../kalamos/src/demo/sample-doc.ts' }
{ find: /^kalamos$/,         replacement: '.../kalamos/src/core/index.ts' }
```

- **演示页**：`src/pages/OpusEditorDemo/index.tsx`，路由 `/opus-editor`，父应用壳层与布局使用 CSS Modules（`index.module.css`）；
- **编辑模式**：`onMount` 内动态 `import('kalamos/client')`，服务端不加载任何 DOM 代码；编辑器内部只使用 Tiptap/ProseMirror/lit，不引入 Solid；
- **静态模式**：直接调用 Core `renderToHTML(sampleDoc)`，输出放入 `.kala-content` 容器，与 Node 端 SSR 使用同一套卡片模板；
- **SSR 演示**：`demo-ssr/App.tsx` 引入 `renderToHTML(previewDoc)`，服务端 `renderToString` 首屏 HTML 中即可检索到 `kala-card-wrapper`，验证卡片服务端直出；
- **共享示例数据**：`kalamos/src/demo/sample-doc.ts` 导出 `sampleDoc`（20 种卡片视图全量）与 `previewDoc`（首屏精简版），kalamos demo 与父应用共用。

---

## 17. 实现与验证记录（2026-10-27）

| 项目 | 状态 | 说明 |
|:---|:---|:---|
| 20 种卡片视图 | 已完成 | 模板逐条对齐生产包 DOM；评论基础/进阶/截图三种形态按原版模板重写 |
| kala-* 类名 | 已完成 | `eva3-*` / `ev-*` / `--ev-*` 全部替换，Core 解析规则同步移除 eva3 选择器 |
| 卡片 CSS | 已完成 | 从 `editor.css` 卡片区块（约 101KB、623 条规则）整段移植，含 B 站变量回退 |
| NodeView 与插入菜单 | 已完成 | 工具栏卡片菜单 16 类、斜杠菜单、悬停编辑/删除；评论卡片三态外壳 |
| SSR 静态渲染 | 已完成 | Core `renderToHTML` 输出完整卡片 DOM，头像使用内联 SVG，离线可渲染 |
| 编辑器交互 | 已完成 | 工具栏 / 斜杠 / 气泡 / 拖拽 / 目录 / 预览 / 字数统计 |
| 父应用演示页 | 已完成 | Solid + CSS Modules，编辑/静态双模式，路由 `/opus-editor` |
| 文档 | 已完成 | 类名、卡片数量、宿主集成与验证记录已同步 |

### 17.1 交互回归（2026-10-28）

浏览器逐项点击验证 `/opus-editor` 的编辑态，修复并复验以下问题：

| 项目 | 结果 | 说明 |
|:---|:---|:---|
| 浮层定位统一 | 已修复 | `.kala-dropdown` / `.kala-bubble` 改为 `position: fixed`，与 `positionFloating`（floating-ui fixed 策略）坐标系一致；标题、字号、字体、字级下拉均贴住触发按钮，底部空间不足时自动上翻 |
| 选区气泡锚点 | 已修复 | 气泡参照物由整个编辑区改为选区虚拟矩形（`coordsAtPos(from/to)`），选中文本上方 6px 处显示 |
| 格式刷激活 | 已修复 | 激活时记录采样选区，忽略 `focus()` 触发的同选区事务，避免刚点格式刷就被判定为「已完成新选区」而立即退出 |
| 斜杠菜单 | 已修复复验 | 移除错误的 `positionFloating(document.body, ...)` 异步覆盖，改为按光标矩形手写定位；补 `command` 绑定后回车可执行，不再落到默认空操作 |
| 表情面板 | 已修复复验 | 工具栏传入 `builtinEmojis`，面板 16 项可插入 |
| 色板 / 表情 / 卡片菜单 | 已复验 | 均为 fixed 浮层，位于视口内且贴近触发按钮 |
| 工具栏功能 | 已复验 | 撤销重做、标题下拉、加粗/斜体/删除线/下划线/行内代码、上下标、字色/背景/高亮、字号/字体/字级、对齐、缩进、列表/任务列表/引用/代码块/分割线、表格（3×3 表头）、图片弹窗、链接弹窗、公式弹窗、表情、@插入、话题插入、卡片菜单（16 类）、清除格式、格式刷、预览分栏、目录、全屏、Word 导入入口（`.docx` 文件选择）均产生预期 DOM 变化 |
| SSR 输出 | 已复验 | `npm run build:lib` 通过；Node 直接调用 `kalamos/server` 的 `renderMarkdownToString` / `renderJSONToString`，输出包含标题、表格、代码、链接、卡片 DOM 与 katex 公式 |
| 宿主类型 | 已修复 | `hilihili-components/src/kalamos-modules.d.ts` 的 `sampleDoc` 由 `unknown` 改为 `{ type; content? }`，OpusEditorDemo 顶层节点统计通过类型检查 |

**已知环境限制**

- 原版 B 站编辑器菜单的 1:1 视觉核对需要登录态，本次未访问任何凭据，仅按已保存的生产包 DOM/CSS 与渲染页结构对齐；
- 内置浏览器截图接口在隐藏视口下返回 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`，本轮以 DOM 尺寸/类名/交互结果作为验证依据。

**待核对差异**

- 工具栏 `@` 与 `#` 按钮当前直接插入字符；输入法键入 `@` 时会出现用户搜索下拉，按钮点击是否也应立即唤起下拉，需登录原版后确认。

### 17.2 lit 工具栏与手机预览复刻（2026-10-28）

按登录态原版 DOM/CSS 重新复刻，工具栏与手机预览全部改为 lit 自定义元素，组件名统一 `kala-*`。

| 项目 | 结果 | 说明 |
|:---|:---|:---|
| 工具栏结构 | 已完成 | `kala-toolbar` 高 41px、`gap:14px`、`padding:8px 16px`、底色 `var(--bg2,#f6f7f8)`、下边框 `1px var(--line_regular,#e3e5e7)`、`justify-content:center`；28 个 item 顺序与原版一致，预览按钮 `margin-left:48px`（对齐 `.eva3-toolbar-item-preview` 抓取值） |
| 工具栏组件 | 已完成 | 基础组件 `kala-icon` / `kala-tooltip` / `kala-button` / `kala-popover` / `kala-dropdown` / `kala-toolbar-select` / `kala-menu` / `kala-menu-item` / `kala-toolbar-splitter`，28 个 item 均为独立 `kala-toolbar-*` 元素 |
| 预览面板 | 已完成 | `kala-preview-panel` 宽 214px、sticky 顶距 41px；`kala-preview` 宽 196px，内部 iPhone 375×812、8px 边框、圆角 48、`--iphone-scale:0.5`，实测 196×414 |
| 预览部件 | 已完成 | `kala-preview-theme` / `kala-preview-iphone`（状态栏、侧键、底部指示条）/ `kala-preview-interact`（顶栏、滚动区、评论胶囊、三连操作栏）/ `kala-preview-container` / `kala-preview-title` / `kala-preview-user` / `kala-preview-avatar` / `kala-preview-content` / `kala-toggle` |
| 正文排版 | 已完成 | 17px / 1.7，颜色 `--Ga9`；块间距 24px，标题 19/18/17px、上间距 36px；标题取自文档首个 heading，空文档显示「标题在手，三连我有」「这是正文提示语」占位 |
| 预览联动 | 已完成 | 编辑事务经 `renderToHTML` 实时同步，公式用 katex 就地渲染；关闭按钮同步工具栏预览按钮激活态；夜间模式通过 `kala-preview-theme[theme=dark]` 覆写 B 站变量 |
| 组件前缀 | 已完成 | 源码内无 `eva3-*` 自定义元素注册，`eva3` 仅保留在溯源注释中 |
| i18n | 已完成 | 工具栏与预览新增文案全部走 `t()`，中英文语言包同步补齐；选项数组改为函数调用，避免模块加载时锁死语言 |
| SSR / 依赖边界 | 已完成 | Core 零 lit、零 DOM 依赖；Client 引入 lit 3.3.3，编辑器与预览不含 Solid |

**useDefineForClassFields 修复（2026-10-28）**

kalamos `tsconfig.json` 为 `target:es2023` 且未关闭 `useDefineForClassFields`（默认 true），lit 组件里「`static properties` + 类字段初始化器」会以自有字段遮蔽 lit 的响应式访问器；lit 3 dev 模式在 `performUpdate` 阶段直接抛错并中断该元素渲染，导致工具栏一个图标都不显示（CDP 捕获到 kala-icon / kala-tooltip / kala-button / kala-toggle / kala-preview-user / kala-preview-interact / kala-preview-theme / kala-toolbar-preview 全部抛 class-field-shadowing 错误）。

修复方式：toolbar.ts 与 preview.ts 全部 16 处响应式属性改为 lit 官方写法 `declare 字段: 类型` + 构造器赋值（如 `declare name: string`、`constructor() { super(); this.name = '' }`）。

**验证状态（CDP 无头 Chrome 实测，2026-10-28）**

- `pnpm typecheck`：通过，零错误；针对性 `eslint`（toolbar.ts / preview.ts）：通过；`pnpm build:lib`：通过（core / server / client 三入口 + d.ts）；
- 工具栏：28 个 item 全部升级渲染，`kala-icon` 内 SVG 正常显示（截图对照原版图标一致）；实测 高 41px、`gap:14px`、`justify-content:center`、底色 `rgb(246,247,248)`、下边框 1px、预览按钮 `margin-left:48px`；
- 标题下拉：经四层 shadowRoot 穿透点击后展开，182×210px，H1/H2/H3/正文 4 项，当前项蓝色高亮带对勾；
- 手机预览：点预览按钮展开 214px 面板，body 加 `kala-editor-body--preview`，iPhone 实测 196×414（0.5 缩放），正文实时渲染（含加粗/下划线/高亮/任务列表）；关闭按钮点击后面板 `hidden` 且 body 类名复位；
- 夜间模式：`kala-toggle` 点击后 reflect 出 `checked` 属性，light DOM 的 `kala-preview-theme` 属性由 `light` 变 `dark`，`--bg1` 解析为 `#18191c`，截图确认整屏暗色；
- 控制台：整个交互过程 0 个 pageerror；
- 20 张卡片三态正常：error 态全部 `display:none`，21 张卡 loaded 态可见，与回归前一致。

**验证方法备注**：内置浏览器无法访问本机 Vite 服务（`localhost` / `127.0.0.1` 均返回 `ERR_ABORTED`，沙箱网络边界限制），改用无头 Chrome + CDP（`--remote-debugging-port` + `Page.captureScreenshot` / `Runtime.evaluate`）完成实机回归。

