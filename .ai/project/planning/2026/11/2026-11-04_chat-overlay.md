# Chat overlay in the Laravel app

## Goal

A small script puts the chat into any page of the Laravel app: a chat button bottom right opens the chat in a panel on
the right, beside the page with the page pushed aside. The panel survives page
reloads by coming back as it was: open or closed, width, the open conversation and the unsent text. Finished when
this works on a test site with several linked pages, and the Laravel app can add it to the pages it chooses.

## Milestones

- [x] Overlay script served by the chat (`/overlay.js`): button, panel with the chat in an iframe, drag to resize
      at a pointer-reactive edge, slim scrollbars on both sides, state kept in the page's local storage, the chat only loaded on first opening
- [x] Chat inside the panel: reopens the last conversation and keeps unsent text per conversation
- [x] Test site with linked pages, checked in the browser
- [x] Laravel side: the app adds the script tag itself where the chat should appear — guide
      `src/php-fpm-claude/claude-defaults/skills/agent-chat-integration`
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

## Decisions

- Overlay instead of a split view in the chat: an iframe of the app inside the chat cannot follow the app's own
  navigation across origins, and the user does not need the chat to read the app's address (user's call).
- The overlay comes back after a reload rather than surviving it; the chat lives on the server, so nothing is lost.
  Full reloads from Laravel's Vite refresh are accepted (user's call); no part of a page survives a full reload.
- Turning the layout around (chat outside, app in an iframe) or injecting through the image's nginx was rejected:
  projects that bring their own nginx config would break it (user's call). A Chrome side-panel extension was offered.
- The app adds the script tag in its own layouts, like a dev tool such as Debugbar; it decides in code which pages
  get the chat, so no path setting exists in the image (user, 253b).
- Before its first sign-in the panel signs in by itself through the app's existing chat route (`data-sign-in` on
  the script tag): the unauthorized chat tells the overlay, which loads the route once in the frame. No extra
  route in the app; works across domains because the sign-in happens inside the frame (user, 251a).
- Always split, no overlay mode: the panel is too wide to lie over the page (user's call). The page moves by a right
  margin; fixed elements of the app and its breakpoints do not follow — accepted for a development aid.
- The script lives in a shadow root, so the app's CSS and the overlay's CSS cannot touch each other.
- A browser extension side panel (never reloads) was offered and not chosen: needs installing, no Safari.

## Open

- Nothing.
