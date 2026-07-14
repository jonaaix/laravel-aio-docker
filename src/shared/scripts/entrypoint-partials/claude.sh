# Claude / AI-agent config initialization.
# Runs for the fpm-claude (coding) and ai-agent (lightweight AI-agent) variants.
# Seeds ~/.claude from the image-baked defaults in /opt/claude-defaults on every boot,
# composes the prompt from shared + variant-specific fragments, and layers a
# user-supplied persona on top.

# Append a claude-defaults fragment to the working CLAUDE.md, if it exists.
_claude_append() {
   local f="/opt/claude-defaults/$1"
   [ -f "$f" ] || return 0
   echo "" >> /home/laravel/.claude/CLAUDE.md
   cat "$f" >> /home/laravel/.claude/CLAUDE.md
}

claude_init() {
   case "$IMAGE_VARIANT" in
      fpm-claude|ai-agent) ;;
      *) return 0 ;;
   esac

   mkdir -p /home/laravel/.claude
   cp /opt/claude-defaults/settings.json /home/laravel/.claude/settings.json
   cp /opt/claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md

   if [ "$IMAGE_VARIANT" = "fpm-claude" ]; then
      # claude-threads is an opt-in dev tool here; the chat rules + the coding-specific
      # git workflow only apply when it's enabled.
      if [ "$DEV_ENABLE_CLAUDE_THREADS" = "true" ] && [ "$ENV_DEV" = "true" ]; then
         _claude_append CLAUDE.threads.md
         _claude_append CLAUDE.threads.coding.md
      fi
      if [ "$DEV_ENABLE_CLAUDE_NONTECH_MODE" = "true" ] && [ "$ENV_DEV" = "true" ]; then
         _claude_append CLAUDE.nontech.md
      fi
      if [ "$DEV_ENABLE_CLAUDE_SOFTDEV_MODE" = "true" ] && [ "$ENV_DEV" = "true" ]; then
         _claude_append CLAUDE.softdev.md
      fi
   fi

   if [ "$IMAGE_VARIANT" = "ai-agent" ]; then
      # claude-threads is the primary interface; ship its chat rules by default. There's
      # no coding git workflow here — these agents don't code.
      if [ "$DISABLE_CLAUDE_THREADS" != "true" ]; then
         _claude_append CLAUDE.threads.md
      fi
      # Non-technical user mode is opt-in (many of these agents serve non-devs).
      if [ "$ENABLE_NONTECH_MODE" = "true" ]; then
         _claude_append CLAUDE.nontech.md
      fi
   fi

   # Layer a user-supplied persona on top, if one is mounted. Appended LAST so it takes
   # precedence over the shipped defaults — this is how an operator tailors a single
   # image into a purpose-built agent (its role, tone, domain rules, guardrails).
   # Default path is /app/AI_PERSONA.md; override with AI_PERSONA_FILE.
   local persona_file="${AI_PERSONA_FILE:-/app/AI_PERSONA.md}"
   if [ -f "$persona_file" ]; then
      {
         printf '\n# Persona (operator-defined)\n\n'
         cat "$persona_file"
      } >> /home/laravel/.claude/CLAUDE.md
      log_ok "Applied AI persona from ${persona_file}"
   fi

   [ -f /opt/claude-defaults/.claude.json ] && node /scripts/merge-mcp-servers.js
   [ -f /opt/claude-defaults/plugins/installed_plugins.json ] && node /scripts/merge-plugins.js

   return 0
}
