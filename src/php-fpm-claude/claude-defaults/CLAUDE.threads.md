# Git workflow rules (claude-threads mode)

## Branch model
- `main` and `dev` are human-owned. NEVER commit to them, push to them, or edit files while checked out on them.
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
- If you find yourself on `main` or `dev`, checkout `dev_ai` immediately before making any changes.

## Commits
- Commit frequently with descriptive messages in plain language, while not ending in micro commits.
- Never commit `.env`, `.env.local`, credentials, API keys, or files matching `*secret*`, `*credentials*`, `*token*`.
- Never run destructive operations (`git reset --hard`, `git checkout .`, `git clean -fd`, `git stash drop`, `git push --force`) without explaining and confirming with the user first.

## Exporting a fix as a patch
- When the user asks to export the current fix as a patch (to hand off to a developer):
  - One patch = one topic, where "topic" is the user's framing of the work (e.g., "dashboard rework"), not a single change. Include every change belonging to that topic, even if it spans many files and many small edits.
  - Only split into multiple patches when the working tree clearly contains *unrelated* work alongside the topic. When in doubt, ask before splitting.
  - Deliver the patch via chat attachment (see "Sharing screenshots and files" below).

## Sharing screenshots and files

Whenever you capture a Playwright screenshot, you MUST send it to the user in the chat — attach it via the claude-threads MCP attachment tool without waiting to be asked. This applies to every screenshot you take, even ones you captured only to inspect the page yourself: the user should always see what you saw.

Default: attach the file directly via the claude-threads MCP attachment tool — the recipient sees it inline in Mattermost without leaving the chat. This covers screenshots, generated reports, exported data, and any other file the user asks for. Files can stay at their normal disk paths (e.g. `.playwright-mcp/<name>.png` for screenshots); the attachment tool reads them from there.

Use the public-link approach below only when MCP attachment doesn't fit:
- file exceeds Mattermost's upload limit
- the user explicitly wants a stable URL (e.g. to share further or embed)
- the user asks for a link instead of an attachment

### Fallback: serve via the app's public directory

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

## Chat interaction

### Acknowledging a task
Before starting work on a task, set the 👀 reaction on the user's message (via the claude-threads MCP reaction tool) to signal you've picked it up. One reaction, nothing more. Skip it for plain chat you answer immediately.

### Suggesting the next step
When you finish something and a genuinely sensible next step exists, proactively propose it — the single move that best advances the project from here, not a generic menu of options. Only when it actually fits; never manufacture a suggestion just to have one. Match the audience: for non-technical users, frame it in product terms as something they can try; for developers, name the concrete technical next move.
