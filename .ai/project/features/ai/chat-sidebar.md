---
id: ai-chat-sidebar
created: 2026-11-05
tags: [chat, sidebar, conversations, unread]
---

# Conversations in the sidebar

## What is it for?

The sidebar is where people find, start and come back to conversations in the [AI web chat](web-chat.md), and where
they see at a glance which ones are working, which have news and which one is being read aloud.

## How does it work?

A sidebar lists the conversations, with Settings at its foot; its edge lights up under the pointer like the panel's and can be dragged to change the width. Everyone working in the same container sees all of them, each
with the name of the person who started it: a development conversation is long-lived, and a team
works on the same app. Each entry shows the title and, below it, who started it and when something last happened, and its state at the
right end: while the agent is answering, three softly bouncing dots, the title turns grey like the line below it, and a narrow light
streak in a soft accent colour runs across both lines in step; while the session is running and waiting, a "Ready" badge, joined — while tasks the agent
started in the background are still running — by a small badge with a slowly turning symbol and the number of those
tasks, "Running in the background" on hover; a paused session shows nothing. A conversation with an answer the person has not seen shows its title in bold with a dot after it, by the same rule as in
the Orbit app (see [Orbit](chat-hub.md#unread)), and the browser tab shows how many there are, as "(2) AI Chat". When an answer
finishes in a conversation the person has written in but is not looking at — another conversation is open, or the
tab is in the background — a short, low double drum beat sounds, once per answer even with several tabs open; the
browser lets it sound only after the person has clicked or typed in the page since loading it. It can be switched
off in the settings (Chat). A new conversation is named
after the beginning of its first message. When the user sends the third message, the agent titles
the session from the user's first three messages, the way Claude Code titles its terminal sessions;
that title replaces the name in the chat and also names the session in Claude Code's own history.
Conversations that were already past their third message keep their name. The user can rename a
conversation at any time by editing its title in place. A name the user gave is kept: no title is
generated for that conversation anymore, and the name also reaches Claude Code's session history —
right away while the session runs, otherwise when it resumes. Someone can start a new
conversation, open an earlier one and continue it. A conversation that is no longer needed can be
archived: its agent session is paused first, it leaves the sidebar, and the user lands on the
conversation below it in the sidebar — the one above when it was the last, a new conversation when none is left. It stays stored and can be brought back from the archive, which lists archived conversations and
finds them by title, ignoring case and accents.

Each conversation has a small round picture of its own (a single geometric shape — circle, triangle, hexagon, star or square — on a coloured ground, the same for that conversation every time), shown before its entry. Folded to its icon strip, the sidebar still lists the conversations by that
picture, with the name on hover; the open conversation is circled in the accent colour, an unseen answer shows a dot
on the picture, a working conversation a slowly turning ring of light around it, and the conversation being read — folded or not — has a fine band
close around its picture, in a slowly turning, glowing gradient drawn from the accent colour (with Black: black — white in dark mode — with violet and cyan), that billows with the voice actually being heard — its pitches spread around the circle —
and lies as a thin, still ring while paused.

## Examples

- A developer starts three tasks in three conversations and works in a fourth. Two of the entries show the bouncing
  dots and the light streak; when one finishes, a low double drum beat sounds and its title turns bold with a dot.
- With the sidebar folded to its icon strip, the same developer recognises the conversations by their pictures and
  sees the dot on the one with a new answer.
