import type { Translate } from '@/i18n/use-translate'
import { TMWK_FEEDBACK_ISSUE_REPO } from '../../../../../shared/tmwk/identity/tmwk-egress'
import type { TmwkFeedbackIssueHandoff } from '../../../../../shared/tmwk/feedback/tmwk-feedback-issue-url'

export function tmwkIssueActionLabel(t: Translate, busy: boolean): string {
  return busy
    ? t('tmwk.feedback.opening', 'Opening…')
    : t('tmwk.feedback.copyAndOpenIssue', 'Copy and open issue')
}

export function tmwkIssueDestinationNote(t: Translate): string {
  return t(
    'tmwk.feedback.destinationNote',
    'Copies this report and opens a new public issue on github.com/{{repo}}. Nothing is sent until you submit it there.',
    { repo: TMWK_FEEDBACK_ISSUE_REPO }
  )
}

/** Replaces the upstream crash copy that promises attached logs; issues are public, so none go. */
export function tmwkCrashIssueDescription(t: Translate): string {
  return t(
    'tmwk.feedback.crashDescription',
    'Describe what happened. The issue gets your notes and app details, never logs.'
  )
}

/** What the person does next: review the prefilled issue, or paste when the report was too long. */
export function tmwkIssueHandoffMessage(
  t: Translate,
  handoff: TmwkFeedbackIssueHandoff | undefined
): string {
  return handoff?.bodyInUrl === false
    ? t(
        'tmwk.feedback.pasteReport',
        'The report was too long for the link. It is on your clipboard: paste it into the issue.'
      )
    : t(
        'tmwk.feedback.reviewIssue',
        'Opened a GitHub issue with your report. Review it, then submit it there.'
      )
}
