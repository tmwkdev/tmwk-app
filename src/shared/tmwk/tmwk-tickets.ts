export type TmwkTicketStatus =
  | 'pending'
  | 'ready'
  | 'dispatched'
  | 'completed'
  | 'failed'
  | 'blocked'

export type TmwkNeedsMe = 'decision' | 'stop' | 'result'

export type TmwkTicket = {
  taskId: string
  runId: string
  title: string
  status: TmwkTicketStatus
  result: string | null
  completedAt: string | null
  firstSeenAt: string
  lastSeenAt: string
  acceptedAt: string | null
  /** The store version at which an observable field last changed. */
  changedAt: number
  needsMe: TmwkNeedsMe | null
  /** The open gate or pending ask the owner is waiting on. */
  question: string | null
  /** The assignee handle while a worker holds the task. */
  owner: string | null
}

const STATUSES: readonly unknown[] = [
  'pending',
  'ready',
  'dispatched',
  'completed',
  'failed',
  'blocked'
]

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

export function isTmwkTicket(value: unknown): value is TmwkTicket {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'taskId' in value &&
    typeof value.taskId === 'string' &&
    'runId' in value &&
    typeof value.runId === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'status' in value &&
    STATUSES.includes(value.status) &&
    'result' in value &&
    isNullableString(value.result) &&
    'completedAt' in value &&
    isNullableString(value.completedAt) &&
    'firstSeenAt' in value &&
    typeof value.firstSeenAt === 'string' &&
    'lastSeenAt' in value &&
    typeof value.lastSeenAt === 'string' &&
    'acceptedAt' in value &&
    isNullableString(value.acceptedAt) &&
    'changedAt' in value &&
    typeof value.changedAt === 'number' &&
    'needsMe' in value &&
    (value.needsMe === null ||
      value.needsMe === 'decision' ||
      value.needsMe === 'stop' ||
      value.needsMe === 'result') &&
    'question' in value &&
    isNullableString(value.question) &&
    'owner' in value &&
    isNullableString(value.owner)
  )
}
