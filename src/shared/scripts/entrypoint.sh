#!/bin/bash
# Unified entrypoint driver — variant-specific behaviour is gated inside the partials,
# selected by the IMAGE_VARIANT and PHP_RUNTIME_CONFIG env vars set per Dockerfile.

. /scripts/entrypoint-partials.sh

claude_init

print_banner
register_shutdown_handler

log_phase "🪝  Pre-boot hooks"
run_before_boot_hooks

log_phase "🐘  PHP setup"
configure_xdebug
tune_php_fpm_pool

log_phase "🌐  Web server"
render_nginx_conf
start_nginx

handle_skip_laravel_boot

log_phase "🔍  Application check"
verify_laravel_app
run_post_autoload_dump
ensure_app_key
create_cache_paths
fix_permissions

# Start PHP-FPM earlier to allow rendering of maintenance page (no-op on Octane variants)
log_phase "🐘  PHP-FPM"
start_php_fpm

log_phase "🚧  Maintenance mode"
enable_maintenance_mode

log_phase "📦  Composer & Octane"
composer_install
ensure_octane_installed

log_phase "📦  NPM"
npm_install
npm_build

log_phase "⚡  Laravel optimization"
optimize_laravel
optimize_filament
cache_blade_icons

log_phase "🗄️   Database"
run_migrations
run_seeds

log_phase "⏰  Cron"
start_cron

log_phase "🎛️   Supervisor"
read_laravel_env
init_supervisor_config
supervisor_add_supercronic
supervisor_add_schedule
supervisor_add_queue_if_enabled
supervisor_add_horizon_if_enabled
supervisor_add_reverb_if_enabled
supervisor_add_claude_threads_if_enabled
supervisor_add_vite_dev_if_enabled
supervisor_add_octane_if_enabled
start_supervisor

log_phase "🚀  Ready"
log_ok "PHP READY"

run_after_boot_hooks
disable_maintenance_mode

wait_forever
