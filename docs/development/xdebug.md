# Xdebug

To enable Xdebug, set `DEV_ENABLE_XDEBUG: true` in your `compose.yaml`. You can connect to the Xdebug server on port `9003`.

```yaml
services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    environment:
      ENV_DEV: true
      DEV_ENABLE_XDEBUG: true
```

::: warning
Xdebug only activates when `ENV_DEV: true`. In production mode, Xdebug is forcibly disabled even if `DEV_ENABLE_XDEBUG: true` is set.
:::

## PHPStorm Configuration

1. Go to `Settings` → `PHP` → `Debug`
2. **External Connections:** **DISABLE** `Break at first line in PHP scripts`
3. **Xdebug:** **DISABLE** `Force break at first line when no path mapping specified`
4. **Xdebug:** **DISABLE** `Force break at first line when a script is outside the project`
5. Go to `Settings` → `PHP` → `Servers`
6. Add a new server with name `laravel` according to the compose configuration:
   - Name: `laravel`
   - Host: `localhost`
   - Port: `8000`
   - Debugger: `Xdebug`
   - **ENABLE**: `Use path mappings`: `path/to/your/project` → `/app`
7. Install the [browser extension](https://www.jetbrains.com/help/phpstorm/browser-debugging-extensions.html) and enable it in the correct tab.
8. Activate the telephone icon in PHPStorm to listen for incoming connections.
