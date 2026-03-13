# Example: Production Dockerfile for Dockerfile-based deployments.
# Use together with docker-compose.dockerfile.yaml and ENABLE_DOCKERFILE_STRATEGY=true.
#
# This Dockerfile bakes your app code, vendor/, and compiled front-end assets directly
# into the image so the entrypoint skips redundant build steps at container start.
#
# Build & push example:
#   docker build -t myapp:latest -f examples/php-fpm/Dockerfile .
#   docker push myapp:latest

FROM ghcr.io/jonaaix/laravel-aio:1.3-php8.5-fpm

WORKDIR /app

# Copy application source
COPY . .

# Install PHP dependencies (no dev, optimised autoloader)
RUN composer install \
    --optimize-autoloader \
    --no-interaction \
    --no-dev \
    --no-progress \
    --prefer-dist

# Build front-end assets and discard node_modules to keep the image lean
RUN npm ci && npm run build && rm -rf node_modules
