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

For AI-assisted development, run your single app container on the [`fpm-claude`](/variants/fpm-claude) image instead of `fpm` — it serves Laravel **and** ships Claude Code. Swap the image and add a named volume for the Claude login:

```yaml
volumes:
  claude_home:

services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude
    stop_grace_period: 60s
    volumes:
      - ./:/app:rw
      - claude_home:/home/laravel # persists Claude login + config across container rebuilds
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

Then work inside it: `docker compose exec -it php claude` (AI session) or `docker compose exec -it php bash`.

::: warning Local development only
`fpm-claude` runs Claude Code with permission bypass enabled — the blast radius is the project mount, but never use this variant in production. Serve production from the plain `fpm` image.
:::

See [`fpm-claude`](/variants/fpm-claude) for usage details, including the optional Mattermost/Slack bridge via `ENABLE_CLAUDE_THREADS`.

## Next steps

- Pick the right [variant](/variants/fpm) for your use case (FPM, Octane, or Claude Code).
- Configure boot behavior via [environment variables](/configuration).
- For production with baked-in dependencies, see [Dockerfile strategy](/deployment/dockerfile-strategy).
