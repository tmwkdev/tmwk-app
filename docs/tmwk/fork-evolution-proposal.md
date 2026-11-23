# Proposal for tmwk ownership and upstream integration

2026-11-23. Endorsed, with the additions below. The policy PR that adopts it updates [fork-ownership.md](fork-ownership.md), which holds the active rules.

tmwk should control the entire app it ships. Any part of the inherited implementation can be improved when the product needs it. Orca remains an important source of code, fixes and ideas, with an explicit integration strategy for each area.

The objective is a simpler building surface: improve behavior where it belongs, reuse the machinery that already works, and spend integration effort where it buys useful product freedom. Ownership gives us responsibility for the result, including inherited code we leave unchanged.

## Why the current boundary needs to change

The current map divides the app into Orca's agent plumbing and tmwk's work layer. Most inherited code is Track, where local edits are prohibited. Extend allows small additive patches, and Own code reaches orchestration through CLI or RPC. This protected the initial fork from uncontrolled divergence and let the main chat and tickets ship quickly.

It also makes some straightforward improvements awkward. Moving a change into a `tmwk` directory can satisfy the ownership rule without reducing its dependence on the inherited implementation. Conversely, a small improvement at the existing owner of a behavior can be forbidden because of its path.

Three existing cases show the difference:

| Area                   | Current implementation                                                                                                                                                      | Opportunity                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Setup terminal cleanup | [A tmwk runtime subclass](../../src/main/tmwk/setup-terminal/runtime-setup-terminal-auto-close.ts) reads protected runtime members and intercepts PTY data and setup waits. | Put lifecycle behavior in the appropriate runtime services, with a deliberate interface for any tmwk policy.    |
| Ticket continuation    | [Follow-up handling](../../src/main/tmwk/tickets/read-follow-ups.ts) joins task, dispatch and host records to retain one ticket across attempts.                            | Give ticket execution a coherent lifecycle interface, improving the underlying implementation where necessary.  |
| Main conversation      | [MainChatView](../../src/renderer/src/components/main-chat/MainChatView.tsx) composes native chat with composer, session and outage owners.                                 | Let the product evolve chat and shell behavior together while retaining shared rendering and session machinery. |

The distinction we need is between product decisions and integration costs. Changing inherited code increases the work of reconciling future updates. That cost should influence the implementation; it should not categorically prevent it.

## Ownership and integration strategy

All shipped behavior is tmwk's responsibility. The path map records how an area is maintained relative to upstream, rather than which organization is allowed to change it.

Use three persistent strategies:

| Strategy        | Development rule                                                                                                                                                                   | Upstream integration rule                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Follow**      | Reuse the inherited implementation. The first intentional local change updates the map and records the reason in the same PR.                                                      | Integrate upstream normally and check its effect on tmwk.                                                                                                    |
| **Maintain**    | Modify inherited code at its existing path. Changes can include substantive behavior and focused restructuring. Record the intended difference and the dependencies it introduces. | Reconcile both implementations. Review relevant upstream changes even when Git merges them without conflict. Retire local changes when upstream covers them. |
| **Independent** | tmwk determines the design and behavior. This includes code with no upstream counterpart and inherited areas whose design we deliberately take over.                               | Review upstream changes affecting the area and its dependencies; port useful changes explicitly. Record what was ported, declined or deferred.               |

Unlisted inherited paths default to Follow. A developer can move an area to Maintain in the same focused PR as its first change; there is no separate approval round just to edit an upstream path. Independent is a deliberate design choice with a stated scope and reason, rather than an automatic consequence of a difficult merge.

Replacement and retirement are transitions, not additional ownership states. An unused implementation may stay temporarily when removal would disrupt callers or compatibility. It may be removed once those dependencies and migrations are handled. We no longer require superseded product logic to remain forever merely because upstream still has it.

The initial migration is:

| Current state | Initial strategy                                           |
| ------------- | ---------------------------------------------------------- |
| Track         | Follow                                                     |
| Extend        | Maintain, preserving each existing patch's intent          |
| Adopted       | Independent, preserving the review history and obligations |
| Own           | Independent for existing tmwk code                         |

These mappings change maintenance policy, not runtime behavior. They do not require code moves or renames. New code belongs in the module that owns its behavior; tmwk directories remain useful for tmwk concepts, without becoming mandatory destinations for every local change.

