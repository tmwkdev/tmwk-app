import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { createTmwkRecordStore } from './tmwk-record-store'

export function openTmwkStore() {
  return createTmwkRecordStore(resolveMainHomePaths().storeDir)
}
