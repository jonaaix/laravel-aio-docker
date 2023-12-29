#!/bin/sh

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
else
    echo "Laravel application found in /app."
fi

# Start Redis
echo "Starting Redis..."
redis-server &

# Start Cron
echo "Starting Cron..."
crond

# Start PHP-FPM
echo "Starting PHP-FPM..."
php-fpm

# Start Nginx
echo "Starting Nginx..."
nginx -g 'daemon off;'

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

if ! pgrep "supervisord" > /dev/null; then
    echo "Supervisor failed to start."
    failed=true
fi

if [ "$failed" = true ]; then
    echo "One or more services failed to start. Exiting..."
    exit 1
fi

# Composer
if [ -f "/app/composer.json" ]; then
    echo "Installing composer dependencies..."
    cd /app && composer install --no-dev --optimize-autoloader --no-interaction --no-progress --no-suggest --prefer-dist
else
   echo "No composer.json found in /app. Shutting down..."
   exit 1
fi

# NPM Build
if [ -f "/app/package.json" ]; then
    echo "Installing npm dependencies..."
    cd /app && npm ci --no-audit

    echo "Building npm assets..."
    cd /app && npm run build
else
   echo "No package.json found in /app. Shutting down..."
   exit 1
fi

# Migrate database
echo "Migrating database..."
cd /app && php artisan migrate --force

echo "========================================"
echo "Ready."
echo "========================================"