## How we improve the existing code

The default sequence is to find the current owner of the behavior, extend or generalize it, and then assess whether the resulting dependency is clear enough to maintain. A separate implementation is justified when the behavior has a different purpose or lifecycle, not simply because editing the original path used to be prohibited.

Prefer a focused change to a terminal service over inserting another runtime inheritance layer. Prefer one host-aware launch flow over separate local and remote implementations. Keep the ticket's identity, history and acceptance in tmwk's work model while reusing the agent transport and execution machinery beneath it.

Boundaries should follow actual responsibilities:

- **Across hosts or processes:** preserve RPC, IPC, CLI and wire contracts, including capability checks and behavior with older supported peers.
- **Within a process:** use typed service interfaces and existing dependency direction. Calling a local service is valid; routing every local call through RPC is not a requirement.
- **Across lifecycle or storage owners:** use the operation that owns the mutation, cleanup, authorization and event publication. A direct database or private-state shortcut is not a substitute for a service interface.
- **In the renderer:** reuse native chat, session handling and UI primitives. Change their extension points or implementation when the product requires it.

An adapter earns its place by translating concepts, containing a volatile dependency, or exposing a useful service. A file that only re-exports internal symbols does not by itself reduce coupling. We should not create a second runtime or a general abstraction framework as a prerequisite for feature work.

tmwk's product invariants remain: a ticket has a durable identity across attempts; the owner is accountable for its outcome; losing contact with a host is different from observing a process exit; and directing work does not require the user to manage every session. Module boundaries should help preserve those behaviors.

## Keeping upstream useful

Use regular integration branches based on a pinned Orca commit. Integrate weekly, starting with the first integration this week, with earlier integrations when an important fix warrants them. Each one pins a candidate commit, merges it on an integration branch, and lands only after a green nightly. A fetched commit or a partially reviewed candidate does not become the recorded integrated baseline.

There is no GitHub Actions validation. A candidate's full validation is the MBP nightly, which takes about two hours, so plan each week's candidate a day ahead of its merge. Local `pnpm check:changed` and `pnpm tc` gate the push; the nightly gates the landing.

The initial approach is a normal merge of an upstream snapshot. Where upstream behavior conflicts with tmwk's product, reconcile it explicitly in the candidate and record the maintained difference. Individual backports remain available for urgent fixes, with their source recorded so the next full integration can reconcile them. Avoid turning routine updates into unrelated cherry-picks whose dependencies are hard to follow.

Each integration follows this sequence:

1. Record the previously integrated upstream commit, candidate commit and tmwk base. Summarize changes by subsystem and identify overlap with maintained behavior.
2. Merge on the integration branch. Resolve Maintain areas for the intended behavior on both sides. Review Independent areas explicitly; never use a blanket merge option that silently prefers all local files.
3. Review changes to callers, types, storage, events and protocols around the divergent areas. A conflict-free merge can still change their meaning.
4. Compare each affected local change with the upstream result: keep, adapt or retire it. Explain any remaining difference. Take generated inputs and regenerate outputs using their owning generators.
5. Validate the candidate, fix integration regressions there, and record deferred work with its reason. Advance the integrated baseline only when the candidate lands.

Keep the maintenance record in [fork-ownership.md](fork-ownership.md), evolving its existing map and patch log. Each divergent area needs its paths, strategy, intended behavioral difference, relevant interface or data dependencies, and last reviewed upstream commit. The integration PR records resolutions and deferred changes. Start with this existing documentation rather than adding a second registry.

