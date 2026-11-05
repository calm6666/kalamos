# kalamos 开发实现文档 —— B 站专栏编辑器/渲染页 1:1 复刻

> 本文档是执行基准。所有实现必须以「逆向证据」为唯一母本，禁止凭印象或经验自创。
> 类名前缀统一：编辑器内部 `eva3-` → `kala-`；渲染端 `bili-dyn-` → `kala-`；`opus-` 正文类 → `kala-`。
> 结构、层级、样式值必须与原版逐字节一致，只允许改前缀。

## 1. 目标

1. **编辑器**（kalamos，禁止引入 Solid）：1:1 复刻 `https://member.bilibili.com/york/read-editor` 的编辑区 UI 与 20 种卡片的编辑态展示，允许/继续使用 lit-element（web component 风格）实现卡片视图。
2. **渲染展示**：1:1 复刻两个 opus 页的正文渲染 UI：
   - `opus/1262391497954689049`：纯图文 + 相册（bili-album）
   - `opus/1225703900149973011`：标题/TOC/话题/高亮/大字级/失效链接卡
3. **SSR 纯展示**：编辑器与渲染器支持服务端纯字符串输出（无 DOM 依赖），对外暴露 `./server` 入口。
4. **外部父程序**（hilihili-components，Solid）：复刻 B 站编辑器页外壳（工具栏背景、目录栏、发布设置栏、顶部布局）与 opus 页外壳（头部导航、正文容器布局），使用 module CSS。父程序只做宿主，不参与编辑器内部渲染。
5. 每个功能均需浏览器点击实测（工具栏按钮、卡片插入、渲染模块），由用户最终验收。

## 2. 架构

```
hilihili-components (Solid 宿主，module CSS)
├── demo 页面 A：编辑器页外壳 + <kalamos-editor>（挂载 kalamos client）
└── demo 页面 B：opus 展示页外壳 + SSR HTML 直出（kalamos server 产物）

kalamos (纯 TS + lit，三层，禁止 Solid)
├── core/     框架无关：schema、extensions、cards 模板（renderContentString）、markdown、SSR html
├── client/   编辑器 UI：lit web component 卡片视图、toolbar、slash-menu、preview
└── server/   SSR：renderToHTML（纯字符串），输入 JSON/HTML
```

## 3. 逆向证据资产清单（均在 %TEMP%，为唯一母本）

| 文件 | 内容 |
| --- | --- |
| `read-editor.css` | 编辑器完整 CSS（269KB，唯一样式母本） |
| `read-editor.js` | 编辑器完整 bundle（5.4MB，模板/类名唯一母本） |
| `editor-cards-rules2.css` | 已筛出的 601 条卡片族规则（video/opus/vote/music/live/mall/game/goods/mall-goods/bangumi/manga/user/toy/generic/comment 等） |
| `editor-extra-rules.css` | comment-card 全部 125 条规则（basic.styled / advanced 两态） |
| `editor-eva3-rules.css` | eva3- 基础规则 459 条（card-wrapper/toolbar/editor/skeleton） |
| `card-templates-all.txt` | 各卡片 JS 模板证据（music/toy/vote/user/mall/game/goods/mall-goods/bangumi/manga 等） |
| `js-vc-area.txt` | video-card（--detailed/--player）/opus-card/comment-card 完整模板 |
| `js-generic-area.txt` | generic-card / vote-card buildVoteHtml 模板 |
| `opus-detail.1.css` / `opus-detail.1.fmt.css` | opus 渲染页完整 CSS（680KB） |
| `cards-rules.css` | 渲染端卡片规则（bili-dyn-card-* / opus-para-link-card / bili-dyn-upower-*） |
| `card-templates.txt` / `card-templates2.txt` | 渲染端 bili-dyn-card-video/ugc/article/common Vue 模板 |
| `dispatcher.txt` | 渲染端 16 种 LINK_CARD_TYPE 分发逻辑 |
| `opus-chunk1.js` | opus 渲染端 bundle |

