# Service starters: Nginx, PHP-FPM, cron.

# Render the Nginx vhost from its template, substituting the configurable listen port.
# HTTP_PORT defaults to 8000; set it to keep host/container port mapping symmetric.
# Rendered fresh on every boot from the .template, so it stays idempotent across restarts.
render_nginx_conf() {
   local target="/etc/nginx/http.d/default.conf"
   local template="${target}.template"
   [ -f "$template" ] || return 0

   # If a project bind-mounted its own vhost onto default.conf, never render over it —
   # the redirect below would truncate and write *through* the mount, destroying the
   # project's source file on the host. /proc/mounts lists every bind mount as its own
   # entry; the path is canonicalized, so resolve the conf.d symlink (claude image) too.
   local canonical
   canonical="$(readlink -f "$target" 2>/dev/null || echo "$target")"
   if grep -qE "[[:space:]](${target}|${canonical})[[:space:]]" /proc/mounts 2>/dev/null; then
      log_skip "Custom Nginx vhost mounted — skipping render (HTTP_PORT not applied)"
      return 0
   fi

   local port="${HTTP_PORT:-8000}"
   case "$port" in
      ''|*[!0-9]*)
         log_error "HTTP_PORT must be a positive integer (got '${HTTP_PORT}'); falling back to 8000"
         port=8000
         ;;
   esac

   sed "s/__HTTP_PORT__/${port}/g" "$template" > "$target"
   log_ok "Nginx listening on port ${port}"
}

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
