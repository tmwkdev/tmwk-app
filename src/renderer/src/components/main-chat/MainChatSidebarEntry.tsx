import React from 'react'
import { MessageCircle } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { showInMainView, useTicketSidebarStore } from './tickets/ticket-sidebar-store'

export function MainChatSidebarEntry(): React.JSX.Element {
  const t = useTranslate()
  const ticketOpen = useTicketSidebarStore((s) => s.openTicketId !== null)
  const active = useAppStore((s) => s.activeView === 'main') && !ticketOpen
  return (
    <div className="shrink-0 border-t border-worktree-sidebar-border p-2">
      <button
        type="button"
        onClick={() => showInMainView(null)}
        aria-current={active ? 'page' : undefined}
        data-current={active ? 'true' : undefined}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring',
          active
            ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
            : 'text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent'
        )}
      >
        <MessageCircle className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t('tmwk.mainChat.title', 'Chat')}</span>
      </button>
    </div>
  )
}
