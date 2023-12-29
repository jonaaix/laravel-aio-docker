#!/bin/sh

shutdownHandler() {
   echo "STOP signal received..."
   # Add any cleanup or graceful shutdown tasks here
   exit 0
}
trap 'shutdownHandler' TERM INT

cd /app || exit 1

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
else
    echo "Laravel application found in /app."
fi

# Start Redis if not running
if ! pgrep "redis-server" > /dev/null; then
   echo "Starting Redis..."
   redis-server &
else
    echo "Redis-server is already running."
fi

# Start Cron if not running
if ! pgrep "crond" > /dev/null; then
   echo "Starting Cron..."
   crond &
else
    echo "Cron is already running."
fi

# Start PHP-FPM if not running
if ! pgrep "php-fpm" > /dev/null; then
   echo "Starting PHP-FPM..."
   php-fpm &
else
    echo "PHP-FPM is already running."
fi

# Start Nginx if not running
if ! pgrep "nginx" > /dev/null; then
   echo "Starting Nginx..."
   nginx &
else
    echo "Nginx is already running."
fi

# Start Supervisor
# echo "Starting Supervisor..."
# exec supervisord -n -c /etc/supervisor/conf.d/laravel-worker.conf

# Ensure all services are running
if ! pgrep "redis-server" > /dev/null; then
    echo "Redis-server failed to start."
    failed=true
fi

if ! pgrep "crond" > /dev/null; then
    echo "Cron failed to start."
    failed=true
fi

if ! pgrep "php-fpm" > /dev/null; then
    echo "PHP-FPM failed to start."
    failed=true
fi

if ! pgrep "nginx" > /dev/null; then
    echo "Nginx failed to start."
    failed=true
fi

#if ! pgrep "supervisord" > /dev/null; then
#    echo "Supervisor failed to start."
#    failed=true
#fi

if [ "$failed" = true ]; then
    echo "One or more services failed to start. Exiting..."
    exit 1
fi

# Create cache paths: mkdir -p storage/framework/{sessions,views,cache}
echo "Creating cache paths..."
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/framework/cache
echo "============================"
echo "===  Cache paths created ==="
echo "============================"

# Fix storage permissions
echo "Fixing storage permissions..."
chmod -R 755 storage
chown -R www-data:www-data storage
echo "============================"
echo "===  Permissions fixed   ==="
echo "============================"

# Optimize Laravel
echo "Optimizing Laravel..."
#php artisan config:cache
#php artisan route:cache
#php artisan view:cache
php artisan config:clear
php artisan route:clear
php artisan view:clear
echo "============================"
echo "===  Laravel optimized   ==="
echo "============================"

crond start -f -l 8 &
echo "============================"
echo "=== Cron service started ==="
echo "============================"

echo "Installing Composer..."
composer install --no-dev --optimize-autoloader --no-interaction --no-progress --no-suggest --prefer-dist
echo "=========================="
echo "=== Composer installed ==="
echo "=========================="

echo "Installing NPM..."
npm ci --no-audit
echo "=========================="
echo "===   NPM installed    ==="
echo "=========================="

echo "Building NPM..."
npm run build
echo "=========================="
echo "===     NPM built      ==="
echo "=========================="

# Migrate database
echo "Migrating database..."
php artisan migrate --force
echo "============================"
echo "=== Migrations completed ==="
echo "============================"

echo "alias pa=\"php artisan\"" > ~/.bashrc

echo "============================"
echo "===      PHP READY       ==="
echo "============================"

# wait forever
while true; do
   tail -f /dev/null &
   wait ${!}
done
