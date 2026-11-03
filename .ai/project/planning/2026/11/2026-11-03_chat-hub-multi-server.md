# Chat hub with several servers

## Goal

One chat codebase in two forms: served from the Docker image (one server, signed-link sign-in, no other
servers) and as the hub, an installable PWA on GitHub Pages that pairs with the chats of several containers
and replaces the frozen Framework7 app. Finished when the hub reaches the Framework7 app's features on
iPhone and desktop, and the Framework7 app is retired.

## Milestones

- [x] Sign-in by signed link only: the chat issues one-time links (~60 s) on request of the Laravel app, which
      proves itself with `CHAT_KEY`; lifelong session until the key changes; "Unauthorized" otherwise; name
      prompt removed
- [x] Device pairing: one-time pairing code (QR and link in Remote control), device key pair (WebCrypto,
      non-extractable), challenge → short-lived access token for API, live stream and files; device list
      with remove; CORS only for the hub origin
- [x] Hub build mode: `generate:hub` (NUXT_PUBLIC_HUB=true, base `/orbit/`, hash routing, own build and output
      dirs so it never clobbers the dev server); icons bundled client-side; manifest and Orbit icons
- [x] Hub connections: servers in IndexedDB (url, deviceId, non-extractable private key), pairing from
      `?pair=&code=` with a confirm step, paste-link form, access tokens refreshed by challenge, `useApi` sends
      Bearer / `access_token`, live stream reconnects with a fresh token, switching reloads into the other server
- [x] Hub server switcher in the sidebar (add, switch, remove) and the screen for a removed device
- [x] Unread in the hub: per server from `participantIds` + `lastAnswerAt` against a local seen map, dots in the
      sidebar, counts in the switcher, other servers polled while visible, app badge with the total
- [x] Push from several servers: device-made VAPID pair (IndexedDB) given to each server with the subscription,
      `hub_ref` echoed in the payload, service worker shows and opens `?server=<ref>#/c/<id>`; server-wide VAPID
      keys removed; presence from the hub; Notifications category in the hub's settings
- [x] Offline reading (cached GETs of lists and conversations per server, offline notice), update notice from the
      service worker, QR scanner (jsqr) in the connect screen
- [ ] Ionic spike on the iPhone: shell with two real chat views; decide Ionic or own gestures
- [ ] Mobile shell (tabs, swipe back, transitions, pull to refresh, swipe actions, keyboard, safe areas)
- [ ] Retire the Framework7 app

## State

- Sign-in and pairing work on the chat side (see the Feature Book chapters `ai/web-chat.md`, `ai/chat-hub.md`).
- Orbit is built with `bun run generate:hub` into `src/agent-chat/.output-hub/public` (base `/orbit/`, hash
  routes, no server code: `serverDir` points at the empty `hub-server/`). Checked in Chrome against the dev chat
  served from `localhost:3100/orbit/`: welcome, pairing confirm, two servers, switching, unread dot and counts,
  offline with saved lists, notifications settings, removing a server, iPhone size in dark mode.
- Push: each device makes its own VAPID pair (IndexedDB) and gives it with `hubRef` to each chat; server-wide
  VAPID keys and `/api/push/key` are gone, old subscriptions without keys are skipped. Registration and a
  signed web-push request were checked; real delivery needs a real device (headless Chrome has no push service).
- Not published yet: the GitHub repo `orbit` with Pages does not exist. `.nojekyll` is in `public/` so Pages
  serves `_nuxt/`.
- Open: Ionic decision, mobile shell, retiring the Framework7 app.

## Decisions

- The chat signs links itself; Laravel only requests them with the shared `CHAT_KEY`. Development and my
  browser checks request links the same way (user's call).
- No emergency access: without the Laravel app and without an earlier sign-in there is no way in (user's call).
- A sign-in lasts until the signing key on the server changes (user's call).
- Asymmetric device keys for the hub rather than a shared device secret (user's call).
- Push without a gateway: the device creates its own VAPID key pair and gives it to every server it pairs
  with, so several servers can notify one device (user's call).
- Ionic and the mobile shell wait; the plan may change there (user's call). Everything else is built in full.
- Hub-only behaviour (unread, notifications, offline, server switcher) stays out of the chat served from the
  container, which keeps its approved behaviour.
- The hub is called orbit and lives at `https://jonaaix.github.io/orbit/` (user's call).
- I build everything; the Tarek experiment has ended and the Framework7 app is frozen (user's call).

## Open

- Nothing.
