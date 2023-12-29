ARG INPUT_PHP
ARG IMAGENAME=php:${INPUT_PHP}-fpm-alpine

FROM $IMAGENAME

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
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

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
    imagick \
    pcntl \
    openssl \
    tokenizer \
    xml \
    ctype \
    json

# Configure Nginx
# Add your Nginx configuration file here. This will depend on your Laravel application.
COPY ./build/php-fpm/nginx.conf /etc/nginx/conf.d/laravel.conf

# Configure Supervisor
# Add your Supervisor configuration files here.
COPY ./build/php-fpm/laravel-worker.conf /etc/supervisor/conf.d/laravel-worker.conf

# Configure Cron Jobs (if needed)
# You can add cron jobs by creating a crontab file and copying it into the container.
COPY ./build/php-fpm/laravel-cron /etc/cron.d/laravel-cron

# Copy custom php.ini configuration
COPY ./build/php-fpm/php.ini /usr/local/etc/php/

# Set up the application working directory
WORKDIR /app

# Copy the entrypoint script into the container
# This script should start Supervisor, which in turn will manage Nginx and PHP-FPM.
COPY ./build/php-fpm/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the port Nginx is reachable on
EXPOSE 80

# Define the command to run on container start
CMD ["/entrypoint.sh"]
