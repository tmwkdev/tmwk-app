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
    <div className="mb-2 border-b border-worktree-sidebar-border pb-2">
      <button
        type="button"
        onClick={openMainPage}
        aria-current={active ? 'page' : undefined}
        data-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium tracking-tight transition-colors',
          active
            ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
            : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-accent'
        )}
      >
        <MessageCircle
          className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{t('tmwk.mainChat.title', 'Main chat')}</span>
          <span className="block text-xs font-normal opacity-60">
            {t('tmwk.mainChat.scope', 'Across all projects')}
          </span>
        </span>
      </button>
    </div>
  )
}
