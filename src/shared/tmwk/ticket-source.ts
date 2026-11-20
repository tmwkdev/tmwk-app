import type { TmwkTicketSource } from './tmwk-ticket-record'

const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/

/** A Linear, Jira or GitHub issue URL as a ticket source; null for anything else. */
export function parseTicketSourceUrl(text: string, title?: string): TmwkTicketSource | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const titled = title ? { title } : {}
  if (url.hostname === 'linear.app' && parts[1] === 'issue' && ISSUE_KEY.test(parts[2] ?? '')) {
    return { kind: 'linear', key: parts[2].toUpperCase(), url: url.href, ...titled }
  }
  if (url.hostname === 'github.com' && parts[2] === 'issues' && /^\d+$/.test(parts[3] ?? '')) {
    return { kind: 'github', key: `${parts[0]}/${parts[1]}#${parts[3]}`, url: url.href, ...titled }
  }
  const browse = parts.indexOf('browse')
  const jiraKey =
    browse !== -1 ? parts[browse + 1] : (url.searchParams.get('selectedIssue') ?? undefined)
  if (jiraKey && ISSUE_KEY.test(jiraKey)) {
    return { kind: 'jira', key: jiraKey.toUpperCase(), url: url.href, ...titled }
  }
  return null
}
