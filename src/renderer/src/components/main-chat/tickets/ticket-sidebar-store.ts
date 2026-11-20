import { create } from 'zustand'
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

/** Whether the sidebar can show tickets (the main home exists), and whether it does. */
export function useTicketsSidebarMode(): { available: boolean; active: boolean } {
  const available = useMainHomeRepoId() !== null
  const tickets = useTicketSidebarStore((s) => s.mode === 'tickets')
  return { available, active: available && tickets }
}
