# Laravel Boost MCP

Using [Laravel Boost](https://github.com/laravel/boost) with the Docker container is straightforward — you bridge the MCP server through `docker compose exec`.

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
