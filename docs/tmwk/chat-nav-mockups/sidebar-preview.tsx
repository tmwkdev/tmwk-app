import React from 'react'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Folder,
  Grid2X2,
  List,
  PanelLeft,
  Search,
  Smartphone
} from 'lucide-react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import SidebarNav from '@/components/sidebar/chrome/SidebarNav'
import SidebarHeader from '@/components/sidebar/chrome/SidebarHeader'
import SidebarToolbar from '@/components/sidebar/chrome/SidebarToolbar'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import {
  makeRepo,
  makeWorktree
} from '@/components/worktree-jump/worktree-jump-palette-test-fixtures'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'

const repo = { ...makeRepo(), id: 'preview-app', displayName: 'tmwk-app' }
const worktrees = [
  makeWorktree('preview-main', 'main', { repoId: repo.id, branch: 'main' }),
  makeWorktree('preview-chat', 'chat-nav-mockups', { repoId: repo.id, branch: 'chat-nav-mockups' }),
  makeWorktree('preview-brand', 'brand-refresh', { repoId: repo.id, branch: 'brand-refresh' })
]
const variants = [
  ['today', 'Today', 'One of five navigation links.'],
  ['a', 'A · A place of its own', 'Chat between tools and projects.'],
  ['b', 'B · Conversation first', 'Chat leads. Tools are one menu away.'],
  ['c', 'C · Conversation dock', 'The latest reply stays within reach.']
] as const

type Variant = (typeof variants)[number][0]

const styles = `
#component-fixture-frame { padding:0; }
.preview-sidebar { height:700px; width:280px; display:flex; flex-direction:column; background:var(--worktree-sidebar); color:var(--worktree-sidebar-foreground); border:1px solid var(--worktree-sidebar-border); overflow:hidden; }
.preview-top { height:40px; flex-shrink:0; padding:0 16px; display:flex; justify-content:flex-end; align-items:center; color:var(--muted-foreground); border-bottom:1px solid var(--worktree-sidebar-border); }
.preview-projects { padding:0 8px; }
.preview-project-label { height:34px; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:500; padding-left:8px; color:color-mix(in srgb,var(--worktree-sidebar-foreground) 70%,transparent); }
.preview-cards { display:flex; flex-direction:column; gap:2px; }
.preview-spacer { flex:1; min-height:16px; }
.preview-chat-band { padding:8px; margin-top:8px; border-top:1px solid var(--worktree-sidebar-border); border-bottom:1px solid var(--worktree-sidebar-border); }
.preview-chat-band .preview-chat { min-height:40px; padding:10px 8px; gap:10px; font-size:14px; font-weight:600; color:var(--worktree-sidebar-foreground); }
.preview-chat-band .preview-chat > svg { color:inherit; }
.preview-b .preview-chat-band { margin-top:0; border-top:0; padding:12px 8px; }
.preview-b .preview-chat-band .preview-chat { min-height:44px; }
.preview-tools { padding:6px 8px; border-top:1px solid var(--worktree-sidebar-border); }
.preview-tools > button { padding:6px 8px; gap:8px; font-size:13px; color:var(--muted-foreground); justify-content:flex-start; width:100%; }
.preview-tools > button svg:last-child { margin-left:auto; }
.preview-dock { margin:0; border-top:1px solid var(--worktree-sidebar-border); padding:8px; }
.preview-dock .preview-chat { padding:10px 8px; display:grid; grid-template-columns:16px 1fr auto; gap:4px 8px; color:var(--worktree-sidebar-foreground); }
.preview-dock .preview-chat > svg { color:inherit; grid-row:1; }
.preview-dock .preview-chat > span:first-of-type { font-size:14px; font-weight:600; }
.preview-dock .preview-chat .preview-reply { grid-column:2 / 4; font-size:12px; line-height:18px; font-weight:400; color:var(--muted-foreground); letter-spacing:normal; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; }
.preview-unread { min-width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius); background:var(--worktree-sidebar-accent); color:var(--worktree-sidebar-accent-foreground); font-size:11px; font-weight:500; }
.preview-board { padding:24px; background:var(--background); color:var(--foreground); }
.preview-board-heading { font-size:20px; font-weight:600; margin:0 0 6px; }
.preview-board-note { font-size:12px; color:var(--muted-foreground); margin:0 0 24px; }
.preview-columns { display:flex; gap:16px; }
.preview-column { width:280px; flex-shrink:0; }
.preview-variant-title { font-size:14px; font-weight:600; margin:0 0 6px; }
.preview-variant-note { font-size:12px; color:var(--muted-foreground); margin:0 0 14px; }
`

