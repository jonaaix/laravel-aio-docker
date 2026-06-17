# Configuration

Configuration is managed via environment variables. **All flags are opt-in** (default: `false` unless noted).

[[toc]]

## Operation Mode

The system runs in **Production Mode** by default.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENV_DEV` | `false` | Set to `true` to enable **Development Mode**. |

## Networking

Applies to all variants.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HTTP_PORT` | `8000` | Port Nginx listens on inside the container. Set it to keep host and container ports symmetric (e.g. map `8765:8765` with `HTTP_PORT=8765`) and avoid mismatched port mappings. This also fixes issues with Claude's testing tools (e.g. Playwright), which assume the in-container port matches the host port and otherwise hit the wrong URL. |

## Development Features

::: info Requirement
Active only when `ENV_DEV: true`.
:::

| Variable | Description |
| :--- | :--- |
| `DEV_FORCE_NPM_INSTALL` | Forces `npm install` on every container start. |
| `DEV_NPM_RUN_DEV` | Runs `npm run dev` (Vite) on container start. |
| `DEV_ENABLE_XDEBUG` | Enables Xdebug extension. See [Xdebug](/development/xdebug). |
| `DEV_ENABLE_CLAUDE_THREADS` | **`fpm-claude` only.** Starts the claude-threads Mattermost/Slack bridge. |
| `DEV_ENABLE_CLAUDE_NONTECH_MODE` | **`fpm-claude` only.** Appends a system prompt for non-developer app builders — speaks in features instead of code, hides paths/errors/commands, verifies via the app UI. |
| `DEV_ENABLE_CLAUDE_SOFTDEV_MODE` | **`fpm-claude` only.** Appends a chat-friendly system prompt for developers using chat UIs — short answers, summarized tool output, proactive on routine commands. |

## Production Automation

::: info Requirement
Active only when `ENV_DEV=false` (default).
:::

| Variable | Description |
| :--- | :--- |
| `PROD_RUN_ARTISAN_MIGRATE` | Runs `php artisan migrate --force` on boot. |
| `PROD_RUN_ARTISAN_DBSEED` | Runs `php artisan db:seed --force` on boot. |
| `PROD_SKIP_OPTIMIZE` | Skips standard Laravel caching/optimization commands. |

## Background Services & System

Supervisor always runs, but specific workers are optional.

| Variable | Context | Description |
| :--- | :--- | :--- |
| `ENABLE_QUEUE_WORKER` | Worker | Starts the standard Laravel Queue Worker. |
| `ENABLE_HORIZON_WORKER` | Worker | Starts the Laravel Horizon process. |
| `ENABLE_REVERB_SERVER` | Server | Starts the Laravel Reverb WebSocket server. |
| `SKIP_LARAVEL_BOOT` | System | Skips Laravel boot (useful for non-Laravel PHP apps or to keep the container alive without booting Laravel). Laravel-independent workers like supercronic and claude-threads still run. |

## PHP-FPM Pool Tuning

::: info Requirement
Applies to FPM variants only (`fpm`, `fpm-claude`).
:::

The FPM worker pool auto-scales from a single knob. In most cases you only need to set `FPM_MAX_CHILDREN` — the spare-server settings derive from it automatically. Override individual values only for edge-case tuning.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `FPM_MAX_CHILDREN` | `10` | Max concurrent PHP-FPM workers. Bump this when your container has more RAM available (~80 MB per worker). |
| `FPM_MIN_SPARE_SERVERS` | `max(1, max_children / 10)` | Minimum idle workers. Auto-derived from `FPM_MAX_CHILDREN`. |
| `FPM_MAX_SPARE_SERVERS` | `max(3, max_children / 3)` | Maximum idle workers. Auto-derived from `FPM_MAX_CHILDREN`. |

Hardcoded (not configurable): `pm = dynamic`, `pm.max_requests = 500` (worker recycle for memory leak mitigation), `request_terminate_timeout = 120s`. `pm.start_servers` is intentionally omitted so PHP-FPM auto-calculates it as `(min_spare + max_spare) / 2` per its own documented default.

::: tip Note on worker count
PHP-FPM workers scale with available RAM, not CPU cores. PHP requests are mostly I/O-bound (waiting on DB, HTTP, filesystem), so many more workers than cores are expected and correct.
:::

## Maintenance Mode

Control Laravel's maintenance mode during container boot (e.g., for deployments).

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENABLE_MAINTENANCE_BOOT` | `false` | Enables maintenance mode during boot. Skipped if `vendor/` doesn't exist. |
| `MAINTENANCE_SECRET` | _(auto-generated)_ | Custom secret for bypassing maintenance mode. |
| `MAINTENANCE_RENDER` | `errors::503` | Custom view to render during maintenance. |
| `MAINTENANCE_RETRY` | `10` | Retry-After header value in seconds. |

## Build Strategy

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENABLE_DOCKERFILE_STRATEGY` | `false` | Skips `composer install`, `npm install`, and `npm run build` at runtime — assumes they were already done during image build. The entrypoint runs `composer run-script post-autoload-dump` instead. See [Dockerfile strategy](/deployment/dockerfile-strategy). |
