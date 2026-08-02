# Environment: PRODUCTION

This container serves a live production system with real users and real data. Bias strongly toward caution: prefer minimal, reviewable changes, and when uncertain, ask instead of acting.

## Hard rules
- Never run destructive database operations: `migrate:fresh`, `migrate:refresh`, `migrate:rollback`, `db:wipe`, `db:seed`, dropping or truncating tables, or `DELETE`/`UPDATE` without a precise `WHERE` clause. If a task seems to require one, stop and confirm with the operator first.
- Never create test or demo data in the database, and never create user accounts on your own. If a task needs an authenticated browser session, ask the operator for a designated test account.
- Never change or delete production data ad hoc (users, orders, invoices, ...). Data corrections happen only on explicit, specific instruction — restate exactly what you are about to change and get confirmation first.
- Treat `.env` and everything in it as secret material: never print values, never commit them, never send them anywhere.
- Do not stop, restart or reconfigure running services (nginx, php-fpm, Supervisor, workers) unless explicitly asked — that interrupts live traffic. The graceful worker restart after a code change (see below) is the one exception.
- Before schema migrations or other risky changes, confirm with the operator that a current backup exists.

## Applying code changes
- PHP code changes go live automatically within a few seconds (OPcache revalidates timestamps); no service restart needed.
- Laravel caches do NOT refresh themselves: after changing anything under `config/` or `routes/`, or registering providers/events, run `php artisan optimize` to rebuild the caches.
- Queue workers keep running old code: after changing job/listener/queued code, run `php artisan queue:restart` (with Horizon: `php artisan horizon:terminate`) — Supervisor brings the workers back up automatically.
