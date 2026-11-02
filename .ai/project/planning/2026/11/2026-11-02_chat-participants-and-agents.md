# Chat participants and agents

## Goal

A conversation in the web chat has participants: people and agents, each with a chat head and a
name. Every conversation starts with the lead coding agent; further agents can be switched in at any
time and addressed with `@Name`, each running its own session. Finished when a user can add a peer
agent with its own persona, model and resources, talk to it and to the lead in one conversation,
and the peer cannot touch the project.

## Milestones

- [x] Chat heads: DiceBear as local npm packages (`@dicebear/core`, `@dicebear/styles`), "Shadows"
      for people, "Voxel Bot" for agents, seeded by name; head with the name below it beside every
      message, own messages included
- [x] Participant list floating top left of the conversation (in the header row below `lg`),
      without making the header taller: the lead plus people who have written; agents follow with
      membership
- [x] Agent registry: Settings → "Agents" modal; lead "Tarek LSA" always present (name, role, model
      editable; role default "Lead Senior Software Architect"); peers with name, role, model, a
      description saved as their `CLAUDE.md` and uploaded resource files, all in the peer's own
      empty working folder under the data dir
- [ ] Conversation membership: new conversations contain only the lead; a switch in the participant
      list adds or removes agents; an added agent can be addressed with `@Name` (composer
      autocomplete), people too once they have written
- [ ] Per-agent sessions: one agent session per agent and conversation; the first message to each
      agent carries the roster (name + role of everyone); baton routing, `@Name it's your turn.`
      handoff (cap 25), catch-up of missed messages (40, `<from>` labels) as in the fork
- [ ] Peer confinement: peers read and search the project, write only in their own folder
- [x] Feature Book chapter: agreed behaviour written

## State

- Agents live in `agents` (unique name, `lead` flag, `model` + `effort` or null = default, `instructions`).
  The model list is Claude's own: the CLI's `initialize` control response (`GET /api/models`, fetched
  once per server start, aliases as fallback) with each model's effort levels; `--effort` starts the session.
  Effort defaults to high (Claude's own default drifts to medium); no "default" choice is offered.
  The lead row is created on first use (`leadAgent()`), its model and effort already drive the conversation's
  Claude session. Peer folders: `<data dir>/agents/<id>/` with `CLAUDE.md` + resource files
  (uploads moved in on save, removed on delete).
- Conversations are already separate from the Claude session (`conversations.agent_session_ref`);
  messages store `sender_name`, conversations `creator_name`.
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
- Chat heads sit in the gutter beside the reading column on wide screens (`lg:-ms-[5.25rem]`), so
  the text column stays aligned with the composer.
- Every agent can run its own model (advisors on Sonnet, for example).
- Peers may read and search the project but write only in their own folder: Claude's deny rules
  block the file-writing tools for the project path (they hold even without permission prompts). Peers
  keep the shell (a Python scratchpad, search commands); shell writes are held back only by the fork's
  write-scope instruction, which tells them to hand project changes to the lead with path and content.
- DiceBear never through its HTTP API. "Shadows" and "Voxel Bot" are both CC0, no credit needed.

## Open

- Unread pings for people addressed with `@` — later (idea pool).
