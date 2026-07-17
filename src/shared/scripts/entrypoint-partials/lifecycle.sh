# Banner, user info, shutdown handler, custom-script hooks, env-file reading, wait-forever.

print_banner() {
   # The ai-agent variant is PHP-free and not a Laravel app — show its own banner
   # instead of the LARAVEL AIO wordmark.
   if [ "$IMAGE_VARIANT" = "ai-agent" ]; then
      cat <<'BANNER'

 █████╗ ██╗    █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔══██╗██║   ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
███████║██║   ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
██╔══██║██║   ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
██║  ██║██║   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
╚═╝  ╚═╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝

BANNER
      log_info "User: $(whoami), UID: $(id -u)"
      log_info "Laravel AIO — agent runtime (variant: ${IMAGE_VARIANT})"
      return 0
   fi

   cat <<'BANNER'

██╗      █████╗ ██████╗  █████╗ ██╗   ██╗███████╗██╗          █████╗   ██╗   ██████╗
██║     ██╔══██╗██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██╔══██╗  ██║  ██╔═══██╗
██║     ███████║██████╔╝███████║██║   ██║█████╗  ██║         ███████║  ██║  ██║   ██║
██║     ██╔══██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██╔══██║  ██║  ██║   ██║
███████╗██║  ██║██║  ██║██║  ██║ ╚████╔╝ ███████╗███████╗    ██║  ██║  ██║  ╚██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝    ╚═╝  ╚═╝  ╚═╝   ╚═════╝

BANNER

   # Beta build (fpm-claude-beta) — mark it clearly under the wordmark.
   local variant_label="${IMAGE_VARIANT:-unknown}"
   if [ "$IMAGE_BETA" = "1" ]; then
      cat <<'BANNER'
██████╗ ███████╗████████╗ █████╗
██╔══██╗██╔════╝╚══██╔══╝██╔══██╗
██████╔╝█████╗     ██║   ███████║
██╔══██╗██╔══╝     ██║   ██╔══██║
██████╔╝███████╗   ██║   ██║  ██║
╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝

BANNER
      variant_label="${IMAGE_VARIANT} BETA"
   fi

   log_info "User: $(whoami), UID: $(id -u)"
   log_info "Image variant: ${variant_label} (runtime: ${PHP_RUNTIME_CONFIG:-unknown})"
}

shutdown_handler() {
   # NOTE: In the most recent Docker version, logging is disabled once stop signal received :( However it still works.
   log_phase "🛑  Graceful shutdown"

   # Cache the artisan command list once to avoid booting Laravel multiple times.
   # php may be absent entirely (e.g. the ai-agent variant) — then only Supervisor is stopped.
   local artisan_commands
   artisan_commands=$(php artisan 2>/dev/null || true)

   local has_horizon="" has_reverb="" has_octane="" has_supervisor=""
   echo "$artisan_commands" | grep -q "horizon" && has_horizon=1
   echo "$artisan_commands" | grep -q "reverb"  && has_reverb=1
   echo "$artisan_commands" | grep -q "octane"  && has_octane=1
   pgrep supervisord > /dev/null && has_supervisor=1

   # Overview of what will be stopped, in the order it happens.
   local -a todo=()
   [ -n "$has_horizon" ]    && todo+=("Horizon")
   [ -n "$has_reverb" ]     && todo+=("Reverb")
   [ -n "$has_octane" ]     && todo+=("Octane")
   [ -n "$has_supervisor" ] && todo+=("Supervisor")

   if [ ${#todo[@]} -eq 0 ]; then
      log_ok "Nothing to stop — exiting"
      exit 0
   fi
   log_info "Stopping ${#todo[@]} service(s):"
   local svc
   for svc in "${todo[@]}"; do
      log_step "$svc"
   done

   if [ -n "$has_horizon" ]; then
      log_step "⏳ Horizon — signalling workers to finish their jobs..."
      php artisan horizon:terminate > /dev/null 2>&1 || true
      # Wait for Horizon workers to drain before moving on (compose stop_grace_period is
      # 60s; cap at 50s to leave a buffer for the remaining shutdown steps).
      local timeout=50
      while [ $timeout -gt 0 ] && pgrep -f "horizon:(work|supervisor)" > /dev/null; do
         sleep 1
         timeout=$((timeout - 1))
      done
      log_ok "Horizon stopped"
   fi

   if [ -n "$has_reverb" ]; then
      log_step "⏳ Reverb — broadcasting restart signal..."
      php artisan reverb:restart > /dev/null 2>&1 || true
      log_ok "Reverb stopped"
   fi

   if [ -n "$has_octane" ]; then
      log_step "⏳ Octane — stopping server..."
      php artisan octane:stop > /dev/null 2>&1 || true
      log_ok "Octane stopped"
   fi

   if [ -n "$has_supervisor" ]; then
      log_step "⏳ Supervisor — terminating workers..."
      killall supervisord > /dev/null 2>&1 || true
      log_ok "Supervisor stopped"
   fi

   log_ok "Shutdown complete"
   printf '\n👋 👋 👋 👋 👋 👋 👋 👋 👋 👋\n👋 👋 👋 👋 👋 👋 👋 👋 👋 👋\n\n'
   exit 0
}

register_shutdown_handler() {
   trap 'shutdown_handler' SIGINT SIGQUIT SIGTERM
}

# Run any custom scripts that are mounted to /custom-scripts/before-boot
run_before_boot_hooks() {
   if [ ! -d "/custom-scripts/before-boot" ]; then
      return 0
   fi
   log_info "Running before-boot custom scripts..."
   for f in /custom-scripts/before-boot/*.sh; do
      [ -e "$f" ] || continue
      log_step "$f"
      bash "$f" || true
   done
}

# Run any custom scripts that are mounted to /custom-scripts/after-boot
run_after_boot_hooks() {
   if [ ! -d "/custom-scripts/after-boot" ]; then
      return 0
   fi
   log_info "Running after-boot custom scripts..."
   for f in /custom-scripts/after-boot/*.sh; do
      [ -e "$f" ] || continue
      log_step "$f"
      bash "$f" || true
   done
}

# Read laravel .env file into the global associative array LARAVEL_ENV
read_laravel_env() {
   declare -gA LARAVEL_ENV
   if [ -f "/app/.env" ]; then
      while IFS='=' read -r key value; do
         if [[ $key != "" && $key != \#* ]]; then
            LARAVEL_ENV[$key]=$value
         fi
      done < "/app/.env"
   fi
}

# wait forever
wait_forever() {
   while true; do
      tail -f /dev/null &
      wait ${!}
   done
}
