import { TMWK_FEEDBACK_ISSUE_REPO } from '../identity/tmwk-egress'

export type TmwkFeedbackIssueKind = 'feedback' | 'crash'

export type TmwkFeedbackIssueHandoff = {
  issueUrl: string
  /** False when the report was too long for the URL and only the clipboard holds it. */
  bodyInUrl: boolean
}

// GitHub rejects new-issue URLs well before browsers do; stay under its ~8 KB request line.
export const TMWK_ISSUE_URL_MAX_LENGTH = 8000
const TITLE_MAX_LENGTH = 80
const CLIPBOARD_BODY =
  'The full report is on your clipboard. Paste it here, then review it before submitting.'

function issueTitle(kind: TmwkFeedbackIssueKind, report: string): string {
  if (kind === 'crash') {
    const reason = /^Reason: (.+)$/m.exec(report)?.[1]?.trim()
    return reason && reason !== 'no captured crash report'
      ? `Crash report: ${reason}`
      : 'Crash report'
  }
  const firstLine = report
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) {
    return 'Feedback'
  }
  return firstLine.length > TITLE_MAX_LENGTH
    ? `${firstLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : firstLine
}

function newIssueUrl(title: string, body: string, labels: string[]): string {
  const params = new URLSearchParams({ title, body })
  if (labels.length > 0) {
    params.set('labels', labels.join(','))
  }
  return `https://github.com/${TMWK_FEEDBACK_ISSUE_REPO}/issues/new?${params.toString()}`
}

export function buildTmwkFeedbackIssueUrl(
  kind: TmwkFeedbackIssueKind,
  report: string
): TmwkFeedbackIssueHandoff {
  const title = issueTitle(kind, report)
  // GitHub ignores labels the author cannot apply, so this is safe for outside reporters.
  const labels = kind === 'crash' ? ['bug'] : []
  const fullUrl = newIssueUrl(title, report, labels)
  if (fullUrl.length <= TMWK_ISSUE_URL_MAX_LENGTH) {
    return { issueUrl: fullUrl, bodyInUrl: true }
  }
  return { issueUrl: newIssueUrl(title, CLIPBOARD_BODY, labels), bodyInUrl: false }
}
