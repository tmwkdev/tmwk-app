import {
  isTmwkTicketId,
  parseTmwkTicketHref,
  tmwkTicketChatHref,
  TMWK_TICKET_ID_IN_TEXT_PATTERN
} from '../../../../../shared/tmwk/tmwk-ticket-link'

type MarkdownNode = {
  type: string
  value?: string
  url?: string
  title?: string | null
  children?: MarkdownNode[]
}

function ticketLink(ticketId: string, child: MarkdownNode): MarkdownNode {
  return { type: 'link', url: tmwkTicketChatHref(ticketId), title: null, children: [child] }
}

function splitTicketIds(value: string): MarkdownNode[] {
  const parts: MarkdownNode[] = []
  let cursor = 0
  for (const match of value.matchAll(TMWK_TICKET_ID_IN_TEXT_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, index) })
    }
    parts.push(ticketLink(match[0], { type: 'text', value: match[0] }))
    cursor = index + match[0].length
  }
  if (cursor === 0) {
    return [{ type: 'text', value }]
  }
  if (cursor < value.length) {
    parts.push({ type: 'text', value: value.slice(cursor) })
  }
  return parts
}

function linkTicketIds(node: MarkdownNode): void {
  if ((node.type === 'link' || node.type === 'definition') && node.url) {
    const ticketId = parseTmwkTicketHref(node.url)
    if (ticketId) {
      node.url = tmwkTicketChatHref(ticketId)
    }
  }
  if (!node.children || node.type === 'link' || node.type === 'linkReference') {
    return
  }
  const nextChildren: MarkdownNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && child.value !== undefined) {
      nextChildren.push(...splitTicketIds(child.value))
    } else if (child.type === 'inlineCode' && child.value && isTmwkTicketId(child.value)) {
      nextChildren.push(ticketLink(child.value, child))
    } else {
      linkTicketIds(child)
      nextChildren.push(child)
    }
  }
  node.children = nextChildren
}

/** Ticket ids and `orca://tickets/<id>` links in chat open the ticket view. */
export function remarkTmwkTicketLinks(): (tree: MarkdownNode) => void {
  return linkTicketIds
}
