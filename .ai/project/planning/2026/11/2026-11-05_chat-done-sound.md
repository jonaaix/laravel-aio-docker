# Sound when a chat is done

## Goal

The web chat plays a short, low double drum beat when an agent answer finishes in a conversation the person is not
looking at, so work running in the background is noticed without watching the sidebar. Finished when the beat sounds
once per answer, never for the conversation in view, and each person can switch it off.

## Milestones

- [x] Sound chosen with the user from synthesized samples (double beat, "Kräftig")
- [x] Per-person setting `users.done_sound` (migration 0036), switch in Settings → Chat
- [x] Trigger in the layout: a conversation's last answer time grows, the person has written in it, and it is not
      the open conversation in a visible tab
- [x] One sound across tabs of the same browser
- [ ] Final strength confirmed by the user ("Kräftig" or "Voll")
- [x] Feature Book: web chat and settings chapters

## State

- Built and type-checked; the switch was checked in the browser as the test user. The sound itself is handed to the
  user to hear on a real finished answer (no own test chats).
- Samples page for choosing the sound: https://claude.ai/artifact/WA8BLYyqYMjNYBB4ChaJa1

## Decisions

- Synthesized with Web Audio, no audio file (user picked from samples; no licensing, tiny).
- Same rule as the unread dot plus "tab in the background" (user's call, question 141a).
- Switch on by default, per person (user's call, question 143a).
- Browsers start audio only after a click or key press in the page; the sound context is unlocked on the first one,
  so an answer finishing right after a reload stays silent.
- Tabs share a Web Lock and a short list of played answers in local storage, so only one tab sounds.
- Every device of the person still sounds on its own; accepted.

## Open

- "Kräftig" or "Voll" (question 142).
