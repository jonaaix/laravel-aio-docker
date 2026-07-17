# Logging helpers — colored, timestamped, level-aware.
# Auto-disables ANSI codes when stdout is not a TTY or NO_COLOR is set.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
   LOG_RESET=$'\033[0m'
   LOG_DIM=$'\033[2m'
   LOG_BOLD=$'\033[1m'
   LOG_BLUE=$'\033[34m'
   LOG_CYAN=$'\033[36m'
   LOG_GREEN=$'\033[32m'
   LOG_YELLOW=$'\033[33m'
   LOG_RED=$'\033[31m'
   LOG_GRAY=$'\033[90m'
else
   LOG_RESET='' LOG_DIM='' LOG_BOLD=''
   LOG_BLUE='' LOG_CYAN='' LOG_GREEN='' LOG_YELLOW='' LOG_RED='' LOG_GRAY=''
fi

_log_ts() { date '+%H:%M:%S'; }

log_info()  { printf '%s[%s]%s %sℹ️ %s %s\n' "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_BLUE"   "$LOG_RESET" "$*"; }
log_ok()    { printf '%s[%s]%s %s✅%s %s\n'  "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_GREEN"  "$LOG_RESET" "$*"; }
log_wait()  { printf '%s[%s]%s %s⏳%s %s\n'  "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_YELLOW" "$LOG_RESET" "$*"; }
log_warn()  { printf '%s[%s]%s %s⚠️ %s %s\n' "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_YELLOW" "$LOG_RESET" "$*"; }
log_error() { printf '%s[%s]%s %s❌%s %s\n'  "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_RED"    "$LOG_RESET" "$*" >&2; }
log_step()  { printf '   %s└─%s %s\n' "$LOG_DIM" "$LOG_RESET" "$*"; }
log_skip()  { printf '%s[%s]%s %s⏭️ %s %s%s%s\n' "$LOG_DIM" "$(_log_ts)" "$LOG_RESET" "$LOG_GRAY" "$LOG_RESET" "$LOG_DIM" "$*" "$LOG_RESET"; }

log_phase() {
   printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$LOG_BLUE" "$LOG_RESET"
   printf '%s%s▶ %s%s\n' "$LOG_BOLD" "$LOG_BLUE" "$*" "$LOG_RESET"
   printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$LOG_BLUE" "$LOG_RESET"
}
