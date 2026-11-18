import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'

export function MainChatContinuityStrip({
  showingEarlier,
  onToggle
}: {
  showingEarlier: boolean
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
      <span>{t('tmwk.mainChat.continued', 'Continued from an earlier conversation')}</span>
      <span aria-hidden>·</span>
      <Button variant="link" size="xs" onClick={onToggle}>
        {showingEarlier
          ? t('tmwk.mainChat.backToCurrent', 'Back to current')
          : t('tmwk.mainChat.showEarlier', 'Show earlier')}
      </Button>
    </div>
  )
}
