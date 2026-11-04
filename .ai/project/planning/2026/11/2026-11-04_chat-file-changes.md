# File changes in the chat

## Goal

Every file change an agent makes shows in the chat, no matter how it was made (file tools, sed, scripts):
live under the step that made it, and as a summary at the end of the answer. Finished when a change made
through a shell command appears under its step while the agent works, and the answer ends with the
list of changed files and their diffs.

## Milestones

- [x] Server: git snapshots of the working tree in a private index (never the user's index), one before the
      turn and one after every step that can change files; diff per step and for the whole turn
- [x] Parts: `data-file-changes` (per step, keyed by tool call) and `data-turn-changes` (end of turn),
      attached to the message the step belongs to, also after the turn has ended
- [x] Client: diff under its step in the working block, visible while working; summary block at the end
      of the answer with per-file expansion; shared diff renderer with the Edit tool view
- [x] Feature Book: web chat chapter

## State

- Built: `server/utils/working-tree.ts` (private index under the data dir `git-index/`), wired in
  `agent-session.ts`; `ChatFileDiff`, `ChatTurnChanges`, step diffs in `WorkingBlock`.
- Checked with unit tests on a real repository and a rendered demo conversation; not yet seen in a live
  agent turn (the user tests that).

## Decisions

- Git, not tool parsing: only git sees changes made by scripts; Claude Code's own `/diff` view works the same
  way. Claude Code additionally parses `sed -i` into an edit; not needed once git covers everything.
- Per step and at the end (user's call: "live in dem Moment" plus all at the end).
- Only in git repositories; elsewhere nothing is shown. Ignored files (vendor, node_modules) are not shown.
- Read-only tools skip the snapshot to keep steps fast.
- Several agents in one project at once may get each other's changes attributed; accepted.

## Open

- Nothing.
