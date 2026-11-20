import React from 'react'
import { ArrowUp, Plus } from 'lucide-react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { Sidebar, styles, preview, type DockTreatment } from './sidebar-preview'

const cStyles = `
.preview-dock[data-dock-treatment] .preview-chat { height:64px; }
.preview-dock[data-dock-treatment='centered'] .preview-chat,
.preview-dock[data-dock-treatment='compact'] .preview-chat { display:flex; align-items:center; gap:8px; }
.preview-dock[data-dock-treatment='compact'] .preview-chat { height:44px; }
.preview-dock .preview-chat[data-appearance='hover'] { background:var(--worktree-sidebar-accent); color:var(--worktree-sidebar-accent-foreground); }
.preview-dock .preview-chat[data-appearance='focus'] { outline:2px solid var(--worktree-sidebar-ring); outline-offset:2px; }
.c-state-grid { display:grid; grid-template-columns:repeat(3,280px); gap:24px 16px; }
.c-state-crop .preview-sidebar { height:auto; }
.c-state-crop .preview-sidebar > :not(.preview-dock):not(.preview-toolbar) { display:none; }
.c-state-label { margin:0 0 8px; font-size:13px; font-weight:500; }
.c-state-description { margin:8px 0 0; font-size:12px; color:var(--muted-foreground); line-height:18px; }
.c-context { width:1216px; height:780px; background:var(--background); color:var(--foreground); display:flex; }
.c-context .preview-sidebar { height:780px; }
.c-context-pane { flex:1; min-width:0; display:flex; flex-direction:column; background:var(--background); }
.c-context-title { height:40px; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 20px; font-size:13px; font-weight:500; }
.c-context-transcript { width:100%; max-width:680px; padding:52px 28px; margin:0 auto; font-size:13px; line-height:22px; }
.c-context-transcript h2 { font-size:14px; line-height:22px; font-weight:600; margin:24px 0 8px; }
.c-context-transcript p { margin:0 0 18px; }
.c-context-transcript ul { margin:8px 0 20px; padding-left:20px; list-style:disc; }
.c-context-user { padding:12px 16px; border-radius:var(--radius); background:var(--muted); color:var(--foreground); margin-bottom:40px; }
.c-context-message { color:var(--foreground); }
.c-context-composer { margin:auto 48px 24px; padding:16px; border:1px solid var(--border); border-radius:var(--radius); background:var(--background); color:var(--muted-foreground); font-size:13px; }
.c-context-composer-controls { display:flex; justify-content:space-between; align-items:center; margin-top:28px; }
.c-context-document { background:var(--editor-surface); flex:1; padding:32px 44px; font-family:var(--font-mono); font-size:12px; line-height:24px; color:var(--foreground); }
.c-context-document h1 { font-size:20px; line-height:28px; font-weight:600; margin:8px 0 28px; }
.c-context-document p { margin:0 0 20px; }
.c-context-file-tab { border-bottom:1px solid var(--border); color:var(--muted-foreground); padding:10px 20px; font-size:12px; }
`
const cTreatments = [
  ['preview', 'With a preview', 'An illustrative update from Chat.'],
  ['centered', 'No preview · same height', 'Chat centers in a 64 px row.'],
  ['compact', 'No preview · compact', 'Chat centers in a 44 px row.']
] as const

