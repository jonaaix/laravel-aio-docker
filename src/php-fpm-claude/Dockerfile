ARG INPUT_PHP="8.5"
ARG IMAGENAME=php:${INPUT_PHP}-fpm

FROM ${IMAGENAME}

ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Install shell tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash \
      curl \
      git \
      zip \
      unzip \
      imagemagick \
      default-mysql-client \
      sqlite3 \
      nano \
      nginx \
      supervisor \
      ca-certificates \
      tzdata \
      jq \
      sudo \
      gnupg \
      procps \
      psmisc \
      pandoc \
      gettext-base \
 && rm -rf /var/lib/apt/lists/*

# PostgreSQL 18 client from PGDG (Debian's own postgresql-client is 17, which
# mismatches PG18 servers: "pg_dump: server version mismatch")
RUN install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*

# Node.js via NodeSource (Debian's apt nodejs is outdated)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN curl -sS https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin

# Create non-root user with UID 1000 to match host user
RUN groupadd -g 1000 laravel \
 && useradd -m -u 1000 -g laravel -s /bin/bash laravel \
 && usermod -aG www-data laravel

RUN mkdir -p /home/laravel/.config \
 && printf '%s\n' \
    'eval "$(starship init bash)"' \
    'export PATH=/home/laravel/.local/bin:/opt/npm-global/bin:/usr/local/share/container-bin:$PATH' \
    > /home/laravel/.bashrc

COPY src/shared/starship.toml /home/laravel/.config/starship.toml

RUN chown -R laravel:laravel /home/laravel

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

RUN echo 'laravel ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/laravel \
 && chmod 0440 /etc/sudoers.d/laravel

# Headless browser deps + Google Chrome (amd64). On arm64 Playwright installs its own browsers.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      fonts-liberation \
      fonts-freefont-ttf \
      libnss3 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libxkbcommon0 \
      libdrm2 \
      libgbm1 \
      libasound2 \
      libpango-1.0-0 \
      libcairo2 \
 && apt-get install -y --no-install-recommends chromium \
 && mkdir -p /opt/google/chrome \
 && ln -sf /usr/bin/chromium /opt/google/chrome/chrome \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# PHP Extension installer
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

# Install PHP Extensions (grouped in one layer for optimization)
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions @composer \
    gd bcmath bz2 calendar iconv intl mbstring pcov \
    mysqli pdo_mysql pdo_pgsql soap zip gmp ldap \
    exif memcached redis imap pcntl openssl tokenizer \
    xml ctype json imagick sockets opcache xdebug

# Configure Nginx. Shared base conf references /etc/nginx/http.d (Alpine); symlink it to Debian's conf.d.
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default \
 && mkdir -p /etc/nginx/conf.d \
 && ln -sfn /etc/nginx/conf.d /etc/nginx/http.d
COPY ./src/shared/nginx/nginx.base.conf /etc/nginx/nginx.conf
COPY ./src/shared/nginx/nginx.fpm.conf.template /etc/nginx/conf.d/default.conf.template
COPY ./src/shared/nginx/maintenance /etc/nginx/maintenance
# Pre-create nginx's compiled default temp dirs (Debian: /var/lib/nginx/body etc.) so they
# are owned by the laravel worker. Otherwise nginx creates them at runtime with a foreign
# owner and spooling a large request body fails with EACCES -> HTTP 500. Mode 0700 keeps the
# spooled bodies readable only by the worker.
RUN mkdir -p /var/run/nginx /var/lib/nginx/tmp \
      /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi \
      /var/lib/nginx/scgi /var/lib/nginx/uwsgi \
 && touch /etc/nginx/conf.d/default.conf \
 && chown -R laravel:laravel /var/lib/nginx /var/run/nginx /var/log/nginx /etc/nginx/conf.d/default.conf \
 && chmod 700 /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi \
      /var/lib/nginx/scgi /var/lib/nginx/uwsgi

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
COPY ./src/shared/php-fpm/www.conf.template /usr/local/etc/php-fpm.d/zz-pool-tuning.conf.template
RUN touch /usr/local/etc/php-fpm.d/zz-pool-tuning.conf \
 && chown laravel:laravel /usr/local/etc/php-fpm.d/zz-pool-tuning.conf

# Yes, different path for xdebug config, disabled by default
COPY ./src/shared/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini.disabled
# Remove xdebug ini file from extension installer
RUN rm /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Set up the application working directory
WORKDIR /app

# Copy entire scripts folder into container
COPY ./src/shared/scripts /scripts

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
# npm-global and claude-defaults live under /opt, OUTSIDE the persisted /home/laravel
# volume. A named volume on /home/laravel is seeded from the image only once (on first
# creation) and then frozen, so anything the image ships under /home/laravel/ is shadowed
# by the stale volume forever. Keeping the image-owned MCP binaries and config defaults in
# /opt means they always reflect the current image on every container recreate.
ENV NPM_CONFIG_PREFIX=/opt/npm-global
ENV PATH=/home/laravel/.local/bin:/opt/npm-global/bin:${PATH}

RUN mkdir -p /home/laravel/.claude /home/laravel/.local/bin /opt/npm-global /opt/claude-defaults \
 && chown -R laravel:laravel /home/laravel /opt/npm-global /opt/claude-defaults

# Install Claude for laravel user which runs the container
USER laravel

# Install MCP server dependencies globally (as laravel, into laravel-owned NPM_CONFIG_PREFIX)
ARG CACHEBUST_NPM_GLOBAL=initial
RUN echo "npm-global cache key: ${CACHEBUST_NPM_GLOBAL}" \
 && npm install -g @playwright/mcp@latest @upstash/context7-mcp@latest claude-threads@latest

# Install php-lsp (Rust-based PHP language server)
RUN if [ "${TARGETARCH}" = "amd64" ]; then \
      PHP_LSP_ARCH="x86_64-unknown-linux-gnu"; \
    else \
      PHP_LSP_ARCH="aarch64-unknown-linux-gnu"; \
    fi \
 && curl -Lo /tmp/php-lsp.tar.gz https://github.com/jorgsowa/php-lsp/releases/latest/download/php-lsp-${PHP_LSP_ARCH}.tar.gz \
 && tar xzf /tmp/php-lsp.tar.gz -C /home/laravel/.local/bin/ \
 && rm /tmp/php-lsp.tar.gz

RUN curl -fsSL https://claude.ai/install.sh | bash

# Register MCP servers globally for all projects
RUN claude mcp add --transport stdio --scope user playwright -- npx -y @playwright/mcp@latest \
 && claude mcp add --transport stdio --scope user context7 -- npx -y @upstash/context7-mcp

# Clone LSP marketplace for phpactor plugin
RUN git clone --depth 1 https://github.com/Piebald-AI/claude-code-lsps.git \
    /opt/claude-defaults/plugins/marketplaces/claude-code-lsps

# Store Claude default config in /opt (source of truth, refreshed into ~/.claude every boot).
# Shared prompt fragments (chat bridge, non-tech mode) are composed in by the entrypoint.
COPY --chown=laravel:laravel ./src/shared/claude-defaults/ /opt/claude-defaults/
COPY --chown=laravel:laravel ./src/php-fpm-claude/claude-defaults/ /opt/claude-defaults/
RUN cp /opt/claude-defaults/settings.json /home/laravel/.claude/settings.json \
 && cp /opt/claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md \
 && cp /home/laravel/.claude.json /opt/claude-defaults/.claude.json

# Patch php-lsp config in both the installed-plugin cache (active at runtime)
# and the marketplace clone (used if the plugin is ever reinstalled/refreshed).
# Sets phpVersion to this image's actual PHP runtime, adds common noise excludes,
# and disables undefinedFunctions (https://github.com/jorgsowa/php-lsp/issues/92 —
# incomplete built-in stubs flag count(), array_*, str_*, trim() etc. as undefined).
#
# Pinned to a known plugin manifest version: a new upstream version may restructure
# .lsp.json so blindly patching it could corrupt the config. On a mismatch the build
# fails — review the upstream changes, adapt the jq filter and the cached snapshot
# under claude-defaults/plugins/cache/<version>/, then bump EXPECTED_PLUGIN_VERSION.
RUN EXPECTED_PLUGIN_VERSION=0.1.0 \
 && PLUGIN_JSON=/opt/claude-defaults/plugins/marketplaces/claude-code-lsps/php-lsp/plugin.json \
 && ACTUAL=$(jq -r '.version' "$PLUGIN_JSON") \
 && if [ "$ACTUAL" != "$EXPECTED_PLUGIN_VERSION" ]; then \
      echo "ERROR: claude-code-lsps/php-lsp upstream version is $ACTUAL, pinned at $EXPECTED_PLUGIN_VERSION."; \
      echo "Inspect the new .lsp.json structure, adapt patches and the cached snapshot, then bump the pin."; \
      exit 1; \
    fi \
 && PHP_VER=$(php -r 'echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;') \
 && JQ_PATCH='.php.initializationOptions.phpVersion = $ver | .php.initializationOptions.excludePaths = ["node_modules/*", "storage/*", "bootstrap/cache/*", "public/build/*"] | .php.initializationOptions.diagnostics.undefinedFunctions = false' \
 && for f in \
      /opt/claude-defaults/plugins/cache/claude-code-lsps/php-lsp/$EXPECTED_PLUGIN_VERSION/.lsp.json \
      /opt/claude-defaults/plugins/marketplaces/claude-code-lsps/php-lsp/.lsp.json; \
    do \
      [ -f "$f" ] || continue; \
      jq --arg ver "$PHP_VER" "$JQ_PATCH" "$f" > "$f.tmp" && mv "$f.tmp" "$f"; \
    done

# Copy MCP and plugin merge scripts
COPY ./src/php-fpm-claude/merge-mcp-servers.js /scripts/merge-mcp-servers.js
COPY ./src/php-fpm-claude/merge-plugins.js /scripts/merge-plugins.js

# Expose the default port Nginx is reachable on. Informational only — the actual
# listen port is configurable at runtime via the HTTP_PORT env var (default 8000).
EXPOSE 8000

ENV IMAGE_VARIANT=fpm-claude
ENV PHP_RUNTIME_CONFIG=fpm
ENV PHP_IDE_CONFIG="serverName=laravel"

# Define the command to run on container start
ENTRYPOINT ["/scripts/entrypoint.sh"]
