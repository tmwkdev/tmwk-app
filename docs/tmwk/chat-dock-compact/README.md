# Compact Chat dock

Implements the compact, no-preview treatment approved in [mockup PR #30](https://github.com/tmwkdev/tmwk-app/pull/30).
The existing Own `MainChatSidebarEntry` now lives immediately above the bottom toolbar,
with a 44 CSS-pixel hit row, 14 px semibold label, 8 px outer inset and 8 px row inset.
There is no second line or preview preference.

The only Extend seams are removing the mount from `SidebarNav` and adding it to
`SidebarToolbar`. The toolbar is already outside both Projects and Activity scrolling
and unmounts when the sidebar collapses. Utility navigation, project controls, toolbar
actions, chat content, and the existing `openMainPage` action are unchanged.

No unread badge is included. The existing Own main-session hook provides the pinned
session and agent-switch state, but no Chat unread count; workspace/agent attention
state belongs to other views. Connecting that to the main home would require more
than a small existing seam, so the mockup's illustrative badge is omitted.

## Rendered evidence

These are the real desktop Sidebar components rendered with seeded state in headless
Chromium, without Electron or a paired runtime. The browser viewport is 1280 × 900;
sidebar dimensions exclude the fixture's surrounding 16 px padding.

| State                              | Sidebar   | Dark                                                                    | Light                                                                    |
| ---------------------------------- | --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Chat active; last project retained | 280 × 700 | [PNG](images/main-chat__MainChatSidebarEntry--chat.dark.png)            | [PNG](images/main-chat__MainChatSidebarEntry--chat.light.png)            |
| Project workspace active           | 280 × 700 | [PNG](images/main-chat__MainChatSidebarEntry--workspace.dark.png)       | [PNG](images/main-chat__MainChatSidebarEntry--workspace.light.png)       |
| Folder workspace active            | 280 × 700 | [PNG](images/main-chat__MainChatSidebarEntry--folderWorkspace.dark.png) | [PNG](images/main-chat__MainChatSidebarEntry--folderWorkspace.light.png) |
| Minimum sidebar width              | 220 × 700 | [PNG](images/main-chat__MainChatSidebarEntry--narrow.dark.png)          | [PNG](images/main-chat__MainChatSidebarEntry--narrow.light.png)          |
| Short window; 24 workspaces        | 280 × 360 | [PNG](images/main-chat__MainChatSidebarEntry--short.dark.png)           | [PNG](images/main-chat__MainChatSidebarEntry--short.light.png)           |
| Short window after scrolling       | 280 × 360 | [PNG](images/short-scrolled.dark.png)                                   | [PNG](images/short-scrolled.light.png)                                   |
| Activity body and view             | 280 × 700 | [PNG](images/main-chat__MainChatSidebarEntry--activity.dark.png)        | [PNG](images/main-chat__MainChatSidebarEntry--activity.light.png)        |
| Collapsed; contents unmounted      | 0 × 700   | [PNG](images/main-chat__MainChatSidebarEntry--collapsed.dark.png)       | [PNG](images/main-chat__MainChatSidebarEntry--collapsed.light.png)       |
| Keyboard focus                     | 280 × 700 | [PNG](images/keyboard-focus.dark.png)                                   | [PNG](images/keyboard-focus.light.png)                                   |
| Hover                              | 280 × 700 | [PNG](images/hover.dark.png)                                            | [PNG](images/hover.light.png)                                            |

Run from the repository root:

```sh
ORCA_BACKGROUND_LAUNCH=1 pnpm fixtures:shot main-chat/MainChatSidebarEntry --theme both --out docs/tmwk/chat-dock-compact/images
ORCA_BACKGROUND_LAUNCH=1 node docs/tmwk/chat-dock-compact/verify.mjs
```

The second command uses installed Chrome headlessly, reads the running fixture server's
address, and writes interaction screenshots plus `.cache/chat-dock-verification.json`.
It checks Tab reachability, Enter and Space activation, project/folder selection clearing
Chat, Chat clearing workspace selection, Tab reaching Settings after Chat, a stationary
dock during project scrolling, and collapsed unmounting. It records computed typography
and dimensions for inspection: 44 px height, 14 px type, weight 600, 8 px row inset.

## Validation limits

The scoped `pnpm check:changed --maxWorkers=2` gate covers typechecking, lint/format,
related unit tests, ownership import boundaries and repository ratchets. No product
state or remote communication changed. macOS supplied the headless browser run;
Windows, Linux, a live remote host, mobile, and native Electron interactions were not
executed. Existing platform-neutral buttons, global navigation and collapse behavior
remain in use; no platform-specific key binding or host lookup was added.
