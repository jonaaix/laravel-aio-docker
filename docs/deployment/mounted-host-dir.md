# Mounted host directory

The classic deployment pattern: your code lives on the host (a git checkout, typically), and the container mounts the project directory via a Docker volume. Composer install and asset builds happen **at container boot**, not at image build. Deploy = update files on the host, then restart the container.

## When to use this

- You want deploys via `git pull` (or rsync, or SCP) without building a custom image
- You don't have a Docker registry / image-build CI pipeline in front of your hosts
- You prefer per-host code visibility (you can `cd` into the project dir on the server and inspect/edit)
- Running on a single VPS, bare-metal, or simple multi-host setup

For immutable builds where the code is baked into the image, see [Dockerfile strategy](/deployment/dockerfile-strategy) instead.

## Compose example

A production stack with PHP-FPM + MariaDB + Redis + phpMyAdmin behind a reverse proxy ([main-caddy-proxy](https://github.com/jonaaix/main-caddy-proxy)) — every service has labels for the proxy's auto-discovery.

```yaml
# WARNING: Make sure the project-folder name is unique on your server!
# Disable port-exposure in production!

services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.4-fpm
    stop_grace_period: 60s
    volumes:
      - ./:/app:cached
    environment:
      DEPLOYMENT_ID: ${DEPLOYMENT_ID}
      ENABLE_HORIZON_WORKER: true
      # ENABLE_REVERB_SERVER: true
      PROD_RUN_ARTISAN_MIGRATE: true
      PROD_RUN_ARTISAN_DBSEED: true
      ENABLE_MAINTENANCE_BOOT: true
    labels:
      caddy: ${LARAVEL_DOMAIN}
      caddy.reverse_proxy: "{{upstreams 8000}}"
    depends_on:
      - mariadb
      - redis
    restart: unless-stopped
    networks:
      - default
      - main-proxy

  mariadb:
    image: mariadb:lts
    command:
      - '--character-set-server=utf8mb4'
      - '--collation-server=utf8mb4_unicode_ci'
      - '--skip-name-resolve'
    volumes:
      - db_volume:/var/lib/mysql/:delegated
    cap_add:
      - SYS_NICE
    environment:
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MARIADB_USER: ${DB_USERNAME}
      MARIADB_PASSWORD: ${DB_PASSWORD}
      MARIADB_DATABASE: ${DB_DATABASE}
    restart: unless-stopped
    networks:
      - default

  redis:
    image: redis:8-alpine
    volumes:
      - redis_volume:/data
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    restart: unless-stopped
    networks:
      - default

volumes:
  db_volume:
  redis_volume:

networks:
  main-proxy:
    external: true
```

A full ready-to-run reference is at [`examples/php-fpm/docker-compose.prod.yaml`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm/docker-compose.prod.yaml).

## What the entrypoint does on boot

With this strategy, every container start runs the full Laravel boot sequence:

1. Render `php-fpm` pool tuning from env vars (`FPM_MAX_CHILDREN`)
2. Start nginx
3. `composer install --no-dev --optimize-autoloader --no-progress`
4. `npm install --no-audit` + `npm run build`
5. `php artisan optimize` (config/route/view cache)
6. `php artisan migrate --force` (when `PROD_RUN_ARTISAN_MIGRATE: true`)
7. `php artisan db:seed --force` (when `PROD_RUN_ARTISAN_DBSEED: true`)
8. Cache Blade icons (when present)
9. Compose Supervisor config + start workers (queue / horizon / reverb / supercronic / schedule)

Maintenance mode wraps the whole sequence when `ENABLE_MAINTENANCE_BOOT: true`.

## Typical deploy flow

```bash
ssh deploy@server
cd /opt/apps/myapp
git pull
docker compose up -d   # restart triggers full boot sequence
```

The container handles: dependency install, asset build, optimization, migrations. You handle: getting the code there.

## Storage persistence

Since `./:/app` mounts the project root from the host, **`storage/` is already on the host** — no extra volume needed. Logs, sessions, uploads, etc. all live in the host filesystem and survive container restarts.

## Pitfalls

- **`vendor/` and `node_modules/` get written into the host-mounted directory** during the first boot. They take disk space on the host and may show up in your `git status` if not git-ignored. Add `vendor/` and `node_modules/` to `.gitignore`.
- **First boot is slow** — composer install + npm install + npm build can take minutes. Subsequent boots are fast (everything's cached on the host).
- **File permissions**: the container runs as uid 1000. If your host user is uid 1000 (typical Linux), files match. Otherwise, use [`fix-laravel-project-permissions.sh`](/guide/project-ownership) after deploys.
- **`.env` lives on the host** — don't commit production secrets to your repo; manage them on the server (or via a secret manager).
- **Concurrent deploys** can leave the app in an inconsistent state during composer install. `ENABLE_MAINTENANCE_BOOT: true` handles user-facing rendering during the boot window.
