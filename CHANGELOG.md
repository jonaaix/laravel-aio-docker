# Changelog

## Version 1.2 (PHP 8.3, PHP 8.4)

- Removed `ENABLE_SUPERVISOR` flag. It will be enabled by default.
- Booting `roadrunner/frankenphp/swoole` will require having a matching `OCTANE_SERVER` set in `.env`
- Laravel Octane will be automatically handled by supervisor
- Storage and cache permissions are now set to `root:www-data`. This will fix bidirectional issues when using a directory mount.
  However, it requires your host user to be in www-data group `sudo usermod -aG www-data $USERNAME`.
- Removed `fii/vips` driver in favor of `zend.max_allowed_stack_size` to enhance security. ImageMagick would have just slightly worse performance.
- Added `ll` alias for `ls -lsah`

```shell
# Dynamically insert the current user into the Docker configuration
echo "{\"userns-remap\": \"${USER}\"}" > /etc/docker/daemon.json

# Restart Docker service to apply changes
systemctl restart docker
```

