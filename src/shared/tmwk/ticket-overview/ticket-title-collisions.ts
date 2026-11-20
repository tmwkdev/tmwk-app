import type { TicketRowModel } from './ticket-row-model'

function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

/** Ids of rows whose title another row shares; those rows append " · <project>". */
export function titleCollisions(
  rows: readonly Pick<TicketRowModel, 'id' | 'title'>[]
): Set<string> {
  const idsByTitle = new Map<string, string[]>()
  for (const row of rows) {
    const key = titleKey(row.title)
    idsByTitle.set(key, [...(idsByTitle.get(key) ?? []), row.id])
  }
  const collisions = new Set<string>()
  for (const ids of idsByTitle.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => collisions.add(id))
    }
  }
  return collisions
}
