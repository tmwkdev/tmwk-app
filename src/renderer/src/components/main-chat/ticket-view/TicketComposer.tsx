import React, { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'

/** "Message the owner": goes straight to the ticket's open attempt (D60). */
export function TicketComposer({
  onSend,
  busy = false,
  placeholder
}: {
  /** Absent: the composer is shown but cannot send. */
  onSend?: (text: string) => void
  busy?: boolean
  placeholder?: string
}): React.JSX.Element {
  const t = useTranslate()
  const [text, setText] = useState('')
  const canSend = Boolean(onSend) && !busy && text.trim().length > 0
  const send = (): void => {
    if (canSend) {
      onSend?.(text.trim())
      setText('')
    }
  }
  return (
    <form
      className="w-full rounded-xl border border-border bg-card px-4 py-3 shadow-xs focus-within:ring-2 focus-within:ring-ring/40"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <textarea
        value={text}
        disabled={!onSend}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // As in Chat's composer: Enter sends, Shift+Enter is a newline.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
        }}
        rows={2}
        placeholder={placeholder ?? t('tmwk.ticketView.messageOwner', 'Message the owner')}
        aria-label={t('tmwk.ticketView.messageOwner', 'Message the owner')}
        className="scrollbar-sleek block max-h-40 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex items-center justify-end">
        <Button
          type="submit"
          size="icon-xs-round"
          disabled={!canSend}
          aria-label={t('tmwk.ticketView.send', 'Send')}
          className="size-7"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </form>
  )
}
