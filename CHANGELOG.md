# Changelog

## Version 1.3.7
- Add the `ai-agent` variant — a PHP-free AI-agent runtime (`ghcr.io/jonaaix/laravel-aio:1.3-ai-agent`) built on `node:22`. Ships the Claude Code CLI, opencode and claude-threads, the Playwright MCP + Chromium for browsing/screenshots, a Python 3 virtualenv (csvkit, pandas, openpyxl, matplotlib, …) so agents can write and run their own scripts, plus a data/reporting toolkit (`ripgrep`, `jq`, `pandoc`, `sqlite3`, `miller`, `imagemagick`). Drops everything PHP-specific (PHP, Composer, nginx, php-fpm, php-lsp, Xdebug). Built for non-coding agents; the coding agent stays in `fpm-claude`.
- Add persona support: mount an `AI_PERSONA.md` (default path `/app/AI_PERSONA.md`, override via `AI_PERSONA_FILE`) and its contents are appended last to the agent's `CLAUDE.md` on boot, so an operator can program a single image into a purpose-built agent. Works in both the `ai-agent` and `fpm-claude` variants.
- Unify the AI feature switches across both variants under new opt-in env vars — `ENABLE_CLAUDE_THREADS`, `ENABLE_AI_NONTECH_MODE`, `ENABLE_AI_SOFTDEV_MODE` — and decouple them from `ENV_DEV`. The legacy `DEV_ENABLE_CLAUDE_THREADS` / `DEV_ENABLE_CLAUDE_NONTECH_MODE` / `DEV_ENABLE_CLAUDE_SOFTDEV_MODE` names keep working as hidden aliases.
- Refactor the Claude prompt fragments into `src/shared/claude-defaults/` so both variants compose from the same source. The combined `CLAUDE.threads.md` was split into a shared chat-bridge fragment and an `fpm-claude`-only `CLAUDE.threads.coding.md` (git workflow / patch handling), which don't apply to non-coding agents.

## Version 1.3.6 (PHP 8.4 and PHP 8.5)
- Fix Claude config and MCP servers never updating on existing deployments (fpm-claude). The `claude-defaults` and globally-installed MCP servers (`claude-threads`, `playwright-mcp`, …) lived under `/home/laravel`, which is a persisted named volume — Docker seeds it from the image only once, so image updates were shadowed forever. Both now live under `/opt`, outside the volume, and reflect the current image on every container recreate. No compose change needed; rebuild the image and recreate the container.

## Version 1.3.5 (PHP 8.4 and PHP 8.5)
- Install the `sqlite3` CLI in all images so SQLite database dumps/backups work (PHP's PDO driver does not provide the `sqlite3` binary).

## Version 1.3.4 (PHP 8.4 and PHP 8.5)
- Add `HTTP_PORT` env var to configure the Nginx listen port at runtime (default `8000`). Works across all variants and lets you keep host/container ports symmetric.

## Version 1.3.3 (PHP 8.4 and PHP 8.5)
- Fix permission fixer overwriting Laravel Passport OAuth keys (`storage/oauth-*.key`) with `664`. Passport requires `600` and will refuse to load the private key otherwise.

## Version 1.3.2 (PHP 8.4 and PHP 8.5)
- Moved image registry to GitHub (ghcr.io)
- Automatically generate `APP_KEY` on first run if not set to prevent boot errors

## Version 1.3.1 (PHP 8.4)
- Replace Laravel Scheduler cron with Supervisor task
- Install supercronic instead of cron, config via /etc/supercronic.txt
- Supervisor log output to stdout/stderr


## Version 1.3 (PHP 8.3, PHP 8.4)
- Add `jq` package to the Docker image for JSON processing.
- Check for `laravel/octane` package in `composer.json` instead of running `php artisan`.
- Add `chromium` and dependencies for painless puppeteer PDF generation.
- Make OCTANE_SERVER in `.env` optional, read from `config/octane.php` if not set.
- Run container as `laravel` user with UID 1000 and GID 1000 by default.
- BREAKING: Default port changed from `80` to `8000` due to reduction of privileges.
- Added a permission fixer script to reset file and dir permissions correctly.

## Version 1.2 (PHP 8.3, PHP 8.4)

- Removed `ENABLE_SUPERVISOR` flag. It will be enabled by default.
- Booting `roadrunner/frankenphp/swoole` will require having a matching `OCTANE_SERVER` set in `.env`
- Laravel Octane will be automatically handled by supervisor
- Storage and cache permissions are now set to `root:www-data`. This will fix bidirectional issues when using a directory mount.
  However, it requires your host user (only on Linux) to be in www-data group `sudo usermod -aG www-data $USERNAME`.
- Removed `fii/vips` driver in favor of `zend.max_allowed_stack_size` to enhance security. ImageMagick would have just slightly worse performance.
- Added `ll` alias for `ls -lsah`

```shell
# Dynamically insert the current user into the Docker configuration
echo "{\"userns-remap\": \"${USER}\"}" > /etc/docker/daemon.json

# Restart Docker service to apply changes
systemctl restart docker
```

