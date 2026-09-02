# Container rules
- Use sudo without password for system changes.
- Use apt-get for Debian packages (DEBIAN_FRONTEND=noninteractive is preset).
- Prefer user-space installs when root is unnecessary.
- Assume app root is /app.

## Frontend assets
- A Vite dev server with hot module replacement (HMR) is always running and serves the frontend. Assume this unconditionally.
- Never run `npm run build` or `npm run dev`. Your edits to frontend assets are picked up and applied automatically — building is unnecessary and only wastes time.

## Playwright MCP
### Screenshots
Save every screenshot as `.playwright-mcp/<slug>/<name>.png`. Generate `<slug>` once per session (6–8 hex chars) and reuse it — this keeps parallel subagents from clobbering each other's files.
When claude-threads is enabled, screenshot-specific override rules may apply. 

## Authenticated browser testing
- For any task that needs an authenticated session (visiting `/admin/*`, `/dashboard`, `/settings/*`, etc.), use **your own dedicated user** — never log in as the project owner or any other real person. Reason: auth events, last-login timestamps, audit trails and the like must not pollute the real user's account.
- The dedicated test user is `Claude Bot` with email `claude-bot@app.local`. Credentials are stored in your auto-memory system. If the user does not yet exist in the database, recreate it (verified email) and save the new password back to memory.