**关键类名结论（编辑器侧，来自 bundle）**：
- 外壳：`eva3-toolbar` → `kala-toolbar`；`eva3-toolbar-item`、`eva3-toolbar-plus`、`eva3-toolbar-splitter`、`eva3-toolbar-item-preview` 等 → `kala-*`；编辑区 `tiptap ProseMirror eva3-editor` → `kala-editor`。
- 卡片外壳：`eva3-card-wrapper` → `kala-card-wrapper`；`data-in-editor` 属性保留（编辑态/展示态光标与交互分流的钩子）。
- 卡片类（16 种 + 形态变体）：`video-card video-card--detailed|video-card--player`、`opus-card`、`vote-card`、`music-card`、`live-card`、`mall-card`、`game-card`、`goods-card`、`mall-goods-card`、`bangumi-card`、`manga-card`、`user-card`、`user-inline`、`toy-card toy-card--link|toy-card-action`、`generic-card`、`comment-card-container basic styled|advanced`。
- 骨架屏：`eva3-card-loading` + 各卡 `-skeleton` → `kala-card-loading`。
- 渲染端卡片（dispatcher）：COMMON/MATCH/GOODS/VOTE/UGC/RESERVE/UPOWER_LOTTERY/OPUS/MUSIC/LIVE + EVA3_OPUS/EVA3_VIDEO/EVA3_COMMENT/EVA3_VOTE/EVA3_USER/EVA3_TOY + ITEM_NULL（tip「此内容无法展示」）+ default（tip「无法展示的卡片类型: X」）；类名 `bili-dyn-card-*` → `kala-card-*`（如 `bili-dyn-card-common` → `kala-card-common`），`bili-dyn-tip` → `kala-tip`。**样式值逐条照抄 `cards-rules.css` 与 `opus-detail.1.css`，仅改前缀。**
- 渲染页正文：`opus-module-content`、`opus-module-title`、`opus-toc`、`opus-para-pic` > `bili-album`（preview single > picture > picture__img）、`bili-topic`、`opus-text-rich-hl`、`opus-text-rich-emoji`、`opus-font-xLarge|xxLarge`、`opus-para-link-card`（失效卡）→ 前缀 `kala-`（`bili-album`→`kala-album`、`bili-topic`→`kala-topic`、`bili-ellipsis`→`kala-ellipsis`）。

