ARG INPUT_PHP="8.3"
ARG IMAGENAME=dunglas/frankenphp:php${INPUT_PHP}-alpine

FROM $IMAGENAME

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Install dependencies including Nginx, Supervisor, Cron, and security tools
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
    nginx \
    supervisor \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# PHP Extension installer
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

# Install PHP Extensions (grouped in one layer for optimization)
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions @composer \
    gd bcmath bz2 calendar iconv intl mbstring \
    mysqli pdo_mysql pdo_pgsql soap zip gmp ldap \
    exif memcached redis imap pcntl openssl tokenizer \
    xml ctype json imagick/imagick@master vips ffi sockets opcache xdebug

# Configure Nginx. Add your Nginx configuration file here. This will depend on your Laravel application.
COPY ./build/php-franken/nginx.conf /etc/nginx/http.d/default.conf

# Configure Supervisor. Add your Supervisor configuration files here.
COPY ./build/shared/supervisor/supervisor-header.conf /etc/supervisor/conf.d/supervisor-header.conf
COPY ./build/shared/supervisor/queue-worker.conf /etc/supervisor/conf.d/queue-worker.conf
COPY ./build/shared/supervisor/horizon-worker.conf /etc/supervisor/conf.d/horizon-worker.conf

# Configure Cron Jobs (if needed). You can add cron jobs by creating a crontab file and copying it into the container.
COPY ./build/shared/laravel-cron /etc/crontabs/www-data

# Copy custom php.ini configuration
COPY ./build/shared/php.ini /usr/local/etc/php/

# Yes, different path for xdebug config, disabled by default
COPY ./build/shared/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled

# Set up the application working directory
WORKDIR /app

# Copy the entrypoint script into the container
COPY ./build/shared/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose the port Nginx is reachable on
EXPOSE 8000

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

ENV PHP_RUNTIME_CONFIG=PHP_FRANKEN

# Define the command to run on container start
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
