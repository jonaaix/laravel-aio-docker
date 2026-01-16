#!/bin/bash

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

   if pgrep supervisord > /dev/null; then
       echo "Killing Supervisor..."
       killall supervisord || true
   fi

   if php artisan | grep -q "octane"; then
       echo "Stopping Laravel Octane..."
       php artisan octane:stop || true
   fi

   if php artisan | grep -q "horizon"; then
       echo "Terminating Laravel Horizon..."
       php artisan horizon:terminate || true
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

# Starting earlier to allow hosting non-Laravel apps
if [ "$PHP_RUNTIME_CONFIG" = "fpm" ]; then
   # Start PHP-FPM if not running
   if ! pgrep "php-fpm" > /dev/null; then
      echo "Starting PHP-FPM..."
      php-fpm &
   else
       echo "PHP-FPM is already running."
   fi
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
   # wait forever
   while true; do
      tail -f /dev/null &
      wait ${!}
   done
fi

cd /app || exit 1

echo "alias pa=\"php artisan\"; alias ll=\"ls -lsah\"" > ~/.bashrc

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
else
    echo "Laravel application found in /app."
fi

# Check and generate APP_KEY if needed
if [ -f "/app/.env" ]; then
    APP_KEY=$(grep -E "^APP_KEY=" /app/.env | cut -d '=' -f2- | xargs)
    if [ -z "$APP_KEY" ]; then
        echo "APP_KEY is empty. Generating new application key..."
        php artisan key:generate
        echo "============================"
        echo "===  APP_KEY generated   ==="
        echo "============================"
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

if [ -f "database/database.sqlite" ]; then
    chown $USER:www-data database/database.sqlite
    chmod 664 database/database.sqlite
fi

echo "============================"
echo "===  Permissions fixed   ==="
echo "============================"


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
echo
echo "PHP runtime configuration: $PHP_RUNTIME_CONFIG"
echo

if [ "$PHP_RUNTIME_CONFIG" = "frankenphp" ]; then
   # check if laravel/octane is installed
   if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
       echo "Laravel Octane/FrankenPHP is not installed. Installing..."
       composer require laravel/octane --no-interaction --prefer-dist
       php artisan octane:install --server=frankenphp --no-interaction
   else
       echo "Laravel Octane is already installed."
   fi

   npm install --save-dev chokidar

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi

if [ "$PHP_RUNTIME_CONFIG" = "roadrunner" ]; then
   # check if laravel/octane is installed
   if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
      echo "Laravel Octane/Roadrunner is not installed. Installing..."
      composer require laravel/octane --no-interaction --prefer-dist
      php artisan octane:install --server=roadrunner --no-interaction
   else
       echo "Laravel Octane is already installed."
   fi

   npm install --save-dev chokidar

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi

if [ "$PHP_RUNTIME_CONFIG" = "swoole" ]; then
   # check if laravel/octane is installed
   if ! jq -e '.require["laravel/octane"] // .["require-dev"]?["laravel/octane"]' composer.json; then
      echo "Laravel Octane/Swoole is not installed. Installing..."
      composer require laravel/octane --no-interaction --prefer-dist
      php artisan octane:install --server=swoole --no-interaction
   else
       echo "Laravel Octane is already installed."
   fi

   npm install --save-dev chokidar

   echo "=========================="
   echo "===  Octane installed  ==="
   echo "=========================="
fi


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


echo "Building NPM..."
if [ "$ENV_DEV" = "true" ]; then
   if [ "$DEV_NPM_RUN_DEV" = "true" ]; then
      npm run dev -- --host &
   else
      echo "Skipping DEV-Server..."
   fi
else
   npm run build
fi
echo "=========================="
echo "===     NPM built      ==="
echo "=========================="


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


echo "Optimizing Laravel..."
if [ "$ENV_DEV" = "true" ]; then
   php artisan optimize:clear
   php artisan view:clear
   php artisan config:clear
   php artisan route:clear
else
   if [ "$PROD_SKIP_OPTIMIZE" = "true" ]; then
      echo "Skipping Laravel optimization..."
   else
      php artisan optimize
      php artisan view:cache
      php artisan config:cache
      php artisan route:cache
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
      php artisan filament:optimize
   fi
fi
echo "============================"
echo "===  Filament optimized  ==="
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

# wait forever
while true; do
   tail -f /dev/null &
   wait ${!}
done
