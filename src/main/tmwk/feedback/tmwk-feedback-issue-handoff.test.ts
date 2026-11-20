import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, writeText, openExternal } = vi.hoisted(() => ({
  fetchMock: vi.fn<typeof fetch>(),
  writeText: vi.fn<(text: string) => void>(),
  openExternal: vi.fn<(url: string) => Promise<void>>()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.0-test' },
  net: { fetch: fetchMock },
  clipboard: { writeText },
  shell: { openExternal }
}))

import { submitFeedback } from '../../ipc/feedback/feedback'

const identity = { submitAnonymously: false, githubLogin: 'octo', githubEmail: 'o@example.com' }

describe('tmwk feedback forms open a GitHub issue instead of posting to Orca', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    writeText.mockReset()
    openExternal.mockReset().mockResolvedValue()
  })

  it('hands the feedback dialog report to the clipboard and a new issue', async () => {
    const result = await submitFeedback({
      ...identity,
      feedback: 'Dock is slow',
      images: [{ contentType: 'image/png', data: new Uint8Array([1, 2, 3]) }]
    })

    const issueUrl =
      'https://github.com/tmwkdev/tmwk-app/issues/new?title=Dock+is+slow&body=Dock+is+slow'
    expect(result).toEqual({ ok: true, issueHandoff: { issueUrl, bodyInUrl: true } })
    expect(writeText).toHaveBeenCalledWith('Dock is slow')
    expect(openExternal).toHaveBeenCalledWith(issueUrl)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing for the language request form', async () => {
    await submitFeedback({
      feedback: 'Language request: Polski',
      submitAnonymously: true,
      githubLogin: null,
      githubEmail: null
    })

    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/tmwkdev/tmwk-app/issues/new?title=Language+request%3A+Polski&body=Language+request%3A+Polski'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing for a crash report, even with a diagnostic bundle', async () => {
    await submitFeedback({
      ...identity,
      feedback: '[Crash Report]\nReason: oom',
      submissionType: 'crash',
      diagnosticBundle: { bundleSubmissionId: 'b1', content: '{}', bytes: 2, spanCount: 1 }
    })

    expect(writeText).toHaveBeenCalledWith('[Crash Report]\nReason: oom')
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/tmwkdev/tmwk-app/issues/new?title=Crash+report%3A+oom&body=%5BCrash+Report%5D%0AReason%3A+oom&labels=bug'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
