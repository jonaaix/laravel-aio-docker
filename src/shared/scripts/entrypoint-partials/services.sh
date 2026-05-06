# Service starters: Nginx, PHP-FPM, cron.

# Start Nginx if not running
start_nginx() {
   if ! pgrep "nginx" > /dev/null; then
      log_ok "Starting Nginx..."
      nginx &
   else
      log_skip "Nginx is already running"
   fi
}

# Start PHP-FPM if not running (only relevant for fpm runtime).
start_php_fpm() {
   [ "$PHP_RUNTIME_CONFIG" = "fpm" ] || return 0

   if ! pgrep "php-fpm" > /dev/null; then
      log_ok "Starting PHP-FPM..."
      php-fpm &
   else
      log_skip "PHP-FPM is already running"
   fi
}

# Start cron in foreground with minimal logging (level 1).
# BusyBox crond exists in Alpine variants; on Debian it's absent and supercronic runs via supervisor.
start_cron() {
   if command -v crond >/dev/null 2>&1; then
      crond start -f -l 1 &
      log_ok "Cron service started (BusyBox crond)"
   else
      log_skip "BusyBox crond not present (Debian variant) — supercronic runs via supervisor"
   fi
}
