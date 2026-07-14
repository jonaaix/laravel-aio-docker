---
layout: home

hero:
  name: Laravel AIO Docker
  text: Production-ready in one image
  tagline: All-in-one Docker runtime for Laravel apps. PHP-FPM, FrankenPHP, RoadRunner, OpenSwoole, plus an FPM + Claude Code variant for AI-assisted development.
  image:
    src: /logo.svg
    alt: Laravel AIO Docker
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/jonaaix/laravel-aio-docker

features:
  - title: 5 image variants
    details: PHP-FPM, FrankenPHP, RoadRunner, OpenSwoole — plus an FPM + Claude Code variant for AI-assisted development.
  - title: Auto-configured boot
    details: Composer install, npm build, optimization, migrations, queue/horizon/reverb/octane workers — all wired up via env vars.
  - title: Native Docker tooling only
    details: No abstraction layers, no custom CLI. The same image for dev and prod, full control over build and runtime.
---

## Why this image instead of Laravel Sail

This image relies exclusively on **native Docker tooling** and intentionally avoids additional abstraction layers or custom APIs. It gives developers **full control over build, runtime, and configuration**, without being constrained by predefined conventions. Development and production setups are based on the same image and are fully reproducible.

## Available variants

### Laravel 12 & 13 — PHP 8.5

| Tag | Runtime |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm` | PHP-FPM |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm-claude` | PHP-FPM + Claude Code |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-roadrunner` | Octane / RoadRunner |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-frankenphp` | Octane / FrankenPHP |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-openswoole` | Octane / OpenSwoole |

### Laravel 10 & 11 — PHP 8.4

| Tag | Runtime |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm` | PHP-FPM |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm-claude` | PHP-FPM + Claude Code |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-roadrunner` | Octane / RoadRunner |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-frankenphp` | Octane / FrankenPHP |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-openswoole` | Octane / OpenSwoole |

### PHP-agnostic

| Tag | Runtime |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-ai-agent` | [Lightweight AI-agent runtime](/variants/ai-agent) (claude · opencode · claude-threads) |

::: tip Switching to an Octane variant
When switching to a Laravel Octane based image (roadrunner / frankenphp / openswoole) for the first time, the entrypoint will automatically set up all requirements if not already available. You can commit the changes to your repository.
:::
