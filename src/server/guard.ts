/**
 * Node 环境守卫
 *
 * Server 层入口必须在 Node.js 运行时调用；浏览器误引入时立即抛错，
 * 防止客户端 NodeView / UI 代码路径被意外触发。
 * 通过 declare const process 规避对 @types/node 的依赖。
 */
declare const process: { versions?: { node?: string } } | undefined

/** 断言当前运行在 Node.js 环境（否则抛出明确错误） */
export function assertNodeEnvironment(): void {
  const isNode =
    typeof process !== 'undefined' &&
    typeof process === 'object' &&
    process.versions !== undefined &&
    typeof process.versions.node === 'string'
  if (!isNode) {
    throw new Error(
      '[kalamos/server] 该入口仅可在 Node.js 环境使用；浏览器请改用 kalamos/client 的 createEditor',
    )
  }
}
