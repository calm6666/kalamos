/**
 * 斜杠命令菜单：键入 / 唤起，键盘上下选择 + Enter 确认 + Esc 关闭
 * 基于 @tiptap/suggestion 驱动
 */
import { Extension } from '@tiptap/core'
import { Suggestion } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'
import { t } from '../i18n'

/** 斜杠命令定义 */
export interface SlashCommand {
  /** 唯一 id */
  id: string
  /** 展示标题的 i18n key */
  titleKey: string
  /** 展示描述的 i18n key */
  descKey: string
  /** 菜单图标（emoji 字符） */
  icon: string
  /** 执行命令 */
  run: (editor: Editor, range: Range) => void
}

/** 内置命令集（卡片命令由 editor 装配层补充） */
export function buildSlashCommands(insertCard: (editor: Editor, range: Range) => void): SlashCommand[] {
  return [
    {
      id: 'heading-h1',
      titleKey: 'slash.heading.h1',
      descKey: 'slash.heading.h1.desc',
      icon: 'H1',
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
    },
    {
      id: 'heading-h2',
      titleKey: 'slash.heading.h2',
      descKey: 'slash.heading.h2.desc',
      icon: 'H2',
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      id: 'heading-h3',
      titleKey: 'slash.heading.h3',
      descKey: 'slash.heading.h3.desc',
      icon: 'H3',
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      titleKey: 'slash.bulletList',
      descKey: 'slash.bulletList.desc',
      icon: '•',
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      titleKey: 'slash.orderedList',
      descKey: 'slash.orderedList.desc',
      icon: '1.',
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: 'task-list',
      titleKey: 'slash.taskList',
      descKey: 'slash.taskList.desc',
      icon: '☑',
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      id: 'quote',
      titleKey: 'slash.quote',
      descKey: 'slash.quote.desc',
      icon: '❝',
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: 'code-block',
      titleKey: 'slash.codeBlock',
      descKey: 'slash.codeBlock.desc',
      icon: '{}',
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      id: 'table',
      titleKey: 'slash.table',
      descKey: 'slash.table.desc',
      icon: '⊞',
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'divider',
      titleKey: 'slash.horizontalRule',
      descKey: 'slash.horizontalRule.desc',
      icon: '—',
      run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      id: 'image',
      titleKey: 'slash.image',
      descKey: 'slash.image.desc',
      icon: '🖼',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        // 图片命令经编辑器自定义事件触发（由 editor.ts 装配 openImageModal）
        editor.emit('kalamos:request-image')
      },
    },
    {
      id: 'latex',
      titleKey: 'slash.latex',
      descKey: 'slash.latex.desc',
      icon: '∑',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        editor.emit('kalamos:request-latex')
      },
    },
    {
      id: 'emoji',
      titleKey: 'slash.emoji',
      descKey: 'slash.emoji.desc',
      icon: '😊',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        editor.emit('kalamos:request-emoji')
      },
    },
    {
      id: 'mention',
      titleKey: 'slash.mention',
      descKey: 'slash.mention.desc',
      icon: '@',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).insertContent('@').run()
      },
    },
    {
      id: 'topic',
      titleKey: 'slash.topic',
      descKey: 'slash.topic.desc',
      icon: '#',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).insertContent('#').run()
      },
    },
    {
      id: 'card',
      titleKey: 'slash.card',
      descKey: 'slash.card.desc',
      icon: '▦',
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        insertCard(editor, range)
      },
    },
  ]
}

