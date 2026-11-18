# Conversation and memory references

Reviewed 2026-11-11 against official documentation. These findings inform the vision; they do not select a dependency or implementation.

For the concrete application of these findings, see [the main chat design](../main-chat.md), which applies retained records, search/read tools, focused worker briefs, and source-linked checkpoints.

## OpenClaw

OpenClaw documents one rolling main conversation for direct messages by default. Other sessions can carry separate work and report back. The active context is bounded through compaction, while transcripts remain stored and searchable. This is a close precedent for the user's intended relationship with one main technical partner. [Main session](https://docs.openclaw.ai/concepts/main-session)

Durable memory uses workspace files, including curated memory and dated notes, with recall tools. This separates retained knowledge from the content included in a particular model call. [Memory](https://docs.openclaw.ai/concepts/memory)

## Hermes

Hermes stores conversations as sessions with full message history and cross-session search. Messaging conversations can persist, but a single universal transcript across all interfaces should not be assumed. Its gateway owns accepted execution; closing a client detaches it. That is a useful precedent for work surviving the laptop UI going offline. [Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions)

Hermes separates bounded, curated memory from searchable session history. Memory is loaded as a snapshot at session start. Saving a memory does not automatically update the prompt of another running session. Its docs caution against multiple agents writing through the same agent home. Shared context needs an explicit delivery and ownership design. [Persistent memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)

Profiles separate agent configuration, memories, sessions, and gateway state. We don't need this: our product operates within a single infrastructure boundary, with one installation per person and setting. [Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)

## Implications for our vision

The following are our inferences from those patterns:

- Preserve as much useful history as practical within one installation.
- Give the user one main conversational relationship, backed by separate execution sessions.
- Make retained history available for recall; use summaries and retrieval to keep active context focused.
- Keep decisions and their rationale accessible across tickets and projects.
- Deliver relevant context to ticket owners explicitly and collect their outcomes on reconnection.
- Keep accepted remote work independent of the laptop client's lifetime.

Retaining history is not a guarantee of perfect recall. Multiple agent CLIs also do not automatically share their native memory stores. The product needs to bridge relevant context deliberately, without requiring one enormous prompt or one shared writable agent directory.

The user's recollection that Muse is based on OpenClaw has not been verified. No product relationship is assumed here.
