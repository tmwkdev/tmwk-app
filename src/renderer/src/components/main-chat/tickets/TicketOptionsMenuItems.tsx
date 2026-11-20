import React from 'react'
import { ArrowUpRight, CheckCheck, EyeOff, FolderTree, Repeat } from 'lucide-react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FilterToggleRow } from '@/components/sidebar/worktree-list/controls/FilterToggleRow'
import SidebarRepositoryFilterSection from '@/components/sidebar/worktree-list/controls/SidebarRepositoryFilterSection'
import { SidebarHostScopeMenuSection } from '@/components/sidebar/worktree-list/controls/SidebarHostScopeMenuSection'
import {
  getSidebarHostVisibilityLabel,
  shouldShowHostScopeControls
} from '@/components/sidebar/worktree-list/controls/sidebar-host-options'
import { useSidebarHostScopeOptions } from '@/components/sidebar/worktree-list/controls/use-sidebar-host-scope-options'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { withoutHiddenRepos } from '../../../../../shared/project/catalog/hidden-projects'
import type {
  TicketGroupBy,
  TicketSortWithin
} from '../../../../../shared/tmwk/ticket-overview/ticket-grouping'
import { isDefaultStatusOrder } from './StatusOrderPopover'
import {
  TICKET_ROW_FIELDS,
  useTicketOptionsStore,
  type TicketDensity,
  type TicketRowField
} from './ticket-options-store'

const keepOpen = (event: Event): void => event.preventDefault()

const GROUP_BYS: readonly TicketGroupBy[] = ['attention', 'status', 'project', 'host', 'none']
const SORTS: readonly TicketSortWithin[] = ['attention', 'lastActivity', 'newest', 'oldest']
const DENSITIES: readonly TicketDensity[] = ['two-line', 'one-line']

function optionLabels(t: Translate) {
  return {
    groupBy: {
      attention: t('tmwk.tickets.options.groupAttention', 'Attention'),
      status: t('tmwk.tickets.options.groupStatus', 'Status'),
      project: t('tmwk.tickets.options.groupProject', 'Project'),
      host: t('tmwk.tickets.options.groupHost', 'Host'),
      none: t('tmwk.tickets.options.groupNone', 'None')
    } satisfies Record<TicketGroupBy, string>,
    sort: {
      attention: t('tmwk.tickets.options.sortAttention', 'Attention order'),
      lastActivity: t('tmwk.tickets.options.sortLastActivity', 'Last activity'),
      newest: t('tmwk.tickets.options.sortNewest', 'Newest'),
      oldest: t('tmwk.tickets.options.sortOldest', 'Oldest')
    } satisfies Record<TicketSortWithin, string>,
    density: {
      'two-line': t('tmwk.tickets.options.densityTwo', 'Two lines'),
      'one-line': t('tmwk.tickets.options.densityOne', 'One line')
    } satisfies Record<TicketDensity, string>,
    field: {
      reason: t('tmwk.tickets.options.fieldReason', 'Reason'),
      project: t('tmwk.tickets.options.fieldProject', 'Project'),
      host: t('tmwk.tickets.options.fieldHost', 'Host'),
      agent: t('tmwk.tickets.options.fieldAgent', 'Agent'),
      lastActivity: t('tmwk.tickets.options.fieldLastActivity', 'Last activity'),
      pr: t('tmwk.tickets.options.fieldPr', 'PR')
    } satisfies Record<TicketRowField, string>
  }
}

function ValueTrigger({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <DropdownMenuSubTrigger>
      <span className="flex flex-1 items-center justify-between gap-3">
        <span>{label}</span>
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {value}
        </span>
      </span>
    </DropdownMenuSubTrigger>
  )
}

function HostsItem({
  hostOptions
}: {
  hostOptions: ReturnType<typeof useSidebarHostScopeOptions>['hostOptions']
}): React.JSX.Element | null {
  const t = useTranslate()
  const setWorkspaceHostScope = useAppStore((s) => s.setWorkspaceHostScope)
  const visibleWorkspaceHostIds = useAppStore((s) => s.visibleWorkspaceHostIds)
  const setVisibleWorkspaceHostIds = useAppStore((s) => s.setVisibleWorkspaceHostIds)
  if (!shouldShowHostScopeControls(hostOptions)) {
    return null
  }
  return (
    <SidebarHostScopeMenuSection
      hostVisibilityLabel={getSidebarHostVisibilityLabel(visibleWorkspaceHostIds, hostOptions, t)}
      hostOptions={hostOptions}
      preserveWorkspaceBoardOpen={false}
      setWorkspaceHostScope={setWorkspaceHostScope}
      visibleWorkspaceHostIds={visibleWorkspaceHostIds}
      setVisibleWorkspaceHostIds={setVisibleWorkspaceHostIds}
    />
  )
}

