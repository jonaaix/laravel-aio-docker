# Banner, user info, shutdown handler, custom-script hooks, env-file reading, wait-forever.

print_banner() {
   cat <<'BANNER'

██╗      █████╗ ██████╗  █████╗ ██╗   ██╗███████╗██╗          █████╗   ██╗   ██████╗
██║     ██╔══██╗██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██╔══██╗  ██║  ██╔═══██╗
██║     ███████║██████╔╝███████║██║   ██║█████╗  ██║         ███████║  ██║  ██║   ██║
██║     ██╔══██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██╔══██║  ██║  ██║   ██║
███████╗██║  ██║██║  ██║██║  ██║ ╚████╔╝ ███████╗███████╗    ██║  ██║  ██║  ╚██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝    ╚═╝  ╚═╝  ╚═╝   ╚═════╝

BANNER
   log_info "User: $(whoami), UID: $(id -u)"
   log_info "Image variant: ${IMAGE_VARIANT:-unknown} (runtime: ${PHP_RUNTIME_CONFIG:-unknown})"
}

shutdown_handler() {
   # NOTE: In the most recent Docker version, logging is disabled once stop signal received :( However it still works.
   log_warn "STOP signal received..."

   # Cache artisan command list once to avoid booting Laravel multiple times
   local artisan_commands
   artisan_commands=$(php artisan 2>/dev/null || true)

   if echo "$artisan_commands" | grep -q "horizon"; then
      log_step "Terminating Laravel Horizon..."
      php artisan horizon:terminate || true
   fi

   if echo "$artisan_commands" | grep -q "reverb"; then
      log_step "Terminating Laravel Reverb..."
      php artisan reverb:restart || true
   fi

   if echo "$artisan_commands" | grep -q "octane"; then
      log_step "Stopping Laravel Octane..."
      php artisan octane:stop || true
   fi

   # Wait for Horizon workers to finish their current jobs before killing Supervisor
   # (compose stop_grace_period is 60s; cap at 50s to leave buffer for Supervisor shutdown).
   local timeout=50
   while [ $timeout -gt 0 ] && pgrep -f "horizon:(work|supervisor)" > /dev/null; do
      sleep 1
      timeout=$((timeout - 1))
   done

   if pgrep supervisord > /dev/null; then
      log_step "Killing Supervisor..."
      killall supervisord || true
   fi

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