**卡片模板关键结论（必须 1:1）**：
- video-card--detailed：`video-card-preview > video-thumbnail(16:9 封面 + badge + video-duration) + video-card-info > video-card-title + video-card-summary + video-card-author + video-card-stats(video-card-stat-item play-count/danmaku-count, BDC/playdata_square_line/1 + BDC/danmu_flying_square_line/1 图标) + video-card-meta`。
- video-card--player：`video-card-player-preview > video-player-cover(332px 封面 + video-card-badge + video-player-stats(video-player-duration/stat.play-count/stat.danmaku-count)) + video-player-enter(100x100 播放按钮) + video-card-player-info > video-card-player-title`。
- opus-card：`container > cover(img 64x64 + badge-images N图) + content(title + details(tag-only-fans/tag-dynamic + author uploader 16px + stats(stat-item view/reply)) + footer publish_text)`。
- toy-card：card_style 0 → `toy-card--link > toy-card-link__icon(eva3-icon→kala-icon) + toy-card-link__text`；非 0 → `toy-card--action > toy-card-container > toy-card-main(cover 64x64 + content(title + meta(badge + info(up icon+name / play-count)))) + toy-card-button`；有 url 时编辑器内 `<div data-href>`，展示态 `<a target=_blank rel=noopener>`。
- vote-card：`vote-card-container(voted/ended/upower/owner-mode) > header(title + multi-tag 多选 + desc) + options(has-images/collapsed, >9 折叠) + footer`；选项 HTML `buildOptionHtml`、页脚 `buildFooterHtml` 按证据实现。
- comment-card：`basic styled`（粉色 surface 346px：background-text + bilibili-logo + main-content(306px 圆角24 内嵌回复引用 reply-reference) + comment-footer(like-info) + video-source）与 `advanced`（灰底 var(--graph_bg_thin)：comment-main-content(avatar 36 + comment-body 356px) + like-section(30px 圆钮 + like-count) + comment-footer(divider + source-info)）两态，类名见 `editor-extra-rules.css`。
- user-card：`container > avatar-wrapper > user-avatar(img|placeholder) + info(name + desc?) + actions(follow-btn)`；空态 `user-card-empty` + `user-follow-skeleton`。
- generic-card：`generic-card-preview > generic-card-media(img) + generic-card-info(generic-card-title + generic-card-description?)`；info 字段兜底链 title||name||text、description||desc||intro||summary、cover||pic||avatar||face||icon。
- music-card：`container > cover(64x64) + content(title + details(badge「音乐」+ artist + duration) + intro)`。
- mall-card：`container > cover(48x64) + info(title + details(datetime + location) + price(¥ + value + 起))`。
- game-card：`container > cover(64x64|placeholder) + content(title + meta(badge「游戏」+ tags) + summary + button「进入」)`。
- goods-card：`container > image(64x64) + info(title + price(¥X 起)) + button「去看看」`。
- mall-goods-card：结构复用 goods-card-* 类名；price = (分/100).toFixed(2)；img 为数组取第一个。
- bangumi-card：`container > cover(48x64) + info(title + meta(badge + followText) + action(icon heart_collect_line/2 + action-text 追番/追剧))`。
- manga-card：`container > manga-cover(48x64) + content(title + details(badge「漫画」+ author) + summary + follow-button「追漫」)`。
- live-card：`container > cover(114x64 + badge(直播中/已结束)) + content(title + uploader(icon+name) + meta(online + area))`。

## 4. 20 种卡片类型（编辑器 cardTypes 终态）

video、opus（图文）、vote、music、live、mall（会员购展览）、game、goods、mall-goods（会员购商品）、bangumi、manga、user、user-inline、toy、comment、generic 为已证实 16 类；剩余以编辑器 plus 插入面板实测为准补齐（执行阶段逐一点开面板确认，宁多勿少，最终清单以面板为准）。每类卡片的 mock 数据字段按模板真实字段构造（info.title/up_name/cover 等真实字段名）。

## 5. 实现规范

1. **模板层**（core/cards/templates.ts）：每卡提供 `renderContentString(data)` 纯字符串输出（SSR 与编辑器共用），DOM 结构与 bundle 证据逐字符一致（空白/换行可忽略，标签结构与类名顺序必须一致）。禁用 `as` 断言；对象字段 camelCase；文件名 kebab-case；注释中文；禁止「(原 XXX)」类注释。
2. **CSS**：编辑器样式集中在 `src/styles/cards.css`（对齐 `editor-cards-rules2.css` 逐条改前缀誊写）与 `tokens.css`；渲染端样式在 `bdc.css`/`content.css`（对齐 `cards-rules.css`/`opus-detail.1.css`）。CSS 变量名保留原版（`--bg1/--text1/--line_regular/--brand_blue` 等）。父程序 hilihili-components 用 module CSS（`.module.css`）。
3. **lit 组件**（client/node-views）：卡片视图用 lit `customElement`，内部渲染模板字符串到 `contentElement`，与原版 BaseCard.renderContent 行为一致；`kala-` 前缀注册（如 `kala-card-video`）。
4. **SSR**：`core/render/html.ts` + `server/index.ts` 输出纯 HTML 字符串（卡片走 renderContentString），不触碰 document/window；opus 展示页 SSR 直出后父程序原样注入。
5. **父程序**（hilihili-components）：Solid 组件 + module CSS；编辑器页外壳含工具栏区/目录栏/正文容器/发布设置栏；opus 页外壳含头部导航与正文容器。demo 可点击跳转两个页面。
6. **验证闭环**：每完成一项 → `pnpm typecheck && pnpm lint && pnpm build`；UI 以浏览器截图对照原站比对；不自动开浏览器交用户验收（实测阶段除外）。

