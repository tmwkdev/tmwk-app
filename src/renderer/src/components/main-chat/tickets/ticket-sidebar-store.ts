import { create } from 'zustand'
import type { TopLevelView } from '../../../../../shared/ui-chrome/ui-chrome-types'
import { useAppStore } from '@/store'
import { useMainHomeRepoId } from '../use-main-chat-host'

/** Tickets, or Orca's worktree list as the Worktree view (D62). */
export type TicketSidebarMode = 'tickets' | 'worktrees'

const MODE_KEY = 'tmwk.sidebarMode.v1'

function readMode(): TicketSidebarMode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'worktrees' ? 'worktrees' : 'tickets'
  } catch {
    return 'tickets'
  }
}

function writeMode(mode: TicketSidebarMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode)
  } catch {
    // Best-effort: unavailable storage keeps the mode for this session only.
  }
}

type TicketSidebarStore = {
  mode: TicketSidebarMode
  setMode: (mode: TicketSidebarMode) => void
  /** The selected ticket, shown in the main view in place of Chat (D65). */
  openTicketId: string | null
  setOpenTicketId: (id: string | null) => void
}

export const useTicketSidebarStore = create<TicketSidebarStore>((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    writeMode(mode)
    set({ mode })
  },
  openTicketId: null,
  setOpenTicketId: (openTicketId) => set({ openTicketId })
}))

/** Shows a ticket in the main view, or Chat with null (D65). */
export function showInMainView(ticketId: string | null): void {
  useTicketSidebarStore.getState().setOpenTicketId(ticketId)
  useAppStore.getState().openMainPage()
}

/**
 * What the main pane shows, so exactly one sidebar entry reads as current. A worktree is
 * shown only under 'terminal'; other full pages mark nothing.
 */
export type SidebarCurrent =
  | { kind: 'chat' }
  | { kind: 'ticket'; ticketId: string }
  | { kind: 'worktree'; worktreeId: string }

export function sidebarCurrent(
  activeView: TopLevelView,
  openTicketId: string | null,
  activeWorktreeId: string | null
): SidebarCurrent | null {
  if (activeView === 'main') {
    return openTicketId === null ? { kind: 'chat' } : { kind: 'ticket', ticketId: openTicketId }
  }
  if (activeView === 'terminal' && activeWorktreeId !== null) {
    return { kind: 'worktree', worktreeId: activeWorktreeId }
  }
  return null
}

export function useSidebarCurrent(): SidebarCurrent | null {
  const activeView = useAppStore((s) => s.activeView)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const openTicketId = useTicketSidebarStore((s) => s.openTicketId)
  return sidebarCurrent(activeView, openTicketId, activeWorktreeId)
}

/** Whether this worktree's card is the current entry; a boolean so only flipped cards re-render. */
export function useIsSidebarCurrentWorktree(worktreeId: string | undefined): boolean {
  return useAppStore((s) => {
    const current = sidebarCurrent(s.activeView, null, s.activeWorktreeId)
    return current?.kind === 'worktree' && current.worktreeId === worktreeId
  })
}

/** Whether the sidebar can show tickets (the main home exists), and whether it does. */
export function useTicketsSidebarMode(): { available: boolean; active: boolean } {
  const available = useMainHomeRepoId() !== null
  const tickets = useTicketSidebarStore((s) => s.mode === 'tickets')
  return { available, active: available && tickets }
}
