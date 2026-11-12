## Playwright MCP
For browsing, screenshots and UI checks use the Playwright MCP tools; `playwright` and `playwright-cli` do not open a browser here.
Save every screenshot as `.playwright-mcp/<slug>/<name>.png`. Generate `<slug>` once per session (6–8 hex chars) and reuse it — this keeps parallel agents from clobbering each other's files.
