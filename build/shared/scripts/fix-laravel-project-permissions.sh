#!/bin/sh
set -e

echo "🔧 Full Laravel project permission reset..."

# 1. Full reset to laravel:laravel
echo "→ Resetting ownership to 1000:1000..."
chown -R --no-dereference 1000:1000 .

# 2. Base permissions
echo "→ Fixing default directory and file permissions..."
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

# 3. Writable dirs: storage & bootstrap/cache
echo "→ Fixing storage and cache permissions for web access..."
chown -R laravel:www-data storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 775 {} \;
find storage bootstrap/cache -type f -exec chmod 664 {} \;

# 4. SQLite DB
if [ -f "database/database.sqlite" ]; then
    echo "→ Fixing permissions for database.sqlite..."
    chown laravel:www-data database/database.sqlite
    chmod 664 database/database.sqlite
fi

echo "✅ Laravel project permissions fully reset."
