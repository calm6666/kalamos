import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsup'

/**
 * 库构建配置：按设计文档分层构建 core / server / client 三入口。
 * - core：同构（Node 与浏览器均可），零 DOM 依赖
 * - server：仅 Node.js 环境
 * - client：仅浏览器环境
 * 样式不参与打包：构建成功后整体拷贝 src/styles 到 dist/styles（exports "./styles" 的承诺）。
 * clean 只放首块（块间共享 dist，逐块 clean 会互相删产物）；package.json 里的
 * `build` 是演示站 vite 构建，勿与 build:lib 混用，否则 dist 会被 demo 产物占据。
 */
const external = [/^@tiptap\//, 'markdown-it', 'markdown-it-task-lists', 'lowlight', 'katex', 'mammoth']

const copyStyles = () => {
  const stylesDir = join(process.cwd(), 'src/styles')
  const outDir = join(process.cwd(), 'dist/styles')
  mkdirSync(outDir, { recursive: true })
  for (const file of readdirSync(stylesDir)) {
    if (file.endsWith('.css')) copyFileSync(join(stylesDir, file), join(outDir, file))
  }
}

export default defineConfig([
  {
    entry: { 'core/index': 'src/core/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external,
  },
  {
    entry: { 'server/index': 'src/server/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    platform: 'node',
    clean: false,
    external,
  },
  {
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    platform: 'browser',
    clean: false,
    external,
    onSuccess: copyStyles,
  },
])
