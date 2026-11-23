import { TMWK_REPO } from '../branding/tmwk-product-name'
import TMWK_POSTHOG from './tmwk-posthog.json'

// tmwk's one config point for where the app sends data (S22). Upstream code reads it through
// small Maintain patches; moving to tmwk's own endpoints later is an edit here only. The release
// check's forbidden list lives beside it in tmwk-release-egress-check.json, kept out of the
// bundle because the check would otherwise find its own strings.
type TmwkEgress = {
  feedback: { apiUrl: string | null; issueRepo: string }
  diagnostics: { blockedHosts: readonly string[] }
  // Read by the release script too, hence JSON. The key itself is never in the repo.
  posthog: typeof TMWK_POSTHOG
}

export const TMWK_EGRESS: TmwkEgress = {
  feedback: {
    // v0 sends nothing off the machine. Null routes every form to a GitHub issue; a tmwk-owned
    // endpoint here posts reports again. Never Orca's feedback server.
    apiUrl: null,
    issueRepo: TMWK_REPO
  },
  diagnostics: {
    // Uploads to these hosts are refused, whatever the build constant or env says.
    blockedHosts: ['orca.dev', 'onorca.dev']
  },
  // Stage 3: tmwk's own PostHog Cloud project. Orca's project and event catalog never send.
  posthog: TMWK_POSTHOG
}

export const TMWK_FEEDBACK_API_URL = TMWK_EGRESS.feedback.apiUrl
export const TMWK_FEEDBACK_OPENS_GITHUB_ISSUE = TMWK_FEEDBACK_API_URL === null
export const TMWK_FEEDBACK_ISSUE_REPO = TMWK_EGRESS.feedback.issueRepo
export const TMWK_POSTHOG_HOST = TMWK_EGRESS.posthog.host
export const TMWK_PRIVACY_URL = TMWK_EGRESS.posthog.privacyUrl
