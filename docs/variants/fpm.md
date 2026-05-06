# PHP-FPM (default)

The standard FPM variant — the default for most Laravel deployments. Combines Nginx + PHP-FPM in a single container with auto-tuned worker pool, supercronic for scheduled tasks, and Supervisor for queue/horizon/reverb workers.

## Image tags

| Tag | PHP |
| :--- | :--- |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm` | 8.5 |
| `ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm` | 8.4 |

## When to use

- Default Laravel deployments
- Apps that don't need long-running workers / Octane
- When you want simple, well-understood request lifecycle (process per request)

## Quick start

See [Get Started](/guide/getting-started) for a minimal `docker-compose.yml` snippet, or jump to [Configuration](/configuration) for the full env-var reference.

## FPM-specific tuning

Worker pool sizing is documented under [Configuration → PHP-FPM Pool Tuning](/configuration#php-fpm-pool-tuning). Most setups only need to set `FPM_MAX_CHILDREN`; spare-server values derive from it automatically.
