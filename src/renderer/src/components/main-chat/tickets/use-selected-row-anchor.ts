import { useLayoutEffect, useRef, type RefObject } from 'react'

type Anchor = { key: string; offset: number; order: string }

function offsetOf(container: HTMLElement, key: string): number | null {
  const element = container.querySelector<HTMLElement>(`[data-ticket-item="${CSS.escape(key)}"]`)
  return element
    ? element.getBoundingClientRect().top - container.getBoundingClientRect().top
    : null
}

/**
 * Keeps the selected row at the same screen offset when the list reorders (D64).
 * The offset is recorded after every layout and on scroll, and restored when `order` changes.
 */
export function useSelectedRowAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  selectedKey: string | null,
  order: string
): void {
  const anchor = useRef<Anchor | null>(null)

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || selectedKey === null) {
      anchor.current = null
      return
    }
    const previous = anchor.current
    const offset = offsetOf(container, selectedKey)
    if (previous?.key === selectedKey && previous.order !== order && offset !== null) {
      // Absolute, so the browser's own scroll anchoring during the reorder is overridden, not added to.
      container.scrollTop += offset - previous.offset
    }
    const record = (): void => {
      const settled = offsetOf(container, selectedKey)
      anchor.current = settled === null ? null : { key: selectedKey, offset: settled, order }
    }
    record()
    // Re-measure on scroll too, so layout that settled after this commit is not stale.
    container.addEventListener('scroll', record, { passive: true })
    return () => container.removeEventListener('scroll', record)
  })
}
