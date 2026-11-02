# Chat participants and agents

## Goal

A conversation in the web chat has participants: people and agents, each with a chat head and a
name. Every conversation starts with the lead coding agent; further agents can be switched in at any
time and addressed with `@Name`, each running its own session. Finished when a user can add a peer
agent with its own persona, model and resources, talk to it and to the lead in one conversation,
and the peer cannot touch the project.

## Milestones

- [x] Chat heads: DiceBear as local npm packages (`@dicebear/core`, `@dicebear/styles`), "Glyphs" (abstract)
      for people, "Voxel Bot" (animated, vivid body colours, larger, no circle or background) for agents, seeded by name; head with the name below it beside every
      message, own messages included
- [x] Pictures: people default to Glyphs (abstract shapes), may
      upload one or pick a Glyph from 8 random ones in Profile (`AvatarChoice`, shared with agents); `?a=<base64url image URL>` from Laravel is downloaded (re-fetched when the
      URL changes) and locks the picture; agents pick a hand-made design (rows "smiley" and "wow", `public/avatars/<design>-<colour>.png`, seed
      `preset:<design>-<colour>`, recoloured from the user's original by hue shift on saturated pixels), a
      Voxel Bot from 8 random ones, or upload.
      Files in `<data dir>/avatars/` (`user-<id>`/`agent-<id>`, ≤ 5 MB), served by `GET /api/avatars/<file>`
- [x] Participant list: stacked heads at the top right of the title bar (36 px like the buttons beside
      them, all circled with a mid-grey ring, Voxel Bots on a grey disc, overlapping below `lg`, name as
      tooltip); a + after them opens a checkbox menu to switch agents in and out, without making the header taller: the lead plus people who have written; agents follow with
      membership
- [x] Agent registry: Settings → "Agents" modal; lead "Tarek LSA" always present (name, role, model
      editable; role default "Lead Senior Software Architect"); peers with name, role, model, a
      description saved as their `CLAUDE.md` and uploaded resource files, all in the peer's own
      empty working folder under the data dir
- [x] Conversation membership: new conversations contain only the lead; a switch in the participant
      list adds or removes agents; an added agent can be addressed with `@Name` (composer
      autocomplete), people too once they have written
- [x] Per-agent sessions: one agent session per agent and conversation; the first message to each
      agent carries the roster (name + role of everyone); baton routing, `👉 @Name`
      handoff (cap 25), catch-up of missed messages (40, `<from>` labels) as in the fork
- [x] Peer confinement: peers read and search the project, write only in their own folder
- [x] Feature Book chapter: agreed behaviour written

## State

- Agents live in `agents` (unique name, `lead` flag, `model` + `effort` or null = default, `instructions`).
  The model list is Claude's own: the CLI's `initialize` control response (`GET /api/models`, fetched
  once per server start, aliases as fallback) with each model's effort levels; `--effort` starts the session.
  Effort defaults to high (Claude's own default drifts to medium); no "default" choice is offered.
  The lead row is created on first use (`leadAgent()`, red Voxel Bot seed `tarek-52`), its model and effort already drive the conversation's
  Claude session. Peer folders: `<data dir>/agents/<id>/` with `CLAUDE.md` + resource files
  (uploads moved in on save, removed on delete).
- Membership lives in `conversation_agents` (lead implied, never stored); the participant modal's
  "Add agent" menu toggles it (`POST /api/conversations/<id>/agents`). The composer suggests
  participants after `@`; until per-agent sessions exist, `@Name` is plain text for the lead.
  `conversations.announced_agents` holds the agents Claude was told about; the next prompt starts
  with `<status>Name joined/left the chat.</status>` lines for the difference.
- Sessions: `AgentSession` (`server/utils/agent-session.ts`) wraps one Claude process and its answer
  stream; `ConversationRuntime` routes (`@` → first named, else last answering agent), holds messages
  for a busy conversation, fires handoffs at turn end (`agent-prompts.ts`). Lead session state stays on
  `conversations` (`agent_session_ref`, `agent_session_started`, `announced_agents`), peers' on
  `conversation_agents`. `messages.agent_id` is the author of an answer or the recipient of a person's
  message; catch-up = messages after the agent's latest own row (cap 40).
- Peer confinement: peers run in `<data dir>/agents/<id>/` with `Edit/Write/NotebookEdit(//<project>/**)`
  denied and the write-scope prompt. In the test chat Peter Peer refused project writes from the prompt
  alone, so the deny rule itself has not been seen firing yet.
- `messages.agent_id` has no ON DELETE rule in the database (migration ran before it was added);
  `deleteAgent` clears it first.
- The fork's multi-bot logic to port lives in `src/claude-threads/src`: baton in
  `message-handler.ts:131-166`, handoff `session/manager.ts:388-470`, catch-up
  `operations/context-prompt/handler.ts:337-440`, roster `commands/system-prompt-generator.ts`.
  Its write scope for Claude bots is prompt guidance only; opencode bots are enforced through
  permission answers.

## Decisions

- One session per agent and conversation (fork model); the lead sees the whole conversation and
  names it; Claude subagents stay internal helpers of each agent.
- People and agents are one participant concept; chat heads for people come first, agents build on it.
- Handover is the fork's: missed messages plus self-contained handoff messages, no summary step.
- A message without `@` goes to the agent that answered last (baton), as in the fork.
- Only Voxel Bots are drawn large and free-standing (`isVoxelBot`); smileys, uploads and people use the round size.
- Below `sm` the head sits above the message, small, with the name beside it, so text uses the full
  width. Phone text size comes from the 15 px root font (see `.ai/guidelines/app.md`).
- Chat heads sit in the gutter beside the reading column from `xl` (`xl:-ms-[6.75rem]`, a 6rem name column where names wrap between words, never truncated), so
  the text column stays aligned with the composer; below `xl` the gutter would clip the right-hand heads. Sizes: people 36 px, Voxel Bots 44 px.
- `@Name` of a known agent or person is drawn as a pill in the theme's `info` blue in chat text (`mentionHighlight`; grey on the grey bubble was rejected); Comark builds its parser once, so the
  plugin reads names at parse time and message parts re-render when the name list changes.
- The participant list lives in the title bar, never beside the conversation: the chat mostly runs in a
  narrow window next to the main app, so a side list has no room.
- One working folder per agent, shared by all conversations (they all work on the same app), so notes and
  Claude's memory carry over between chats.
- Every agent can run its own model (advisors on Sonnet, for example).
- Peers may read and search the project but write only in their own folder: Claude's deny rules
  block the file-writing tools for the project path (they hold even without permission prompts). Peers
  keep the shell (a Python scratchpad, search commands); shell writes are held back only by the fork's
  write-scope instruction, which tells them to hand project changes to the lead with path and content.
- DiceBear never through its HTTP API. "Voxel Bot" is CC0; "Glyphs" (Matt Houser) is CC BY 4.0 and is credited in the Profile window.

## Open

- Unread pings for people addressed with `@` — later (idea pool).
