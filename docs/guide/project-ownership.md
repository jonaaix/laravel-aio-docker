# Project Directory Ownership

The container runs as **uid 1000**, which matches the host user on most Linux systems by default. On macOS the default group is `staff`, which can require an extra step.

## Resetting permissions

Your local project's permissions may need to be reset to the correct defaults (`1000:1000`) if files were created by other tools or another user.

For a full reset of permissions, run inside your project directory:

```bash
docker compose exec --user root php sh -c "/scripts/fix-laravel-project-permissions.sh"
```

## macOS

On macOS the default group is `staff`, so you might need to run the following command afterwards:

```bash
sudo chown -R $(whoami):staff /path/to/app
```
