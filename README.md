<p align="center">
  <a href="https://github.com/jonaaix/laravel-aio-docker">
    <img src="./assets/logo.png" alt="Laravel AIO Docker Logo" width="150">
  </a>
</p>

<h1 align="center">Laravel AIO Docker Image</h1>

<p align="center">
All-in-one Docker runtime for Laravel apps. PHP-FPM, FrankenPHP, RoadRunner, OpenSwoole, plus an FPM + Claude Code variant for AI-assisted development.
</p>

<p align="center">
   <a href="https://github.com/jonaaix/laravel-aio-docker/pkgs/container/laravel-aio"><img src="https://img.shields.io/badge/variants-fpm | fpm--claude | roadrunner | frankenphp | openswoole-blue?style=flat-square" alt="Variants"></a>
   <a href="https://github.com/jonaaix/laravel-aio-docker/actions/workflows/build-and-push.yml"><img src="https://img.shields.io/github/actions/workflow/status/jonaaix/laravel-aio-docker/build-and-push.yml?style=flat-square&label=build" alt="Build Status"></a>
   <a href="./LICENSE"><img src="https://img.shields.io/packagist/l/aaix/laravel-easy-backups.svg?style=flat-square" alt="License"></a>
</p>

## Quick start

```yaml
services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    volumes:
      - ./:/app:rw
    environment:
      ENV_DEV: true
    ports:
      - "8000:8000"
```

## Variants

| Tag | Runtime |
| :--- | :--- |
| `1.3-php8.5-fpm` | PHP-FPM |
| `1.3-php8.5-fpm-claude` | PHP-FPM + Claude Code (dev only) |
| `1.3-php8.5-frankenphp` | Octane / FrankenPHP |
| `1.3-php8.5-roadrunner` | Octane / RoadRunner |
| `1.3-php8.5-openswoole` | Octane / OpenSwoole |

PHP 8.4 builds also exist for all variants — replace `php8.5` with `php8.4`.

## Documentation

📖 **Full docs: [jonaaix.github.io/laravel-aio-docker](https://jonaaix.github.io/laravel-aio-docker/)**

Everything else — env vars, deployment recipes, Octane setup, Xdebug, custom-script hooks — lives in the doc site.

## License

MIT
