# Chat building blocks for agents

## Goal

Agents shape the chat's interface through MCP tools: they describe a building block as data, the chat draws it in its
own style at that point of the answer. First step: page, variants and choice. Finished when an agent can show a design
alternatives page with lettered variants beneath it, and a click on a variant or option puts "b) Title" into the
message field.

## Milestones

- [x] Shared type `data-ui-block` part (page, variants, choice)
- [x] Server: tools `show_page`, `show_variants`, `show_choice` in the chat MCP server; validation with clear errors;
      page HTML stored as a frozen copy; page route serving it sandboxed with scripts allowed
- [x] Client: page block (embedded, full width, fixed height), variants block (page + option rows), choice block
      (section card + option rows); option row extracted from the question card; picks into the message field
- [x] Feature Book chapter
- [ ] User check: a new conversation (tools load at session start) asked for design alternatives
- [ ] Second step (own plan): cards

## State

- Built: tools in `server/utils/ui-blocks.ts` (validation tested in `tests/ui-blocks.test.ts`), page route
  `conversations/[id]/pages/[name]`, components `UiBlock`, `UiPage`, `UiOptions`, `OptionRow` (shared with the question
  card), pick bridge `useBlockPicks`.
- Not yet seen with a real agent answer.

## Decisions

- Embedded in the answer at full width and fixed height, scrolling inside (user, 182b).
- Frozen copy at sending; a revision comes as a new block (user, 183a).
- Picking a variant or option writes "b) Title" into the message field, nothing is sent (user, 184b, 187a).
- Page, variants and choice first, cards second (user, 185a).
- The "❓ Questions" question cards stay; the choice block is an addition, used when the prompt asks for it (user, 186a).
- One tool per block instead of one tool with a kind field: each schema stays small and exact for the model.
- Pages are served with `Content-Security-Policy: sandbox allow-scripts`, so even opened directly they never run with
  the chat's origin. Only the HTML file is copied: pages must be self-contained (inline or CDN).

## Open

- Nothing.
