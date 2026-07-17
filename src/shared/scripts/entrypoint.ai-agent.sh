#!/bin/bash
# Minimal entrypoint for the `ai-agent` variant — a lightweight AI-agent runtime.
# Reuses the shared partials for logging/lifecycle/supervisor but skips the entire
# Laravel/PHP boot sequence (no nginx, no php-fpm, no composer, no migrations).

. /scripts/entrypoint-partials.sh

claude_init

print_banner
register_shutdown_handler

log_phase "🪝  Pre-boot hooks"
run_before_boot_hooks
cleanup_playwright_locks

log_phase "🎛️   Supervisor"
init_supervisor_config
supervisor_add_claude_threads_if_enabled
start_supervisor

log_phase "🚀  Ready"
log_ok "AGENT READY"

run_after_boot_hooks

wait_forever
