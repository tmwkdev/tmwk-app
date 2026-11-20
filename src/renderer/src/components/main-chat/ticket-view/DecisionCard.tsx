import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatPaletteSessionAge } from '@/components/cmd-j/palette-session-age'
import { useNow } from '@/lib/window-activity/use-now'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketDecision } from '../../../../../shared/tmwk/ticket-view'
import { TicketStateGlyph } from '../tickets/ticket-glyphs'

/** The pending decision, answered in one click from its options or with a typed reply. */
export function DecisionCard({
  decision,
  onAnswer,
  busy = false
}: {
  decision: TicketDecision
  /** Absent: the card shows its answers but cannot send them yet. */
  onAnswer?: (answer: string) => void
  busy?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(60_000)
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const askedAt = decision.askedAt ? Date.parse(decision.askedAt) : Number.NaN
  const age = Number.isNaN(askedAt) ? undefined : formatPaletteSessionAge(askedAt, now, t)
  const disabled = !onAnswer || busy
  const answers =
    decision.options.length > 0
      ? decision.options
      : decision.recommend
        ? [t('tmwk.ticketView.useRecommendation', 'Go with the recommendation')]
        : []
  const send = (answer: string): void => {
    onAnswer?.(answer)
    setReply('')
    setReplying(false)
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <TicketStateGlyph state="decision" />
        {age
          ? t('tmwk.ticketView.decisionAsked', 'Decision · asked {{age}} ago', { age })
          : t('tmwk.ticketView.decision', 'Decision')}
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm font-medium">{decision.text}</div>
      {decision.recommend && (
        <div className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-muted-foreground">
          {decision.recommend}
        </div>
      )}
      {replying ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (reply.trim()) {
              send(reply.trim())
            }
          }}
        >
          <Textarea
            autoFocus
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setReplying(false)
              }
            }}
            aria-label={t('tmwk.ticketView.replyLabel', 'Your answer')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
              {t('tmwk.ticketView.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={disabled || !reply.trim()}>
              {t('tmwk.ticketView.sendAnswer', 'Send answer')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {answers.map((answer, index) => (
            <Button
              key={answer}
              size="sm"
              variant={index === 0 ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() =>
                send(decision.options.length > 0 ? answer : (decision.recommend ?? answer))
              }
            >
              {answer}
            </Button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setReplying(true)}>
            {t('tmwk.ticketView.reply', 'Reply')}
          </Button>
        </div>
      )}
    </div>
  )
}
