# The `agent` variant is a lightweight AI-agent runtime. It carries NO PHP, Composer,
# nginx or php-fpm — only what's needed to run AI agents (claude, opencode,
# claude-threads) that work over chat, MCP servers, a headless browser, and small
# Python scripts they write and run themselves.

FROM node:22-bookworm-slim

ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Shell tools + a small, coherent data/report toolkit for BI-style agents:
#   ripgrep  — Claude Code's internal search backend (much faster than the fallback)
#   jq       — JSON wrangling around MCP output
#   pandoc   — turn Markdown into docx/html reports to share via claude-threads
#   sqlite3  — lightweight scratch/analysis store and agent memory
#   miller   — CSV/JSON stream processing (mlr) for data exports
#   imagemagick — image conversion/manipulation for chat attachments
#   python3 + venv — so agents can write and run their own scripts (see /opt/venv below)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash \
      curl \
      wget \
      git \
      zip \
      unzip \
      ca-certificates \
      gnupg \
      tzdata \
      locales \
      less \
      nano \
      jq \
      ripgrep \
      fd-find \
      pandoc \
      sqlite3 \
      miller \
      imagemagick \
      python3 \
      python3-venv \
      python3-pip \
      supervisor \
      sudo \
      procps \
      psmisc \
 && ln -sf "$(command -v fdfind)" /usr/local/bin/fd \
 && rm -rf /var/lib/apt/lists/*

# System libraries the Chromium that Playwright drives depends on, plus:
#   fonts-noto-core / fonts-noto-color-emoji — correct glyphs & emoji in screenshots
#     (€, umlauts, CJK, 📊 …) so rendered HTML doesn't fall back to tofu boxes
#   poppler-utils — pdftotext/pdfimages to read PDFs users send into the chat
# The actual browser binary is Playwright's own Chromium, installed under /opt below.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      fonts-liberation \
      fonts-freefont-ttf \
      fonts-noto-core \
      fonts-noto-color-emoji \
      poppler-utils \
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
 && rm -rf /var/lib/apt/lists/*

# Playwright resolves its browser from PLAYWRIGHT_BROWSERS_PATH. Keep it under /opt
# (OUTSIDE the persisted /home/laravel volume) so the browser baked at build time is
# never shadowed by a stale volume — and never re-downloaded at runtime. The install
# itself runs as laravel further down, once the npm agents are in place.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

# Python virtualenv, kept under /opt (OUTSIDE the persisted /home/laravel volume, like
# npm-global) so it always reflects the current image. Agents can build and run their
# own scripts and freely `pip install` into it at runtime. Preloaded with a data &
# reporting stack: csvkit (CSV tooling), pandas + openpyxl (data/Excel), matplotlib
# (charts to attach), requests, python-dateutil, tabulate.
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV" \
 && "$VIRTUAL_ENV/bin/pip" install --no-cache-dir --upgrade pip \
 && "$VIRTUAL_ENV/bin/pip" install --no-cache-dir \
      csvkit pandas openpyxl requests python-dateutil tabulate matplotlib

RUN curl -sS https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin

# Create non-root user with UID 1000 to match host user. The node base image already
# ships a `node` user/group at UID/GID 1000, so free that slot first.
RUN userdel -r node 2>/dev/null || true; \
    groupdel node 2>/dev/null || true; \
    groupadd -g 1000 laravel \
 && useradd -m -u 1000 -g laravel -s /bin/bash laravel

RUN mkdir -p /home/laravel/.config \
 && printf '%s\n' \
    'eval "$(starship init bash)"' \
    'export PATH=/home/laravel/.local/bin:/opt/npm-global/bin:/opt/venv/bin:/usr/local/share/container-bin:$PATH' \
    > /home/laravel/.bashrc

COPY src/shared/starship.toml /home/laravel/.config/starship.toml

RUN chown -R laravel:laravel /home/laravel

# Set Bash as the default shell
SHELL ["/bin/bash", "-c"]

RUN echo 'laravel ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/laravel \
 && chmod 0440 /etc/sudoers.d/laravel

# Configure Supervisor — keeps claude-threads alive and auto-restarts it on crashes.
COPY ./src/shared/supervisor/ /tmp/supervisor/
RUN mkdir -p /etc/supervisor/conf.d/ && cp -n /tmp/supervisor/* /etc/supervisor/conf.d/ && rm -r /tmp/supervisor/

# The agent's working directory. Mount a project/config dir here if the agent needs one.
WORKDIR /app
RUN mkdir -p /app && chown laravel:laravel /app

# Copy entire scripts folder into container
COPY ./src/shared/scripts /scripts
RUN find /scripts -type f -name "*.sh" -exec chmod +x {} \;

# Secure ownership and permissions for Supervisor config directory
RUN chown -R laravel:laravel /etc/supervisor/conf.d \
 && chmod -R 755 /etc/supervisor/conf.d

# Prepare global helper commands
ENV PATH=/usr/local/share/container-bin:${PATH}
RUN mkdir -p /usr/local/share/container-bin \
 && chown -R laravel:laravel /usr/local/share/container-bin \
 && printf '%s\n' \
    '#!/bin/sh' \
    'exec ls -lsah "$@"' \
    > /usr/local/share/container-bin/ll \
 && chmod +x /usr/local/share/container-bin/ll

# Prepare environment for the AI agents
ENV HOME=/home/laravel
ENV SHELL=/bin/bash
ENV TERM=xterm-256color
# npm-global, the python venv and claude-defaults live under /opt, OUTSIDE the persisted
# /home/laravel volume. A named volume on /home/laravel is seeded from the image only once
# (on first creation) and then frozen, so anything the image ships under /home/laravel/ is
# shadowed by the stale volume forever. Keeping image-owned binaries and config defaults in
# /opt means they always reflect the current image on every container recreate.
ENV NPM_CONFIG_PREFIX=/opt/npm-global
ENV PATH=/home/laravel/.local/bin:/opt/npm-global/bin:/opt/venv/bin:${PATH}

RUN mkdir -p /home/laravel/.claude /home/laravel/.local/bin /opt/npm-global /opt/claude-defaults /opt/ms-playwright \
 && chown -R laravel:laravel /home/laravel /opt/npm-global /opt/claude-defaults /opt/venv /opt/ms-playwright

# Install the agents for the laravel user which runs the container
USER laravel

# Install the AI agents globally (as laravel, into laravel-owned NPM_CONFIG_PREFIX):
#   @playwright/mcp — browser automation MCP server (browsing/screenshots)
#   claude-threads  — chat bridge (Mattermost/Slack) that fronts the Claude Code CLI
#   opencode        — alternative provider-agnostic coding/agent CLI
ARG CACHEBUST_NPM_GLOBAL=initial
RUN echo "npm-global cache key: ${CACHEBUST_NPM_GLOBAL}" \
 && npm install -g @playwright/mcp@latest claude-threads@latest opencode-ai@latest

# Bake the Chromium the Playwright MCP drives into /opt/ms-playwright, so rendering HTML
# and taking screenshots works offline and immediately (otherwise the MCP would download
# it on first use into the persisted volume). Install it with the EXACT playwright-core
# that @playwright/mcp bundles — its expected browser revision is pinned to that version,
# so installing via a standalone `playwright@latest` yields a mismatched build that the
# MCP can't launch. System deps are already installed above (no --with-deps / root).
RUN MCP=/opt/npm-global/lib/node_modules/@playwright/mcp \
 && CORE=$(node -e "console.log(require('path').dirname(require.resolve('playwright-core/package.json',{paths:['$MCP']})))") \
 && node "$CORE/cli.js" install chromium

# Install the Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Register the Playwright MCP server globally for all projects
RUN claude mcp add --transport stdio --scope user playwright -- npx -y @playwright/mcp@latest

# Store the Claude default config in /opt (source of truth, refreshed into ~/.claude every boot).
# Shared prompt fragments (chat bridge, non-tech mode) are composed in by the entrypoint.
COPY --chown=laravel:laravel ./src/shared/claude-defaults/ /opt/claude-defaults/
COPY --chown=laravel:laravel ./src/ai-agent/claude-defaults/ /opt/claude-defaults/
RUN cp /opt/claude-defaults/settings.json /home/laravel/.claude/settings.json \
 && cp /opt/claude-defaults/CLAUDE.md /home/laravel/.claude/CLAUDE.md \
 && if [ -f /home/laravel/.claude.json ]; then \
      cp /home/laravel/.claude.json /opt/claude-defaults/.claude.json; \
    else \
      echo '{}' > /opt/claude-defaults/.claude.json; \
    fi

# Reuse the shared MCP/plugin merge scripts (identical across claude-capable variants)
COPY ./src/php-fpm-claude/merge-mcp-servers.js /scripts/merge-mcp-servers.js
COPY ./src/php-fpm-claude/merge-plugins.js /scripts/merge-plugins.js

ENV IMAGE_VARIANT=ai-agent

# Define the command to run on container start
ENTRYPOINT ["/scripts/entrypoint.ai-agent.sh"]
