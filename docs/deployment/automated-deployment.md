# Automated deployment / CI

A simple GitHub-Actions-driven deploy pipeline. The workflow SSHes into your server and triggers a small `deploy.sh` script, which freezes the compose config, pulls the latest image (or rebuilds it locally), and restarts the stack.

The same skeleton works for **both** [Mounted host directory](/deployment/mounted-host-dir) and [Dockerfile strategy](/deployment/dockerfile-strategy) deployments — only the `compose.prod.yaml` differs. See [Per-strategy compose differences](#per-strategy-compose-differences) below.

::: tip Prerequisites
- Project is checked out on the server (e.g. via `git clone`) at a known path
- Docker + Docker Compose installed on the server
- An SSH key whose public part is in the server's `~/.ssh/authorized_keys`
- The corresponding private key stored as a GitHub secret (`SSH_PRIVATE_KEY`), plus `REMOTE_HOST` and `REMOTE_USER`
:::

## GitHub Actions workflow

`.github/workflows/deploy-prod.yml` in your **application** repo (not this image's repo):

```yaml
name: Deploy to Production

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Check required secrets
        run: |
          [ -z "${{ secrets.REMOTE_HOST }}" ] && echo "REMOTE_HOST secret is missing" && exit 1
          [ -z "${{ secrets.REMOTE_USER }}" ] && echo "REMOTE_USER secret is missing" && exit 1
          [ -z "${{ secrets.SSH_PRIVATE_KEY }}" ] && echo "SSH_PRIVATE_KEY secret is missing" && exit 1
          echo "All required secrets are available."

      - name: Execute remote deploy script
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.REMOTE_HOST }}
          username: ${{ secrets.REMOTE_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/my-app
            git reset --hard
            git clean -df
            git pull
            chmod +x deploy.sh
            ./deploy.sh
```

`workflow_dispatch` makes this a manually-triggered button in the GitHub Actions UI. Swap for `push` to a `release` branch, tag triggers, or any other event when you want it to fire automatically.

`git reset --hard && git clean -df` before `git pull` ensures a clean checkout even if something on the server got accidentally modified.

## deploy.sh

Place this in your application repo's root. Executable bit is set by the workflow before it runs.

```bash
#!/bin/sh

export DEPLOYMENT_ID=$(date +%s)

$(which docker) compose -f compose.prod.yaml config > compose.compiled.yaml
if [ -f compose.yaml ]; then
    rm -f compose.yaml
fi
mv compose.compiled.yaml compose.yaml

$(which docker) compose pull
$(which docker) compose up -d --remove-orphans

sleep 2
$(which docker) image prune --all --force

echo "Deployed successfully!"
```

### What each step does

1. **`DEPLOYMENT_ID=$(date +%s)`** — a Unix-timestamp env var passed into the compose config. The image's entrypoint can read it; changing it triggers a recreate even if the image digest didn't change. Useful when you want a forced restart on every deploy (cache busts, re-running migrations, etc.).
2. **`docker compose config`** — renders `compose.prod.yaml` into a fully-resolved `compose.compiled.yaml` (env vars substituted, defaults filled in, anchors expanded). The result is then moved to `compose.yaml` so subsequent `docker compose` commands pick it up by default — no `-f` flag needed afterwards.
3. **`docker compose pull`** — fetches new image layers if the tag pointer moved (e.g., you bumped the image version in `compose.prod.yaml`).
4. **`docker compose up -d --remove-orphans`** — recreates changed services in detached mode. `--remove-orphans` cleans up containers from services that were removed from the compose file.
5. **`sleep 2 && docker image prune --all --force`** — frees disk space by removing unused images. The 2-second wait gives Docker time to release references on the previous image.

## Securing the SSH access

- **Use a dedicated deploy user** on the server, not root. Limit it to the project directory and Docker socket.
- **Restrict the SSH key** with `command=` in `~/.ssh/authorized_keys` if you want it to ONLY run the deploy script:
  ```
  command="cd /var/www/my-app && ./deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA…
  ```
  Then the GitHub Action doesn't need to send a multi-line `script:` — the SSH connection itself triggers the deploy.
- **Rotate the key** periodically; store only the private half as a GitHub secret.

## Per-strategy compose differences

The workflow + `deploy.sh` skeleton above stays identical. What changes is what's inside `compose.prod.yaml` (the file `deploy.sh` materializes into `compose.yaml`):

### Mounted host directory

```yaml
services:
  php:
    image: ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm
    volumes:
      - ./:/app:cached
```

Code lives on the server (`git pull` keeps it fresh). The image is just the runtime. `docker compose pull` updates the runtime image when you bump the tag in `compose.prod.yaml`.

### Dockerfile strategy — built on the server

```yaml
services:
  php:
    build:
      dockerfile: ./Docker/production/Dockerfile
      context: ./
```

`docker compose up -d` rebuilds the image locally during deploy from the freshly pulled source. No registry needed. Slightly slower deploys (Docker layer cache helps), but zero infrastructure beyond the server itself.

### Dockerfile strategy — built in CI, pulled from registry

```yaml
services:
  php:
    image: ghcr.io/your-org/your-app:${IMAGE_TAG:-latest}
```

A separate CI job (e.g. a `build-and-push` workflow that runs first) builds the image and pushes it to GHCR / Docker Hub / a private registry. `deploy.sh` only pulls and restarts. You can drop the `git pull` from the SSH script entirely if the server doesn't need the source — only the `compose.prod.yaml` and `deploy.sh` are required there.

The choice is operational, not technical: how much you want to lean on a registry vs. building on the server. The deploy script doesn't care.

## Extending the workflow

Common additions:

- **Run tests before deploy**: add a `test` job that depends on a clean checkout, then make `deploy` `needs: test`
- **Notify a chat channel**: append a final step using a Slack/Mattermost webhook action
- **Multi-environment**: matrix over `staging` and `prod` with different secrets per environment
- **Health check after deploy**: `curl` your app's `/health` endpoint and fail the job if it doesn't return 200 within N seconds
