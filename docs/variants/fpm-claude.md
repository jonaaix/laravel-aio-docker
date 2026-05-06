# FPM + Claude Code (`fpm-claude`)

The `fpm-claude` variant extends the standard FPM image with a pre-installed [Claude Code](https://docs.anthropic.com/en/docs/claude-code) environment. It enables Claude to work directly inside the running container with full access to the Laravel project.

::: danger Not for production
This variant is designed for **local AI-assisted development only**.
:::

## Image tags

| Tag | PHP |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude` | 8.5 |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm-claude` | 8.4 |

## What's included on top of the standard FPM image

- **Claude Code CLI** — pre-installed and pre-configured for the `laravel` user
- **[php-lsp](https://github.com/jorgsowa/php-lsp)** — Rust-based PHP language server in `/home/laravel/.local/bin/`, plus the [claude-code-lsps](https://github.com/Piebald-AI/claude-code-lsps) plugin marketplace cloned under `~/.claude-defaults/plugins/marketplaces/`, so Claude can offer code-aware lookups (definitions, references, types) on PHP files
- **MCP servers pre-registered for the `laravel` user**: [Playwright MCP](https://github.com/microsoft/playwright-mcp) (browser automation) and [Context7 MCP](https://github.com/upstash/context7) (up-to-date library docs)
- **[claude-threads](https://github.com/anneschuth/claude-threads)** — optional Mattermost/Slack bridge, enabled via `DEV_ENABLE_CLAUDE_THREADS: true`
- **Starship** prompt with git status display
- **Sudo** access without password for the `laravel` user

A full example docker-compose setup is available at [`examples/php-fpm-claude/docker-compose.local.yaml`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm-claude/docker-compose.local.yaml).

## Usage

To start a Claude Code session inside the container:

```bash
docker compose exec -it php_ai claude
```

To launch a bash shell session:

```bash
docker compose exec -it php_ai bash
```

## claude-threads: Mattermost/Slack bridge

[claude-threads](https://github.com/anneschuth/claude-threads) wraps the Claude Code CLI and exposes it as a bot in a Mattermost or Slack channel. Each chat thread gets its own Claude session — useful to let non-technical teammates work on a Laravel project via chat.

**Enable it** by setting `DEV_ENABLE_CLAUDE_THREADS: true` (requires `ENV_DEV: true`). Supervisor then keeps the bot running in the background and auto-restarts it on crashes.

**Persistence.** Two host-mounted directories are recommended so state survives container rebuilds — both scoped per compose project.

### One-time setup per project

1. Bring up the stack with `DEV_ENABLE_CLAUDE_THREADS: true`. On first boot the bot will crash-loop until configured — that's expected.
2. Log in to Claude: `docker compose exec -it php_ai claude` → run `/login` → follow the device-code flow.
3. Run the config wizard: `docker compose exec -it php_ai claude-threads` → enter Mattermost/Slack credentials.
4. Restart the container. Supervisor picks up the new config and the bot joins the channel.

::: info Notes
One claude-threads instance = one configured working directory + one Claude account. For multiple isolated projects, run multiple compose stacks (one per user/project) — `COMPOSE_PROJECT_NAME` keeps the host-mount paths separate. See the [claude-threads setup guide](https://github.com/anneschuth/claude-threads/blob/main/SETUP_GUIDE.md) for platform-specific steps.
:::

## Multi-line input in Docker

Shift+Enter does not work for multi-line input when running Claude Code inside a Docker container. Use one of these alternatives instead:

- **Ctrl+J** — sends a line feed character, works universally
- **`\` + Enter** — backslash at the end of the line

To make Shift+Enter work in **iTerm2**, you can map it to Ctrl+J:

1. Go to **Settings → Profiles → Keys → Key Mappings**
2. Click **+** to add a new mapping
3. Set **Keyboard Shortcut** to Shift+Enter
4. Set **Action** to "Send Hex Code"
5. Enter `0x0A` as the hex code

::: tip
This remaps Shift+Enter globally in iTerm2, not just for Docker sessions. Consider using a separate iTerm2 profile if you want to limit this to container use.
:::
