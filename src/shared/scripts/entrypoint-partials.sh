# Loader for all entrypoint partials.
# Drivers source this single file: . /scripts/entrypoint-partials.sh

PARTIALS_DIR="$(dirname "${BASH_SOURCE[0]}")/entrypoint-partials"

. "$PARTIALS_DIR/log.sh"
. "$PARTIALS_DIR/lifecycle.sh"
. "$PARTIALS_DIR/php.sh"
. "$PARTIALS_DIR/services.sh"
. "$PARTIALS_DIR/laravel.sh"
. "$PARTIALS_DIR/octane.sh"
. "$PARTIALS_DIR/supervisor.sh"
. "$PARTIALS_DIR/claude.sh"
