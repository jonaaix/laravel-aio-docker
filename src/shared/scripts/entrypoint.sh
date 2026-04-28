#!/bin/bash

# Init Claude config defaults if missing (e.g. fresh volume mount on ~/.claude)
if [ "$IMAGE_VARIANT" = "fpm-claude" ]; then
    mkdir -p /home/laravel/.claude
    cp /home/laravel/.claude-defaults/settings.json /home/laravel/.claude/settings.json
    cp /home/laravel/.claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md

    if [ "$DEV_ENABLE_CLAUDE_THREADS" = "true" ] && [ "$ENV_DEV" = "true" ]; then
        echo "" >> /home/laravel/.claude/CLAUDE.md
        cat /home/laravel/.claude-defaults/CLAUDE.threads.md >> /home/laravel/.claude/CLAUDE.md
    fi

    if [ "$DEV_ENABLE_CLAUDE_NONTECH_MODE" = "true" ] && [ "$ENV_DEV" = "true" ]; then
        echo "" >> /home/laravel/.claude/CLAUDE.md
        cat /home/laravel/.claude-defaults/CLAUDE.nontech.md >> /home/laravel/.claude/CLAUDE.md
    fi

    node /scripts/merge-mcp-servers.js
    node /scripts/merge-plugins.js
fi

echo "Running entrypoint.sh..."

echo "

██╗      █████╗ ██████╗  █████╗ ██╗   ██╗███████╗██╗          █████╗   ██╗   ██████╗
██║     ██╔══██╗██╔══██╗██╔══██╗██║   ██║██╔════╝██║         ██╔══██╗  ██║  ██╔═══██╗
██║     ███████║██████╔╝███████║██║   ██║█████╗  ██║         ███████║  ██║  ██║   ██║
██║     ██╔══██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║         ██╔══██║  ██║  ██║   ██║
███████╗██║  ██║██║  ██║██║  ██║ ╚████╔╝ ███████╗███████╗    ██║  ██║  ██║  ╚██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝    ╚═╝  ╚═╝  ╚═╝   ╚═════╝

"
echo
echo "User: $(whoami), UID: $(id -u)"
echo


shutdown_handler() {
   # NOTE: In the most recent Docker version, logging is disabled once stop signal received :( However it still works.
   echo "STOP signal received..."
   # Add any cleanup or graceful shutdown tasks here

   # Cache artisan command list once to avoid booting Laravel multiple times
   ARTISAN_COMMANDS=$(php artisan 2>/dev/null || true)

   # Stop services
   if echo "$ARTISAN_COMMANDS" | grep -q "horizon"; then
       echo "Terminating Laravel Horizon..."
       php artisan horizon:terminate || true
   fi

   if echo "$ARTISAN_COMMANDS" | grep -q "reverb"; then
       echo "Terminating Laravel Reverb..."
       php artisan reverb:restart || true
   fi

   if echo "$ARTISAN_COMMANDS" | grep -q "octane"; then
       echo "Stopping Laravel Octane..."
       php artisan octane:stop || true
   fi

   # Wait for Horizon workers to finish their current jobs before killing Supervisor
   # (compose stop_grace_period is 60s; cap at 50s to leave buffer for Supervisor shutdown).
   TIMEOUT=50
   while [ $TIMEOUT -gt 0 ] && pgrep -f "horizon:(work|supervisor)" > /dev/null; do
       sleep 1
       TIMEOUT=$((TIMEOUT - 1))
   done

   if pgrep supervisord > /dev/null; then
       echo "Killing Supervisor..."
       killall supervisord || true
   fi

   exit 0
}
trap 'shutdown_handler' SIGINT SIGQUIT SIGTERM

