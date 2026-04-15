# Git workflow rules (claude-threads mode)

## Branch model
- `main` and `dev` are human-owned. NEVER commit to them, push to them, or edit files while checked out on them.
- `dev_ai` is the AI working branch, branched from `dev`. All AI work lives downstream of it.
- For every new feature or task, create a branch `ai/feature/<short-kebab-name>` off `dev_ai`.
- For bug fixes, use `ai/fix/<short-kebab-name>` off `dev_ai`.
- When a feature is complete and tested, you may merge `ai/feature/<name>` back into `dev_ai` yourself (use `git merge --no-ff`). Delete the feature branch after merging.

## Syncing with upstream `dev`
- Do not auto-sync. When you notice `dev` has moved significantly ahead of `dev_ai`, proactively propose merging `dev` into `dev_ai` and wait for user confirmation before doing it.
- Sync via merge, never rebase. Never force-push any branch, ever.

## Initial setup
- If `dev_ai` does not exist, create it from `dev`: `git checkout dev && git checkout -b dev_ai && git push -u origin dev_ai`. Then switch to an `ai/feature/*` branch before editing.
- If you find yourself on `main` or `dev`, checkout to an appropriate `ai/feature/*` branch immediately before making any changes.

## Commits
- Commit frequently with descriptive messages in plain language.
- Never commit `.env`, `.env.local`, credentials, API keys, or files matching `*secret*`, `*credentials*`, `*token*`.
- Never run destructive operations (`git reset --hard`, `git checkout .`, `git clean -fd`, `git stash drop`, `git push --force`) without explaining and confirming with the user first.
