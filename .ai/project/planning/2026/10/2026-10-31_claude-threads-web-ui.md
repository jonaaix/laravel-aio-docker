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
- [x] Port upstream CLI-compatibility fixes into the core (upstream 1.21–1.37)
- [x] History store for evaluation: tool output cut to its first 2,000 characters, per-turn metrics
      (model, tokens, cost, duration, outcome), archive instead of delete, paged message loading
- [ ] Auth: short-lived signed iframe link from the Laravel app carrying the user, password for
      standalone access, conversations scoped per user — blocks image integration
- [ ] Image integration: supervisor program, nginx sub-path proxy for the iframe, optional own
      port/domain, env (`NUXT_WORKING_DIR=/app`, data dir in the persisted home)
- [ ] In-process HTTP MCP for Claude: `permission_prompt` → UI decision, `send_file` → attachment
      stored with the conversation; then drop the bypass permission mode
- [ ] Questions and plan approvals (AskUserQuestion, ExitPlanMode) as UI controls
- [x] Token-level streaming (`--include-partial-messages` + `stream_event` deltas)
- [ ] Turn markers: show "stopped" on interrupted turns, errors inline
- [ ] Attachments from the user (upload into the conversation, passed to Claude)
- [ ] Multi-bot conversations (bots table, mention handoff, catch-up) on top of the new runtime
- [ ] opencode backend selectable per conversation
- [ ] Extract lean core: drop Mattermost/Slack, onboarding, auto-update, commands, bug report,
      sticky message; worktree disabled
- [ ] Prompt fragment rewrite (`CLAUDE.threads.md` drops Mattermost/`react_to_post`), docs, CHANGELOG

## State

- `src/claude-threads/` = vendored fork (core + Mattermost bridge), configs as in the fork.
- `src/agent-chat/` = the Nuxt 4 app, its own package: `app/` (Nuxt UI frontend), `server/` (API,
  SSE, runtime, SQLite), `shared/types/conversation.ts` (message format shared by both sides). It
  reaches the fork through the alias `#claude-threads` → `../claude-threads/src`; only
  `claude/cli` is imported. The fork needs its own `bun install` for the modules that file pulls in.
- The web runtime drives `ClaudeCli` from `src/claude/cli.ts` directly, one process per conversation,
  in `bypass` permission mode without MCP. Claude stream-json events are mapped to AI SDK
  `UIMessage` parts (`server/utils/claude-event-mapper.ts`): text, reasoning, `dynamic-tool`.
  Subagent sidechains are skipped. Text and reasoning stream token by token: a `content_block_start`
  opens a live part that only lives in memory and reaches the browser as `delta` events; the full
  `assistant` event for that block replaces it and is what gets stored. A stopped turn keeps the
  live text as a finished part. Tool calls appear live as `input-streaming` from their block start.
  `ClaudeCli` gained `includePartialMessages` for this.
- An answer renders as a thinking box, a working box, then the answer text (`ChatActivityBox` is the
  shared frame). Thinking: one item per thinking block in a scroll area that follows the newest
  unless the reader scrolled up. Working: one truncated line per tool call (tool name + the call's
  `description`, else its command/path) with ✓/✗/spinner, the last 5 visible and earlier ones behind
  "Show N earlier steps"; each line expands to its command (Bash `command`, else
  path/pattern/url) and output; while Claude works the newest call shows that command box already.
  The chat does not follow the answer: the sent message moves to the top and the answer grows below. Claude runs with `--thinking-display summarized`,
  otherwise Claude Code omits the thinking text (Opus 5.5 sends none).
- History: `chat.sqlite` in `NUXT_DATA_DIR` (default `~/.config/agent-chat`), WAL mode, migrations in
  `server/database/migrations` (copied into `.output/server/migrations` at build, applied on start).
  Tool output is cut to its first 2,000 chars. Each turn's assistant message carries the metrics
  columns (`server/utils/turn-metrics.ts`, from the result event's `model_usage_since_last_result`;
  `null` where Claude reports nothing, e.g. interrupted turns). A turn without any output still gets
  an assistant message with empty parts to carry its metrics; the UI hides those.
- Account card at the bottom of the sidebar: email and organization from `claude auth status`
  (read once per server start), session (5 h) and weekly usage from the `rate_limit_event` Claude
  sends with every turn (`unifiedWindows`). The last usage is kept in `<data dir>/usage.json`, so it
  shows the last known state until the next turn ("Updated HH:MM"; a window whose reset has passed is
  greyed out). Live updates ride the sidebar's `/api/events` stream. Below the card a settings menu
  holds the appearance choice (light, dark, system).
- Conversations are archived (`archived_at`), never deleted; archived ones are read-only (409 on
  send) and listed under `/archived`. A chat opens with its last 50 messages, older pages load
  when scrolling near the top (`GET /api/conversations/:id/messages?before=`).
- Runtime config via env: `NUXT_WORKING_DIR` (default `<data dir>/workspace`, created on demand),
  `NUXT_DATA_DIR`, `NUXT_CLAUDE_MODEL`, `NUXT_APP_BASE_URL` (sub-path for the iframe). Paths are
  resolved in `server/utils/paths.ts`.
