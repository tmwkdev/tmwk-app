import React, { useId, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HostRowIcon } from '@/components/host-picker/host-row-icon'
import { RunTargetRow } from '@/components/new-workspace/run-target/RunTargetComboboxRow'
import {
  COMBOBOX_FIELD_SHELL,
  COMBOBOX_POPOVER_SURFACE
} from '@/components/new-workspace/type-ahead/type-ahead-combobox-styles'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { NewTicketRunOnOption } from './use-new-ticket-targets'

/** The composer's Run on, reduced to Auto plus the hosts where the project is checked out. */
export function TicketRunOnPicker({
  options,
  value,
  onChange,
  defaultOpen = false
}: {
  options: readonly NewTicketRunOnOption[]
  value: string
  onChange: (key: string) => void
  defaultOpen?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const listId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [armed, setArmed] = useState(0)
  const selected = options.find((option) => option.key === value) ?? options[0]
  const label = (option: NewTicketRunOnOption): string =>
    option.kind === 'auto' ? t('tmwk.newTicket.runOnAuto', 'Auto') : option.setup.label
  const detail = (option: NewTicketRunOnOption): string =>
    option.kind === 'auto'
      ? t('tmwk.newTicket.runOnAutoDetail', 'Picks a ready host')
      : option.setup.path
  const icon = (option: NewTicketRunOnOption): React.ReactNode =>
    option.kind === 'auto' ? (
      <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
    ) : (
      <HostRowIcon hostId={option.setup.hostId} />
    )
  const commit = (index: number): void => {
    const option = options[index]
    if (option) {
      onChange(option.key)
    }
    setOpen(false)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setArmed((index) => (open ? (index + step + options.length) % options.length : index))
      setOpen(true)
    } else if (open && event.key === 'Enter') {
      event.preventDefault()
      commit(armed)
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setArmed(Math.max(0, options.indexOf(selected)))
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={t('tmwk.newTicket.runOn', 'Run on')}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${armed}` : undefined}
          onKeyDown={onKeyDown}
          className={cn(COMBOBOX_FIELD_SHELL, 'text-left text-sm outline-none')}
        >
          <span className="flex w-4 shrink-0 items-center justify-center">
            {selected ? icon(selected) : null}
          </span>
          <span className="min-w-0 flex-1 truncate">{selected ? label(selected) : null}</span>
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          'w-[var(--radix-popover-trigger-width)] min-w-64 p-1',
          COMBOBOX_POPOVER_SURFACE
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div id={listId} role="listbox" aria-label={t('tmwk.newTicket.runOn', 'Run on')}>
          {options.map((option, index) => (
            <RunTargetRow
              key={option.key}
              optionId={`${listId}-${index}`}
              icon={icon(option)}
              label={label(option)}
              detail={detail(option)}
              armed={index === armed}
              current={option.key === selected?.key}
              onArm={() => setArmed(index)}
              onCommit={() => commit(index)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
