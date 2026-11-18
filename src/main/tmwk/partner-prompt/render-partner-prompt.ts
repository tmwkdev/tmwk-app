const LEADING_HTML_COMMENT = /^\s*<!--[\s\S]*?-->\s*/

export function renderPartnerPrompt(basePrompt: string): string {
  return `${basePrompt.replace(LEADING_HTML_COMMENT, '').trim()}\n`
}
