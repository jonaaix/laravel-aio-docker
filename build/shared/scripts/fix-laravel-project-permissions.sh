#!/bin/sh
set -e

echo "🔧 Full Laravel project permission reset..."

# 1. Reset ownership
echo "→ Resetting ownership to 1000:1000..."
chown -R --no-dereference 1000:1000 .

# 2. Base permissions
echo "→ Fixing default directory and file permissions..."
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

# 3. Restore +x for artisan and CLI tools
echo "→ Restoring executable bit for artisan and binaries..."
chmod 755 artisan

if [ -d vendor/bin ]; then
  find vendor/bin -type f -exec chmod 755 {} \;
fi

if [ -d node_modules/.bin ]; then
  find node_modules/.bin -type f -exec chmod 755 {} \;
fi

# 4. Writable dirs
echo "→ Setting correct permissions on writable directories..."
find storage bootstrap/cache -type d -exec chmod 775 {} \;
find storage bootstrap/cache -type f -exec chmod 664 {} \;

# 5. SQLite DB (optional)
if [ -f "database/database.sqlite" ]; then
  echo "→ Fixing permissions for database.sqlite..."
  chmod 664 database/database.sqlite
fi

echo
echo "📋 Executables:"
ls -l artisan vendor/bin/* 2>/dev/null || echo "→ No executables found."
echo

echo "✅ Laravel project permissions fully reset."
