# claude-threads web UI (fpm-claude-beta)

## Goal

The `fpm-claude-beta` image ships its own claude-threads build that serves a built-in web chat app
(Claude.ai / ChatGPT-like) instead of bridging to Mattermost/Slack. Users list, start, continue,
stop and pause agent sessions in the browser; permissions, questions and plan approvals are
answered via UI controls; files and images the agent sends show up inline.

The app is embeddable as an iframe in the Laravel app the container hosts, and can optionally be
given its own domain or port so it is reachable independently of that app.

Finished when: a fresh `fpm-claude-beta` container with the feature enabled serves the app both
embedded and standalone, a conversation survives a container restart with its full history and
attachments, and no Mattermost/Slack config is needed anywhere.

## Milestones

- [x] Fork copied into this repo (`src/claude-threads`), beta image builds from it
- [ ] Decide stack, dependencies, auth/identity model, backend scope
- [ ] Feature Book chapter for the chat app's agreed behavior
- [ ] Port upstream CLI-compatibility fixes into the fork while the platform layer still exists
      (task tracker, decision bridge + `MCP_TOOL_TIMEOUT`, compaction/auth_status, version check,
      lifecycle/idle/resume fixes, MCP connector posture, state-home lock)
- [ ] Extract lean core: drop Mattermost/Slack, onboarding, auto-update, commands except stop/pause,
      bug report, sticky message, baton; disable worktree
- [ ] Persistence: database for conversations, messages/events, attachments metadata; files on disk
- [ ] Server: HTTP + WebSocket, normalized event protocol, token-level streaming
      (`--include-partial-messages`)
- [ ] In-process HTTP MCP for Claude: `permission_prompt` → UI decision, `send_file` → attachment
- [ ] Web UI: conversation sidebar, streaming chat, tool/thinking blocks, task list, approvals,
      attachments, stop + pause buttons
- [ ] Image integration: supervisor, nginx route for iframe embedding, optional own port/domain,
      auth, prompt fragment rewrite (`CLAUDE.threads.md` drops `react_to_post`), docs, CHANGELOG

## State

- `src/claude-threads/` is a copy of `jonaaix/claude-threads` @ `feature/opencode-support`
  (578ed1f, upstream base 1.17.3 + 64 own commits), without `.github`, `.husky`, `website`.
  It is the source of truth from now on; the GitHub fork is no longer built from.
- `build-image.sh 8.5 fpm-claude-beta` copies it into the image and builds it with bun
  (`CLAUDE_THREADS_BETA=1`). `fpm-claude` and `ai-agent` keep `claude-threads@latest` from npm.
- Upstream `anneschuth/claude-threads` is at 1.40.2 (182 commits ahead); remote `upstream` exists in
  the local clone `~/repos/claude-threads` for reference. No web UI or new platform upstream.
- Visible chat history currently lives only in Mattermost; the thread-logger JSONL misses the first
  prompt and splits on session respawn, so it cannot serve as the history store.

## Decisions

- All relevant code lives in this repo; the fork is copied, not referenced.
- Only `fpm-claude-beta` gets the web UI for now.
- Lean-core extraction over a fake `web` platform behind `PlatformClient`: the platform interface
  is post/reaction/emoji-shaped and the operations pipeline flattens tools into markdown — a web UI
  needs the structured event stream. Tap point: `ClaudeEvent` per session (opencode already
  translated into the same shape). Estimated kept core ~9–11k of 49k lines. Runtime code is
  Node-compatible (Bun APIs only in test helpers).
- Upstream fixes are ported first, mostly by hand with upstream files as reference; cherry-picking
  only for small fixes. After the platform layer is gone, upstream diffs no longer map.
- Ready-made chat apps (LibreChat, Open WebUI) rejected: built around LLM APIs with their own
  backend and user store, not around an agent CLI with permissions, tools and pause.
- Next.js rejected: React rules out the laravel-islands helpers, and long-lived child processes plus
  WebSockets need a custom server outside its model.
- Worktree code stays in the repo but is disabled.

## Open

- Stack and dependencies (proposed: Nuxt 4 full-stack, SQLite + Drizzle, laravel-islands helpers)
- Component base inside Nuxt: laravel-islands helpers vs. Nuxt UI
- Auth and identity for the iframe and the standalone domain
- Keep opencode backend and/or multi-bot baton?