/** 创建斜杠命令扩展（Suggestion 插件挂载为 ProseMirror 插件） */
export function createSlashExtension(commands: SlashCommand[]): Extension {
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommand>({
          editor: this.editor,
          char: '/',
          allowSpaces: false,
          items: ({ query }) => {
            const kw = query.trim().toLowerCase()
            return commands.filter(
              (command) =>
                kw.length === 0 ||
                t(command.titleKey).toLowerCase().includes(kw) ||
                command.id.includes(kw),
            )
          },
          command: ({ editor, range, props }) => {
            props.run(editor, range)
          },
          render: () => {
            let menu: HTMLDivElement | null = null
            let selectedIndex = 0
            let currentItems: SlashCommand[] = []
            let currentCommand: ((item: SlashCommand) => void) | null = null

            /** 按光标矩形定位菜单，底部空间不足时向上翻转 */
            const place = (rect: DOMRect): void => {
              if (menu === null) {
                return
              }
              const height = menu.offsetHeight > 0 ? menu.offsetHeight : 340
              const top =
                rect.bottom + 6 + height > window.innerHeight
                  ? Math.max(8, rect.top - height - 6)
                  : rect.bottom + 6
              const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 328))
              menu.style.left = `${left}px`
              menu.style.top = `${top}px`
            }

            const renderItems = (): void => {
              if (menu === null) {
                return
              }
              // 闭包内使用局部常量，避免可空 let 变量的空值收窄失效
              const menuEl = menu
              menuEl.innerHTML = ''
              if (currentItems.length === 0) {
                const empty = document.createElement('div')
                empty.className = 'kala-slash-menu__empty'
                empty.textContent = t('slash.empty')
                menuEl.appendChild(empty)
                return
              }
              currentItems.forEach((item, index) => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = index === selectedIndex ? 'kala-slash-menu__item is-selected' : 'kala-slash-menu__item'
                const icon = document.createElement('span')
                icon.className = 'kala-slash-menu__icon'
                icon.textContent = item.icon
                const meta = document.createElement('span')
                const title = document.createElement('div')
                title.className = 'kala-slash-menu__title'
                title.textContent = t(item.titleKey)
                const desc = document.createElement('div')
                desc.className = 'kala-slash-menu__desc'
                desc.textContent = t(item.descKey)
                meta.append(title, desc)
                btn.append(icon, meta)
                btn.addEventListener('click', () => {
                  if (currentCommand !== null) {
                    currentCommand(item)
                  }
                })
                menuEl.appendChild(btn)
              })
              const selected = menuEl.querySelectorAll('.kala-slash-menu__item')[selectedIndex]
              selected?.scrollIntoView({ block: 'nearest' })
            }

            return {
              onStart: (props) => {
                menu = document.createElement('div')
                menu.className = 'kala-slash-menu'
                document.body.appendChild(menu)
                currentCommand = (item) => props.command(item)
                currentItems = props.items
                selectedIndex = 0
                renderItems()
                // clientRect 是返回 DOMRect 的函数（可能为 null）；菜单用 fixed 定位跟随光标
                const rect = props.clientRect?.() ?? null
                if (rect !== null) {
                  place(rect)
                }
              },
              onUpdate: (props) => {
                currentItems = props.items
                selectedIndex = 0
                if (currentCommand === null) {
                  currentCommand = (item) => props.command(item)
                }
                renderItems()
                // clientRect 是返回 DOMRect 的函数（可能为 null）
                const rect = props.clientRect?.() ?? null
                if (rect !== null && menu !== null) {
                  place(rect)
                }
              },
              onKeyDown: ({ event }) => {
                if (event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % Math.max(currentItems.length, 1)
                  renderItems()
                  return true
                }
                if (event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + currentItems.length) % Math.max(currentItems.length, 1)
                  renderItems()
                  return true
                }
                if (event.key === 'Enter') {
                  const item = currentItems[selectedIndex]
                  if (item !== undefined && currentCommand !== null) {
                    currentCommand(item)
                  }
                  return true
                }
                if (event.key === 'Escape') {
                  menu?.remove()
                  menu = null
                  return true
                }
                return false
              },
              onExit: () => {
                menu?.remove()
                menu = null
                currentCommand = null
              },
            }
          },
        }),
      ]
    },
  })
}
