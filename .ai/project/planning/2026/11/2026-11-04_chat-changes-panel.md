# Changes panel beside the conversation

## Goal

On wide screens a panel to the right of the conversation keeps the file changes of one answer visible, stacked
diff after diff, so a developer can follow along. Finished when it fills live while an agent works, can show an
older answer's changes, can be closed and resized, and the open/closed choice follows the person.

## Milestones

- [x] `users.changes_panel_hidden` (migration), saved through the appearance route like other view choices
- [x] Panel in the layout beside the page: shown when wide, not embedded, the conversation has changes and the
      person has not closed it; left edge drags the width (kept per browser like the sidebar)
- [x] Content: newest answer with changes by default, live while working, scrolls to the file changed last unless
      the person scrolled; clicking "N files changed" of an answer shows that answer
- [x] With the panel visible, "N files changed" in the answer does not unfold inline
- [x] Feature Book: web chat chapter

## State

- Built: `ChatChangesPanel` as a second root of the conversation page, `useChangesPanelRoom` decides whether it
  fits, `users.changes_panel_hidden` (migration 0032). Checked with demo conversations; the live follow while an
  agent works is not yet seen in a real turn.

## Decisions

- User's calls (questions 111–114): newest answer plus older ones on click; all files open and stacked; automatic
  on wide screens, closable, remembered per person; nothing on narrow screens or in the embedded chat.
- Own aside with a left resize handle instead of `UDashboardPanel`: its handle only sits on the right edge.
- "Wide enough" is measured, not a breakpoint: the conversation keeps 1000 px (chat heads hang beside the
  messages), the panel needs 384 px; its width is capped by what is left.

## Open

- Nothing.