## 6. 执行顺序

1. 盘点差距：逐文件比对现有 kalamos 实现与证据（卡片类型数、类名前缀、模板结构、CSS 值），输出差距清单（写入本文档 §7）。
2. core/cards 重构：types（20 种）→ templates（按证据重写/补齐）→ icons（BDC 图标名与 SVG 对齐）→ mock 数据。
3. CSS 誊写：cards.css 按 editor-cards-rules2.css + editor-extra-rules.css + editor-eva3-rules.css 逐条改前缀誊写；bdc.css/content.css 按渲染端证据誊写。
4. client 适配：node-views/card.ts（lit 组件化、kala- 前缀）、toolbar（kala-toolbar 结构）、插入面板（plus 面板复刻）。
5. 渲染端：opus 正文模块（标题/TOC/话题/高亮/大字/相册/失效卡/emoji）+ 卡片渲染（dispatcher 16 类）。
6. SSR 验证 + hilihili-components demo（编辑器页 + 展示页）。
7. 全功能实测修复，全绿交付。

## 7. 差距清单（已盘点）

### 7.1 编辑器内部（kalamos core/client/styles）—— 基本完成，实测阶段逐项核对

| 项 | 现状 | 结论 |
| --- | --- | --- |
| 卡片类型 | 16 类 + topVideo，CardType/cardTypes 与证据一致 | 保持，插入面板实测后再定增补 |
| 卡片外壳 | `kala-card-wrapper ${className}` + `data-in-editor`，与证据 `WRAPPER:"eva3-card-wrapper comment-card"` 结构一致 | 保持 |
| video 变体 | `video-card--${player|detailed}` 动态拼接，模板分叉正确 | 保持 |
| 模板细节 | templates.ts 按 §3 结论实现，但 vote/user/comment/opus 等字段级细节未逐字符比对 | 实测阶段截图比对修正 |
| 卡片 CSS | cards.css 103KB，全部卡片族类名齐备（video 77/opus 54/vote 398/…）；kala-toolbar 在 ui.css（13 处） | 保持，逐卡片实测比对 |
| 前缀残留 | 源码无 eva3-/bili-dyn- 运行时残留（仅 3 处中文注释提及来源，允许保留） | 无需处理 |

### 7.2 渲染端 opus 展示页 —— 严重缺失，本次主要工作量

| 项 | 现状 | 动作 |
| --- | --- | --- |
| opus 正文渲染器 | 不存在：无 opus-module-title/opus-module-content/kala-album/opus-para-pic/opus-text-rich-hl/opus-font-xLarge/kala-ellipsis 输出 | 新建 `core/opus/render.ts`：opus JSON → 展示页 DOM（标题/TOC/正文段落/图片相册/话题/高亮/大字/emoji/失效链接卡），类名按 §3 渲染端结论改 kala- |
| 正文 CSS | content.css 仅 9.5KB，opus-module/kala-album/opus-para/kala-ellipsis 计数全为 0 | 按 `opus-detail.1.css` 证据逐条誊写正文模块样式（只改前缀） |
| 卡片渲染 dispatcher | 不存在：kala-card-common/kala-card-video 等 16 类渲染端卡片未实现 | 新建 `core/opus/cards-dispatcher.ts`：LINK_CARD_TYPE 16 类分发，复用编辑器 renderContentString 数据结构，样式按 `cards-rules.css` 誊写进 bdc.css 或新文件 |
| 展示数据源 | 两个 opus 页（1262391497954689049 纯图文+相册 / 1225703900149973011 标题/TOC/话题/高亮/大字/失效卡）无样本数据 | 新建 demo 数据文件：按两页面实际内容构造 opus JSON |
| SSR 直出 | server 入口仅输出编辑器通用 HTML（renderToHTML 走 tiptap static-renderer），opus 展示页结构未接入 | server 增加 opus 展示页直出函数（纯字符串，无 DOM） |

