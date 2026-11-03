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
- [ ] `SPEC.md` (API contract, link format, usability bar) and `PLAN.md` (milestones) in the app folder
- [ ] Dev server with `NUXT_WORKING_DIR` on the app folder; conversation as test user Claude with Peter
- [ ] Overnight nudges until `PLAN.md` is ticked off
- [ ] Review with the user

## State

- The generated starter builds (`npm run build` → `www/` with service worker); it is the unchanged
  Framework7 demo.
- The outer repo ignores `/src/agent-chat-mobile`.

## Decisions

- The app lives in this repo as its own git repo, so it can move to GitHub as it is.
- Scaffolded with the official Framework7 CLI (user's call); icon fonts left out because the copied
  CLAUDE.md prescribes Heroicons.
- Only CLAUDE.md and `.claude/settings.json` are copied, no skills.

## Open

- None.
