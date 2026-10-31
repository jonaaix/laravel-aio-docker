# claude-threads web UI (fpm-claude-beta)

## Goal

The `fpm-claude-beta` image ships its own claude-threads build that serves a built-in web chat app
(Claude.ai / ChatGPT-like) instead of bridging to Mattermost/Slack. Agreed behavior:
[Feature Book `ai-web-chat`](../../../features/ai/web-chat.md).

Finished when: a fresh `fpm-claude-beta` container with the feature enabled serves the app both
embedded (iframe under the app's domain) and standalone (own port/domain), a conversation survives a
container restart with its full history and attachments, and no Mattermost/Slack config is needed.

## Milestones

- [x] Fork copied into this repo (`src/claude-threads`), beta image builds from it
- [x] Stack decided: Nuxt 4 + Nuxt UI, SQLite/Drizzle, SSE
- [x] Feature Book chapter `ai-web-chat`
- [x] First vertical slice: conversations list, start/continue, Claude streaming block-level, tool and
      reasoning blocks, stop, pause/resume, history in SQLite, works under a sub-path
- [ ] Port upstream CLI-compatibility fixes into the core (running in a separate worktree)
- [ ] Auth/identity for iframe and standalone access — blocks image integration
- [ ] Image integration: supervisor program, nginx sub-path proxy for the iframe, optional own
      port/domain, env (`NUXT_WORKING_DIR=/app`, data dir in the persisted home)
- [ ] In-process HTTP MCP for Claude: `permission_prompt` → UI decision, `send_file` → attachment
      stored with the conversation; then drop the bypass permission mode
- [ ] Questions and plan approvals (AskUserQuestion, ExitPlanMode) as UI controls
- [ ] Token-level streaming (`--include-partial-messages` + `stream_event` deltas)
- [ ] Turn markers: show "stopped" on interrupted turns, errors inline
- [ ] Attachments from the user (upload into the conversation, passed to Claude)
- [ ] Multi-bot conversations (bots table, mention handoff, catch-up) on top of the new runtime
- [ ] opencode backend selectable per conversation
- [ ] Extract lean core: drop Mattermost/Slack, onboarding, auto-update, commands, bug report,
      sticky message; worktree disabled
- [ ] Prompt fragment rewrite (`CLAUDE.threads.md` drops Mattermost/`react_to_post`), docs, CHANGELOG

## State

- `src/claude-threads/` = vendored fork (`src/`, core + Mattermost bridge, untouched) plus a Nuxt 4 app
  in the same package: `app/` (Nuxt UI frontend), `server/` (API, SSE, runtime, SQLite),
  `shared/types/conversation.ts` (message format shared by both sides).
- The web runtime drives `ClaudeCli` from `src/claude/cli.ts` directly, one process per conversation,
  in `bypass` permission mode without MCP. Claude stream-json events are mapped to AI SDK
  `UIMessage` parts (`server/utils/claude-event-mapper.ts`): text, reasoning, `dynamic-tool`.
  Subagent sidechains are skipped.
- History: `chat.sqlite` in `NUXT_DATA_DIR` (default `~/.claude-threads/web`), WAL mode, migrations in
  `server/database/migrations` (copied into `.output/server/migrations` at build, applied on start).
  Tool output is capped at 64k chars per tool call.
- Runtime config via env: `NUXT_WORKING_DIR`, `NUXT_DATA_DIR`, `NUXT_CLAUDE_MODEL`,
  `NUXT_APP_BASE_URL` (sub-path for the iframe).
- Scripts: `dev:web`, `build:web`, `typecheck:web`, `db:generate`; core keeps `build`, `test`,
  `typecheck` (now against `tsconfig.core.json`).
- The beta image still runs the Mattermost bridge; the web app is not wired into the image yet.
- Core tests: 2 pre-existing failures (listener leak, fixed upstream in a61b109, part of the port).

## Decisions

- All relevant code lives in this repo; the fork is copied, not referenced. Only `fpm-claude-beta`
  gets the web UI for now.
- Nuxt 4 + Nuxt UI (MIT since v4, chat + dashboard components) over hand-built Vue on laravel-islands
  helpers: a completely new app in its own stack. Heroicons through `@iconify-json/heroicons`, every
  Nuxt UI icon remapped in `app.config.ts`; `icon.fallbackToApi: false` so the iframe never calls
  out to Iconify. Markdown via `@comark/nuxt`. `ai` is used for its `UIMessage` types only.
- Next.js rejected: React rules out reusing Vue knowledge and helpers; long-lived child processes and
  live connections need a custom server outside its model.
- SPA (`ssr: false`): the chat is fully client-driven and runs inside an iframe.
- SSE + REST instead of WebSockets: Nitro WebSockets are still experimental; SSE reconnects by itself
  and passes nginx without upgrade handling.
- SQLite stays, evaluated against "many large chats": one writer process, WAL, indexed
  `(conversation_id, seq)`, capped tool output, files on disk rather than in the DB. Postgres in the
  container would add a daemon for no gain at this write rate; the Laravel app's database would couple
  the chat to the app it may have to repair.
- Lean core over a fake `web` platform behind `PlatformClient`: the platform interface is
  post/reaction-shaped. The web app taps `ClaudeEvent` directly. Core stays in `src/` and is cut down
  later; the Mattermost bridge keeps working until then.
- Multi-bot and the opencode backend stay; Claude Code comes first.
- Worktree code stays in the repo but is disabled.

## Open

- Auth and identity for iframe and standalone access (signed link from the Laravel app vs. shared
  password vs. external protection); who sees which conversations.
