# Laravel application boot lifecycle: env, cache paths, permissions, composer,
# npm, optimize, migrate, seed, maintenance mode.
#
# All Laravel-dependent functions self-gate on SKIP_LARAVEL_BOOT — when that env is
# "true", the driver still runs through every phase but Laravel-bound steps no-op
# silently. This keeps Laravel-independent steps (nginx, supercronic, claude-threads)
# alive while skipping anything that needs a booted application.

# Announce skip-boot mode once at the top of the boot sequence.
handle_skip_laravel_boot() {
   if [ "$SKIP_LARAVEL_BOOT" = "true" ]; then
      log_warn "SKIP_LARAVEL_BOOT=true — Laravel-dependent steps will be skipped"
   fi
}

# Check if the Laravel application is present in /app, exit otherwise.
verify_laravel_app() {
   cd /app 2>/dev/null || true
   if [ "$SKIP_LARAVEL_BOOT" = "true" ]; then
      return 0
   fi
   if [ ! -f "/app/artisan" ]; then
      log_error "No Laravel application found in /app. Exiting..."
      exit 1
   fi
   log_ok "Laravel application found in /app"
}

run_post_autoload_dump() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
      return 0
   fi
   log_info "Dockerfile strategy enabled (ENABLE_DOCKERFILE_STRATEGY=true). Skipping Composer install, NPM install and NPM build..."
   composer run-script post-autoload-dump --no-interaction
   log_ok "post-autoload-dump done"
}

# Check and generate APP_KEY if needed
ensure_app_key() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ ! -f "/app/.env" ]; then
      log_skip "No .env file found, skipping APP_KEY generation"
      return 0
   fi
   local app_key
   app_key=$(grep -E "^APP_KEY=" /app/.env | cut -d '=' -f2- | xargs)
   if [ -n "$app_key" ]; then
      log_skip "APP_KEY is already set"
      return 0
   fi
   log_info "APP_KEY is empty. Generating new application key..."
   if php artisan key:generate; then
      log_ok "APP_KEY generated"
   else
      log_error "Failed to generate APP_KEY. Please check your Laravel installation."
      exit 1
   fi
}

# Create cache paths: mkdir -p storage/framework/{sessions,views,cache}
create_cache_paths() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_info "Creating cache paths..."
   mkdir -p storage/framework/sessions
   mkdir -p storage/framework/views
   mkdir -p storage/framework/cache
   mkdir -p storage/logs/supervisor
   log_ok "Cache and log paths created"
}

# Fix storage permissions
fix_permissions() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_info "Fixing storage and cache permissions to allow writing for www-data..."
   chown -R "$USER:www-data" storage bootstrap/cache
   find storage bootstrap/cache -type d -exec chmod 775 {} \;
   find storage bootstrap/cache -type f -exec chmod 664 {} \;

   # Laravel Passport OAuth keys require 600 — Passport refuses keys with looser permissions.
   chmod 600 storage/oauth-*.key 2>/dev/null || true

   if [ -f "database/database.sqlite" ]; then
      chown "$USER:www-data" database/database.sqlite
      chmod 664 database/database.sqlite
   fi
   log_ok "Permissions fixed"
}

# Enable maintenance mode if requested. Sets MAINTENANCE_MODE_ENABLED=true on success.
enable_maintenance_mode() {
   MAINTENANCE_MODE_ENABLED=false
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_MAINTENANCE_BOOT" != "true" ]; then
      return 0
   fi
   # Only enable maintenance mode if vendor directory exists (skip on initial deployment)
   if [ ! -f "vendor/autoload.php" ]; then
      log_skip "vendor/autoload.php not found — skipping maintenance mode (initial deployment)"
      return 0
   fi
   log_info "Enabling maintenance mode..."

   # Build the maintenance command arguments array
   local args=("down")

   # Add render option (use custom or default)
   if [ -n "$MAINTENANCE_RENDER" ]; then
      args+=("--render=$MAINTENANCE_RENDER")
   else
      args+=("--render=errors::503")
   fi

   # Add secret option (use custom or generate automatically)
   if [ -n "$MAINTENANCE_SECRET" ]; then
      args+=("--secret=$MAINTENANCE_SECRET")
   else
      args+=("--with-secret")
   fi

   # Add retry option (use custom or default)
   if [ -n "$MAINTENANCE_RETRY" ]; then
      # Validate that MAINTENANCE_RETRY is a number
      if [[ "$MAINTENANCE_RETRY" =~ ^[0-9]+$ ]]; then
         args+=("--retry=$MAINTENANCE_RETRY")
      else
         log_warn "MAINTENANCE_RETRY must be a number. Using default value of 10."
         args+=("--retry=10")
      fi
   else
      args+=("--retry=10")
   fi

   # Execute the maintenance command
   if php artisan "${args[@]}"; then
      MAINTENANCE_MODE_ENABLED=true
      log_ok "Maintenance enabled"
   else
      log_warn "Failed to enable maintenance mode"
   fi
}

