/**
 * @提及 Suggestion：键入 @ 唤起用户搜索下拉
 * - items 走 api.searchUser（异步）
 * - 弹层挂载用 Suggestion 内建 mount（自动随光标定位）
 * - 键盘 ↑/↓/Enter/Esc 导航
 */
import type { MentionOptions } from '@tiptap/extension-mention'
import type { UserInfo, EditorApi } from '../../core/types'
import { t } from '../i18n'

/** @提及建议项渲染器（对齐 ui.css 的 .kala-mention-menu；items 附加 label 以对齐 Mention 节点属性契约） */
export function createMentionSuggestion(api: EditorApi): MentionOptions['suggestion'] {
  let menu: HTMLDivElement | null = null
  let unmountMenu: (() => void) | null = null
  let currentItems: UserInfo[] = []
  let selectedIndex = 0
  let selectItem: ((user: UserInfo) => void) | null = null

  /** 关闭并卸载弹层 */
  const closeMenu = (): void => {
    if (unmountMenu !== null) {
      unmountMenu()
      unmountMenu = null
    }
    menu = null
  }

  /** 重建菜单条目 */
  const renderItems = (): void => {
    if (menu === null) {
      return
    }
    // 闭包内使用局部常量，避免模块级 let 变量的空值收窄失效
    const menuEl = menu
    menuEl.textContent = ''
    if (currentItems.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'kala-mention-menu__empty'
      empty.textContent = t('mention.empty')
      menuEl.appendChild(empty)
      return
    }
    currentItems.forEach((user, index) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className =
        index === selectedIndex
          ? 'kala-mention-menu__item is-selected'
          : 'kala-mention-menu__item'
      if (user.avatar.length > 0) {
        const avatar = document.createElement('img')
        avatar.className = 'kala-mention-menu__avatar'
        avatar.referrerPolicy = 'no-referrer'
        avatar.src = user.avatar
        avatar.alt = ''
        item.appendChild(avatar)
      } else {
        const avatarFallback = document.createElement('span')
        avatarFallback.className = 'kala-mention-menu__avatar'
        item.appendChild(avatarFallback)
      }
      const info = document.createElement('span')
      info.className = 'kala-mention-menu__info'
      const name = document.createElement('div')
      name.className = 'kala-mention-menu__name'
      name.textContent = user.name
      const sign = document.createElement('div')
      sign.className = 'kala-mention-menu__sign'
      sign.textContent = user.sign
      info.append(name, sign)
      item.appendChild(info)
      item.addEventListener('click', () => {
        selectItem?.(user)
      })
      menuEl.appendChild(item)
    })
  }

  /** 选中条目 */
  const pick = (user: UserInfo): void => {
    selectItem?.(user)
    closeMenu()
  }

  return {
    char: '@',
    // 搜索结果附加 label（Mention 节点属性契约），command 处按 MentionNodeAttrs 接收
    items: async ({ query }) => {
      const users = await api.searchUser(query)
      return users.map((user) => ({ ...user, label: user.name }))
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: props.id ?? '', label: props.label ?? '' } },
          { type: 'text', text: ' ' },
        ])
        .run()
    },
    render: () => ({
      onStart: (props) => {
        currentItems = props.items
        selectedIndex = 0
        selectItem = props.command
        menu = document.createElement('div')
        menu.className = 'kala-mention-menu'
        renderItems()
        // 托管挂载：插件负责 append、随光标定位与自动清理
        unmountMenu = props.mount(menu)
      },
      onUpdate: (props) => {
        currentItems = props.items
        selectedIndex = 0
        selectItem = props.command
        if (menu === null) {
          menu = document.createElement('div')
          menu.className = 'kala-mention-menu'
          renderItems()
          unmountMenu = props.mount(menu)
          return
        }
        renderItems()
      },
      onKeyDown: ({ event }) => {
        if (menu === null) {
          return false
        }
        if (event.key === 'ArrowDown') {
          const size = Math.max(1, currentItems.length)
          selectedIndex = (selectedIndex + 1) % size
          renderItems()
          return true
        }
        if (event.key === 'ArrowUp') {
          const size = Math.max(1, currentItems.length)
          selectedIndex = (selectedIndex - 1 + size) % size
          renderItems()
          return true
        }
        if (event.key === 'Enter') {
          const user = currentItems[selectedIndex]
          if (user !== undefined) {
            pick(user)
          }
          return true
        }
        if (event.key === 'Escape') {
          closeMenu()
          return true
        }
        return false
      },
      onExit: () => {
        closeMenu()
      },
    }),
  }
}
