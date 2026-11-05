# kalamos

kalamos（κάλαμος，古希腊芦苇笔）：纯 TypeScript 富文本编辑器库，基于 Tiptap 3 + ProseMirror，支持 Markdown 双向转换与 SSR 静态渲染。

## 分层与导出

| 子路径 | 层 | 环境 | 内容 |
| --- | --- | --- | --- |
| `.` | core | 同构（Node 与浏览器，零 DOM） | Markdown 与编辑器 JSON 互转（`markdownToJSON`、`renderToHTML`）、卡片模板（`buildCardHTML` 等）、类型与常量、opus 展示渲染 |
| `./server` | server | 仅 Node.js | 接收 Markdown / JSON 输出 HTML / Markdown 字符串（`renderOpusDisplay` 等），带 `assertNodeEnvironment` 守卫 |
| `./client` | client | 仅浏览器 | `createEditor` 装配与句柄类型、mock API、i18n（`setLocale` / `getLocale`）、表情（`builtinEmojis`）、word 导入、node-views |
| `./styles` | styles | - | `dist/styles/index.css` 样式汇总（令牌、正文、UI、卡片、opus，含 katex 样式） |
| `./styles/tokens` | styles | - | `dist/styles/tokens.css` 设计令牌 |

SSR 场景只引 `.` 与 `./server`，客户端编辑器经 `./client` 引入（该层永远不会被打进服务端包）。

## 构建

```sh
pnpm build:lib   # 库构建：tsup 三入口（core/server/client）+ dts + sourcemap，并把 src/styles 拷贝到 dist/styles
pnpm build       # 演示站构建（tsc && vite build），产物也是 dist，仅用于本地 demo
```

注意两个 build 的产物同名不同物：`build:lib` 首个入口自带 clean，会把之前演示站留下的 `index.html` / `assets` 清掉；发包或被应用消费前永远以 `build:lib` 为准。

## 外部依赖

`@tiptap/*`（3.32）、`markdown-it`（含 task-lists 插件）、`lowlight`、`katex`、`mammoth` 声明为构建外部依赖，不打进产物；它们同时在本包 `dependencies` 中，workspace 消费方经由 `packages/kalamos/node_modules` 正常解析。

## 开发

```sh
pnpm dev          # vite 演示站（src/main.ts + index.html）
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

## 接入与版本控制

- 接入模式：workspace **dist 引入**（打包后引入）。
- 当前消费方：暂无（尚未接线）。
- 版本控制：独立 git 仓库，挂载于根仓库 `packages/kalamos`（gitlink 记录指针，远程仓库就绪后转为正式 submodule）。
