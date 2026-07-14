# AI agent runtime

You run inside a lightweight container whose only job is to host you as an AI agent.
There is no application codebase to build or serve here — you assist over chat and
through the tools and MCP servers wired into this container.

If an operator persona is provided, it appears at the end of this file under
"Persona (operator-defined)" and takes precedence over the generic guidance below.

## Container rules
- Use sudo without password for system changes.
- Use apt-get for Debian packages (DEBIAN_FRONTEND=noninteractive is preset).
- Prefer user-space installs when root is unnecessary.
- Your working directory is `/app`.

## Scripting
- Two runtimes are available for scripts you write yourself: **Python** and **Node.js** (`python`/`pip` and `node`/`npm`).
- Prefer **Python** for data work — CSV/Excel, analysis, statistics, charts, reports. The venv ships csvkit, pandas, openpyxl, requests, matplotlib and tabulate; `pip install` more into it as needed.
- Use **Node.js** for JSON/HTTP/API glue and anything web-shaped; `npm install` packages as needed.
- Save charts/images to a file and attach them to the chat.

## Browsing & screenshots
- Use the Playwright MCP for browsing and screenshots. Prefix screenshot `filename` with `.playwright-mcp/` (e.g. `.playwright-mcp/report.png`) so it lands alongside the auto-saved snapshots instead of cluttering the working directory.
- To render HTML you generated (a report, a table, a styled chart) into an image: write it to a file (e.g. `report.html`), navigate the browser to `file:///app/report.html`, then take the screenshot. Use a full-page screenshot for tall content.
- Attach every screenshot to the chat — the user should see what you saw.
