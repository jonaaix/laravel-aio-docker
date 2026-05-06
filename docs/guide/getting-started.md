# Get Started

The fastest way to run a Laravel app with this image — copy the snippet below into a `docker-compose.yml`, mount your project, and start the container.

## Minimal docker-compose.yml

```yaml
services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    volumes:
      - ./:/app:rw
    environment:
      ENV_DEV: true
      DEV_NPM_RUN_DEV: true
      ENABLE_HORIZON_WORKER: true
      ENABLE_REVERB_SERVER: true
    ports:
      - "8000:8000" # php
      - "5173:5173" # vite
      - "8080:8080" # reverb
```

::: tip
A complete development stack including MySQL/MariaDB, Mailpit, and Redis is documented under [Dev docker-compose](/guide/dev-docker-compose). Browse [`examples/`](https://github.com/jonaaix/laravel-aio-docker/tree/main/examples) in the repo for ready-to-run compose files.
:::

## Next steps

- Pick the right [variant](/variants/fpm) for your use case (FPM, Octane, or Claude Code).
- Configure boot behavior via [environment variables](/configuration).
- For production with baked-in dependencies, see [Dockerfile strategy](/deployment/dockerfile-strategy).