# Disable maintenance mode if it was enabled
disable_maintenance_mode() {
   if [ "$MAINTENANCE_MODE_ENABLED" != "true" ]; then
      return 0
   fi
   if [ ! -f "vendor/autoload.php" ]; then
      log_warn "Cannot disable maintenance mode — vendor/autoload.php not found"
      return 0
   fi
   log_info "Disabling maintenance mode..."
   if php artisan up; then
      log_ok "Maintenance disabled"
   else
      log_warn "Failed to disable maintenance mode"
   fi
}

composer_install() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_DOCKERFILE_STRATEGY" = "true" ]; then
      return 0
   fi
   log_info "Installing Composer..."
   if [ "$ENV_DEV" = "true" ]; then
      if [ -d "vendor" ]; then
         log_skip "vendor already exists, skipping composer install"
         return 0
      fi
      composer install --optimize-autoloader --no-interaction --prefer-dist
   else
      composer install --optimize-autoloader --no-interaction --no-progress --prefer-dist
   fi
   log_ok "Composer installed"
}

npm_install() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_DOCKERFILE_STRATEGY" = "true" ]; then
      return 0
   fi
   log_info "Installing NPM..."
   if [ "$ENV_DEV" = "true" ]; then
      if [ ! -d "node_modules" ]; then
         npm install --no-audit
      elif [ "$DEV_FORCE_NPM_INSTALL" = "true" ]; then
         npm install --no-audit
      else
         log_skip "node_modules already exists, skipping npm install"
         return 0
      fi
   else
      npm install --no-audit
   fi
   log_ok "NPM installed"
}

npm_build() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENABLE_DOCKERFILE_STRATEGY" = "true" ]; then
      return 0
   fi
   if [ "$ENV_DEV" = "true" ]; then
      log_skip "ENV_DEV=true, skipping npm build"
      return 0
   fi
   log_info "Building NPM..."
   npm run build
   log_ok "NPM built"
}

optimize_laravel() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_info "Optimizing Laravel..."
   if [ "$ENV_DEV" = "true" ]; then
      php artisan optimize:clear
   else
      if [ "$PROD_SKIP_OPTIMIZE" = "true" ]; then
         log_skip "PROD_SKIP_OPTIMIZE=true, skipping Laravel optimization"
         return 0
      fi
      php artisan optimize:clear
      php artisan optimize
   fi
   log_ok "Laravel optimized"
}

optimize_filament() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if ! php artisan | grep -q "filament"; then
      return 0
   fi
   log_info "Optimizing Laravel Filament..."
   if [ "$ENV_DEV" = "true" ]; then
      php artisan filament:optimize-clear
   else
      php artisan filament:optimize-clear
      php artisan filament:optimize
   fi
   log_ok "Filament optimized"
}

# Blade Icons cache — critical for performance in production (dev: up to the developer)
cache_blade_icons() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   if [ "$ENV_DEV" = "true" ]; then
      return 0
   fi
   if ! php artisan | grep -q "icons:cache"; then
      return 0
   fi
   log_info "Caching Blade icons..."
   php artisan icons:cache
   log_ok "Icons cached"
}

run_migrations() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_info "Migrating database..."
   if [ "$ENV_DEV" = "true" ]; then
      log_skip "ENV_DEV=true, no automatic migrations"
      return 0
   fi
   if [ "$PROD_RUN_ARTISAN_MIGRATE" != "true" ]; then
      log_skip "Automatic migrations disabled (PROD_RUN_ARTISAN_MIGRATE != true)"
      return 0
   fi
   php artisan migrate --force
   log_ok "Migrations completed"
}

run_seeds() {
   [ "$SKIP_LARAVEL_BOOT" != "true" ] || return 0
   log_info "Seeding database..."
   if [ "$ENV_DEV" = "true" ]; then
      log_skip "ENV_DEV=true, no automatic seeding"
      return 0
   fi
   if [ "$PROD_RUN_ARTISAN_DBSEED" != "true" ]; then
      log_skip "Automatic seeding disabled (PROD_RUN_ARTISAN_DBSEED != true)"
      return 0
   fi
   php artisan db:seed --force
   log_ok "Seeding completed"
}
