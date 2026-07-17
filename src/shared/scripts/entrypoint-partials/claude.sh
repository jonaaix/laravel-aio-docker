# Claude / AI-agent config initialization.
# Runs for the fpm-claude (coding) and ai-agent (lightweight AI-agent) variants.
# Seeds ~/.claude from the image-baked defaults in /opt/claude-defaults on every boot,
# composes the prompt from shared + variant-specific fragments, and layers a
# user-supplied persona on top.

# AI feature toggles. All opt-in and NOT tied to ENV_DEV. Canonical names:
# ENABLE_CLAUDE_THREADS (the claude-threads bridge), ENABLE_AI_NONTECH_MODE,
# ENABLE_AI_SOFTDEV_MODE. The legacy DEV_ENABLE_CLAUDE_* names stay as hidden aliases.
_ai_threads_enabled() { [ "$ENABLE_CLAUDE_THREADS" = "true" ]     || [ "$DEV_ENABLE_CLAUDE_THREADS" = "true" ]; }
_ai_nontech_enabled() { [ "$ENABLE_AI_NONTECH_MODE" = "true" ] || [ "$DEV_ENABLE_CLAUDE_NONTECH_MODE" = "true" ]; }
_ai_softdev_enabled() { [ "$ENABLE_AI_SOFTDEV_MODE" = "true" ] || [ "$DEV_ENABLE_CLAUDE_SOFTDEV_MODE" = "true" ]; }

# Append a claude-defaults fragment to the working CLAUDE.md, if it exists.
_claude_append() {
   local f="/opt/claude-defaults/$1"
   [ -f "$f" ] || return 0
   echo "" >> /home/laravel/.claude/CLAUDE.md
   cat "$f" >> /home/laravel/.claude/CLAUDE.md
}

# Remove abandoned Chromium singleton locks from the Playwright MCP's persistent profile.
# The MCP profile lives at ~/.cache/ms-playwright-mcp/mcp-<channel>-<hash>/ (the browser
# BINARIES are the separate ~/.cache/ms-playwright/). A hard container kill leaves a
# SingletonLock symlink (→ "<host>-<pid>") behind; playwright-core's isProfileLocked reads
# that pid and calls process.kill(pid, 0). Because PIDs restart low in a fresh container,
# the old pid is almost always reused by a live process, so the stale lock reads as "in use"
# and the browser refuses to launch. Deleting Singleton* at boot (no browser running yet)
# makes isProfileLocked return false. Glob ms-playwright* to cover both cache dir names and
# any future rename. Only meaningful for the browser-capable variants.
cleanup_playwright_locks() {
   case "$IMAGE_VARIANT" in fpm-claude|ai-agent) ;; *) return 0 ;; esac
   local base removed=0
   for base in "${HOME:-/home/laravel}"/.cache/ms-playwright*; do
      [ -d "$base" ] || continue
      [ -n "$(find "$base" -maxdepth 3 -name 'Singleton*' 2>/dev/null)" ] || continue
      find "$base" -maxdepth 3 -name 'Singleton*' -delete 2>/dev/null || true
      removed=1
   done
   [ "$removed" = "1" ] && log_ok "Cleared abandoned Playwright browser lock(s)"
   return 0
}

claude_init() {
   case "$IMAGE_VARIANT" in
      fpm-claude|ai-agent) ;;
      *) return 0 ;;
   esac

   mkdir -p /home/laravel/.claude
   cp /opt/claude-defaults/settings.json /home/laravel/.claude/settings.json
   cp /opt/claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md

   if _ai_threads_enabled; then
      _claude_append CLAUDE.threads.md
      # The AI git workflow (dev_ai branch model, patch handoff) only applies to the
      # coding variant — ai-agents don't code.
      [ "$IMAGE_VARIANT" = "fpm-claude" ] && _claude_append CLAUDE.threads.coding.md
   fi

   _ai_nontech_enabled && _claude_append CLAUDE.nontech.md
   _ai_softdev_enabled && _claude_append CLAUDE.softdev.md

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
