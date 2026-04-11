ARG INPUT_PHP="8.5"
ARG IMAGENAME=php:${INPUT_PHP}-fpm-alpine

FROM ${IMAGENAME}

ARG TARGETARCH

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Install shell tools
RUN apk add --no-cache \
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
    jq \
    sudo

RUN curl -sS https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin

# Create non-root user with UID 1000 to match host user
RUN addgroup -g 1000 laravel \
 && adduser -D -u 1000 -G laravel -s /bin/bash laravel \
 && addgroup laravel www-data

RUN mkdir -p /home/laravel/.config \
 && printf '%s\n' \
    'eval "$(starship init bash)"' \
    'export PATH=/home/laravel/.local/bin:/home/laravel/.npm-global/bin:/usr/local/share/container-bin:$PATH' \
    > /home/laravel/.bashrc \
 && printf '%s\n' \
    'add_newline = false' \
    > /home/laravel/.config/starship.toml \
 && chown -R laravel:laravel /home/laravel

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

RUN echo 'laravel ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/laravel \
 && chmod 0440 /etc/sudoers.d/laravel

# Install puppeteer PDF tools dependencies
RUN apk add --no-cache \
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
    gd bcmath bz2 calendar iconv intl mbstring pcov \
    mysqli pdo_mysql pdo_pgsql soap zip gmp ldap \
    exif memcached redis imap pcntl openssl tokenizer \
    xml ctype json imagick sockets opcache xdebug

# Configure Nginx
COPY ./src/shared/nginx/nginx.base.conf /etc/nginx/nginx.conf
COPY ./src/shared/nginx/nginx.fpm.conf /etc/nginx/http.d/default.conf
COPY ./src/shared/nginx/maintenance /etc/nginx/maintenance
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

# Prepare global helper commands
ENV PATH=/usr/local/share/container-bin:${PATH}

RUN mkdir -p /usr/local/share/container-bin \
 && chown -R laravel:laravel /usr/local/share/container-bin

RUN printf '%s\n' \
    '#!/bin/sh' \
    'exec php artisan "$@"' \
    > /usr/local/share/container-bin/pa \
 && chmod +x /usr/local/share/container-bin/pa \
 && printf '%s\n' \
    '#!/bin/sh' \
    'exec ls -lsah "$@"' \
    > /usr/local/share/container-bin/ll \
 && chmod +x /usr/local/share/container-bin/ll

# Prepare environment for Claude
ENV HOME=/home/laravel
ENV SHELL=/bin/bash
ENV TERM=xterm-256color
ENV NPM_CONFIG_PREFIX=/home/laravel/.npm-global
ENV PATH=/home/laravel/.local/bin:/home/laravel/.npm-global/bin:${PATH}

RUN mkdir -p /home/laravel/.npm-global /home/laravel/.claude /home/laravel/.local/bin \
 && chown -R laravel:laravel /home/laravel

# Install MCP server dependencies globally
RUN npm install -g @playwright/mcp @upstash/context7-mcp \
 && mkdir -p /home/laravel/.npm && chown -R laravel:laravel /home/laravel/.npm

# Install Claude for laravel user which runs the container
USER laravel
RUN curl -fsSL https://claude.ai/install.sh | bash

# Register MCP servers globally for all projects
RUN claude mcp add --transport stdio --scope user playwright -- npx -y @playwright/mcp@latest \
 && claude mcp add --transport stdio --scope user context7 -- npx -y @upstash/context7-mcp

# Store Claude default config (will be copied on first boot if volume is empty)
RUN mkdir -p /home/laravel/.claude-defaults \
 && printf '%s\n' \
    '{' \
    '  "permissions": {' \
    '    "defaultMode": "bypassPermissions"' \
    '  },' \
    '  "skipDangerousModePermissionPrompt": true' \
    '}' \
    > /home/laravel/.claude-defaults/settings.json \
 && printf '%s\n' \
    '# Container rules' \
    '- Use sudo without password for system changes.' \
    '- Use apk add for Alpine packages.' \
    '- Prefer user-space installs when root is unnecessary.' \
    '- Assume app root is /app.' \
    > /home/laravel/.claude-defaults/CLAUDE.md \
 && cp /home/laravel/.claude-defaults/settings.json /home/laravel/.claude/settings.json \
 && cp /home/laravel/.claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md \
 && cp /home/laravel/.claude.json /home/laravel/.claude-defaults/.claude.json

# Copy MCP merge script
COPY ./src/php-fpm-claude/merge-mcp-servers.js /scripts/merge-mcp-servers.js

# Expose the port Nginx is reachable on
EXPOSE 8000

ENV IMAGE_VARIANT=fpm-claude
ENV PHP_RUNTIME_CONFIG=fpm
ENV PHP_IDE_CONFIG="serverName=laravel"

# Define the command to run on container start
ENTRYPOINT ["/scripts/entrypoint.sh"]
