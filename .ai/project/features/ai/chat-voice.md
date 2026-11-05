---
id: ai-chat-voice
created: 2026-11-05
tags: [chat, read-aloud, dictation, speech]
---

# Voice in the chat

## What is it for?

People can dictate messages and have any message read aloud in the [AI web chat](web-chat.md), and keep listening
while they move on to other conversations. The voice service and reading speed are chosen in
[Chat settings](chat-settings.md).

## How does it work?

While a voice service is set up for reading aloud, a microphone sits in the message input: pressing it records,
small bars beside the stop button follow the voice so it is clear the microphone hears something, and pressing stop
has the service write down what was said. The text lands in the input at the cursor, to be checked and sent by hand.
Google Cloud expects the person's chat language and handles about a minute per request, so a longer dictation is
written down piece by piece and joined. A refused microphone or a failed transcript is said at the input. Without a
voice service there is no microphone.

Any message can also be read aloud: the speaker beside "Copy" starts reading and turns into a pause button, and into a
resume button while paused, until it is done; until the voice actually starts, it shows a spinning icon instead.
When it is through, reading stays paused at the end with the player still there, so the person can step back 10
seconds or jump to a passage; resuming from the very end starts the message again. Reading ends only when the player is
closed or another message is read; while it reads, the button stays visible without pointing at the message. With a voice service set up in the settings, a natural voice of that service reads, and a message read once
plays again without asking the service anew; if the service fails, the device's voice reads the rest. Without a
service the device's own voice reads, chosen by the language the message is written in — one of the six chat
languages, recognised by its common words — falling back to the person's chat language for very short texts. Only
the prose is read: no code blocks, tool steps, the stop hook line, markdown marks or emoji. Building blocks the agent placed in
the answer are read from their content: card sections with their heading and cards, variants and choices with letter,
name and description, a page only by its title. The speed is the person's
reading speed from the settings (Read aloud). Reading goes on when the person moves to another conversation. While a
message is read, a small player shows the beginning of the message — its first heading, or else its first line — as a link back
to its conversation that opens it scrolled to the passage being read, a progress bar along the text with the passage count ("3/8")
— a jump lands on the start of the passage at that spot —, pause and resume (resuming carries on where it paused) with
"Back 10 seconds" and "Forward 10 seconds" on either side, the reading speed as a menu from 0.5× to 3× in steps of
0.25× and a button to stop; it sits at the foot of the sidebar right above the account card, and above the message
input where the sidebar is folded away. With the sidebar folded to its icon strip, the player shrinks to one button there that pauses and resumes. Inside the
message, the paragraph being read is tinted as a whole, even when it is read in more than one piece, and while that message is playing, clicking one of its paragraphs
carries on reading from there; while paused, clicks and text selection work as usual. The conversation being read shows a ring around its picture in the sidebar that moves with the voice (see
[Conversations in the sidebar](chat-sidebar.md)). Google Cloud voices belong to one language, so it reads in the
language recognised the same way.

## Examples

- A developer has a long answer read aloud, switches to another conversation while it reads, pauses in the player,
  and later resumes exactly where it stopped.
- While the answer is read, the developer clicks its fourth paragraph; reading carries on from there and the tint
  moves along with it.
