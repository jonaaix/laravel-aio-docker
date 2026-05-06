# Custom boot scripts

You can hook into the entrypoint boot process by mounting custom script directories. The scripts are executed in **alphabetical order** within each phase.

| Mount point | When it runs |
| :--- | :--- |
| `/custom-scripts/before-boot` | Very early — after the banner, before xdebug/nginx/laravel boot |
| `/custom-scripts/after-boot` | Very late — after `PHP READY`, before container `wait_forever` |

## docker-compose example

```yaml
services:
  php:
    volumes:
      - ./docker/before-boot:/custom-scripts/before-boot
      - ./docker/after-boot:/custom-scripts/after-boot
```

## Notes

- Each script must have the `.sh` extension to be picked up.
- Scripts are executed with `bash`, errors do not abort the boot (`|| true`).
- Use `before-boot` for setup that needs to happen before Laravel runs (e.g., wait for an external service, prepare a directory).
- Use `after-boot` for tasks that need a fully-booted Laravel (e.g., cache warmup, post-deploy hooks).
