import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { createTmwkRecordStore } from './tmwk-record-store'
import { createTmwkSummaryStore } from './tmwk-summary-store'

export function openTmwkStore() {
  return createTmwkRecordStore(resolveMainHomePaths().storeDir)
}

export function openTmwkSummaryStore() {
  return createTmwkSummaryStore(resolveMainHomePaths().storeDir)
}
