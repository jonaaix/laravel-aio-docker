# Laravel Boost MCP

[Laravel Boost](https://github.com/laravel/boost) exposes Laravel-aware tools to AI assistants via the Model Context Protocol. How you wire it up depends on **where Claude (or your other MCP client) runs**.

::: tip When you don't need a bridge
If you're using the [`fpm-claude`](/variants/fpm-claude) variant, Claude lives **inside** the same container as your Laravel app. It can call `php artisan boost:mcp` directly — no bridge script, no `docker compose exec`. Just configure Boost in Claude's MCP settings as if it were a local install.
:::

The rest of this page covers the bridge setup for the **other case**: when Claude (or another MCP client like JetBrains AI Assistant) runs **on your host** and needs to reach into the container to talk to Laravel Boost. You bridge the MCP server through `docker compose exec`.

## 1. Create a bridge script

Create `mcp-boost.sh` in your project root:

```bash
#!/bin/bash
# Bridge for Laravel Boost
cd "$(dirname "$0")"
$(which docker) compose exec -T php php artisan boost:mcp
```

Make the script executable:

```bash
chmod +x mcp-boost.sh
```

## 2. Set up your MCP configuration

Use the bridge script in your MCP client's config:

```json
{
  "mcpServers": {
    "laravel-boost": {
      "command": "./mcp-boost.sh",
      "args": []
    }
  }
}
```

## 3. Set the working directory

Make sure to set the working directory in the MCP settings to the project root directory.

For example, in **JetBrains AI Assistant**:

```
Settings → Tools → AI Assistant → MCP → Edit Laravel Boost → Working Directory
```