# Run any custom scripts that are mounted to /custom-scripts/before-boot
if [ -d "/custom-scripts/before-boot" ]; then
   echo "Running custom scripts..."
   for f in /custom-scripts/before-boot/*.sh; do
      echo "Running $f..."
      bash "$f" || true
   done
fi

# Enable xdebug if needed
if [ "$DEV_ENABLE_XDEBUG" = "true" ]; then
   if [ "$ENV_DEV" = "true" ]; then
      echo "Enabling Xdebug..."
      mv /usr/local/etc/php/conf.d/xdebug.ini.disabled /usr/local/etc/php/conf.d/xdebug.ini || true
   else
      echo "Disabling Xdebug..."
      if [ -f /usr/local/etc/php/conf.d/xdebug.ini ]; then
          mv /usr/local/etc/php/conf.d/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled
      fi
      echo "ERROR: Xdebug can only be enabled in DEV environment."
   fi
else
   echo "Disabling Xdebug..."
   if [ -f /usr/local/etc/php/conf.d/xdebug.ini ]; then
       mv /usr/local/etc/php/conf.d/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled
   fi
fi

# Render PHP-FPM pool tuning override from template with sensible auto-scaled defaults
# (pm.start_servers is omitted intentionally — PHP-FPM auto-calculates it as (min+max)/2).
if [ "$PHP_RUNTIME_CONFIG" = "fpm" ] && [ -f /usr/local/etc/php-fpm.d/zz-pool-tuning.conf.template ]; then
   export FPM_MAX_CHILDREN="${FPM_MAX_CHILDREN:-10}"
   MIN_SPARE_AUTO=$(( FPM_MAX_CHILDREN / 10 ))
   [ "$MIN_SPARE_AUTO" -lt 1 ] && MIN_SPARE_AUTO=1
   MAX_SPARE_AUTO=$(( FPM_MAX_CHILDREN / 3 ))
   [ "$MAX_SPARE_AUTO" -lt 3 ] && MAX_SPARE_AUTO=3
   export FPM_MIN_SPARE_SERVERS="${FPM_MIN_SPARE_SERVERS:-$MIN_SPARE_AUTO}"
   export FPM_MAX_SPARE_SERVERS="${FPM_MAX_SPARE_SERVERS:-$MAX_SPARE_AUTO}"
   # Make writable for re-render on container restart, then lock down again.
   chmod 644 /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   envsubst < /usr/local/etc/php-fpm.d/zz-pool-tuning.conf.template > /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   chmod 444 /usr/local/etc/php-fpm.d/zz-pool-tuning.conf
   echo "PHP-FPM pool: max_children=$FPM_MAX_CHILDREN, min_spare=$FPM_MIN_SPARE_SERVERS, max_spare=$FPM_MAX_SPARE_SERVERS (start auto)"
fi

# Start Nginx if not running
if ! pgrep "nginx" > /dev/null; then
   echo "Starting Nginx..."
   nginx &
else
    echo "Nginx is already running."
fi

# Skip Laravel boot
if [ "$SKIP_LARAVEL_BOOT" = "true" ]; then
   echo "Skipping Laravel boot..."

   # Start PHP-FPM if not running
   if ! pgrep "php-fpm" > /dev/null; then
      echo "Starting PHP-FPM..."
      php-fpm &
   else
       echo "PHP-FPM is already running."
   fi

   # wait forever
   while true; do
      tail -f /dev/null &
      wait ${!}
   done
fi

cd /app || exit 1

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
else
    echo "Laravel application found in /app."
fi

if [ "$ENABLE_DOCKERFILE_STRATEGY" = "true" ]; then
   echo "Dockerfile strategy enabled (ENABLE_DOCKERFILE_STRATEGY=true). Skipping Composer install, NPM install and NPM build..."
   composer run-script post-autoload-dump --no-interaction
   echo "=================================="
   echo "=== post-autoload-dump done.   ==="
   echo "=================================="
fi

# Check and generate APP_KEY if needed
if [ -f "/app/.env" ]; then
    APP_KEY=$(grep -E "^APP_KEY=" /app/.env | cut -d '=' -f2- | xargs)
    if [ -z "$APP_KEY" ]; then
        echo "APP_KEY is empty. Generating new application key..."
        if php artisan key:generate; then
            echo "============================"
            echo "===  APP_KEY generated   ==="
            echo "============================"
        else
            echo "ERROR: Failed to generate APP_KEY. Please check your Laravel installation."
            exit 1
        fi
    else
        echo "APP_KEY is already set."
    fi
else
    echo "No .env file found. Skipping APP_KEY generation."
fi

# Create cache paths: mkdir -p storage/framework/{sessions,views,cache}
echo "Creating cache paths..."
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/framework/cache

echo "Creating log paths..."
mkdir -p storage/logs/supervisor

echo "============================"
echo "===  Cache paths created ==="
echo "============================"


# Fix storage permissions
echo "Fixing storage and cache permissions to allow writing for www-data..."
chown -R $USER:www-data storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 775 {} \;
find storage bootstrap/cache -type f -exec chmod 664 {} \;

# Laravel Passport OAuth keys require 600 — Passport refuses keys with looser permissions.
chmod 600 storage/oauth-*.key 2>/dev/null || true

if [ -f "database/database.sqlite" ]; then
    chown $USER:www-data database/database.sqlite
    chmod 664 database/database.sqlite
fi

echo "============================"
echo "===  Permissions fixed   ==="
echo "============================"

# Start PHP-FPM earlier to allow rendering of maintenance page
if [ "$PHP_RUNTIME_CONFIG" = "fpm" ]; then
   # Start PHP-FPM if not running
   if ! pgrep "php-fpm" > /dev/null; then
      echo "Starting PHP-FPM..."
      php-fpm &
   else
       echo "PHP-FPM is already running."
   fi
fi

# Enable maintenance mode if requested
MAINTENANCE_MODE_ENABLED=false
if [ "$ENABLE_MAINTENANCE_BOOT" = "true" ]; then
   # Only enable maintenance mode if vendor directory exists (skip on initial deployment)
   if [ -f "vendor/autoload.php" ]; then
      echo "Enabling maintenance mode..."

      # Build the maintenance command arguments array
      MAINTENANCE_ARGS=("down")

      # Add render option (use custom or default)
      if [ -n "$MAINTENANCE_RENDER" ]; then
         MAINTENANCE_ARGS+=("--render=$MAINTENANCE_RENDER")
      else
         MAINTENANCE_ARGS+=("--render=errors::503")
      fi

      # Add secret option (use custom or generate automatically)
      if [ -n "$MAINTENANCE_SECRET" ]; then
         MAINTENANCE_ARGS+=("--secret=$MAINTENANCE_SECRET")
      else
         MAINTENANCE_ARGS+=("--with-secret")
      fi

      # Add retry option (use custom or default)
      if [ -n "$MAINTENANCE_RETRY" ]; then
         # Validate that MAINTENANCE_RETRY is a number
         if [[ "$MAINTENANCE_RETRY" =~ ^[0-9]+$ ]]; then
            MAINTENANCE_ARGS+=("--retry=$MAINTENANCE_RETRY")
         else
            echo "WARNING: MAINTENANCE_RETRY must be a number. Using default value of 10."
            MAINTENANCE_ARGS+=("--retry=10")
         fi
      else
         MAINTENANCE_ARGS+=("--retry=10")
      fi

      # Execute the maintenance command
      if php artisan "${MAINTENANCE_ARGS[@]}"; then
         MAINTENANCE_MODE_ENABLED=true
         echo "============================"
         echo "=== Maintenance enabled  ==="
         echo "============================"
      else
         echo "WARNING: Failed to enable maintenance mode"
      fi
   else
      echo "vendor/autoload.php not found. Skipping maintenance mode (initial deployment)."
   fi
fi

if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
   echo "Installing Composer..."
   if [ "$ENV_DEV" = "true" ]; then
      if [ ! -d "vendor" ]; then
         composer install --optimize-autoloader --no-interaction --prefer-dist
      else
         echo "vendor already exists. Skipping composer install."
      fi
   else
      composer install --optimize-autoloader --no-interaction --no-progress --prefer-dist
   fi
   echo "=========================="
   echo "=== Composer installed ==="
   echo "=========================="
fi
echo
echo "PHP runtime configuration: $PHP_RUNTIME_CONFIG"
echo

if [ "$PHP_RUNTIME_CONFIG" = "frankenphp" ]; then
   # check if laravel/octane is installed
   if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
      if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
         echo "Laravel Octane/FrankenPHP is not installed. Installing..."
         composer require laravel/octane --no-interaction --prefer-dist
         php artisan octane:install --server=frankenphp --no-interaction
      else
         echo "Laravel Octane is already installed."
      fi

      npm install --save-dev chokidar
   fi

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi

if [ "$PHP_RUNTIME_CONFIG" = "roadrunner" ]; then
   # check if laravel/octane is installed
   if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
      if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
         echo "Laravel Octane/Roadrunner is not installed. Installing..."
         composer require laravel/octane --no-interaction --prefer-dist
         php artisan octane:install --server=roadrunner --no-interaction
      else
         echo "Laravel Octane is already installed."
      fi

      npm install --save-dev chokidar
   fi

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi

if [ "$PHP_RUNTIME_CONFIG" = "swoole" ]; then
   # check if laravel/octane is installed
   if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
      if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
         echo "Laravel Octane/Swoole is not installed. Installing..."
         composer require laravel/octane --no-interaction --prefer-dist
         php artisan octane:install --server=swoole --no-interaction
      else
         echo "Laravel Octane is already installed."
      fi

      npm install --save-dev chokidar
   fi

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi


if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
   echo "Installing NPM..."
   if [ "$ENV_DEV" = "true" ]; then
      if [ ! -d "node_modules" ]; then
         npm install --no-audit
      elif [ "$DEV_FORCE_NPM_INSTALL" = "true" ]; then
         npm install --no-audit
      else
         echo "node_modules already exists. Skipping npm install."
      fi
   else
      npm install --no-audit
   fi
   echo "=========================="
   echo "===   NPM installed    ==="
   echo "=========================="
fi


if [ "$ENABLE_DOCKERFILE_STRATEGY" != "true" ]; then
   echo "Building NPM..."
   if [ "$ENV_DEV" != "true" ]; then
      npm run build
   fi
   echo "=========================="
   echo "===     NPM built      ==="
   echo "=========================="
fi


echo "Optimizing Laravel..."
if [ "$ENV_DEV" = "true" ]; then
   php artisan optimize:clear
else
   if [ "$PROD_SKIP_OPTIMIZE" = "true" ]; then
      echo "Skipping Laravel optimization..."
   else
      php artisan optimize:clear
      php artisan optimize
   fi
fi
echo "============================"
echo "===  Laravel optimized   ==="
echo "============================"

echo "Optimizing Laravel Filament..."
if php artisan | grep -q "filament"; then
   if [ "$ENV_DEV" = "true" ]; then
      php artisan filament:optimize-clear
   else
      php artisan filament:optimize-clear
      php artisan filament:optimize
   fi
fi
echo "============================"
echo "===  Filament optimized  ==="
echo "============================"

# Blade Icons cache — critical for performance in production (dev: up to the developer)
if [ "$ENV_DEV" != "true" ] && php artisan | grep -q "icons:cache"; then
   echo "Caching Blade icons..."
   php artisan icons:cache
   echo "============================"
   echo "===   Icons cached       ==="
   echo "============================"
fi

echo "Migrating database..."
if [ "$ENV_DEV" = "true" ]; then
   echo "No automatic migrations will run with ENV_DEV=true."
else
   if [ "$PROD_RUN_ARTISAN_MIGRATE" = "true" ]; then
      php artisan migrate --force
   else
      echo "Automatic migrations are disabled..."
   fi
fi
echo "============================"
echo "=== Migrations completed ==="
echo "============================"


echo "Seeding database..."
if [ "$ENV_DEV" = "true" ]; then
   echo "No automatic seeding will run with ENV_DEV=true."
else
   if [ "$PROD_RUN_ARTISAN_DBSEED" = "true" ]; then
      php artisan db:seed --force
   else
      echo "Automatic seeding is disabled..."
   fi
fi
echo "============================"
echo "===   Seeding completed  ==="
echo "============================"


# Start cron in foreground with minimal logging (level 1)
crond start -f -l 1 &
echo "============================"
echo "=== Cron service started ==="
echo "============================"


# Read laravel .env file
if [ -f "/app/.env" ]; then
   declare -A LARAVEL_ENV
   while IFS='=' read -r key value; do
      if [[ $key != "" && $key != \#* ]]; then
         LARAVEL_ENV[$key]=$value
      fi
   done < "/app/.env"
fi

cat /etc/supervisor/conf.d/supervisor-header.conf > /etc/supervisor/conf.d/laravel-worker-compiled.conf

echo "Adding supercronic supervisor config..."
echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
cat /etc/supervisor/conf.d/supercronic-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

echo "============================"
echo "=== Supercronic added    ==="
echo "============================"

echo "Adding schedule supervisor config..."
echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
cat /etc/supervisor/conf.d/schedule-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

echo "=================================="
echo "===   Schedule Worker added    ==="
echo "=================================="

if [ "$ENABLE_QUEUE_WORKER" = "true" ]; then
   echo "Adding queue supervisor config..."
   echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   cat /etc/supervisor/conf.d/queue-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

   echo "============================"
   echo "===  Queue Worker added  ==="
   echo "============================"
fi

if [ "$ENABLE_HORIZON_WORKER" = "true" ]; then
   echo "Adding horizon supervisor config..."
   echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   cat /etc/supervisor/conf.d/horizon-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

   echo "============================"
   echo "===    Horizon added     ==="
   echo "============================"
fi

if [ "$ENABLE_REVERB_SERVER" = "true" ]; then
   echo "Adding reverb supervisor config..."
   echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   cat /etc/supervisor/conf.d/reverb-server.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

   echo "============================"
   echo "===     Reverb added     ==="
   echo "============================"
fi

if [ "$IMAGE_VARIANT" = "fpm-claude" ] && [ "$DEV_ENABLE_CLAUDE_THREADS" = "true" ] && [ "$ENV_DEV" = "true" ]; then
   echo "Adding claude-threads supervisor config..."
   echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   cat /etc/supervisor/conf.d/claude-threads.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

   echo "============================"
   echo "=== claude-threads added ==="
   echo "============================"
fi

if [ "$DEV_NPM_RUN_DEV" = "true" ] && [ "$ENV_DEV" = "true" ]; then
   echo "Adding Vite dev server supervisor config..."
   echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   cat /etc/supervisor/conf.d/vite-dev-server.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

   echo "============================"
   echo "===   Vite dev added     ==="
   echo "============================"
fi

if [ "$PHP_RUNTIME_CONFIG" != "fpm" ]; then
   OCTANE_SERVER=${LARAVEL_ENV[OCTANE_SERVER]}

   if [ -z "$OCTANE_SERVER" ]; then
      # Try to read from config/octane.php
      OCTANE_SERVER=$(grep -E 'env\(\s*["'"'"']OCTANE_SERVER["'"'"']\s*,\s*["'"'"'][^"'"'"']+["'"'"']' config/octane.php | sed -E 's/.*OCTANE_SERVER["'"'"']\s*,\s*["'"'"']([^"'"'"']+)["'"'"'].*/\1/')
   fi

   if [ -z "$OCTANE_SERVER" ]; then
      echo "ERROR: Could not <OCTANE_SERVER> in .env or config/octane.php."
      exit 1
   fi

   if [ "$PHP_RUNTIME_CONFIG" != "$OCTANE_SERVER" ]; then
      echo "ERROR: Mismatch between PHP_RUNTIME_CONFIG ($PHP_RUNTIME_CONFIG) and LARAVEL_ENV[OCTANE_SERVER] ($OCTANE_SERVER)."
      echo "Please ensure they are consistent."
      exit 1
   fi

   echo "Adding Octane supervisor config..."
   if [ "$ENV_DEV" = "true" ]; then
      cat /etc/supervisor/conf.d/octane-worker-dev.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   else
      # Best practice for Octane: 2x CPU cores (Laravel runs blocking PHP, so I/O waits stall workers).
      export OCTANE_WORKERS=$(( $(nproc) * 2 ))
      echo "Octane workers: $OCTANE_WORKERS ($(nproc) cores * 2)"
      cat /etc/supervisor/conf.d/octane-worker-prod.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
   fi
   echo "============================"
   echo "===     Octane added     ==="
   echo "============================"
else
   echo "PHP_RUNTIME_CONFIG is set to <fpm>. Skipping Octane start."
fi

supervisord -n -c /etc/supervisor/conf.d/laravel-worker-compiled.conf &

echo "============================"
echo "===  Supervisor started  ==="
echo "============================"

echo "============================"
echo "===      PHP READY       ==="
echo "============================"

# Run any custom scripts that are mounted to /custom-scripts/after-boot
if [ -d "/custom-scripts/after-boot" ]; then
   echo "Running custom scripts..."
   for f in /custom-scripts/after-boot/*.sh; do
      echo "Running $f..."
      bash "$f" || true
   done
fi

# Disable maintenance mode if it was enabled
if [ "$MAINTENANCE_MODE_ENABLED" = "true" ]; then
   if [ -f "vendor/autoload.php" ]; then
      echo "Disabling maintenance mode..."
      if php artisan up; then
         echo "============================"
         echo "=== Maintenance disabled ==="
         echo "============================"
      else
         echo "WARNING: Failed to disable maintenance mode"
      fi
   else
      echo "WARNING: Cannot disable maintenance mode - vendor/autoload.php not found"
   fi
fi

# wait forever
while true; do
   tail -f /dev/null &
   wait ${!}
done
