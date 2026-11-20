import { create } from 'zustand'
import { showInMainView } from '../tickets/ticket-sidebar-store'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

export type NewTicketDraft = {
  words: string
  /** A `ProjectCombobox` option id; null until the user or the project filter picks one. */
  projectOptionId: string | null
  runOnKey: string
  /** Null means the user's default agent. */
  agent: TuiAgent | null
  source: string
}

export const EMPTY_NEW_TICKET_DRAFT: NewTicketDraft = {
  words: '',
  projectOptionId: null,
  runOnKey: 'auto',
  agent: null,
  source: ''
}

type NewTicketSheetState = {
  open: boolean
  draft: NewTicketDraft
  createMore: boolean
  openSheet: () => void
  /** Esc and the close button keep the draft for the next open. */
  closeSheet: () => void
  updateDraft: (patch: Partial<NewTicketDraft>) => void
  setCreateMore: (createMore: boolean) => void
  /** After a request lands: Create more clears the sheet but keeps Project; otherwise it closes. */
  submitted: () => void
}

export const useNewTicketSheetStore = create<NewTicketSheetState>((set) => ({
  open: false,
  draft: EMPTY_NEW_TICKET_DRAFT,
  createMore: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  setCreateMore: (createMore) => set({ createMore }),
  submitted: () =>
    set((state) =>
      state.createMore
        ? { draft: { ...EMPTY_NEW_TICKET_DRAFT, projectOptionId: state.draft.projectOptionId } }
        : { open: false, draft: EMPTY_NEW_TICKET_DRAFT }
    )
}))

/** The open seam for the Tickets header's +: shows Chat, where the sheet is mounted, then the sheet. */
export function useNewTicketSheet(): { open: () => void } {
  const openSheet = useNewTicketSheetStore((s) => s.openSheet)
  return {
    open: () => {
      showInMainView(null)
      openSheet()
    }
  }
}
