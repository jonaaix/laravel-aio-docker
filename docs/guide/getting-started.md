# Quick start

The fastest way to run a Laravel app with this image — copy the snippet below into a `compose.yaml`, mount your project, and start the container.

## Minimal dev compose.yaml

A barebones starting point — just the PHP container, no database, no Redis. Add services as your app needs them.

```yaml
services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    volumes:
      - ./:/app:rw
    environment:
      ENV_DEV: true
      DEV_NPM_RUN_DEV: true
      ENABLE_QUEUE_WORKER: true
      ENABLE_REVERB_SERVER: true
    ports:
      - "8000:8000" # php
      - "5173:5173" # vite
      - "8080:8080" # reverb
```

::: tip
Add a database, Redis, phpMyAdmin etc. from the [Recipes](/recipes/databases). Or browse [`examples/`](https://github.com/jonaaix/laravel-aio-docker/tree/main/examples) in the repo for ready-to-run compose files.
:::

## Minimal dev with Claude Code

If you want AI-assisted development with [Claude Code](/variants/fpm-claude) running inside the container, add a sidecar `php_ai` service that mounts the same project but skips the Laravel boot. It's purely there to host a Claude session against your code.

```yaml
volumes:
  claude_home:
    driver: local

services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    volumes:
      - ./:/app:rw
    environment:
      ENV_DEV: true
      DEV_NPM_RUN_DEV: true
      ENABLE_QUEUE_WORKER: true
      ENABLE_REVERB_SERVER: true
    ports:
      - "8000:8000" # php
      - "5173:5173" # vite
      - "8080:8080" # reverb

  php_ai:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude
    # docker compose exec -it php_ai claude
    # docker compose exec -it php_ai bash
    stop_grace_period: 60s
    volumes:
      - ./:/app:rw
      - claude_home:/home/laravel  # persists Claude login + config across container rebuilds
    environment:
      ENV_DEV: true
      SKIP_LARAVEL_BOOT: true
```

::: info Why two services
1. **Host isolation.** Claude Code runs with permission bypass enabled — convenient for fast iteration, dangerous if pointed at your host filesystem. Inside `php_ai` the blast radius is the project mount; the rest of your machine is unreachable.
2. **Stable AI session.** You can rebuild or restart the `php` container as often as you want (code changes, env tweaks, package installs) without losing the interactive Claude session running in `php_ai`. The `claude_home` named volume additionally persists Claude's login + config across container rebuilds.
:::

See [`fpm-claude`](/variants/fpm-claude) for usage details, including the optional Mattermost/Slack bridge via `ENABLE_CLAUDE_THREADS`.

## Next steps

- Pick the right [variant](/variants/fpm) for your use case (FPM, Octane, or Claude Code).
- Configure boot behavior via [environment variables](/configuration).
- For production with baked-in dependencies, see [Dockerfile strategy](/deployment/dockerfile-strategy).
