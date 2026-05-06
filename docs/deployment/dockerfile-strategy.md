# Dockerfile Deployments

When building a custom Docker image that already contains your application code, `vendor/`, and compiled assets (e.g. `public/build`), you can instruct the entrypoint to skip the build steps that were already performed during the image build.

Set `ENABLE_DOCKERFILE_STRATEGY=true` to skip `composer install`, `npm install`, and `npm run build`. When enabled, the entrypoint will automatically run `composer run-script post-autoload-dump` at container startup to execute any scripts (e.g. `package:discover`, `filament:upgrade`) that were skipped during the build due to `--no-scripts`.

## docker-compose example

```yaml
services:
  php:
    build:
      dockerfile: ./Docker/production/Dockerfile
      context: ./
    volumes:
      # Mount the storage directory to persist logs, uploads, sessions and cache
      # across deployments (not baked into the image).
      - ./storage:/app/storage:rw
    environment:
      PROD_RUN_ARTISAN_MIGRATE: true
      PROD_RUN_ARTISAN_DBSEED: true
      ENABLE_QUEUE_WORKER: true
      # Skip composer install, npm install and npm build — already done in the Dockerfile
      ENABLE_DOCKERFILE_STRATEGY: true
```

## .dockerignore

::: warning Important
Create a `.dockerignore` file in your project root to prevent large or unnecessary directories from being copied into the image by the `COPY . .` instruction:
:::

```
vendor
node_modules
.git
storage
```

## Minimal production Dockerfile

A minimal production `Dockerfile` that bakes in all build artifacts might look like:

```dockerfile
FROM ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm

USER root
RUN mkdir -p /app && chown -R laravel:laravel /app

WORKDIR /app
USER laravel

COPY --chown=laravel:laravel . .

# Use --no-scripts to prevent Laravel post-install scripts from running in the build
# environment (no database/services available). The entrypoint will run
# `composer run-script post-autoload-dump` at container startup instead.
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

RUN npm ci && npm run build && rm -rf node_modules
```

A full example is available at [`examples/php-fpm/Dockerfile`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm/Dockerfile), paired with [`examples/php-fpm/docker-compose.dockerfile.yaml`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm/docker-compose.dockerfile.yaml) and [`examples/php-fpm/.dockerignore`](https://github.com/jonaaix/laravel-aio-docker/blob/main/examples/php-fpm/.dockerignore).
