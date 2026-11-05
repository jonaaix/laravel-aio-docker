# Unread message count in the sidebar

## Goal

The sidebar shows, per conversation, how many messages from others a person has not seen yet — agent answers and
messages from other people — as a number in place of the unread dot, "99+" from 100. Finished when a group
conversation with several unseen messages shows their number in the unfolded list, on the folded picture and in the
hover card, and opening it clears the number on every device.

## Milestones

- [x] Schema: `messages.posted_at` (user messages on sending, agent answers when finished), `conversations.last_posted_at`;
      backfill existing rows
- [x] Server: set both on sending and on finishing; summary carries `lastPostedAt`; reads baseline and read marker move
      to `lastPostedAt`; `GET /api/unread` returns the per-person counts
- [x] Client: counts loaded with the reads, refreshed on new posts and read events; unread = count > 0; hub's other
      servers count through the same endpoint
- [x] UI: count pill replaces the dot (list, folded picture, hover card), "99+" cap, larger gap in the folded strip;
      mock removed
- [x] Feature Book: sidebar and Orbit unread rule
- [ ] User check in the dev chat

## State

- Built and migrated (`0037_message_posted_at`): the backfill moved the read markers of fully read conversations up
  to `last_posted_at`, so nothing that was read turned unread.
- Dev data for the check: Jonas's markers on "Mobile Framework7-Chat-App" and the image chat were reset to 0.

## Decisions

- Always the number, also for 1; "99+" from 100 (user, questions 178b, 179a).
- Everything others write counts — agent answers and other people's messages (user, 180a). Notifications and the
  done sound stay on agent answers.
- The browser tab keeps counting unread conversations, not messages (user, 181a).
- Agent answers count from the moment they finish, not when they start: a person who leaves while an answer is still
  being written must find it unread.
- `GET /api/reads` keeps its shape; counts come from `GET /api/unread`. Orbit asks other servers for `unread` too, so a
  server on an older version shows no count there until it is updated.

## Open

- Nothing.