### 7.3 父程序 hilihili-components —— 部分完成

| 项 | 现状 | 动作 |
| --- | --- | --- |
| 编辑器页外壳 | OpusEditorDemo 为通用演示壳（hero+tabs），非 B 站编辑器页 1:1 外壳 | 重做：按原站布局复刻顶部布局/工具栏背景区/目录栏/正文容器/发布设置栏，内部挂 kalamos 编辑器，module CSS |
| opus 展示页外壳 | 不存在 | 新建 OpusDisplayDemo：头部导航 + 正文容器，SSR HTML 注入，module CSS |
| 路由/跳转 | demo 两页面互跳入口 | 补齐 |

### 7.5 渲染端取证结论（浏览器实测，构建渲染器唯一母本）

**类名映射（渲染端，样式值逐字节照抄只改前缀）**：
`opus-` → `kala-`（kala-module-content/kala-module-title/kala-toc/kala-para-pic/kala-pic-view/kala-paragraph-children/kala-font-xxLarge/kala-text-rich-hl/kala-para-link-card/kala-heading-highlight/kala-module-author 等）；`bili-dyn-` → `kala-`（bili-dyn-pic→kala-pic、bili-dyn-tip→kala-tip、bili-dyn-card-*→kala-card-*）；`bili-album`→`kala-album`、`bili-topic`→`kala-topic`、`bili-ellipsis`→`kala-ellipsis`、`bili-opus-view(-wrap)`→`kala-opus-view(-wrap)`、`b-img`→`kala-bimg`、`b-avatar`→`kala-bavatar`、`bili_dark`→`kala_dark`。`.reference` 上下文选择器保留原样。

**页面级结构**（body 直下）：
```
HEADER.bili-header.bili-header--mini.bili-header--fixed（64px）
DIV（空占位）
DIV
  DIV.bgc（fixed 封面主色背景 rgb(211,233,232)）
  DIV.bg（透明）
  DIV.opus-detail（708px、margin 0 168px、padding 0 0 10px、bg white）
    DIV.bili-opus-view-wrap（position:relative）
      DIV.opus-toc.opus-toc--expanded（fixed，style="left:-84px; top:72px; width:240px; --toc-panel-max-height:calc(100vh - 72px - 12px)"）
      DIV.bili-opus-view（708px、bg white、radius 6px 6px 0 0）
        DIV.opus-module-top > __display > __album > __album__cover（708px 封面）
        DIV.opus-module-title > __inner > __inner-mask[data-title-anchor] > __content > __text
        DIV.opus-module-author
        DIV.opus-module-topic
        DIV.opus-module-content.opus-paragraph-children（color var(--Ga9) 17px/29px，padding 0 56px 36px）
        DIV.opus-module-copyright
        DIV.opus-module-bottom
      comment-wrap > bili-comment-container > bili-comments（评论区，demo 可省）
```
body 背景 #f1f2f3；header 高 64px。

