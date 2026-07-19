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

   # Hand the whole shutdown to Supervisor. On SIGTERM it stops every managed program with
   # that program's stopsignal + stopwaitsecs and does NOT restart them. This MUST happen
   # first: while supervisord is alive, autorestart=true immediately respawns any worker we
   # stop ourselves, and the respawn reconnects to a Redis that may already be going away
   # (the source of the "PHP only stops via kill" hangs). Laravel workers (horizon, queue,
   # reverb, octane) handle SIGTERM by finishing their current job and exiting, so this is
   # graceful and loses no in-flight work; Horizon metrics snapshots live in Redis already.
   # No script-side cap is imposed — stopwaitsecs is 3600s, so Docker's stop_grace_period is
   # the real ceiling and governs how long the queue may take to drain.
   if pgrep supervisord > /dev/null; then
      log_wait "Stopping Supervisor and all managed workers (SIGTERM, graceful)..."
      killall supervisord 2>/dev/null || true
      while pgrep supervisord > /dev/null; do
         sleep 1
      done
      log_ok "All workers stopped"
   else
      log_ok "Supervisor not running — nothing to stop"
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
