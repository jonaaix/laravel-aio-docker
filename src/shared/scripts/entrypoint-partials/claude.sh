# Claude config initialization (only meaningful in fpm-claude variant).

# Init Claude config defaults if missing (e.g. fresh volume mount on ~/.claude)
claude_init() {
   [ "$IMAGE_VARIANT" = "fpm-claude" ] || return 0

   mkdir -p /home/laravel/.claude
   cp /opt/claude-defaults/settings.json /home/laravel/.claude/settings.json
   cp /opt/claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md

   if [ "$DEV_ENABLE_CLAUDE_THREADS" = "true" ] && [ "$ENV_DEV" = "true" ]; then
      echo "" >> /home/laravel/.claude/CLAUDE.md
      cat /opt/claude-defaults/CLAUDE.threads.md >> /home/laravel/.claude/CLAUDE.md
   fi

   if [ "$DEV_ENABLE_CLAUDE_NONTECH_MODE" = "true" ] && [ "$ENV_DEV" = "true" ]; then
      echo "" >> /home/laravel/.claude/CLAUDE.md
      cat /opt/claude-defaults/CLAUDE.nontech.md >> /home/laravel/.claude/CLAUDE.md
   fi

   if [ "$DEV_ENABLE_CLAUDE_SOFTDEV_MODE" = "true" ] && [ "$ENV_DEV" = "true" ]; then
      echo "" >> /home/laravel/.claude/CLAUDE.md
      cat /opt/claude-defaults/CLAUDE.softdev.md >> /home/laravel/.claude/CLAUDE.md
   fi

   node /scripts/merge-mcp-servers.js
   node /scripts/merge-plugins.js
}
