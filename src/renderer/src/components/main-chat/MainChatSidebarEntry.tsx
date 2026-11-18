import React from 'react'
import { MessageCircle } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'

export function MainChatSidebarEntry(): React.JSX.Element {
  const t = useTranslate()
  const openMainPage = useAppStore((s) => s.openMainPage)
  const active = useAppStore((s) => s.activeView === 'main')
  return (
    <button
      type="button"
      onClick={openMainPage}
      aria-current={active ? 'page' : undefined}
      data-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <MessageCircle
        className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
      />
      <span className="min-w-0 flex-1 truncate">{t('tmwk.mainChat.title', 'Chat')}</span>
    </button>
  )
}
