import { describe, expect, it } from 'vitest'
import { buildTmwkFeedbackIssueUrl } from './tmwk-feedback-issue-url'

describe('buildTmwkFeedbackIssueUrl', () => {
  it('prefills a feedback issue titled by its first line', () => {
    expect(buildTmwkFeedbackIssueUrl('feedback', '\nDock is slow\nSteps: open it')).toEqual({
      issueUrl:
        'https://github.com/tmwkdev/tmwk-app/issues/new?title=Dock+is+slow&body=%0ADock+is+slow%0ASteps%3A+open+it',
      bodyInUrl: true
    })
  })

  it('titles a crash by its reason and labels it a bug', () => {
    expect(
      buildTmwkFeedbackIssueUrl('crash', '[Crash Report]\n\nReason: render-process-gone')
    ).toEqual({
      issueUrl:
        'https://github.com/tmwkdev/tmwk-app/issues/new?title=Crash+report%3A+render-process-gone&body=%5BCrash+Report%5D%0A%0AReason%3A+render-process-gone&labels=bug',
      bodyInUrl: true
    })
  })

  it('points at the clipboard when the report does not fit in the URL', () => {
    const handoff = buildTmwkFeedbackIssueUrl('crash', `Reason: oom\n${'x'.repeat(9000)}`)
    const url = new URL(handoff.issueUrl)
    expect(handoff.bodyInUrl).toBe(false)
    expect(handoff.issueUrl.length).toBeLessThanOrEqual(8000)
    expect(url.searchParams.get('title')).toBe('Crash report: oom')
    expect(url.searchParams.get('body')).toBe(
      'The full report is on your clipboard. Paste it here, then review it before submitting.'
    )
  })
})
