ARG INPUT_PHP
ARG IMAGENAME=php:${INPUT_PHP}-cli-alpine

FROM ghcr.io/roadrunner-server/roadrunner:2024.1.5 AS roadrunner
FROM $IMAGENAME

COPY --from=roadrunner /usr/bin/rr /usr/local/bin/rr

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Install dependencies including Nginx, Supervisor, and Cron
RUN apk update && apk add --no-cache \
    bash \
    curl \
    git \
    zip \
    imagemagick \
    vips \
    mysql-client \
    postgresql-client \
    nano \
    nodejs \
    npm \
    redis \
    nginx \
    supervisor \
    && rm -rf /var/cache/apk/*

# PHP Extension installer
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions?v=1 /usr/local/bin/

# Install PHP Extensions
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions \
    @composer \
    gd \
    bcmath \
    bz2 \
    calendar \
    iconv \
    intl \
    mbstring \
    mysqli \
    pdo_mysql \
    pdo_pgsql \
    soap \
    zip \
    gmp \
    ldap \
    exif \
    memcached \
    redis \
    imap \
    pcntl \
    openssl \
    tokenizer \
    xml \
    ctype \
    json

# Install packages with issues separately
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions \
    imagick/imagick@master \
    vips

RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions \
    ffi

RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions \
    sockets


# Configure Nginx
# Add your Nginx configuration file here. This will depend on your Laravel application.
COPY ./build/php-roadrunner/nginx.conf /etc/nginx/http.d/default.conf

# Configure Supervisor
# Add your Supervisor configuration files here.
COPY ./build/php-roadrunner/supervisor/supervisor-header.conf /etc/supervisor/conf.d/supervisor-header.conf
COPY ./build/php-roadrunner/supervisor/queue-worker.conf /etc/supervisor/conf.d/queue-worker.conf
COPY ./build/php-roadrunner/supervisor/horizon-worker.conf /etc/supervisor/conf.d/horizon-worker.conf

# Configure Cron Jobs (if needed)
# You can add cron jobs by creating a crontab file and copying it into the container.
COPY ./build/php-roadrunner/laravel-cron /etc/crontabs/www-data

# Copy custom php.ini configuration
COPY ./build/php-roadrunner/php.ini /usr/local/etc/php/

# Set up the application working directory
WORKDIR /app

# Copy the entrypoint script into the container
# This script should start Supervisor, which in turn will manage Nginx and php-roadrunner.
COPY ./build/php-roadrunner/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the port Nginx is reachable on
EXPOSE 80

# Define the command to run on container start
ENTRYPOINT ["/entrypoint.sh"]
