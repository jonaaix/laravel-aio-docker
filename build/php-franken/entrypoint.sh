#!/bin/sh

echo "Running entrypoint.sh..."

shutdown_handler() {
   # NOTE: In the most recent Docker version, logging is disabled once stop signal received :( However it still works.
   echo "STOP signal received..."
   # Add any cleanup or graceful shutdown tasks here

   echo "Killing Supervisor..."
   killall supervisord || true

   echo "Stopping Laravel Octane..."
   php artisan octane:stop || true

   echo "Terminating Laravel Horizon..."
   php artisan horizon:terminate || true

   if [ "$START_REDIS" = "true" ]; then
      echo "Creating Redis snapshot..."
      redis-cli -a $REDIS_PASS SAVE
   fi

   exit 0
}
trap 'shutdown_handler' SIGINT SIGQUIT SIGTERM

cd /app || exit 1

echo "alias pa=\"php artisan\"" > ~/.bashrc

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
else
    echo "Laravel application found in /app."
fi


# Start Redis if not running
if [ "$START_REDIS" = "true" ]; then
   if ! pgrep "redis-server" > /dev/null; then
      echo "Starting Redis..."
      redis-server --requirepass $REDIS_PASS &
   else
       echo "Redis-server is already running."
   fi
else
    echo "START_REDIS is set to false. Redis will not be started."
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
echo "Fixing storage permissions..."
chmod -R 775 storage
chmod -R 775 bootstrap/cache/
chmod 775 database/database.sqlite || true

chown -R $USER:www-data storage
chown -R $USER:www-data bootstrap/cache
chown $USER:www-data database/database.sqlite || true
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

# check if laravel/octane is installed
if [ ! -d "vendor/laravel/octane" ]; then
   echo "Laravel Octane is not installed. Installing..."
   composer require laravel/octane --no-interaction --prefer-dist
   php artisan octane:install --server=frankenphp --no-interaction
else
   echo "Laravel Octane is already installed."
fi
echo "=========================="
echo "===  Octane installed  ==="
echo "=========================="



echo "Installing NPM..."
if [ "$ENV_DEV" = "true" ]; then
   if [ ! -d "node_modules" ]; then
      npm ci --no-audit
   else
      echo "node_modules already exists. Skipping npm install."
   fi
else
   npm ci --no-audit
fi

echo "=========================="
echo "===   NPM installed    ==="
echo "=========================="


echo "Building NPM..."
if [ "$ENV_DEV" = "true" ]; then
   if [ "$ENABLE_NPM_RUN_DEV" = "true" ]; then
      npm run dev -- --host &
   else
      echo "skipping dev server"
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
   php artisan migrate --force
fi
echo "============================"
echo "=== Migrations completed ==="
echo "============================"


echo "Optimizing Laravel..."
if [ "$ENV_DEV" = "true" ]; then
   php artisan config:clear
   php artisan route:clear
else
   php artisan config:cache
   php artisan route:cache

fi

php artisan view:cache
php artisan icons:cache
php artisan filament:cache-components
echo "============================"
echo "===  Laravel optimized   ==="
echo "============================"


crond start -f -l 8 &
echo "============================"
echo "=== Cron service started ==="
echo "============================"


if [ "$START_SUPERVISOR" = "true" ]; then

   cat /etc/supervisor/conf.d/supervisor-header.conf > /etc/supervisor/conf.d/laravel-worker-compiled.conf

   if [ "$ENABLE_QUEUE_WORKER" = "true" ]; then
      echo "Adding queue supervisor config..."
      echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
      cat /etc/supervisor/conf.d/queue-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

      if [ "$DEV_ENV" = "true" ]; then
         # Change the log output to stdout
         sed -i 's|stdout_logfile=/app/storage/logs/supervisor/queue-worker.log|stdout_logfile=/dev/stdout|' /etc/supervisor/conf.d/laravel-worker-compiled.conf
      fi
   fi

   if [ "$ENABLE_HORIZON_WORKER" = "true" ]; then
      echo "Adding horizon supervisor config..."
      echo "" >> /etc/supervisor/conf.d/laravel-worker-compiled.conf
      cat /etc/supervisor/conf.d/horizon-worker.conf >> /etc/supervisor/conf.d/laravel-worker-compiled.conf

      if [ "$DEV_ENV" = "true" ]; then
         # Change the log output to stdout
         sed -i 's|stdout_logfile=/app/storage/logs/supervisor/horizon-worker.log|stdout_logfile=/dev/stdout|' /etc/supervisor/conf.d/laravel-worker-compiled.conf
      fi

      echo "============================"
      echo "===    Horizon added     ==="
      echo "============================"
   fi

   supervisord -n -c /etc/supervisor/conf.d/laravel-worker-compiled.conf &

   echo "============================"
   echo "===  Supervisor started  ==="
   echo "============================"
fi


if [ "$ENV_DEV" = "true" ]; then
   php artisan octane:frankenphp --no-interaction --watch &
else
   php artisan octane:frankenphp --no-interaction &
fi
echo "============================"
echo "===    Octane started    ==="
echo "============================"

echo "============================"
echo "===      PHP READY       ==="
echo "============================"

# wait forever
while true; do
   tail -f /dev/null &
   wait ${!}
done
