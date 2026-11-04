# Chat overlay in the Laravel app

## Goal

A small script puts the chat into any page of the Laravel app: a chat button bottom right opens the chat in a panel on
the right, beside the page with the page pushed aside. The panel survives page
reloads by coming back as it was: open or closed, width, the open conversation and the unsent text. Finished when
this works on a test site with several linked pages, and the image can switch the script on for its Laravel app.

## Milestones

- [x] Overlay script served by the chat (`/overlay.js`): button, panel with the chat in an iframe, drag to resize
      at a pointer-reactive edge, slim scrollbars on both sides, state kept in the page's local storage, the chat only loaded on first opening
- [x] Chat inside the panel: reopens the last conversation and keeps unsent text per conversation
- [x] Test site with linked pages, checked in the browser
- [ ] Image: nginx puts the script into every HTML page when switched on (`ENABLE_CHAT_OVERLAY`) — depends on the
      chat's image integration (supervisor program, sub-path proxy) in `2026/10/2026-10-31_claude-threads-web-ui.md`
- [x] Feature Book: web chat chapter

## State

- Panel script, panel memory and drafts are built. Checked with a test shop of three linked pages
  (`localhost:8090`, signed in to the chat on `localhost:3000`): split (page margin), drag to resize, following a link
  brings the panel back with width, conversation and unsent text; the panel shows ten messages first.
- An endless loading tab came from Chrome's six connections per address being held by the live streams of open chat
  tabs; background tabs now close their stream and catch up on return (checked with three simulated background tabs).
- Load time (production build, measured on a copy at :3300): messages after ~220 ms; transfer cut from 3.6 MB to
  676 KB by compressed assets and by loading code colours only for messages with code. The panel starts loading the
  chat at once instead of after the page's own load.
- Missing: nginx putting the script into the Laravel app's pages — waits for the chat's image integration.

## Decisions

- Overlay instead of a split view in the chat: an iframe of the app inside the chat cannot follow the app's own
  navigation across origins, and the user does not need the chat to read the app's address (user's call).
- The overlay comes back after a reload rather than surviving it; the chat lives on the server, so nothing is lost.
  Full reloads from Laravel's Vite refresh are accepted (user's call); no part of a page survives a full reload.
- Turning the layout around (chat outside, app in an iframe) or injecting through the image's nginx was rejected:
  projects that bring their own nginx config would break it (user's call). A Chrome side-panel extension was offered.
- Always split, no overlay mode: the panel is too wide to lie over the page (user's call). The page moves by a right
  margin; fixed elements of the app and its breakpoints do not follow — accepted for a development aid.
- The script lives in a shadow root, so the app's CSS and the overlay's CSS cannot touch each other.
- A browser extension side panel (never reloads) was offered and not chosen: needs installing, no Safari.

## Open

- Nothing.
