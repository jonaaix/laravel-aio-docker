# Laravel Octane installation. Self-gates on PHP_RUNTIME_CONFIG (frankenphp / roadrunner / swoole).
ensure_octane_installed() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   [ "$PHP_RUNTIME_CONFIG" != "fpm" ] || return 0

   if [ "$ENABLE_DOCKERFILE_STRATEGY" = "true" ]; then
      return 0
   fi
   local server="$PHP_RUNTIME_CONFIG"
   # check if laravel/octane is installed
   if jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json > /dev/null; then
      log_skip "Laravel Octane is already installed"
   else
      log_info "Laravel Octane/$server is not installed. Installing..."
      composer require laravel/octane --no-interaction --prefer-dist
      php artisan octane:install --server="$server" --no-interaction
   fi
   npm install --save-dev chokidar
   log_ok "Octane installed"
}
