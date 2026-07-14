# `ai-agent`

A PHP-free runtime for **non-coding** AI agents that work over chat and MCP servers. You "program" an instance with a mounted persona and point it at your data sources. For AI-assisted coding against a Laravel app, use [`fpm-claude`](/variants/fpm-claude) instead.

**Includes:** Claude Code CLI · opencode · claude-threads (opt-in) · Playwright MCP with Chromium baked in (offline HTML render + screenshots) · Python venv (csvkit, pandas, openpyxl, matplotlib, requests, tabulate) · ripgrep, jq, pandoc, sqlite3, miller, poppler-utils, imagemagick. No PHP / Composer / nginx.

## Image tag

`ghcr.io/jonaaix/laravel-aio:1.3-ai-agent` — PHP-agnostic (no PHP version in the tag).

## Configuration

All opt-in; none depend on `ENV_DEV`.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `AI_PERSONA_FILE` | `/app/AI_PERSONA.md` | Persona Markdown file. Appended **last** to the agent's `CLAUDE.md`, so it overrides the defaults. Applied only if the file exists. |
| `ENABLE_CLAUDE_THREADS` | `false` | Start the claude-threads Mattermost/Slack bridge (under Supervisor) and add its chat prompt. Leave off to use the container only for interactive `claude` / `opencode` sessions. |
| `ENABLE_AI_NONTECH_MODE` | `false` | Append the non-technical prompt — the agent talks in outcomes, not code. |
| `ENABLE_AI_SOFTDEV_MODE` | `false` | Append the chat-friendly developer prompt (short answers, summarized tool output). |

Prompt assembled on boot: runtime base → claude-threads chat rules (if `ENABLE_CLAUDE_THREADS`) → non-tech / softdev prompt (if enabled) → your `AI_PERSONA.md` (last, wins).

## Minimal setup

```yaml
volumes:
    agent_home:
services:
    ai-agent:
        image: ghcr.io/jonaaix/laravel-aio:1.3-ai-agent
        stop_grace_period: 60s
        volumes:
            - agent_home:/home/laravel          # persists Claude login + claude-threads config
            - ./AI_PERSONA.md:/app/AI_PERSONA.md:ro
        environment:
            ENABLE_CLAUDE_THREADS: true
            ENABLE_AI_NONTECH_MODE: true
        restart: unless-stopped
```

1. `docker compose up` — claude-threads crash-loops until configured (expected).
2. `docker compose exec -it ai-agent claude` → `/login`.
3. `docker compose exec -it ai-agent claude-threads` → enter Mattermost/Slack credentials.
4. Add data sources: `docker compose exec -it ai-agent claude mcp add --transport http --scope user my-data <url>`.
5. Restart the container.

One `ai-agent` container = one Claude account + one channel. Run multiple stacks for multiple agents. Full example: [`examples/ai-agent/`](https://github.com/jonaaix/laravel-aio-docker/tree/main/examples/ai-agent).
