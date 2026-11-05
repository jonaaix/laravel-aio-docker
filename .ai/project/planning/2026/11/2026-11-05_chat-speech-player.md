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
- [x] Feature Book: web chat chapter

## State

- Built and checked in the browser as the test user: reading, pause (position held), switching chats (reading goes
  on, level bars on the source chat), resume, back, stop; player in the sidebar foot and above the input on a phone.

## Decisions

- Player in the sidebar foot, floating above the input on narrow screens (user's call, question 150a).
- Back button jumps 10 seconds (question 151a); progress bar, speed in the player and stop (question 152b, c).
- Progress follows the text, not minutes: pieces are generated one after another, so total time is unknown. A jump lands
  on the start of the piece at that spot.
- Level bars take the place of the working dots while a chat is read.
- Device voices cannot seek inside an utterance: back restarts the current piece, or the previous one right after a
  piece began.

## Open

- Nothing.
