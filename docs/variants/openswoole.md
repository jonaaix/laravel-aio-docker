# OpenSwoole (Octane)

Laravel Octane variant powered by **[OpenSwoole](https://openswoole.com/)**. The container keeps a long-running PHP worker pool warm with coroutine support.

## Image tags

| Tag | PHP |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-openswoole` | 8.5 |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-openswoole` | 8.4 |

::: tip First-time switch
When switching to a Laravel Octane based image for the first time, the entrypoint will automatically install `laravel/octane` and run `octane:install --server=swoole` if not already configured. You can commit the changes to your repository.
:::

## Workers

Octane workers default to **2 × `nproc`** (CPU cores × 2). Override via the `OCTANE_WORKERS` env var if needed.

## Configuration

All shared env vars apply — see [Configuration](/configuration). Octane-specific behavior:

- `OCTANE_SERVER` (in `.env` or `config/octane.php`) must equal `swoole` — the entrypoint validates consistency between `PHP_RUNTIME_CONFIG=swoole` and `OCTANE_SERVER` on boot and exits with an error on mismatch.
- Octane's supervisor worker config is auto-added when a non-FPM runtime is detected.

See [Quick start](/guide/getting-started) for a minimal compose snippet.