function CContext({ project }: { project: boolean }): React.JSX.Element {
  return (
    <div className="c-context">
      <Sidebar variant="c" project={project} dockTreatment="compact" />
      <main className="c-context-pane">
        <div className="c-context-title">{project ? 'tmwk-app / chat-nav-mockups' : 'Chat'}</div>
        {project ? (
          <>
            <div className="c-context-file-tab">chat-navigation.md</div>
            <article className="c-context-document">
              <h1>Chat navigation</h1>
              <p>A conversation dock above the bottom toolbar.</p>
              <p>Keep the label simple: Chat.</p>
              <p>The dock stays in place while you move between projects.</p>
              <p>Without a preview, the icon, label, and unread count share one line.</p>
            </article>
          </>
        ) : (
          <>
            <div className="c-context-transcript">
              <div className="c-context-user">
                I&apos;d like to see option C without any subtext.
              </div>
              <div className="c-context-message">
                <p>
                  The label can sit vertically centered, with the icon and unread count on the same
                  line.
                </p>
                <h2>Two ways to handle the height</h2>
                <ul>
                  <li>Keep the taller row for more breathing room.</li>
                  <li>Use a compact row to give the project list more space.</li>
                </ul>
                <p>Both keep Chat anchored above the bottom toolbar.</p>
              </div>
            </div>
            <div className="c-context-composer">
              Message…
              <div className="c-context-composer-controls">
                <Plus size={16} />
                <Button size="icon-xs" variant="secondary" aria-label="Send message">
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function cStudy(project: boolean, treatment?: DockTreatment, context = false) {
  const fixture = preview(project, 'c')
  return defineFixture({
    ...fixture,
    width: context ? 1216 : treatment ? 280 : 920,
    render: () => (
      <>
        <style>{styles + cStyles}</style>
        {context ? (
          <CContext project={project} />
        ) : treatment ? (
          <Sidebar
            variant="c"
            project={project}
            dockTreatment={treatment}
            previewMessage="Chat nav mockups are ready"
          />
        ) : (
          <div className="preview-board">
            <h1 className="preview-board-heading">Option C · With and without a preview</h1>
            <p className="preview-board-note">
              {project ? 'Project selected · One unread reply' : 'Chat selected · No unread reply'}{' '}
              · Same bottom anchor, three row treatments
            </p>
            <div className="preview-columns">
              {cTreatments.map(([id, title, note]) => (
                <div className="preview-column" key={id}>
                  <h2 className="preview-variant-title">{title}</h2>
                  <p className="preview-variant-note">{note}</p>
                  <Sidebar
                    variant="c"
                    project={project}
                    dockTreatment={id}
                    previewMessage="Chat nav mockups are ready"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  })
}

export const cCompareChat = cStudy(false)
export const cCompareProject = cStudy(true)
export const cPreviewChat = cStudy(false, 'preview')
export const cPreviewProject = cStudy(true, 'preview')
export const cCenteredChat = cStudy(false, 'centered')
export const cCenteredProject = cStudy(true, 'centered')
export const cCompactChat = cStudy(false, 'compact')
export const cCompactProject = cStudy(true, 'compact')
export const cContextChat = cStudy(false, 'compact', true)
export const cContextProject = cStudy(true, 'compact', true)

export const cStates = defineFixture({
  ...preview(true, 'c'),
  width: 920,
  render: () => (
    <>
      <style>{styles + cStyles}</style>
      <div className="preview-board">
        <h1 className="preview-board-heading">Option C · Dock details</h1>
        <p className="preview-board-note">
          Workspace selected · Illustrative interaction and unread states · Same theme tokens and
          controls
        </p>
        <div className="c-state-grid">
          <div>
            <h2 className="c-state-label">Quiet</h2>
            <div className="c-state-crop">
              <Sidebar variant="c" project dockTreatment="compact" unreadCount={0} />
            </div>
            <p className="c-state-description">No count when everything is read.</p>
          </div>
          <div>
            <h2 className="c-state-label">One reply</h2>
            <div className="c-state-crop">
              <Sidebar variant="c" project dockTreatment="compact" unreadCount={1} />
            </div>
            <p className="c-state-description">The count stays on the same baseline.</p>
          </div>
          <div>
            <h2 className="c-state-label">Several replies</h2>
            <div className="c-state-crop">
              <Sidebar variant="c" project dockTreatment="compact" unreadCount={12} />
            </div>
            <p className="c-state-description">A wider count leaves the label in place.</p>
          </div>
          <div>
            <h2 className="c-state-label">Pointer hover</h2>
            <div className="c-state-crop">
              <Sidebar
                variant="c"
                project
                dockTreatment="compact"
                unreadCount={1}
                appearance="hover"
              />
            </div>
            <p className="c-state-description">The existing sidebar accent marks the hit area.</p>
          </div>
          <div>
            <h2 className="c-state-label">Keyboard focus</h2>
            <div className="c-state-crop">
              <Sidebar
                variant="c"
                project
                dockTreatment="compact"
                unreadCount={1}
                appearance="focus"
              />
            </div>
            <p className="c-state-description">The existing focus ring surrounds the row.</p>
          </div>
          <div>
            <h2 className="c-state-label">Narrow sidebar · 240 px</h2>
            <div className="c-state-crop">
              <Sidebar
                variant="c"
                project
                dockTreatment="compact"
                unreadCount={1}
                sidebarWidth={240}
              />
            </div>
            <p className="c-state-description">No preview to truncate or wrap.</p>
          </div>
        </div>
      </div>
    </>
  )
})
