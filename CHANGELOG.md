# Changelog

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

