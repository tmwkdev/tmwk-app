import React, { useState } from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import type { NewTabAgentMenuModel } from '@/components/agent/launch-menu/new-tab-agent-menu-model'
import type { NewWorkspaceProjectOption } from '@/lib/workspace/creation/new-workspace-project-options'
import type { WorkspaceCreateErrorDisplay } from '@/lib/workspace/creation/workspace-create-error-format'
import type { AgentPickerEntry } from '../../../../../shared/agent-launch/picker/agent-launch-picker'
import { EMPTY_NEW_TICKET_DRAFT, type NewTicketDraft } from './new-ticket-sheet-store'
import { NewTicketSheetForm } from './NewTicketSheetForm'
import type { NewTicketRunOnOption } from './use-new-ticket-targets'

const REQUEST =
  'Avatars stay stale after switching GitHub accounts until restart. Make the sidebar and PR reviewers pick up the new account right away.'

const PROJECTS: NewWorkspaceProjectOption[] = [
  {
    kind: 'project',
    id: 'p-tmwk',
    projectId: 'p-tmwk',
    displayName: 'tmwk-app',
    badgeColor: 'var(--muted-foreground)',
    detail: 'tmwkdev/tmwk-app'
  },
  {
    kind: 'project',
    id: 'p-docs',
    projectId: 'p-docs',
    displayName: 'docs-site',
    badgeColor: 'var(--muted-foreground)',
    detail: 'tmwkdev/docs-site'
  }
]

const RUN_ON: NewTicketRunOnOption[] = [
  { key: 'auto', kind: 'auto' },
  {
    key: 'local:mac',
    kind: 'host',
    setup: {
      id: 'mac',
      kind: 'ready',
      projectId: 'p-tmwk',
      hostId: 'local',
      repoId: 'r-mac',
      label: 'Local Mac',
      detail: 'This computer',
      path: '~/code/tmwk-app'
    }
  },
  {
    key: 'ssh:mbp:mbp',
    kind: 'host',
    setup: {
      id: 'mbp',
      kind: 'ready',
      projectId: 'p-tmwk',
      hostId: 'ssh:mbp',
      repoId: 'r-mbp',
      label: 'mbp',
      detail: 'SSH',
      path: '~/tmwk-app'
    }
  }
]

const CLAUDE: AgentPickerEntry = {
  agent: 'claude',
  label: 'Claude Code',
  rows: [{ kind: 'cli', agent: 'claude' }],
  surfaces: ['terminal'],
  defaultSurface: 'terminal',
  terminal: {},
  structured: {},
  catalog: { origin: 'unknown' },
  catalogRead: 'settled'
}

const AGENT_MODEL: NewTabAgentMenuModel = {
  state: 'settled',
  rows: CLAUDE.rows,
  detection: {
    detectedIds: ['claude'],
    isLoading: false,
    isRefreshing: false,
    detectionFailed: false,
    needsServerUpdate: false,
    refresh: async () => ['claude']
  }
}

function Sheet({
  initial,
  error = null,
  runOnOpen = false
}: {
  initial: Partial<NewTicketDraft>
  error?: WorkspaceCreateErrorDisplay | null
  runOnOpen?: boolean
}): React.JSX.Element {
  const [draft, setDraft] = useState<NewTicketDraft>({ ...EMPTY_NEW_TICKET_DRAFT, ...initial })
  const [createMore, setCreateMore] = useState(false)
  return (
    <div className="bg-background p-8">
      <div className="mx-auto w-[512px] rounded-lg border border-black/14 bg-dialog-surface p-6 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.28)] dark:border-white/14">
        <NewTicketSheetForm
          draft={draft}
          onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          projectOptions={PROJECTS}
          projectFromFilter={draft.projectOptionId === 'p-tmwk'}
          runOnOptions={RUN_ON}
          runOnDefaultOpen={runOnOpen}
          agentField={
            <AgentLaunchPicker
              model={AGENT_MODEL}
              entries={[CLAUDE]}
              agent="claude"
              setupDisabled
              onPick={() => {}}
            />
          }
          createMore={createMore}
          onCreateMoreChange={setCreateMore}
          submitting={false}
          error={error}
          onSubmit={() => {}}
        />
      </div>
    </div>
  )
}

const filledDraft: Partial<NewTicketDraft> = {
  words: REQUEST,
  projectOptionId: 'p-tmwk',
  source: 'https://github.com/tmwkdev/tmwk-app/issues/431'
}

export const filled = defineFixture({ width: 600, render: () => <Sheet initial={filledDraft} /> })

export const empty = defineFixture({ width: 600, render: () => <Sheet initial={{}} /> })

export const runOnOpen = defineFixture({
  width: 600,
  render: () => <Sheet initial={{ projectOptionId: 'p-tmwk' }} runOnOpen />
})

export const notDelivered = defineFixture({
  width: 600,
  render: () => (
    <Sheet
      initial={filledDraft}
      error={{
        title: "Saved as a ticket, but Chat didn't get it",
        message: 'Chat has not started yet.',
        help: 'Create sends it to Chat again.'
      }}
    />
  )
})
