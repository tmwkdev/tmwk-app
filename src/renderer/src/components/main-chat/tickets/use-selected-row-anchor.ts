import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

function offsetOf(container: HTMLElement, key: string): number | null {
  const element = container.querySelector<HTMLElement>(`[data-ticket-item="${CSS.escape(key)}"]`)
  return element
    ? element.getBoundingClientRect().top - container.getBoundingClientRect().top
    : null
}

/**
 * Keeps the selected row at the same screen offset when the list reorders (D64).
 * The offset is recorded after every layout and scroll, and restored when `order` changes.
 */
export function useSelectedRowAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  selectedKey: string | null,
  order: string
): void {
  const anchor = useRef<{ key: string; offset: number; order: string } | null>(null)

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || selectedKey === null) {
      anchor.current = null
      return
    }
    const previous = anchor.current
    const offset = offsetOf(container, selectedKey)
    if (previous?.key === selectedKey && previous.order !== order && offset !== null) {
      container.scrollTop += offset - previous.offset
    }
    const settled = offsetOf(container, selectedKey)
    anchor.current = settled === null ? null : { key: selectedKey, offset: settled, order }
  })

  useEffect(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }
    const record = (): void => {
      const current = anchor.current
      const offset = current ? offsetOf(container, current.key) : null
      if (current && offset !== null) {
        anchor.current = { ...current, offset }
      }
    }
    container.addEventListener('scroll', record, { passive: true })
    return () => container.removeEventListener('scroll', record)
  }, [scrollRef])
}
