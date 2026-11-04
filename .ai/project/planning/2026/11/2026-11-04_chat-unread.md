# Unread conversations in the web chat

## Goal

The web chat shows which conversations have an answer the person has not seen yet, the same way the Orbit app
does, but remembered per person on the server. Finished when switching away from a working conversation leaves a
dot once the answer is done, the tab title counts unread conversations, and reading on one device clears the dot
on the others.

## Milestones

- [x] `conversation_reads` (conversation, user, seen answer time), migration; on a person's first load every
      conversation counts as read
- [x] `GET /api/reads`, `PUT /api/conversations/:id/read`; a `read` list event reaches only that person
- [x] Web chat: dot in the sidebar, open conversation kept read, "(n) AI Chat" in the tab title
- [x] Orbit: the active server and the other servers use the server's reads instead of browser storage
- [x] Feature Book: web chat and hub chapters

## State

- Built: `conversation_reads` (migration 0033), `read-store.ts`, `useReads`/`useUnread`, Orbit moved onto them.
- Checked in the web chat with two browsers (baseline, dots, tab count, read on one device clears the other);
  the Orbit build itself has not been run.

## Decisions

- Remembered per person on the server, not per browser (user's call, question 128).
- Unread count in the tab title (user's call, question 129).
- Same rule as Orbit: a finished agent answer since the person last had the conversation open, only in
  conversations the person has written in.

## Open

- Nothing.
