import { clipboard, shell } from 'electron'
import type { FeedbackSubmitResult } from '../../../shared/feedback/feedback-submit-contract'
import {
  buildTmwkFeedbackIssueUrl,
  type TmwkFeedbackIssueKind
} from '../../../shared/tmwk/feedback/tmwk-feedback-issue-url'

/** Replaces the upstream POST: the report goes to the clipboard and a prefilled GitHub issue. */
export async function handOffFeedbackToGitHubIssue(
  kind: TmwkFeedbackIssueKind,
  report: string
): Promise<FeedbackSubmitResult> {
  const issueHandoff = buildTmwkFeedbackIssueUrl(kind, report)
  try {
    // Clipboard first, so the report survives a browser that fails to open.
    clipboard.writeText(report)
    await shell.openExternal(issueHandoff.issueUrl)
    return { ok: true, issueHandoff }
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