Keep the record cheap to maintain. The nightly lists the Maintain and Independent areas upstream has touched since their last reviewed commit, so that field is updated during review rather than tracked by hand. Undocumented divergence is checked by machine as well as in review: an inherited path that differs from the integrated upstream baseline with no Maintain or Independent entry fails `check:tmwk` ([TMWK-8](https://linear.app/allcue/issue/TMWK-8/p13-add-a-fork-boundary-check-to-checktmwk)).

Useful measures are integration age, recurring conflict areas, regression findings, and local changes retired. A zero-conflict merge is evidence about text, not proof of product compatibility. Review and simplify areas that repeatedly consume integration time.

## The first integration has concrete opportunities

The upstream snapshot inspected for this proposal is `bffef7a9b8f4`; tmwk is at `61241aff7360`, with common ancestor `f1e1f44779fa`. These references make the comparison reproducible; the integration implementation should choose and record its own candidate.

Several upstream changes overlap current tmwk concerns:

| Upstream change                                                                              | What to compare before adopting it                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Worker setup terminal and startup tab cleanup](https://github.com/stablyai/orca/pull/47370) | Upstream binds terminals to worker release and stop. tmwk also closes successful setup terminals earlier. Preserve the useful distinctions while sharing lifecycle machinery where possible. |
| [Worker start timeouts](https://github.com/stablyai/orca/pull/47393)                         | Reconcile failed starts with ticket attempts, and preserve uncertainty when a paired server may still be running the worker.                                                                 |
| [Paired server follow-up reports](https://github.com/stablyai/orca/pull/47163)               | Check report delivery alongside tmwk's ticket continuation and attempt identity. A delivery fix alone does not establish ticket continuity.                                                  |
| [Worker stop reasons and host loss](https://github.com/stablyai/orca/pull/47543)             | Carry authoritative stop reasons into ticket state without treating an unreachable host as confirmed termination.                                                                            |

These changes are candidates for consolidation, not proof that the corresponding tmwk code can be deleted. Compare end-to-end behavior before removing a local change.

Lifecycle work is frozen until the first integration and its lifecycle comparison are done. That covers terminals, follow-ups, sub-agents and worktree cleanup, including [TMWK-19](https://linear.app/allcue/issue/TMWK-19/accepting-a-ticket-should-close-its-owners-terminals-and-clear-its), [TMWK-20](https://linear.app/allcue/issue/TMWK-20/one-time-cleanup-path-for-tickets-accepted-before-cleanup-on-accept-85) and [TMWK-21](https://linear.app/allcue/issue/TMWK-21/sub-agents-started-with-worker-start-parent-shouldnt-become-their-own). Local lifecycle changes made now would be compared against upstream's rewrite of the same machinery a week later.

The identity tripwire ([TMWK-10](https://linear.app/allcue/issue/TMWK-10/p15-build-the-identity-tripwire-inside-check-tmwkmjs)) lands before or with the first integration. Merging upstream is when Orca's endpoints, keys, names or update URLs could return.

## Policy changes to land together

The policy PR should update the rules, the map and enforcement consistently. Existing restrictions continue to apply until that PR lands.

| Surface                                                                                                                                                                                      | Proposed change                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Fork map](fork-ownership.md)                                                                                                                                                                | Replace ownership by organization with Follow, Maintain and Independent. Migrate existing entries and preserve their rationale. Remove the prohibition on substantive inherited-code changes and mandatory relocation.                          |
| [AGENTS.md](../../AGENTS.md)                                                                                                                                                                 | State tmwk's responsibility for the whole app. Require a recorded strategy and rationale for divergence, focused changes, and review of affected upstream behavior.                                                                             |
| [Orchestration import gate](../../config/ast-grep/rules/tmwk-no-orchestration-internals.yml) and [its rule cases](../../config/ast-grep/rule-tests/tmwk-no-orchestration-internals-test.yml) | Remove the blanket namespace ban and obsolete rule cases. Retain existing process, dependency and cycle checks; review lifecycle and storage ownership explicitly. Add specific dependency rules as the pilot establishes its service boundary. |
| [Orchestration ownership plan](orchestration-ownership-plan.md)                                                                                                                              | Mark its path and import restrictions as superseded, while retaining the implemented ticket model and historical decisions.                                                                                                                     |
| [Code quality plan](code-quality-plan.md)                                                                                                                                                    | Revise P1.3, P1.4, P2.3 and P2.4 and their linked work items. Check documented divergence and actual dependencies; remove the requirement that every upstream import pass through a shrinking allowlist of wrapper files.                       |
| [Documentation index](README.md), main chat and identity guidance                                                                                                                            | Align descriptions with responsibility for the whole product. Preserve the product behavior, identity configuration, consent and release requirements.                                                                                          |

The [code quality plan](code-quality-plan.md) items change with it:

| Item                                                                                                                | Change                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1.3, [TMWK-8](https://linear.app/allcue/issue/TMWK-8/p13-add-a-fork-boundary-check-to-checktmwk)                   | Becomes the divergence check: an inherited path differing from the integrated baseline with no Maintain or Independent entry fails `check:tmwk`. |
| P1.4, [TMWK-9](https://linear.app/allcue/issue/TMWK-9/p14-add-a-seam-rule-that-limits-own-imports-of-upstream-code) | Superseded. There is no seam rule limiting imports of upstream code.                                                                             |
| P2.3, [TMWK-13](https://linear.app/allcue/issue/TMWK-13/p23-put-orca-behind-named-seam-modules)                     | Superseded. Orca is not put behind named seam modules.                                                                                           |
| P2.4, [TMWK-14](https://linear.app/allcue/issue/TMWK-14/p24-clean-up-the-fork-ownership-map)                        | Becomes "migrate the map" to Follow, Maintain and Independent.                                                                                   |

The replacement review rules should flag an undocumented local divergence, a dependency bypassing an operation's lifecycle or storage owner, an unhandled compatibility change, or unrelated churn. Editing an inherited path or importing a documented local service is not itself a finding.

Keep the identity seam in `src/shared/tmwk/identity/` for app identifiers, folders, commands, schemes, destinations and keys. Broader ownership must not scatter those values through the tree. Existing license and attribution obligations remain in force.

## Delivery sequence

### Establish the policy

Land one focused policy PR covering the changes above. Inventory current divergent paths from the actual diff against the integrated upstream baseline, including test companions and generated files; do not rely solely on today's map. Preserve patch intent and identify any unrecorded differences.

Done when the instructions, path map, review rules and executable gates agree. Developers can make a justified change at its existing owner without inventing a wrapper or moving it merely to satisfy a path rule. This phase changes no product behavior.

### Integrate the upstream candidate

Prepare the pinned integration in a separate PR from architectural changes. The identity tripwire is in place first, and lifecycle work waits for this phase's comparison. Review the lifecycle overlaps above and identify code that upstream makes redundant. Keep behavior changes needed for compatibility in this PR; leave broader redesign to the next phase.

Done when the candidate passes the applicable checks and a green MBP nightly, the maintained differences are current, and the integrated baseline is recorded. If validation exposes a regression, repair the candidate before landing it. A failed candidate leaves the released baseline unchanged.

### Improve ticket execution as the first pilot

Use ticket execution to prove the new approach. Map the existing launch, observation, follow-up, report and stop flows before choosing an interface. Consolidate how ticket callers use those operations, preserving the distinction between ticket decisions and execution facts.

Begin with the most awkward demonstrated behavior: continuation across attempts and hosts, or setup-terminal lifetime after the upstream comparison. Make the smallest change that simplifies it. Improve inherited services directly where that is the appropriate owner; retain CLI and RPC for callers and hosts that need those contracts.

Done when the selected workflow has one clear implementation path, its local and remote behavior is verified, and the replaced code or workaround has been removed. Do not make all tickets wait on a complete orchestration rewrite.

### Evolve the shell and chat with product work

Apply the same approach to navigation, the ticket sidebar, the composer and chat events as concrete features need them. Shared rendering, adapters and transport continue to benefit from upstream. Broader ownership does not create a separate shell rewrite project.

## Validation and compatibility

Policy and documentation changes need consistency, link and formatting checks. Product changes use the existing typecheck, lint and targeted behavior checks. Add a regression test only when it meets the repository's test-value rule and protects the layer that owns the behavior.

For the integration and execution pilot, record reproducible state and results for the affected workflows:

- Start a ticket, receive an owner report and accept the result.
- Continue a completed ticket and retry a failed attempt while retaining ticket identity and history.
- Run work on a paired host, lose contact and reconnect without duplicate execution or a false completion.
- Exercise successful and failed setup, worker stop, and terminal cleanup while preserving failure evidence and user activity.
- Verify the affected CLI, desktop and mobile surfaces, including older supported peers or explicit capability refusal.
- Cover affected macOS, Linux and Windows behavior and both git and folder workspaces. Use isolated display or CI coverage for checks that cannot safely run on the user's desktop.

Keep `ORCA_BACKGROUND_LAUNCH=1` for agent-launched apps and tests. Follow the repository's hidden-renderer and component-fixture rules for rendered checks. Run `pnpm check:changed` after the last edit or rebase immediately before a push; document any scoped validation limits.

Success is useful product work requiring fewer indirections, with upstream integrations remaining regular and reviewable. We should see local fixes retired as Orca catches up, fewer places translating the same execution facts, and explicit responsibility for the behavior we deliberately change.