**正文段落 DOM（opus-module-content 内，前缀改 kala-）**：
- 文本段：`<p><span style="background:;color:;">文本run</span><strong>加粗</strong></p>`（span 空样式也保留 style 属性，color 后无分号 `background:;color:;`）
- 图片段：`DIV.kala-para-pic.center > DIV.kala-pic-view > DIV.kala-pic > DIV.kala-pic__img > DIV.kala-bimg > PICTURE.kala-bimg__inner > SOURCE+SOURCE+IMG`；懒加载态另有 `DIV.kala-pic__mask > DIV.kala-pic__loading > SVG`（SSR 输出最终态：无 sleepy/mask）+ `DIV.kala-pic-view__caption`（13px text3，有文字才输出）
- 引用：`BLOCKQUOTE.kala-paragraph-children > P > SPAN + STRONG`（左边竖线样式见提取规则 158-159）
- 大标题：`<h1 data-heading-id="heading-N"><span class="kala-font-xxLarge" style="background:;color:;">1.钟离权出场造型</span></h1>`
- 高亮视频链接：`<a href target=_blank class="kala-text-rich-hl video" style="font-size:17px;background:;"><svg 20x20>播放圆圈path</svg><span>文本</span></a>`
- 失效卡：`<div class="kala-para-link-card"><div class="kala-tip"><svg 16x16 viewBox="0 0 16 16"><path d="M8 1.0833333333333333C4.1800299999999995 1.0833333333333333 1.0833333333333333 4.1800299999999995 1.0833333333333333 8C1.0833333333333333 11.81995 4.1800299999999995 14.916666666666666 8 14.916666666666666C11.81995 14.916666666666666 14.916666666666666 11.81995 14.916666666666666 8C14.916666666666666 4.1800299999999995 11.81995 1.0833333333333333 8 1.0833333333333333zM8 4.625C8.414233333333334 4.625 8.75 4.96079 8.75 5.375L8.75 8.25C8.75 8.664233333333334 8.414233333333334 9 8 9C7.585766666666665 9 7.25 8.664233333333334 7.25 8.25L7.25 5.375C7.25 4.96079 7.585766666666665 4.625 8 4.625zM7.25 10.375C7.25 9.960766666666665 7.585766666666665 9.625 8 9.625C8.414233333333334 9.625 8.75 9.960766666666665 8.75 10.375L8.75 10.5C8.75 10.914233333333332 8.414233333333334 11.25 8 11.25C7.585766666666665 11.25 7.25 10.914233333333332 7.25 10.5L7.25 10.375z" fill="currentColor"/></svg><span class="kala-ellipsis">此内容无法展示</span></div></div>`
- TOC：panel > header(label「目录」+collapse-btn>chevron>svg.opus-toc__chevron-icon 16x16 path 完整值见 `%TEMP%\opus-svg-evidence.txt` A2) + list(title + item(row--d0 > arrow>svg 8x8[A5] + content>text)；有子级 arrow 加 `--has-children` 且 row 后跟 `opus-toc-item__children` 嵌套 --d1 项，无子级为 Vue 空注释占位；chevron 折叠态类名 `opus-toc__chevron--collapse`)
- 作者模块（完整实测）：`DIV.opus-module-author > DIV.opus-module-author__left > DIV.opus-module-author__avatar(style="width:66px;height:66px;") > DIV.b-avatar(66px，含 __canvas>__layers>__layer center [AVATAR_LAYER 37.776px 圆形头像 picture>source webp+img] + PENDENT_LAYER 66px 挂件 + ICON_LAYER 20px 圆形徽章)`；`__center > __name-row > __name(style="color:#FB7299;")` + `__pub > __pub__text`；`__right > __more > DIV.opus-more > DIV.opus-more__container.opus-more__btn[data-type=more] > svg 24x24 三点竖排 path：M13.7485 5.49841C13.7485 6.46404 12.9657 7.24683 12.0001 7.24683C11.0344 7.24683 10.2516 6.46404 10.2516 5.49841C10.2516 4.53279 11.0344 3.75 12.0001 3.75C12.9657 3.75 13.7485 4.53279 13.7485 5.49841ZM13.7484 18.4982C13.7484 19.4639 12.9656 20.2467 11.9999 20.2467C11.0343 20.2467 10.2515 19.4639 10.2515 18.4982C10.2515 17.5326 11.0343 16.7498 11.9999 16.7498C12.9656 16.7498 13.7484 17.5326 13.7484 18.4982ZM11.9999 13.7487C12.9656 13.7487 13.7484 12.9658 13.7484 12.0002C13.7484 11.0345 12.9656 10.2517 11.9999 10.2517C11.0343 10.2517 10.2515 11.0345 10.2515 12.0002C10.2515 12.9658 11.0343 13.7487 11.9999 13.7487Z`
- 话题：`.bili-topic > svg 20x20（# 图标 4 条 path，完整值见取证文件 A1）+ 文本（bili-topic__text）`
- **补充取证已完成**（2026-10-28）：全部剩余 SVG/模块 DOM 已取全，逐字符证据在 `%TEMP%\opus-svg-evidence.txt`：A1 bili-topic 20x20 完整 4 path、A2 chevron 16x16 完整 path、A3 video-hl 播放圆圈 20x20 完整 2 path、A4 share 5 图标 44x44（动态/微博/微信双色/QZone/QQ，rect rx=22 currentColor + white path）、A5 toc-item 8x8 箭头 path、B1 copyright、B2 topic 模块、B3 top 模块（封面 picture 1416w_798h + height:419px）、B4 feedback、B5 toc panel 完整层级与 16+6 目录项。
- demo 真实图片 URL（page1 前 8 张）：i0.hdslb.com/bfs/new_dyn/0946bafe25fbc13e9cfe912d8ba8f08b46845469.jpg@1192w.webp、251cbcaa254d92b1659beb55412dd45146845469.jpg@1192w.webp、4d4853cdeb337c8b536cb182e1d191a546845469.png@1192w.webp、5f0266c6aec48beedb89b9418a8504a146845469.jpg@1192w.webp、4db3792e15bee59182d7ab869630ebf846845469.webp@948w_1114h.webp、607a9897dbad00771351ca5f79c1243b46845469.jpg@1192w.webp、b8936ed6c1146314bce0f364e57188f046845469.jpg@1192w.webp、071fafafd68efb7d7de533abf0010cff46845469.jpg@1192w.webp；头像 i0.hdslb.com/bfs/face/e9c8f4e9dc988ea1af42398ca65f56263fd7c4df.jpg@74w_74h_1c_1s.webp
- 正文 CSS 证据已提取：`%TEMP%\opus-content-rules.txt`（305 条规则，含 :root b-img 变量/kala-bimg/kala-pic/kala-tip/kala-album/正文段落/标题/TOC/作者/版权/底部/高亮/emoji 全套）；页面布局规则 `%TEMP%\opus-page-rules.txt`（13 条，bili-opus-view 系）；渲染端卡片规则 `%TEMP%\cards-rules.css`（299 行，已完整读过：kala-card-common/match/goods/vote/ugc/reserve/upower/music/live/opus + kala-pic/kala-tip/kala-ellipsis + reference 上下文）。
- bundle 中无现成 SVG path（已验证 opus-chunk1.js 不含 topic/video-hl/chevron 完整 path），浏览器直取方案见上条「补充取证已完成」，渲染端证据链齐备，可直接进入构建阶段。

### 7.4 执行优先级（更新 §6）

1. ~~盘点差距~~（本节）
2. 渲染端 opus：`core/opus/render.ts` + content.css 誊写 + 卡片 dispatcher + demo 数据（最大缺口）
3. SSR：server opus 直出 + 验证
4. 父程序：OpusEditorDemo 外壳 1:1 重做 + OpusDisplayDemo 新建
5. 编辑器侧：逐卡片实测比对修正（vote/user/comment/opus 模板细节、工具栏 28 项、插入面板）
6. 全功能实测修复，全绿交付

## 8. 验收标准

- 编辑器：工具栏 28 项、插入面板卡片入口与原站一致；16+ 卡片编辑态 DOM 类名与证据一致（前缀 kala-）；编辑区排版与原站截图逐像素对齐。
- 渲染端：两个 opus 页正文 DOM 结构与原站一致；卡片族 CSS 值与 opus-detail.1.css 一致。
- SSR：`server` 入口在 Node 环境无 DOM 输出与浏览器渲染一致的 HTML。
- 父程序：hilihili-components demo 两页面可用，module CSS，无样式污染。
- 质量门：typecheck / ESLint / build 全部 0 错误。