/** Ticket options, from the same primitives as Workspace options. Hosts and Projects are Orca's shared filters (D62). */
export function TicketOptionsMenuItems({
  onOpenStatusOrder,
  onOpenWorktreeView
}: {
  onOpenStatusOrder: () => void
  onOpenWorktreeView?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const labels = optionLabels(t)
  const options = useTicketOptionsStore((s) => s.options)
  const setOptions = useTicketOptionsStore((s) => s.setOptions)
  const setShowOnRow = useTicketOptionsStore((s) => s.setShowOnRow)
  const projectCount = useAppStore((s) => withoutHiddenRepos(s.repos).length)
  const { hostOptions } = useSidebarHostScopeOptions()
  const showSection = projectCount > 1 || shouldShowHostScopeControls(hostOptions)
  const shownFields = TICKET_ROW_FIELDS.filter((field) => options.showOnRows[field])
  const shownLabel =
    shownFields.length === 0
      ? t('tmwk.tickets.options.fieldsNone', 'None')
      : shownFields.length === 1
        ? labels.field[shownFields[0]]
        : `${labels.field[shownFields[0]]} +${shownFields.length - 1}`

  return (
    <>
      <DropdownMenuLabel className="pb-0 text-sm text-foreground">
        {t('tmwk.tickets.options.title', 'Ticket options')}
      </DropdownMenuLabel>
      {showSection && (
        <>
          <DropdownMenuLabel>{t('tmwk.tickets.options.show', 'Show')}</DropdownMenuLabel>
          <HostsItem hostOptions={hostOptions} />
          <SidebarRepositoryFilterSection />
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuLabel>{t('tmwk.tickets.options.groupBy', 'Group by')}</DropdownMenuLabel>
      <div className="px-2 pt-0.5 pb-1">
        <ToggleGroup
          type="single"
          value={options.groupBy}
          onValueChange={(value) => {
            if (value) {
              setOptions({ groupBy: value as TicketGroupBy })
            }
          }}
          variant="outline"
          size="sm"
          className="h-6 w-full justify-stretch"
        >
          {GROUP_BYS.map((groupBy) => (
            <ToggleGroupItem
              key={groupBy}
              value={groupBy}
              // Capture pointer intent before Radix roving focus can consume the click without changing ToggleGroup value.
              onPointerDownCapture={() => setOptions({ groupBy })}
              className="h-6 grow basis-0 px-1 text-[10px] data-[state=on]:bg-foreground/10 data-[state=on]:font-semibold data-[state=on]:text-foreground"
            >
              {labels.groupBy[groupBy]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {options.groupBy === 'status' && (
        <DropdownMenuItem onSelect={onOpenStatusOrder}>
          <span className="flex flex-1 items-center justify-between gap-3">
            <span>{t('tmwk.tickets.options.statusOrder', 'Status order…')}</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {isDefaultStatusOrder(options.statusOrder)
                ? t('tmwk.tickets.options.orderDefault', 'Default')
                : t('tmwk.tickets.options.orderCustom', 'Custom')}
            </span>
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <ValueTrigger
          label={
            options.groupBy === 'none'
              ? t('tmwk.tickets.options.sortBy', 'Sort by')
              : t('tmwk.tickets.options.sortWithin', 'Sort within group')
          }
          value={labels.sort[options.sortWithin]}
        />
        <DropdownMenuSubContent className="w-52">
          <DropdownMenuRadioGroup
            value={options.sortWithin}
            onValueChange={(value) => setOptions({ sortWithin: value as TicketSortWithin })}
          >
            {SORTS.map((sort) => (
              <DropdownMenuRadioItem key={sort} value={sort} onSelect={keepOpen}>
                {sort === 'attention' ? (
                  <span className="flex flex-col">
                    {labels.sort.attention}
                    <span className="text-[11px] text-muted-foreground">
                      {t(
                        'tmwk.tickets.options.sortAttentionHint',
                        'Decisions, then stops, then results'
                      )}
                    </span>
                  </span>
                ) : (
                  labels.sort[sort]
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-2xs leading-4 text-muted-foreground">
            {t('tmwk.tickets.options.sortNote', 'What needs you stays first in every group.')}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <ValueTrigger
          label={t('tmwk.tickets.options.density', 'Row density')}
          value={labels.density[options.density]}
        />
        <DropdownMenuSubContent className="w-44">
          <DropdownMenuRadioGroup
            value={options.density}
            onValueChange={(value) => setOptions({ density: value as TicketDensity })}
          >
            {DENSITIES.map((density) => (
              <DropdownMenuRadioItem key={density} value={density} onSelect={keepOpen}>
                {labels.density[density]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <ValueTrigger
          label={t('tmwk.tickets.options.showOnRows', 'Show on rows')}
          value={shownLabel}
        />
        <DropdownMenuSubContent className="w-56">
          {TICKET_ROW_FIELDS.map((field) => (
            <DropdownMenuCheckboxItem
              key={field}
              checked={options.showOnRows[field]}
              onCheckedChange={(checked) => setShowOnRow(field, checked === true)}
              onSelect={keepOpen}
            >
              {labels.field[field]}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-2xs leading-4 text-muted-foreground">
            {t(
              'tmwk.tickets.options.showOnRowsNote',
              'Needs-you rows always keep their reason. A project still shows when two titles match, and a host when it explains a problem.'
            )}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {t('tmwk.tickets.options.filters', 'Filters')}
        </span>
      </div>
      <FilterToggleRow
        icon={<CheckCheck className="size-3.5" />}
        label={t('tmwk.tickets.options.hideDone', 'Hide done')}
        checked={options.hideDone}
        onChange={(hideDone) => setOptions({ hideDone })}
      />
      <FilterToggleRow
        icon={<Repeat className="size-3.5" />}
        label={t('tmwk.tickets.options.hideOngoing', 'Hide ongoing')}
        checked={options.hideOngoing}
        onChange={(hideOngoing) => setOptions({ hideOngoing })}
      />
      <FilterToggleRow
        icon={<EyeOff className="size-3.5" />}
        label={t('tmwk.tickets.options.hideQuiet', 'Hide quiet')}
        checked={options.hideQuiet}
        onChange={(hideQuiet) => setOptions({ hideQuiet })}
      />
      <div className="px-2 pt-1 pb-1 text-2xs leading-4 text-muted-foreground">
        {t('tmwk.tickets.options.filtersNote', 'Filters never hide what needs you.')}
      </div>
      {onOpenWorktreeView && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenWorktreeView}>
            <FolderTree className="size-3.5 text-muted-foreground" />
            {t('tmwk.tickets.options.worktreeView', 'Worktree view')}
            <ArrowUpRight className="ml-auto size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}
