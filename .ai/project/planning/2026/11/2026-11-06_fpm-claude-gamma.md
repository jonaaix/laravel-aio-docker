# fpm-claude-gamma: image variant with the agent chat

## Goal

A new image variant `fpm-claude-gamma` runs the agent chat beside the Laravel app in the same container, so the
integration guide (`src/php-fpm-claude-gamma/claude-defaults/skills/agent-chat-integration`) works without manual steps:
the app calls the chat at `http://localhost:3000`, reads its key from `/home/laravel/.config/agent-chat/chat-key`,
and the browser reaches it at a public address. `fpm-claude` and `fpm-claude-beta` stay untouched, so updating
existing instances never changes them. Finished when a gamma container serves the chat, signs a Laravel user in
through the guide's route and shows the panel on a page.

## Milestones

- [x] Scope confirmed (public address, on/off)
- [x] Build: own `src/php-fpm-claude-gamma/Dockerfile`, a copy of today's beta build (fork claude-threads built in,
      no switch) plus the chat built with bun into `/opt`, never `/home/laravel`; registered in `build-image.sh`,
      `build-push-all.sh` and the CI workflow
- [x] Runtime: supervisor program for the chat (`NUXT_WORKING_DIR=/app`, data in `/home/laravel/.config/agent-chat`),
      port 3000, started only with `ENABLE_AGENT_CHAT=true`, entrypoint banner marks GAMMA
- [x] Check: container starts, chat creates its key (600, readable by PHP), links only with that key, browser
      sign-in works, chat stays off without `ENABLE_AGENT_CHAT`
- [ ] Check with a real Laravel app: guide's route signs in, panel shows

## State

- The chat comes from `~/repos/orbit-agent-chat` and runs its agents through the Claude Agent SDK; gamma no
  longer copies `src/claude-threads` for it. Built locally and checked in a container: the chat starts, signs in,
  and lists models through the SDK.
- Last push: digest `sha256:76c37a77…` - from before the move and the SDK switch. The next push waits for the
  user's test of real conversations on the SDK.

## Decisions

- The chat lives in its own repo, `~/repos/orbit-agent-chat` (user). `build-image.sh` hands its committed state
  (`git archive HEAD`, path overridable with `AGENT_CHAT_REPO`) to the build as the named context `orbit-agent-chat`.

- The chat goes into its own variant, not into `fpm-claude-beta`: an update of beta must not change running beta
  instances (user).
- Gamma is a copy of beta with its own Dockerfile, not built on beta or switched by a build arg, so changes to gamma
  never reach beta or `fpm-claude` (user). The shared entrypoint starts the chat only behind a flag gamma sets.
- The chat is reached on its own port 3000, mapped in `docker-compose.yml`; the app's nginx stays untouched (user, 258a).
- Opt-in like everything the image defines: the chat runs only with `ENABLE_AGENT_CHAT=true` (user, 259b).
- Not in the public docs or CHANGELOG, like `fpm-claude-beta`: a test variant.
- The chat guide moved from `php-fpm-claude` to gamma's defaults, so `fpm-claude` and beta no longer ship a guide for
  a chat they do not have.

## Open

- The CI workflow cannot build gamma until the chat's repo is on GitHub: it still expects the chat in this
  repo. Then the workflow has to check it out as the `orbit-agent-chat` build context.