function Tools({ open }: { open: boolean }): React.JSX.Element {
  return (
    <div className="preview-tools">
      <DropdownMenu open={open}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <Grid2X2 className="size-4" />
            Tools
            <ChevronUp className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-52">
          <DropdownMenuItem>
            <Search className="size-3.5" />
            Search
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <List className="size-3.5" />
            Tasks
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CalendarClock className="size-3.5" />
            Automations
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Smartphone className="size-3.5" />
            Orca Mobile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function Sidebar({
  variant,
  project,
  menuOpen = false
}: {
  variant: Variant
  project: boolean
  menuOpen?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`preview-sidebar preview-${variant}`}
      data-preview-variant={variant}
      data-preview-project={project}
    >
      <div className="preview-top">
        <PanelLeft size={16} />
      </div>
      <SidebarNav />
      <SidebarHeader onWorkspaceBoardMenuOpenChange={() => {}} />
      <div className="preview-projects">
        <div className="preview-project-label">
          <ChevronDown size={12} />
          <Folder size={14} />
          tmwk-app
        </div>
        <div className="preview-cards">
          {worktrees.map((worktree) => (
            <WorktreeCard
              key={worktree.id}
              worktree={worktree}
              repo={repo}
              isActive={project && worktree.id === 'preview-chat'}
              nativeDragEnabled={false}
              hideRepoBadge
              contentIndent={20}
            />
          ))}
        </div>
        <div className="preview-project-label">
          <ChevronDown size={12} />
          <Folder size={14} />
          website
        </div>
      </div>
      <div className="preview-spacer" />
      {variant === 'b' && <Tools open={menuOpen} />}
      <div className="preview-toolbar">
        <SidebarToolbar workspaceBoardOpen={false} onWorkspaceBoardToggle={() => {}} />
      </div>
    </div>
  )
}

function arrange(frame: HTMLElement): void {
  for (const sidebar of frame.querySelectorAll<HTMLElement>('[data-preview-variant]')) {
    const variant = sidebar.dataset.previewVariant
    if (variant === 'today') {
      continue
    }
    const nav = sidebar.querySelector<HTMLElement>(
      '[data-contextual-tour-target="sidebar-navigation"]'
    )!
    const chat = nav.firstElementChild
    if (!(chat instanceof HTMLButtonElement)) {
      throw new Error('Expected the Chat button first in SidebarNav.')
    }
    chat.classList.add('preview-chat')
    const band = document.createElement('div')
    band.className = 'preview-chat-band'
    band.append(chat)
    if (variant === 'a') {
      nav.after(band)
    }
    if (variant === 'b') {
      nav.before(band)
      nav.remove()
    }
    if (variant === 'c') {
      band.className = 'preview-dock'
      if (sidebar.dataset.previewProject === 'true') {
        const unread = document.createElement('span')
        unread.className = 'preview-unread'
        unread.textContent = '1'
        unread.setAttribute('aria-label', '1 unread reply')
        chat.append(unread)
      }
      const reply = document.createElement('span')
      reply.className = 'preview-reply'
      reply.textContent = 'The sidebar options are ready.'
      chat.append(reply)
      sidebar.querySelector('.preview-toolbar')!.before(band)
    }
  }
}

function preview(project: boolean, variant?: Variant, menuOpen = false) {
  return defineFixture({
    width: variant ? 280 : 1216,
    store: {
      settings: {
        ...getDefaultSettings('/tmp/chat-nav-preview'),
        showTasksButton: true,
        showMobileButton: true,
        showAutomationsButton: true,
        visibleTaskProviders: ['github']
      },
      activeView: project ? 'worktree' : 'main',
      activeRepoId: repo.id,
      activeWorktreeId: 'preview-chat',
      repos: [repo],
      worktreesByRepo: { [repo.id]: worktrees },
      worktreeCardProperties: ['branch'],
      setupGuideSidebarDismissed: true,
      preflightStatusChecked: true,
      linearStatusChecked: true,
      groupBy: 'repo'
    },
    setup: () => {
      window.localStorage.setItem('orca.mobile.sidebar-onboarding-dismissed', '1')
    },
    interact: arrange,
    render: () => (
      <>
        <style>{styles}</style>
        {variant ? (
          <Sidebar variant={variant} project={project} menuOpen={menuOpen} />
        ) : (
          <div className="preview-board">
            <h1 className="preview-board-heading">Chat, with a place of its own</h1>
            <p className="preview-board-note">
              {project ? 'Project workspace selected' : 'Chat selected'} · 280 px sidebar · Existing
              app components and theme · Illustrative content
            </p>
            <div className="preview-columns">
              {variants.map(([id, title, note]) => (
                <div className="preview-column" key={id}>
                  <h2 className="preview-variant-title">{title}</h2>
                  <p className="preview-variant-note">{note}</p>
                  <Sidebar variant={id} project={project} />
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  })
}

export const compareChat = preview(false)
export const compareProject = preview(true)
export const todayChat = preview(false, 'today')
export const todayProject = preview(true, 'today')
export const aChat = preview(false, 'a')
export const aProject = preview(true, 'a')
export const bChat = preview(false, 'b')
export const bProject = preview(true, 'b')
export const cChat = preview(false, 'c')
export const cProject = preview(true, 'c')
export const bTools = preview(true, 'b', true)
