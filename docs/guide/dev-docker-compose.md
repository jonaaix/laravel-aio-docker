# Dev docker-compose.yml

A complete `docker-compose.yml` for **local development** — Laravel + MariaDB. Add Redis / Mailpit / phpMyAdmin from the [recipes](/recipes/redis).

::: warning
Make sure the project-folder name is unique on your server! Disable port-exposure in production.
:::

```yaml
volumes:
  db_volume:
    driver: local

services:
  php:
    container_name: ${APP_NAME}_php
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    stop_grace_period: 60s
    volumes:
      - ./:/app
    environment:
      ENV_DEV: true
      DEV_NPM_RUN_DEV: true
      DEV_ENABLE_XDEBUG: true
      ENABLE_HORIZON_WORKER: true
      ENABLE_REVERB_SERVER: true
    ports:
      - "8000:8000" # php
      - "5173:5173" # vite
      - "8080:8080" # reverb
    restart: unless-stopped
    depends_on:
      - mysql
      # - redis
    networks:
      - app

  mysql:
    container_name: ${APP_NAME}_mysql
    image: mariadb:lts
    # image: mysql:lts
    command:
      - '--character-set-server=utf8mb4'
      - '--collation-server=utf8mb4_unicode_ci'
      - '--skip-name-resolve' # Disable DNS lookups (not needed in Docker, improves performance)
    volumes:
      - db_volume:/var/lib/mysql/:delegated
    cap_add:
      - SYS_NICE # Allow the container to adjust process priority (optional for performance tuning)
    environment:
      # MySQL specific configuration
      # MYSQL_ALLOW_EMPTY_PASSWORD: 'false' # Disallow empty password
      # MYSQL_INITDB_SKIP_TZINFO: '1' # Skip loading DB time zone tables (improves performance)
      ### Database initialization ###
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE}
    ports:
      - "3306:3306"
    restart: unless-stopped
```

::: tip
Browse [`examples/`](https://github.com/jonaaix/laravel-aio-docker/tree/main/examples) in the repo for ready-to-run reference compose files per variant.
:::
