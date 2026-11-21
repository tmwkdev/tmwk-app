import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkTmwkTicketLinks } from './remark-tmwk-ticket-links'

type Node = { type: string; url?: string; value?: string; children?: Node[] }

function links(markdown: string): { url?: string; text: string }[] {
  const tree: Node = unified().use(remarkParse).parse(markdown)
  remarkTmwkTicketLinks()(tree)
  const found: { url?: string; text: string }[] = []
  const textOf = (node: Node): string => node.value ?? (node.children ?? []).map(textOf).join('')
  const visit = (node: Node): void => {
    if (node.type === 'link') {
      found.push({ url: node.url, text: textOf(node) })
    }
    node.children?.forEach(visit)
  }
  visit(tree)
  return found
}

describe('remarkTmwkTicketLinks', () => {
  it('links bare and inline-code ticket ids to the chat ticket href', () => {
    expect(links('Filed tk_0a1b2c3d, see `tk_deadbeef`.')).toEqual([
      { url: '#tmwk-ticket=tk_0a1b2c3d', text: 'tk_0a1b2c3d' },
      { url: '#tmwk-ticket=tk_deadbeef', text: 'tk_deadbeef' }
    ])
  })

  it('rewrites ticket deep links and leaves other links alone', () => {
    expect(
      links('[the ticket](orca://tickets/tk_0a1b2c3d) and [tk_deadbeef](https://example.com)')
    ).toEqual([
      { url: '#tmwk-ticket=tk_0a1b2c3d', text: 'the ticket' },
      { url: 'https://example.com', text: 'tk_deadbeef' }
    ])
  })

  it('ignores code blocks, embedded ids and malformed ids', () => {
    expect(
      links('```\ntk_0a1b2c3d\n```\n\nxtk_0a1b2c3d tk_0a1b2c3d9 tk_0A1B2C3D a/tk_0a1b2c3d')
    ).toEqual([])
  })
})
