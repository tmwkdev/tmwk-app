import { useEffect, useEffectEvent, useState } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import {
  readTmwkDeleteWorktreeRisks,
  uncheckedDeleteRisks,
  type TmwkDeleteWorktreeRiskEntry
} from './read-tmwk-delete-worktree-risks'

export type TmwkDeleteWorktreeRiskCheck = {
  checking: boolean
  /** Targets with something at risk; empty once the check found nothing. */
  entries: TmwkDeleteWorktreeRiskEntry[]
  showNames: boolean
  acknowledged: boolean
  setAcknowledged: (acknowledged: boolean) => void
  /** Delete waits for the check, then for the user to accept the named loss. */
  blocksDelete: boolean
}

// Each openModal call brings new modal data, so a reopen for the same targets checks afresh.
const openNonces = new WeakMap<AppState['modalData'], number>()
let nextOpenNonce = 0

function openNonceOf(modalData: AppState['modalData']): number {
  let nonce = openNonces.get(modalData)
  if (nonce === undefined) {
    nonce = ++nextOpenNonce
    openNonces.set(modalData, nonce)
  }
  return nonce
}

type RiskResult = {
  generation: string
  entries: TmwkDeleteWorktreeRiskEntry[] | null
  acknowledged: boolean
}

export function useTmwkDeleteWorktreeRisks({
  isOpen,
  deleteTargets
}: {
  isOpen: boolean
  deleteTargets: readonly Worktree[]
}): TmwkDeleteWorktreeRiskCheck {
  const modalData = useAppStore((state) => state.modalData)
  const checked = deleteTargets.filter((target) => !target.isMainWorktree)
  const generation =
    isOpen && checked.length > 0
      ? [
          openNonceOf(modalData),
          ...checked
            .map((target) => `${getWorktreeHostIdentity(target)}:${target.instanceId ?? ''}`)
            .sort()
        ].join('\n')
      : ''
  const [result, setResult] = useState<RiskResult>({
    generation: '',
    entries: null,
    acknowledged: false
  })
  const startCheck = useEffectEvent((signal: AbortSignal) => {
    void readTmwkDeleteWorktreeRisks(checked, signal)
      .catch(() => checked.map((worktree) => ({ worktree, risks: uncheckedDeleteRisks(worktree) })))
      .then((entries) => {
        if (!signal.aborted) {
          setResult({
            generation,
            entries: entries.filter((entry) => entry.risks.length > 0),
            acknowledged: false
          })
        }
      })
  })

  // Catalog refreshes replace arrays; re-check only when the targets themselves change.
  useEffect(() => {
    setResult({ generation, entries: null, acknowledged: false })
    if (!isOpen || generation === '') {
      return
    }
    const controller = new AbortController()
    startCheck(controller.signal)
    return () => {
      controller.abort()
    }
  }, [generation, isOpen])

  const current = result.generation === generation ? result : null
  const checking = generation !== '' && !current?.entries
  const entries = current?.entries ?? []
  const acknowledged = current?.acknowledged ?? false
  return {
    checking,
    entries,
    showNames: checked.length > 1,
    acknowledged,
    setAcknowledged: (next) =>
      setResult((prev) =>
        prev.generation === generation ? { ...prev, acknowledged: next } : prev
      ),
    blocksDelete: checking || (entries.length > 0 && !acknowledged)
  }
}
