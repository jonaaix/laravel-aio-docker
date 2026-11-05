# Read-aloud mini player

## Goal

Reading a message aloud keeps going while the person moves between chats, and a small player controls it: the chat
it comes from (a link back), a progress bar to jump to any part, back 10 seconds, pause/resume, reading speed and stop.
The chat being read shows audio level bars in the sidebar. Finished when a long answer can be paused, resumed where it
stopped, rewound and jumped through without starting over.

## Milestones

- [x] Speech engine: chunk index, pause/resume, seek to a chunk, back 10 s, live rate change, progress, source chat
- [x] Reading survives leaving the chat (no stop on unmount)
- [x] Level bars in the sidebar row of the chat being read (still while paused)
- [x] Player in the sidebar foot (desktop) and above the message input (narrow screens)
- [x] Reading speed slider shared between settings and player
- [x] Pause as the main button, slim progress bar, speed menu opens at the current speed
- [x] Read-along: the passage being read is tinted in the message; clicking a paragraph jumps there
- [x] One-button player in the folded sidebar
- [x] Feature Book: web chat chapter

## State

- Built and checked in the browser as the test user: reading, pause (position held), switching chats (reading goes
  on, level bars on the source chat), resume, back, stop; player in the sidebar foot and above the input on a phone.

## Decisions

- Player at the foot of the sidebar right above the account card, links above both (question 154a): mini players
  conventionally sit at the bottom, and a player at the top made the chat list jump. Floats above the input on narrow
  screens (question 150a).
- Back and forward 10 seconds on either side of pause (user's call, replacing back-only); progress bar and stop
  (question 152b). Speed in the player is a menu in 0.25× steps with a capped, scrolling height (user's call); the fine
  slider stays in the settings.
- Progress follows the text, not minutes: pieces are generated one after another, so total time is unknown. A jump lands
  on the start of the piece at that spot.
- Read-along finds the spoken piece in the rendered message by its opening and closing words and marks it with the
  CSS Custom Highlight API, so the message markup stays untouched; where a piece is not found, nothing is marked.
- Paragraph clicks jump only while that message is read, so normal clicks and text selection stay unaffected.
- Level bars take the place of the working dots while a chat is read.
- Device voices cannot seek inside an utterance: back restarts the current piece, or the previous one right after a
  piece began.

## Open

- Nothing.
