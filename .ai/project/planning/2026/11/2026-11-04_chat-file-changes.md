# File changes in the chat

## Goal

Every file change an agent makes shows in the chat, no matter how it was made (file tools, sed, scripts):
live while the agent works and as a summary afterwards, both in one "N files changed" block below "Worked".
Finished when a change made through a shell command shows up in that block while the agent works.

## Milestones

- [x] Server: git snapshots of the working tree in a private index (never the user's index), one before the
      turn and one after every step that can change files; diff per step and for the whole turn
- [x] Parts: one `data-turn-changes` per message (turn start until now, plus the paths the last step changed),
      replaced after every changing step and at turn end, also after the turn has ended
- [x] Client: summary below the working block in its style, open while working with the latest file expanded;
      per-file expansion; shared diff renderer with the Edit tool view
- [x] Feature Book: web chat chapter

## State

- Built: `server/utils/working-tree.ts` (private index under the data dir `git-index/`), wired in
  `agent-session.ts`; `ChatFileDiff`, `ChatTurnChanges`.
- Checked with unit tests on a real repository and a rendered demo conversation; not yet seen in a live
  agent turn (the user tests that).

## Decisions

- Git, not tool parsing: only git sees changes made by scripts; Claude Code's own `/diff` view works the same
  way. Claude Code additionally parses `sed -i` into an edit; not needed once git covers everything.
- Live and at the end in one block, no diff under the steps (user's call: live, but not twice).
- Older messages may still carry `data-file-changes` parts from the first version; nothing renders them.
- Folders without git use a private archive under the data folder (`shadow-git/`), with a fixed list of secrets and
  bulky folders excluded (user's call, question 131); it is deleted once the folder becomes a git repository.
- Read-only tools skip the snapshot to keep steps fast.
- Several agents in one project at once may get each other's changes attributed; accepted.

## Open

- Nothing.
