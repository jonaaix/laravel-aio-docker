# Chat hub with several servers

## Goal

One chat codebase in two forms: served from the Docker image (one server, signed-link sign-in, no other
servers) and as the hub, an installable PWA on GitHub Pages that pairs with the chats of several containers
and replaces the frozen Framework7 app. Finished when the hub reaches the Framework7 app's features on
iPhone and desktop, and the Framework7 app is retired.

## Milestones

- [ ] Sign-in by signed link only: verify signature, expiry (~60 s) and single use; lifelong session until the
      key changes; "Unauthorized" otherwise; name prompt removed; dev helper to create a link
- [ ] Device pairing: one-time pairing code (QR and link in Remote control), device key pair (WebCrypto,
      non-extractable), challenge → short-lived access token for API, live stream and files; device list
      with remove; CORS only for the hub origin
- [ ] Hub build: static PWA build mode, connections to several servers, all state per connection, server
      switcher with unread counts
- [ ] Push from several servers without a gateway: device-made VAPID key handed to each paired server
- [ ] Offline reading, update flow, app badge, QR scanner, language per connection (taken from the
      Framework7 app)
- [ ] Ionic spike on the iPhone: shell with two real chat views; decide Ionic or own gestures
- [ ] Mobile shell (tabs, swipe back, transitions, pull to refresh, swipe actions, keyboard, safe areas)
- [ ] Retire the Framework7 app

## State

- Concept agreed with the user; the Feature Book chapters `ai/web-chat.md` (Reaching the chat) and
  `ai/chat-settings.md` (Remote control) describe the target. Nothing built yet.
- Today the chat identifies a person by a `chat-user-id` cookie / user id; the Framework7 app connects with a
  permanent link that carries the user id. Both go away.

## Decisions

- No emergency access: without the Laravel app and without an earlier sign-in there is no way in (user's call).
- A sign-in lasts until the signing key on the server changes (user's call).
- Asymmetric device keys for the hub rather than a shared device secret (user's call).
- Push without a gateway: the device creates its own VAPID key pair and gives it to every server it pairs
  with, so several servers can notify one device (user's call).
- Ionic only after a spike on a real iPhone (user's call).
- I build everything; the Tarek experiment has ended and the Framework7 app is frozen (user's call).

## Open

- The hub's GitHub Pages address (needed for the CORS allowlist and the pairing link).
- How I sign in during development and for browser checks, since there is no other way in.
