# Container rules
- Use sudo without password for system changes.
- Use apt-get for Debian packages (DEBIAN_FRONTEND=noninteractive is preset).
- Prefer user-space installs when root is unnecessary.
- Assume app root is /app.

## Code intelligence tooling
- For symbol-level work (rename, find references, go to definition, find implementations), load the `LSP` tool first via `ToolSearch query="select:LSP"` and prefer it over text grep. Check the loaded schema for available operations; if a needed op (e.g. `rename`) is missing, fall back to `findReferences` + `Edit`.

## Playwright MCP
### Screenshots
Always prefix `filename` with `.playwright-mcp/` (e.g. `.playwright-mcp/login-page.png`) so screenshots land alongside the auto-saved snapshots and console logs instead of cluttering the project root.
When claude-threads is enabled, screenshot-specific override rules may apply. 

## Authenticated browser testing
- For any task that needs an authenticated session (visiting `/admin/*`, `/dashboard`, `/settings/*`, etc.), use **a dedicated test user** — never log in as the project owner or any other real person. Reason: auth events, last-login timestamps, audit trails and the like must not pollute a real user's account. Which test account to use (and whether you may create one) is defined by the environment rules below.
