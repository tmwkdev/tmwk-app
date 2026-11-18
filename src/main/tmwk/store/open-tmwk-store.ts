import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { createTmwkRecordStore } from './tmwk-record-store'
import { createTmwkSummaryStore } from './tmwk-summary-store'
import { createTicketSnapshotStore } from '../tickets/ticket-snapshot-store'

export function openTmwkStore() {
  return createTmwkRecordStore(resolveMainHomePaths().storeDir)
}

export function openTmwkSummaryStore() {
  return createTmwkSummaryStore(resolveMainHomePaths().storeDir)
}

export function openTmwkTicketStore() {
  return createTicketSnapshotStore(resolveMainHomePaths().storeDir)
}
