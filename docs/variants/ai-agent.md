# AI Agent — lightweight runtime (`ai-agent`)

The `ai-agent` variant is a **PHP-free** image built to run AI agents that work over
chat and MCP servers — not to serve or build a Laravel app. It ships the Claude Code
CLI, [opencode](https://opencode.ai), [claude-threads](https://github.com/anneschuth/claude-threads),
the Playwright MCP for browsing/screenshots, a Python 3 stack for scripting, and a data
& reporting toolkit.

Use it for non-coding agents: sales/controlling assistants, support bots, research
agents, ops helpers — instances you "program" with a persona and point at your data
sources. For AI-assisted **coding** against a Laravel codebase, use the
[FPM + Claude Code](/variants/fpm-claude) variant instead.

::: tip PHP-agnostic tag
This image has no PHP runtime, so its tag carries no PHP version.
:::

## Image tag

| Tag | Description |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-ai-agent` | Lightweight AI-agent runtime |

## What's included

- **Claude Code CLI** — pre-installed and pre-configured for the `laravel` user
- **opencode** — provider-agnostic agent CLI (`opencode`)
- **claude-threads** — Mattermost/Slack bridge, running **by default** under Supervisor (auto-restart on crash)
- **[Playwright MCP](https://github.com/microsoft/playwright-mcp)** with its Chromium browser **baked into the image** (`/opt/ms-playwright`) — browsing, rendering generated HTML, and screenshots work offline out of the box. Pre-registered for the `laravel` user. Ships with Noto + emoji fonts so screenshots render `€`, umlauts, CJK and emoji correctly
- **Python 3 + virtualenv** at `/opt/venv` — so agents can write and run their own scripts. Preloaded with `csvkit`, `pandas`, `openpyxl`, `requests`, `matplotlib`, `tabulate`; `pip install` more at runtime
- A small **data & reporting toolkit**: `ripgrep`, `jq`, `pandoc` (Markdown → docx/html reports), `sqlite3`, `miller` (`mlr`, CSV/JSON wrangling), `poppler-utils` (read incoming PDFs), `imagemagick`
- **Starship** prompt and passwordless **sudo** for the `laravel` user

## What's intentionally left out

Everything specific to running a PHP web app: **no PHP, Composer, nginx, php-fpm,
php-lsp, Xdebug**. The image optimizes for cheap idle operation, not minimal disk size —
the browser and Python stack only consume resources when actually used. For AI-assisted
**coding** against a Laravel codebase, use the [FPM + Claude Code](/variants/fpm-claude)
variant instead.

## The persona: programming the agent

The base prompt is assembled at boot. On top of the shipped defaults you can mount an
**`AI_PERSONA.md`** — its contents are appended **last** to the agent's `CLAUDE.md`, so
they take precedence and define the instance: its role, tone, domain rules and
guardrails. This is how one image becomes many purpose-built agents.

```yaml
services:
    ai-agent:
        image: ghcr.io/jonaaix/laravel-aio:1.3-ai-agent
        volumes:
            - ai_agent_home:/home/laravel
            - ./AI_PERSONA.md:/app/AI_PERSONA.md:ro
```

- Default mount path is `/app/AI_PERSONA.md`; override with the `AI_PERSONA_FILE` env var.
- Edit the file and restart the container — the new persona is re-applied on boot.
- The same mechanism works in the [FPM + Claude Code](/variants/fpm-claude) variant.

::: info The persona is layered, not replacing
Your `AI_PERSONA.md` is added on top of the container/chat baseline rules. When your
persona conflicts with the generic guidance, the persona wins.
:::

### How the prompt is composed

On boot the agent's `CLAUDE.md` is assembled in order:

1. The agent-runtime base (container rules, scripting, browsing/screenshots).
2. The shared **claude-threads** chat rules (attachments, acknowledging tasks, suggesting the next step) — the same instructions the `fpm-claude` variant uses. Included by default; skipped when `DISABLE_CLAUDE_THREADS: true`.
3. **Non-technical mode** (`CLAUDE.nontech.md`, shared with `fpm-claude`) when `ENABLE_NONTECH_MODE: true` — makes the agent talk in outcomes, not internals. Recommended when the agent serves non-devs.
4. Your `AI_PERSONA.md`, last, taking precedence over all of the above.

A full reference is at
[`examples/ai-agent/`](https://github.com/jonaaix/laravel-aio-docker/tree/main/examples/ai-agent).

## Usage

```bash
# Interactive session (claude-threads keeps running in the background)
docker compose exec -it ai-agent claude
docker compose exec -it ai-agent opencode
docker compose exec -it ai-agent bash
```

Set `DISABLE_CLAUDE_THREADS: true` to turn off the chat bridge and use the container
purely for interactive sessions.

## One-time setup

1. Bring the stack up. On first boot claude-threads crash-loops until configured — expected.
2. Log in to Claude: `docker compose exec -it ai-agent claude` → run `/login`.
3. Configure the bridge: `docker compose exec -it ai-agent claude-threads` → enter Mattermost/Slack credentials.
4. Restart the container. Supervisor picks up the config and the bot joins the channel.

Register the agent's data sources as MCP servers, e.g.:

```bash
docker compose exec -it ai-agent claude mcp add --transport http --scope user \
    my-data https://mcp.example.internal/sse
```

## Persistence

Mount a named volume on `/home/laravel` so the Claude login and claude-threads config
survive container recreates. One `ai-agent` container = one configured working directory +
one Claude account; run multiple stacks for multiple isolated agents.
