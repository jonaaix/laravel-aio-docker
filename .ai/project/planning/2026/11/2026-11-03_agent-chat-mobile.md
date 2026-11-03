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
      when an agent finishes an answer; chat side committed in `Chat:` commits, needs the `push_subscriptions` migration
- [ ] Review with the user

## State

- The app is built and committed in its own repo (77 tests via `npm test`, Pages workflow runs them
  before deploying); its own plan and Feature Book live in `src/agent-chat-mobile/.ai/`.
- Tarek works on round 5 and may change `src/agent-chat` for it; he writes no migrations and reports a
  needed table instead. Untested: real iPhone (install, icon, startup image,
  flight mode, text size, VoiceOver) and a real Pages update.
- The outer repo ignores `/src/agent-chat-mobile`.
- While the dev server runs with `NUXT_WORKING_DIR`, every new conversation's lead works in the app folder.

## Decisions

- The app lives in this repo as its own git repo, so it can move to GitHub as it is.
- Scaffolded with the official Framework7 CLI (user's call); icon fonts left out because the copied
  CLAUDE.md prescribes Heroicons.
- Only CLAUDE.md and `.claude/settings.json` are copied, no skills.
- No SPEC/PLAN files up front: the requirements come through the chat, like a normal user (user's call).
- Tarek and Peter both on Sonnet / medium (user's call).
- I lead and decide Tarek's open questions myself; the user does not decide them (user's call).
- QR scanning sits in the app, because the iPhone camera opens links in Safari, whose storage the
  installed app does not share. Libraries `qrcode`, `jsqr` and `web-push` approved by me.
- No push while the app is visible on screen.
