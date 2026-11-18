import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'

export const PREFERENCE_BRIEFING_BUDGET = 2000

export const PREFERENCE_PARTIAL_LINE =
  'Briefing is partial: some standing preferences did not fit. Ask the partner before any outward or irreversible action.'

export type PreferenceBriefing = { text: string; partial: boolean }

function formatLine(record: TmwkRecord): string {
  const scope = record.project ? `[${record.project.name}] ` : ''
  return `${record.id}  ${scope}${record.text}`
}

function renderBlock(lines: string[]): string {
  return [`Standing preferences (${lines.length})`, ...lines].join('\n')
}

/** `effective` holds records in effect. `projectId` adds that project's rules to the global ones. */
export function renderPreferenceBriefing(
  effective: TmwkRecord[],
  projectId: string | null,
  budget: number = PREFERENCE_BRIEFING_BUDGET
): PreferenceBriefing {
  // Later in the array is newer, which breaks createdAt ties.
  const newestFirst = effective
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) => record.project === null || (projectId && record.project.repoId === projectId)
    )
    .sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt) || b.index - a.index)
  const kept = [...newestFirst]
  while (kept.length > 0 && renderBlock(kept.map((e) => formatLine(e.record))).length > budget) {
    kept.pop()
  }
  const dropped = kept.length < newestFirst.length
  const display = [
    ...kept.filter((e) => e.record.project === null),
    ...kept.filter((e) => e.record.project !== null)
  ]
  if (display.length === 0 && !dropped) {
    return { text: 'No standing preferences.', partial: false }
  }
  const block = renderBlock(display.map((e) => formatLine(e.record)))
  return { text: dropped ? `${block}\n${PREFERENCE_PARTIAL_LINE}` : block, partial: dropped }
}

export function renderPreferenceHistory(records: TmwkRecord[]): string {
  return records
    .filter((record) => record.supersededBy !== null || record.retiredAt !== null)
    .map(
      (record) =>
        `${formatLine(record)} ${record.supersededBy ? `(replaced by ${record.supersededBy})` : '(removed)'}`
    )
    .join('\n')
}
