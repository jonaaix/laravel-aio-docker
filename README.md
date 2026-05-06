<p align="center">
  <a href="https://github.com/jonaaix/laravel-aio-docker">
    <img src="./assets/logo.png" alt="Laravel AIO Docker Logo" width="150">
  </a>
</p>

<h1 align="center">Laravel AIO Docker Image</h1>

<p align="center">
A production-ready, all-in-one Docker runtime for Laravel apps.<br>
PHP-FPM, FrankenPHP, RoadRunner, OpenSwoole — plus an FPM + Claude Code variant for AI-assisted development.
</p>

<p align="center">
   <a href="https://github.com/jonaaix/laravel-aio-docker/pkgs/container/laravel-aio"><img src="https://img.shields.io/badge/variants-fpm | fpm--claude | roadrunner | frankenphp | openswoole-blue?style=flat-square" alt="Variants"></a>
   <a href="https://github.com/jonaaix/laravel-aio-docker/actions/workflows/build-and-push.yml"><img src="https://img.shields.io/github/actions/workflow/status/jonaaix/laravel-aio-docker/build-and-push.yml?style=flat-square&label=build" alt="Build Status"></a>
   <a href="./LICENSE"><img src="https://img.shields.io/packagist/l/aaix/laravel-easy-backups.svg?style=flat-square" alt="License"></a>
</p>

## Highlights

- **5 runtime variants** — PHP-FPM (default), FrankenPHP, RoadRunner, OpenSwoole, plus an **FPM + Claude Code** variant for AI-assisted development
- **Zero-config boot** — composer install, npm build, Laravel optimize, migrations, queue / horizon / reverb / octane workers all wired up through environment variables
- **Same image, dev to production** — mount your code for hot-reload dev, or bake it into a custom image for immutable deploys; `compose.yaml` is the only thing that changes
- **Native Docker tooling, no abstractions** — no custom CLI to learn, no Sail-style wrapper layer, full control of build and runtime
- **Batteries included** — nginx, PHP-FPM, Supervisor, supercronic, Xdebug, Chromium for headless PDF, Starship prompt, all preconfigured

## Quick start

A single container is the entire web tier — nginx, PHP-FPM, cron, and the Supervisor that runs your queue / Horizon / Reverb / Octane workers, all in one image. Drop the snippet below into a `compose.yaml`, mount your project, and `docker compose up`:

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

That gives you Laravel + nginx + Vite dev server + queue worker + Reverb. Add a database, Redis, phpMyAdmin etc. as your app needs them — see the [Recipes](https://jonaaix.github.io/laravel-aio-docker/recipes/databases) for ready-to-paste service blocks.

### With Claude Code (AI-assisted development)

Add a sidecar `php_ai` container running [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for in-container AI work:

```yaml
volumes:
  claude_home:
    driver: local

services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    # ... same as above

  php_ai:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude
    # docker compose exec -it php_ai claude
    # docker compose exec -it php_ai bash
    stop_grace_period: 60s
    volumes:
      - ./:/app:rw
      - claude_home:/home/laravel
    environment:
      ENV_DEV: true
      SKIP_LARAVEL_BOOT: true
```

Run `docker compose exec -it php_ai claude` to start an AI session against your codebase. Permission-bypass mode is contained to the project mount — the host filesystem is unreachable. The `php` container can be restarted as often as you want without dropping the AI session. See [FPM + Claude Code](https://jonaaix.github.io/laravel-aio-docker/variants/fpm-claude) for details.

## Add what you need

| Service | Recipe |
| :--- | :--- |
| MariaDB / PostgreSQL | [Adding databases](https://jonaaix.github.io/laravel-aio-docker/recipes/databases) |
| Redis | [Adding Redis](https://jonaaix.github.io/laravel-aio-docker/recipes/redis) |
| phpMyAdmin | [Adding phpMyAdmin](https://jonaaix.github.io/laravel-aio-docker/recipes/phpmyadmin) |
| Chromium PDF generation | [Adding Chromium PDF](https://jonaaix.github.io/laravel-aio-docker/recipes/chromium-pdf) |
| SPA served from nginx | [SPA with integrated nginx](https://jonaaix.github.io/laravel-aio-docker/recipes/spa-with-nginx) |
| Custom boot scripts | [Custom boot scripts](https://jonaaix.github.io/laravel-aio-docker/recipes/custom-scripts) |

Ready-to-run reference compose files per variant live in [`examples/`](./examples/).

## Image variants

#### PHP 8.5 (Laravel 12 & 13)

```
ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude
ghcr.io/jonaaix/laravel-aio:1.3-php8.5-frankenphp
ghcr.io/jonaaix/laravel-aio:1.3-php8.5-roadrunner
ghcr.io/jonaaix/laravel-aio:1.3-php8.5-openswoole
```

#### PHP 8.4 (Laravel 10 & 11)

```
ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm
ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm-claude
ghcr.io/jonaaix/laravel-aio:1.3-php8.4-frankenphp
ghcr.io/jonaaix/laravel-aio:1.3-php8.4-roadrunner
ghcr.io/jonaaix/laravel-aio:1.3-php8.4-openswoole
```

## Documentation

📖 **[jonaaix.github.io/laravel-aio-docker](https://jonaaix.github.io/laravel-aio-docker/)**

Configuration reference, deployment strategies (mounted host dir / Dockerfile build / CI), per-variant guides, recipes.

## License

MIT
