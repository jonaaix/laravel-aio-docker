---
id: ai-chat-file-changes
created: 2026-11-05
tags: [chat, file-changes, diff, git]
---

# File changes in the chat

## What is it for?

A developer following the agent's work sees every file it changed, live and in full, without leaving the
[AI web chat](web-chat.md).

## How does it work?

Every file change shows, however it was made — through the agent's file tools, a shell
command or a script. In a git repository the chat compares through git itself, leaving the project's git state
untouched; a folder without git gets a private archive in the chat's own data folder instead, which never takes in
secrets (`.env` files, keys, certificates, `.ssh`) or bulky folders (`node_modules`, `vendor`, `storage`, `dist`,
`build`), and is removed once the folder becomes a git repository. Right below
"Worked", in the same quiet style, "N files changed · +A −R" appears with the first changed file and counts up while the
agent works; it is a button that shows that answer's changes: all changed files stacked in the order they were changed,
the latest at the bottom, each diff in full with line numbers, up to 1,000 lines per file. The steps themselves show no diff, and while the panel is open, "Worked" does not preview the file a running
step writes. Where the screen leaves the conversation
enough room (from a window of about 1,670 pixels, so that the chat heads keep hanging beside the reading column), the changes stay in view in a "Changes" panel to its right, for a developer following along. It shows
the newest answer with changes, opens at its bottom and stays there as the agent's changes come in, a newly changed file unfolding smoothly
into place; "N files changed" in an older answer shows that one, and a newer answer with
changes takes over again. Whoever turned off "Show file changes automatically" in the settings gets the panel only
through "N files changed", for that conversation. The panel can be closed, which each person keeps until they open it again through
"N files changed", and its edge drags the width, as far as the conversation keeps enough room; a double click
restores the default width. Where there is no room — a narrow window, a phone, the chat embedded in the app —
"N files changed" opens the same view as an overlay from the right, which turns into the panel when the window
grows wide enough. Clicking a file's name opens the whole file as it is now in the preview
panel beside the conversation, any text file in any language, unless it was deleted: with line numbers, the lines the change added marked,
and scrolled to the first of them; with several changes, arrows next to "1 of 3" step through them. Files git ignores, or that the private archive leaves out, do not show and cannot be opened.

When the agent commits in a git repository, the commit shows in the same view at the moment it happens, between the
files changed before and after it, headed like a file — "Git commit" with the short id — above a card framed by a fine AI
colour gradient: a ring-shaped point, the commit title in the same gradient, and — when the commit has a description — a thin line running down
from the point beside its first three lines, the rest behind "Show more". Several commits in one answer each appear at their
own place.

## Examples

- On a wide screen the agent edits three files; the Changes panel beside the conversation shows each diff as it
  arrives, the latest at the bottom.
- On a phone, "3 files changed" under "Worked" opens the same view as an overlay; tapping a file name shows the whole
  file with the changed lines marked.
