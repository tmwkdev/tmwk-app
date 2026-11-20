import { useCallback, useState, type KeyboardEvent, type RefObject } from 'react'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { DONE_ITEM_KEY, ticketItemKey, type TicketListItem } from './ticket-list-items'

type Options = {
  listRef: RefObject<HTMLElement | null>
  items: readonly TicketListItem[]
  selectedId: string | null
  openIds: ReadonlySet<string>
  setTicketOpen: (id: string, open: boolean) => void
  doneOpen: boolean
  toggleDone: () => void
  onSelect: (id: string) => void
  onOpenSession: (session: TicketRowSession, row: TicketRowModel) => void
}

/** D64's listbox keys over a roving tab stop: ↑↓ move, → opens sessions, ← closes or goes to the parent, Enter opens, Space toggles Done. */
export function useTicketListKeyboard({
  listRef,
  items,
  selectedId,
  openIds,
  setTicketOpen,
  doneOpen,
  toggleDone,
  onSelect,
  onOpenSession
}: Options): {
  activeKey: string | null
  setActiveKey: (key: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
} {
  const [focusedKey, setActiveKey] = useState<string | null>(null)
  const has = (key: string | null): key is string =>
    key !== null && items.some((item) => item.key === key)
  const selectedKey = selectedId === null ? null : ticketItemKey(selectedId)
  const activeKey = has(focusedKey)
    ? focusedKey
    : has(selectedKey)
      ? selectedKey
      : (items[0]?.key ?? null)

  const focusItem = useCallback(
    (key: string) => {
      setActiveKey(key)
      listRef.current
        ?.querySelector<HTMLElement>(`[data-ticket-item="${CSS.escape(key)}"]`)
        ?.focus()
    },
    [listRef]
  )

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.metaKey || event.ctrlKey || event.altKey || items.length === 0) {
      return
    }
    // The focused element wins over state: focus can land without a focus event (an unfocused window).
    const targetKey =
      event.target instanceof Element
        ? event.target.closest('[data-ticket-item]')?.getAttribute('data-ticket-item')
        : null
    const index = Math.max(
      0,
      items.findIndex((item) => item.key === (targetKey ?? activeKey))
    )
    const item = items[index]
    let handled = true
    switch (event.key) {
      case 'ArrowDown':
        focusItem(items[Math.min(items.length - 1, index + 1)].key)
        break
      case 'ArrowUp':
        focusItem(items[Math.max(0, index - 1)].key)
        break
      case 'Home':
        focusItem(items[0].key)
        break
      case 'End':
        focusItem(items.at(-1)!.key)
        break
      case 'ArrowRight':
        if (item.kind === 'ticket' && item.row.sessions.length > 0) {
          if (openIds.has(item.row.id)) {
            focusItem(items[index + 1].key)
          } else {
            setTicketOpen(item.row.id, true)
          }
        } else if (item.kind === 'done' && !doneOpen) {
          toggleDone()
        }
        break
      case 'ArrowLeft':
        if (item.kind === 'session') {
          focusItem(ticketItemKey(item.row.id))
        } else if (item.kind === 'ticket' && openIds.has(item.row.id)) {
          setTicketOpen(item.row.id, false)
        } else if (item.kind === 'done' && doneOpen) {
          toggleDone()
        }
        break
      case 'Enter':
        if (item.kind === 'ticket') {
          onSelect(item.row.id)
        } else if (item.kind === 'session') {
          onOpenSession(item.session, item.row)
        } else {
          toggleDone()
        }
        break
      case ' ':
        if (doneOpen && item.kind !== 'done' && item.row.state === 'done') {
          focusItem(DONE_ITEM_KEY)
        }
        if (items.some((entry) => entry.kind === 'done')) {
          toggleDone()
        }
        break
      default:
        handled = false
    }
    if (handled) {
      event.preventDefault()
    }
  }

  return { activeKey, setActiveKey, onKeyDown }
}
