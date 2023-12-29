#!/bin/sh

# Check if the Laravel application is not present in /app
if [ ! -f "/app/artisan" ]; then
    echo "No Laravel application found in /app. Exiting..."
    exit 1
fi

# Start Redis
redis-server &

# Start Cron
crond

# Start PHP-FPM
php-fpm

# Start Nginx
nginx -g 'daemon off;'

# Start Supervisor
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf


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