- Scripts in `src/agent-chat`: `dev`, `build`, `preview`, `typecheck`, `db:generate`.
- The beta image still runs the Mattermost bridge; the web app is not wired into the image yet.
- Core carries the upstream CLI fixes: modern task/tool_result/rate-limit events, decision bridge
  (`src/mcp/decision-bridge.ts`, `MessageManager.handleBridgeRequest` → `resolveBridgePlan` /
  `resolveBridgeQuestion`; no event fires on arrival yet), compaction/auth_status, three-tier version
  check, lifecycle fixes, `turn:complete` on `MessageManager.events`. Every Claude session runs with
  claude.ai connectors disabled (`claudeAiConnectors: true` per platform opts back in).
  Not ported: operator-declared MCP servers / strict MCP config, platform rendering of turn markers.
- Core tests: 3023 pass, 0 fail.

## Decisions

- All relevant code lives in this repo; the fork is copied, not referenced. Only `fpm-claude-beta`
  gets the web UI for now.
- Nuxt 4 + Nuxt UI (MIT since v4, chat + dashboard components) over hand-built Vue on laravel-islands
  helpers: a completely new app in its own stack. Heroicons through `@iconify-json/heroicons`, every
  Nuxt UI icon remapped in `app.config.ts`; `icon.fallbackToApi: false` so the iframe never calls
  out to Iconify. Markdown via `@comark/nuxt`. `ai` is used for its `UIMessage` types only.
- Next.js rejected: React rules out reusing Vue knowledge and helpers; long-lived child processes and
  live connections need a custom server outside its model.
- Look follows Claude.ai / ChatGPT on the user's call: fully rounded buttons, inputs and badges
  (deliberately rounder than the project design system's pills), doubled `--ui-radius`, Geist
  (self-hosted by `@nuxt/fonts`, bundled with Nuxt UI), a 52rem reading column via `--ui-container`,
  no hard lines, tool calls in one working box per answer as in Mattermost, thinking in its own box (user's call). Theme overrides live in `app.config.ts`.
  The browser window is the page's scroll container (native scrollbar over the full height): the
  dashboard layout is unpinned in `app.config.ts`, sidebar and navbar stick to the top, the composer
  to the bottom; slim scrollbars only inside the activity boxes.
  Icons are served by the app itself (`icon.provider: 'server'`): no request leaves the app.
- SPA (`ssr: false`): the chat is fully client-driven and runs inside an iframe.
- SSE + REST instead of WebSockets: Nitro WebSockets are still experimental; SSE reconnects by itself
  and passes nginx without upgrade handling.
- SQLite stays, evaluated against "many large chats": one writer process, WAL, indexed
  `(conversation_id, seq)`, capped tool output, files on disk rather than in the DB. Postgres in the
  container would add a daemon for no gain at this write rate; the Laravel app's database would couple
  the chat to the app it may have to repair.
- The chat app is its own package next to the fork, not inside it: two apps stay apart and the fork
  keeps its own configs, so upstream fixes can still be ported. Alias instead of a package
  dependency: no build step or exports map for one imported file.
- Lean core over a fake `web` platform behind `PlatformClient`: the platform interface is
  post/reaction-shaped. The web app taps `ClaudeEvent` directly. Core stays in `src/` and is cut down
  later; the Mattermost bridge keeps working until then.
- The app's data lives in `~/.config/agent-chat`, never in `/app` (the Laravel project) and apart
  from `~/.claude` (Claude Code's own) and `~/.config/claude-threads` (the fork's, going away); in the
  container it sits in the persisted home volume. `/app` is only where Claude works. Without a
  configured working dir Claude starts in an empty sandbox folder, never in the app's own code.
- One SQLite file, not one per conversation: lookups go through the `(conversation_id, seq)` index
  and stay independent of file size (simulated year of 365 chats × 500 turns: 3.3 GB, last 50
  messages in 0.3 ms); per-chat files would need a central list anyway and complicate migrations,
  search and backup. The bottleneck is the browser rendering a whole long chat, hence paged loading.
- History is permanent because the development process gets evaluated after the app is finished.
  Claude's own transcripts are no substitute (deleted after 30 days by default). Conversations are
  archived, never deleted.
- No `auto_vacuum`: nothing is ever deleted, and pages freed by rewritten rows are reused.
- Tool output is stored as its first 2,000 characters plus success/error — Mattermost level plus the
  reason a call failed (same simulation: 1.9 GB instead of 3.3 GB). Tool input, including the full
  content of edits, stays complete.
- Access: the Laravel app hands out a short-lived signed link for the iframe that carries the user;
  standalone access is protected by a password. Each user sees only their own conversations.
- Multi-bot and the opencode backend stay; Claude Code comes first.
- Worktree code stays in the repo but is disabled.

## Open

- Standalone access: whose conversations someone sees after logging in with the password.
- How the Laravel app produces the signed link (helper shipped with the image vs. code in each app).
