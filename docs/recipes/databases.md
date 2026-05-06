# Adding databases

The image is database-agnostic — use whatever engine you want. Below are working examples for **MariaDB** and **PostgreSQL** as common starting points; the same pattern (service + named volume + `depends_on`) applies to MySQL, CockroachDB, MS SQL, or anything else with an official Docker image.

## MariaDB

```yaml
volumes:
  db_volume:
    driver: local

services:
  mariadb:
    image: mariadb:lts
    command:
      - '--character-set-server=utf8mb4'
      - '--collation-server=utf8mb4_unicode_ci'
      - '--skip-name-resolve' # Disable DNS lookups (not needed in Docker, improves performance)
    volumes:
      - db_volume:/var/lib/mysql/:delegated
    cap_add:
      - SYS_NICE # Allow the container to adjust process priority (optional for performance tuning)
    environment:
      MARIADB_INITDB_SKIP_TZINFO: '1' # Skip loading DB time zone tables (improves performance)
      ### Database initialization ###
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MARIADB_USER: ${DB_USERNAME}
      MARIADB_PASSWORD: ${DB_PASSWORD}
      MARIADB_DATABASE: ${DB_DATABASE}
    ports:
      - "3306:3306"
    restart: unless-stopped
```

In your Laravel `.env`: `DB_CONNECTION=mariadb` (or `mysql`), `DB_HOST=mariadb`, `DB_PORT=3306`.

## PostgreSQL

```yaml
volumes:
  pg_volume:
    driver: local

services:
  pgsql:
    image: postgres:18-alpine
    volumes:
      - pg_volume:/var/lib/postgresql:delegated
    environment:
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C.UTF-8"
    ports:
      - "3304:5432"
    restart: unless-stopped
```

In your Laravel `.env`: `DB_CONNECTION=pgsql`, `DB_HOST=pgsql`, `DB_PORT=5432`.

## Wire it up

Add the service to your `php` container's `depends_on`:

```yaml
services:
  php:
    # ...
    depends_on:
      - mariadb   # or: pgsql
```
