# Supervisor config assembly. Each function appends a worker config to the compiled file.
# Call init_supervisor_config first; start_supervisor last.

SUPERVISOR_COMPILED=/etc/supervisor/conf.d/laravel-worker-compiled.conf

init_supervisor_config() {
   cat /etc/supervisor/conf.d/supervisor-header.conf > "$SUPERVISOR_COMPILED"
}

# Internal: append a worker config file to the compiled config.
_supervisor_append() {
   local conf="/etc/supervisor/conf.d/$1"
   echo "" >> "$SUPERVISOR_COMPILED"
   cat "$conf" >> "$SUPERVISOR_COMPILED"
}

supervisor_add_supercronic() {
   log_step "Adding supercronic worker..."
   _supervisor_append "supercronic-worker.conf"
}

supervisor_add_schedule() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_step "Adding schedule worker..."
   _supervisor_append "schedule-worker.conf"
}

supervisor_add_queue_if_enabled() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_QUEUE_WORKER" != "true" ]; then
      return 0
   fi
   log_step "Adding queue worker..."
   _supervisor_append "queue-worker.conf"
}

supervisor_add_horizon_if_enabled() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_HORIZON_WORKER" != "true" ]; then
      return 0
   fi
   log_step "Adding Horizon worker..."
   _supervisor_append "horizon-worker.conf"
}

supervisor_add_reverb_if_enabled() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_REVERB_SERVER" != "true" ]; then
      return 0
   fi
   log_step "Adding Reverb server..."
   _supervisor_append "reverb-server.conf"
}

supervisor_add_claude_threads_if_enabled() {
   if [ "$IMAGE_VARIANT" != "fpm-claude" ] || \
      [ "$DEV_ENABLE_CLAUDE_THREADS" != "true" ] || \
      [ "$ENV_DEV" != "true" ]; then
      return 0
   fi
   log_step "Adding claude-threads worker..."
   _supervisor_append "claude-threads.conf"
}

supervisor_add_vite_dev_if_enabled() {
   if [ "$DEV_NPM_RUN_DEV" != "true" ] || [ "$ENV_DEV" != "true" ]; then
      return 0
   fi
   log_step "Adding Vite dev server..."
   _supervisor_append "vite-dev-server.conf"
}

# Validates OCTANE_SERVER env / config consistency, then appends octane worker config.
# Self-gates on PHP_RUNTIME_CONFIG != "fpm" and SKIP_LARAVEL_BOOT.
supervisor_add_octane_if_enabled() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   [ "$PHP_RUNTIME_CONFIG" != "fpm" ] || return 0

   local octane_server
   octane_server=${LARAVEL_ENV[OCTANE_SERVER]}

   if [ -z "$octane_server" ]; then
      # Try to read from config/octane.php
      octane_server=$(grep -E 'env\(\s*["'"'"']OCTANE_SERVER["'"'"']\s*,\s*["'"'"'][^"'"'"']+["'"'"']' config/octane.php | sed -E 's/.*OCTANE_SERVER["'"'"']\s*,\s*["'"'"']([^"'"'"']+)["'"'"'].*/\1/')
   fi

   if [ -z "$octane_server" ]; then
      log_error "Could not find OCTANE_SERVER in .env or config/octane.php."
      exit 1
   fi

   if [ "$PHP_RUNTIME_CONFIG" != "$octane_server" ]; then
      log_error "Mismatch between PHP_RUNTIME_CONFIG ($PHP_RUNTIME_CONFIG) and OCTANE_SERVER ($octane_server)."
      log_error "Please ensure they are consistent."
      exit 1
   fi

   log_step "Adding Octane worker..."
   if [ "$ENV_DEV" = "true" ]; then
      _supervisor_append "octane-worker-dev.conf"
   else
      # Best practice for Octane: 2x CPU cores (Laravel runs blocking PHP, so I/O waits stall workers).
      export OCTANE_WORKERS=$(( $(nproc) * 2 ))
      log_step "Octane workers: $OCTANE_WORKERS ($(nproc) cores * 2)"
      _supervisor_append "octane-worker-prod.conf"
   fi
}

start_supervisor() {
   supervisord -n -c "$SUPERVISOR_COMPILED" &
   log_ok "Supervisor started"
}
