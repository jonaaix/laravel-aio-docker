# Adding Redis

To add Redis to your stack, add the following service to your `compose.yaml`:

```yaml
volumes:
  redis_volume:
    driver: local

services:
  redis:
    image: redis:8-alpine
    volumes:
      - redis_volume:/data
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - app
```

Don't forget to add `redis` under your php service's `depends_on` and to set the matching `REDIS_HOST=redis`, `REDIS_PASSWORD=...` env vars in your Laravel `.env`.
