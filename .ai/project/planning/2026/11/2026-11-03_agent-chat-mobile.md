# Agent chat mobile app

## Goal

A Framework7 + Vue PWA, hosted on GitHub Pages without its own server, that connects to one or more
agent-chat instances through their "Mobile app link" and lets the user chat in their conversations on
the go. Built by the agents Tarek and Peter in an agent-chat conversation overnight. Finished when the
handover runs and the user has reviewed the result.

## Milestones

- [x] agent-chat: API open to other origins, "Mobile app link" under Settings → Remote control
- [x] `src/agent-chat-mobile/` created with `framework7 create` (web + PWA, Vue, Single View, Vite, no
      icon fonts), CLAUDE.md and `.claude/settings.json` copied from this repo, own git repo
- [x] Dev server with `NUXT_WORKING_DIR` on the app folder; conversation `ef8a94e7-…` started as test
      user Claude with a brief, Peter added
- [x] Overnight: four rounds with Tarek and Peter (connections, list, live thread, offline and unsent
      messages, attachments, install polish, load time, accessibility, tests, update flow, Pages deploy)
- [x] Round 5 (Tarek): connect by QR code (code in Remote control, scanner in the app), push notifications
            when an agent finishes an answer, reviewed by Peter and fixed; `push_subscriptions` migration 0019
- [x] Round 6 (Tarek): per-connection switch to show only the title on the lock screen, testable
      notify decision in `afterTurn`, tappable question cards in the app, reviewed by Peter and fixed
- [x] Round 7 (Tarek): web chat keeps other question cards' choices; unread dots and app badge (his choice)
- [x] Round 8 (Tarek): summary and next-step cards with "Accept" in the app, code highlighting in opened
      working steps, reviewed by Peter and fixed
- [x] Round 9 (Tarek, his choice): saved chats show at once and stay readable offline, reviewed by Peter and fixed
- [x] Round 10 (Tarek, his choice): add and remove agents in a chat from the app, reviewed by Peter and fixed
- [x] Round 11 (Tarek): agent switch checked in the browser, list follows changes on every page; the chat
      accepts only true/false for `member`
- [x] Round 12 (Tarek): clean light mode (agent answers without bubbles, flat cards in one grey, quiet tool
      rows, glass composer); Peter reviews it and the app-wide listening
- [x] Round 13 (Tarek): live connections close in the background; chat list search (his choice)
- [x] Round 14 (Tarek): Peter reviewed round 13, fixes (quiet background, no cut-off answers, accent-free search)
- [x] Round 15 (Tarek): heartbeat; a live connection without a sign of life for 45 s is rebuilt (app and chat)
- [x] Round 16 (Tarek, his choice): copy a finished agent answer with one tap
- [x] Round 17 (Tarek): share an answer through the share sheet; copy and share reviewed by Peter and fixed
- [x] Round 18 (Tarek, his choice): earlier messages load by themselves when scrolling up
- [ ] Round 19 (Tarek): Peter reviews the auto loading, then his own topic (no search inside a chat)
- [ ] Review with the user

## State

- The app is built and committed in its own repo (316 tests via `npm test`, Pages workflow runs them
  before deploying); its own plan and Feature Book live in `src/agent-chat-mobile/.ai/`. The chat's
  tests count 38 via `npm test` in `src/agent-chat`.
- Tarek is paused. QR scan verified with a fake camera at iPhone size (scan, confirm, connected); push
  verified up to the send attempt, real delivery untested. Untested on a real iPhone: install, icon,
  startup image, flight mode, text size, VoiceOver, camera, push.
- Push works for one chat server per device at a time (one push subscription per app), unless the
  servers share `NUXT_VAPID_PUBLIC_KEY` / `NUXT_VAPID_PRIVATE_KEY`.
- The default VAPID subject is a placeholder address Apple may reject; a real deployment sets
  `NUXT_VAPID_SUBJECT` to a real `mailto:` or `https://` address.
- The outer repo ignores `/src/agent-chat-mobile`.
- While the dev server runs with `NUXT_WORKING_DIR`, every new conversation's lead works in the app folder.

## Decisions

- The app lives in this repo as its own git repo, so it can move to GitHub as it is.
- Scaffolded with the official Framework7 CLI (user's call); icon fonts left out because the copied
  CLAUDE.md prescribes Heroicons.
- Only CLAUDE.md and `.claude/settings.json` are copied, no skills.
- No SPEC/PLAN files up front: the requirements come through the chat, like a normal user (user's call).
- Tarek and Peter both on Sonnet / medium (user's call).
- Tarek may change `src/agent-chat` for features that need the chat; he writes no migrations, I generate
  them with the server stopped.
- I lead and decide Tarek's open questions myself; the user does not decide them (user's call).
- QR scanning sits in the app, because the iPhone camera opens links in Safari, whose storage the
  installed app does not share. Libraries `qrcode`, `jsqr` and `web-push` approved by me.
- No push while the app is visible on screen.
- Copy and share take the whole answer as written, like copying in the web chat.
- The muddy light mode came from our own choices (long answers in iMessage bubbles, cards and pills nested
  in them, grey composer band), not from Framework7, whose defaults look clean in the starter.
