# `fpm-claude`

`fpm-claude` extends [`fpm`](/variants/fpm) with a pre-installed Claude Code environment, so Claude works directly inside the running container with full access to the Laravel project.

::: danger Not for production
Local AI-assisted development only.
:::

**Adds on top of `fpm`:** Claude Code CLI · [php-lsp](https://github.com/jorgsowa/php-lsp) + [claude-code-lsps](https://github.com/Piebald-AI/claude-code-lsps) plugin (code-aware lookups on PHP) · [Playwright](https://github.com/microsoft/playwright-mcp) + [Context7](https://github.com/upstash/context7) MCP servers · claude-threads (opt-in) · Starship · passwordless sudo.

## Image tags

| Tag | PHP |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude` | 8.5 |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm-claude` | 8.4 |

## Environment-aware prompt

Claude's `CLAUDE.md` is recomposed on every boot and adapts to the environment:

- **`ENV_DEV=true`** — dev rules: disposable database, the `Claude Bot` test user for authenticated browser testing. With `DEV_NPM_RUN_DEV=true` additionally the Vite/HMR rules (never build); without it, the instruction to run `npm run build` after asset changes.
- **`ENV_DEV` unset/false (production)** — guardrails: no destructive DB operations, no test data or self-created accounts, `.env` is secret, no service restarts, plus how to apply code changes correctly (`php artisan optimize`, `queue:restart`).

`~/.claude/settings.json` is user-owned: it is seeded once from the image defaults and afterwards only the keys the container needs are enforced (`permissions.defaultMode`, `skipDangerousModePermissionPrompt`). Everything else — including disabling the php-lsp plugin via `enabledPlugins` — persists across boots.

## Configuration

All opt-in; none depend on `ENV_DEV`. Each appends a fragment to Claude's `CLAUDE.md` on boot (threads also starts the bridge under Supervisor):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENABLE_CLAUDE_THREADS` | `false` | Start the claude-threads Mattermost/Slack bridge; adds its chat rules + the AI git workflow (`dev_ai` branch model, patch handoff). |
| `ENABLE_AI_NONTECH_MODE` | `false` | Non-developer prompt — talks in features, hides paths/errors/commands, verifies via the app UI. |
| `ENABLE_AI_SOFTDEV_MODE` | `false` | Chat-friendly developer prompt — short answers, summarized tool output, proactive on routine commands. |
| `AI_PERSONA_FILE` | `/app/AI_PERSONA.md` | Persona Markdown file, appended **last** to `CLAUDE.md` (overrides the defaults). Applied only if present. |

## Usage

```bash
docker compose exec -it php claude   # start a Claude session
docker compose exec -it php bash     # shell
```

Full example: [`examples/php-fpm-claude/docker-compose.local.yaml`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm-claude/docker-compose.local.yaml).

## claude-threads

Wraps the Claude Code CLI as a Mattermost/Slack bot — one Claude session per thread, so non-technical teammates can drive the project via chat. Enable with `ENABLE_CLAUDE_THREADS: true`; Supervisor keeps it running and auto-restarts on crashes.

Setup: bring the stack up (bot crash-loops until configured — expected) → `docker compose exec -it php claude` → `/login` → `docker compose exec -it php claude-threads` → enter credentials → restart.

::: info
One claude-threads instance = one working directory + one Claude account. Run one compose stack per project; `COMPOSE_PROJECT_NAME` keeps the host-mount paths separate. See the [claude-threads setup guide](https://github.com/anneschuth/claude-threads/blob/main/SETUP_GUIDE.md).
:::

## Multi-line input

Shift+Enter does not work inside Docker. Use **Ctrl+J** or **`\`+Enter**. To keep Shift+Enter: in iTerm2 map it to send hex code `0x0A` (Settings → Profiles → Keys → Key Mappings).
