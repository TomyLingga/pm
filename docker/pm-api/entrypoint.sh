#!/usr/bin/env bash
# Shared entrypoint of pm-api, pm-worker and pm-scheduler.
# Rebuilds the Laravel caches from the mounted .env, then runs the given command.
set -euo pipefail

cd /var/www/html

# Wait for PostgreSQL (the API must not start on a half-ready database).
if [ -n "${DB_HOST:-}" ]; then
  for i in $(seq 1 60); do
    if php -r 'try { new PDO(sprintf("pgsql:host=%s;port=%s;dbname=%s", getenv("DB_HOST"), getenv("DB_PORT") ?: 5432, getenv("DB_DATABASE")), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); exit(0); } catch (Throwable $e) { exit(1); }' 2>/dev/null; then
      break
    fi
    echo "menunggu database ${DB_HOST}... ($i)"
    sleep 2
  done
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link >/dev/null 2>&1 || true

# Only the API container migrates (workers/scheduler set PM_SKIP_MIGRATE=1).
if [ "${PM_SKIP_MIGRATE:-0}" != "1" ]; then
  php artisan migrate --force
fi

exec "$@"
