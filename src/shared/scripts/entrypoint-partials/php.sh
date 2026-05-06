# PHP runtime configuration: xdebug toggle, FPM pool tuning.

# Enable xdebug if needed
configure_xdebug() {
   if [ "$DEV_ENABLE_XDEBUG" = "true" ]; then
      if [ "$ENV_DEV" = "true" ]; then
         log_ok "Enabling Xdebug..."
         mv /usr/local/etc/php/conf.d/xdebug.ini.disabled /usr/local/etc/php/conf.d/xdebug.ini || true
         return 0
      fi
      log_error "Xdebug can only be enabled in DEV environment."
   fi
   _xdebug_disable
   log_skip "Xdebug disabled"
}

_xdebug_disable() {
   if [ -f /usr/local/etc/php/conf.d/xdebug.ini ]; then
      mv /usr/local/etc/php/conf.d/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled
   fi
}

# Render PHP-FPM pool tuning override from template with sensible auto-scaled defaults
# (pm.start_servers is omitted intentionally — PHP-FPM auto-calculates it as (min+max)/2).
tune_php_fpm_pool() {
   if [ "$PHP_RUNTIME_CONFIG" != "fpm" ]; then
      return 0
   fi
   if [ ! -f /usr/local/etc/php-fpm.d/zz-pool-tuning.conf.template ]; then
      return 0
   fi
   export FPM_MAX_CHILDREN="${FPM_MAX_CHILDREN:-10}"
   local min_spare_auto=$(( FPM_MAX_CHILDREN / 10 ))
   [ "$min_spare_auto" -lt 1 ] && min_spare_auto=1
   local max_spare_auto=$(( FPM_MAX_CHILDREN / 3 ))
   [ "$max_spare_auto" -lt 3 ] && max_spare_auto=3
   export FPM_MIN_SPARE_SERVERS="${FPM_MIN_SPARE_SERVERS:-$min_spare_auto}"
   export FPM_MAX_SPARE_SERVERS="${FPM_MAX_SPARE_SERVERS:-$max_spare_auto}"
   # Make writable for re-render on container restart, then lock down again.
   chmod 644 /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   envsubst < /usr/local/etc/php-fpm.d/zz-pool-tuning.conf.template > /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   chmod 444 /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   log_ok "PHP-FPM pool: max_children=$FPM_MAX_CHILDREN, min_spare=$FPM_MIN_SPARE_SERVERS, max_spare=$FPM_MAX_SPARE_SERVERS (start auto)"
}
