import React from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'

/** First launch: no tickets yet, and the way to make one. */
export function TicketsEmpty({
  onHandOffInChat
}: {
  onHandOffInChat: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-4 text-[13px] leading-5 text-muted-foreground">
      {t('tmwk.tickets.emptyBody', 'Work you hand off in Chat shows up here.')}
      <Button size="xs" variant="outline" onClick={onHandOffInChat}>
        <MessageCircle className="size-3" />
        {t('tmwk.tickets.handOff', 'Hand off work in Chat')}
      </Button>
    </div>
  )
}
