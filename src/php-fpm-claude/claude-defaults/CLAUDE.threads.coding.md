# Git workflow rules (claude-threads mode)

## Branch model
- `main` is human-owned and off-limits. NEVER commit to it, push to it, or edit files while checked out on it.
- `dev` is human-owned but not strictly off-limits: if `dev` is the currently checked-out branch, ask the user whether you should work directly on `dev` before making any changes. Only work on `dev` if they say yes. Otherwise switch to `dev_ai`.
- `dev_ai` is the AI working branch, branched from `dev`. Default: work and commit directly on `dev_ai` — it flows into `dev`.
- Only create a separate branch when the user explicitly asks for one. In that case:
  - features → `ai/feature/<short-kebab-name>` off `dev_ai`
  - bug fixes → `ai/fix/<short-kebab-name>` off `dev_ai`
  - when done and tested, merge back into `dev_ai` with `git merge --no-ff` and delete the branch.

## Syncing with upstream `dev`
- Do not auto-sync. When you notice `dev` has moved significantly ahead of `dev_ai`, proactively propose merging `dev` into `dev_ai` and wait for user confirmation before doing it.
- Sync via merge, never rebase. Never force-push any branch, ever.

## Initial setup
- If `dev_ai` does not exist, create it from `dev`: `git checkout dev && git checkout -b dev_ai && git push -u origin dev_ai`. Then switch to `dev_ai` before editing.
- If you're on `main`, switch to `dev_ai` immediately before making any changes. If you're on `dev`, ask whether to work on `dev` (see Branch model); otherwise switch to `dev_ai`.

## Commits
- Commit frequently with descriptive messages in plain language, while not ending in micro commits.
- Never commit `.env`, `.env.local`, credentials, API keys, or files matching `*secret*`, `*credentials*`, `*token*`.
- Never run destructive operations (`git reset --hard`, `git checkout .`, `git clean -fd`, `git stash drop`, `git push --force`) without explaining and confirming with the user first.

## Exporting a fix as a patch
- When the user asks to export the current fix as a patch (to hand off to a developer):
  - One patch = one topic, where "topic" is the user's framing of the work (e.g., "dashboard rework"), not a single change. Include every change belonging to that topic, even if it spans many files and many small edits.
  - Only split into multiple patches when the working tree clearly contains *unrelated* work alongside the topic. When in doubt, ask before splitting.
  - Deliver the patch as a chat attachment (see the chat-bridge sharing rules above).

## Sharing files: public-directory fallback

The default is to attach files directly in the chat (see the chat-bridge rules above).
Use this fallback only when MCP attachment doesn't fit — the file exceeds the upload
limit, or the user explicitly wants a stable URL to share further or embed.

Store the file at:
```text
<public-root>/playwright-mcp/<aa>/<bb>/<cc>/<rest>/<name>.png
```

Per chat session, generate one random 24-char hex hash. Use the first three 2-char chunks as shard folders and the remaining 18 chars as the session folder. Reuse that folder for all shared files in the session.

Exclude the folder from version control:
```gitignore
<public-root>/playwright-mcp/
```

Build the URL from the app's base URL:
```text
<base-url>/playwright-mcp/<aa>/<bb>/<cc>/<rest>/<name>.png
```
