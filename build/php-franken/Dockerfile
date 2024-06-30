ARG INPUT_PHP
ARG IMAGENAME=dunglas/frankenphp:php${INPUT_PHP}-alpine

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
    vips \
    mysql-client \
    postgresql-client \
    nano \
    nodejs \
    npm \
    redis \
    supervisor \
    && rm -rf /var/cache/apk/*

# PHP Extension installer
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions?v=1 /usr/local/bin/

# Install PHP Extensions
RUN chmod +x /usr/local/bin/install-php-extensions
RUN install-php-extensions @composer
RUN install-php-extensions gd
RUN install-php-extensions bcmath
RUN install-php-extensions bz2
RUN install-php-extensions calendar
RUN install-php-extensions iconv
RUN install-php-extensions intl
RUN install-php-extensions mbstring
RUN install-php-extensions mysqli
RUN install-php-extensions pdo_mysql
RUN install-php-extensions pdo_pgsql
RUN install-php-extensions soap
RUN install-php-extensions zip
RUN install-php-extensions gmp
RUN install-php-extensions ldap
RUN install-php-extensions exif
RUN install-php-extensions memcached
RUN install-php-extensions redis
RUN install-php-extensions imap
RUN install-php-extensions pcntl
RUN install-php-extensions openssl
RUN install-php-extensions tokenizer
RUN install-php-extensions xml
RUN install-php-extensions ctype
RUN install-php-extensions json

# packages with issues
RUN install-php-extensions imagick/imagick@master
RUN install-php-extensions vips
RUN install-php-extensions ffi
RUN install-php-extensions sockets


# Configure Nginx
# Add your Nginx configuration file here. This will depend on your Laravel application.
COPY ./build/php-franken/nginx.conf /etc/nginx/http.d/default.conf

# Configure Supervisor
# Add your Supervisor configuration files here.
COPY ./build/php-franken/supervisor/supervisor-header.conf /etc/supervisor/conf.d/supervisor-header.conf
COPY ./build/php-franken/supervisor/queue-worker.conf /etc/supervisor/conf.d/queue-worker.conf
COPY ./build/php-franken/supervisor/horizon-worker.conf /etc/supervisor/conf.d/horizon-worker.conf

# Configure Cron Jobs (if needed)
# You can add cron jobs by creating a crontab file and copying it into the container.
COPY ./build/php-franken/laravel-cron /etc/crontabs/www-data

# Copy custom php.ini configuration
COPY ./build/php-franken/php.ini /usr/local/etc/php/

# Set up the application working directory
WORKDIR /app

# Copy the entrypoint script into the container
# This script should start Supervisor, which in turn will manage Nginx and php-franken.
COPY ./build/php-franken/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the port Nginx is reachable on
EXPOSE 80

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

# Define the command to run on container start
ENTRYPOINT ["/entrypoint.sh"]
