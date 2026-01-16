ARG INPUT_PHP="8.3"
ARG IMAGENAME=php:${INPUT_PHP}-cli-alpine

FROM $IMAGENAME

ARG TARGETARCH

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Create non-root user with UID 1000 to match host user
RUN addgroup -g 1000 laravel \
 && adduser -D -u 1000 -G laravel -s /bin/sh laravel \
 && addgroup laravel www-data

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
    jq

# Install puppeteer PDF tools dependencies
RUN apk update && apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ttf-freefont \
      libc6-compat \
      gcompat

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# PHP Extension installer
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

# Install PHP Extensions (grouped in one layer for optimization)
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions @composer \
    gd bcmath bz2 calendar iconv intl mbstring \
    mysqli pdo_mysql pdo_pgsql soap zip gmp ldap \
    exif memcached redis imap pcntl openssl tokenizer \
    xml ctype json imagick sockets opcache xdebug openswoole

# Configure Nginx
COPY ./src/shared/nginx/nginx.base.conf /etc/nginx/nginx.conf
COPY ./src/shared/nginx/nginx.octane.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /var/run/nginx /var/lib/nginx/tmp && \
    chown -R laravel:laravel /var/lib/nginx /var/run/nginx /var/log/nginx

# Configure Supervisor. Add your Supervisor configuration files here.
COPY ./src/shared/supervisor/ /tmp/supervisor/
RUN mkdir -p /etc/supervisor/conf.d/ && cp -n /tmp/supervisor/* /etc/supervisor/conf.d/ && rm -r /tmp/supervisor/

# Download and install Supercronic
RUN curl -sSL -o /usr/local/bin/supercronic https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-${TARGETARCH} \
 && chmod +x /usr/local/bin/supercronic
# Configure Cron Jobs (if needed). You can add cron jobs by creating a crontab file and mounting it into the container.
COPY ./src/shared/laravel-cron /etc/supercronic.txt
RUN chown 1000:1000 /etc/supercronic.txt

# Copy custom php.ini configuration
COPY ./src/shared/php.ini /usr/local/etc/php/

# Yes, different path for xdebug config, disabled by default
COPY ./src/shared/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled
# Remove xdebug ini file from extension installer
RUN rm /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Set up the application working directory
WORKDIR /app

# Copy entire scripts folder into container
COPY ./src/shared/scripts /scripts

# Make all *.sh files in /scripts executable
RUN find /scripts -type f -name "*.sh" -exec chmod +x {} \;

# Set secure ownership and permissions for Supervisor config directory
RUN chown -R laravel:laravel /etc/supervisor/conf.d \
 && chmod -R 755 /etc/supervisor/conf.d

# Set the user to run the container
USER laravel

# Expose the port Nginx is reachable on
EXPOSE 8000

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

ENV PHP_RUNTIME_CONFIG=swoole
ENV PHP_IDE_CONFIG="serverName=laravel"

# Define the command to run on container start
ENTRYPOINT ["/scripts/entrypoint.sh"]
