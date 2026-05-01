# Container rules
- Use sudo without password for system changes.
- Use apt-get for Debian packages (DEBIAN_FRONTEND=noninteractive is preset).
- Prefer user-space installs when root is unnecessary.
- Assume app root is /app.

## Playwright MCP
### Screenshots
Always prefix `filename` with `.playwright-mcp/` (e.g. `.playwright-mcp/login-page.png`) so screenshots land alongside the auto-saved snapshots and console logs instead of cluttering the project root. 
