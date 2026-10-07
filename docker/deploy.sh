#!/usr/bin/env bash
# Build and (re)start the PM-App production stack in the right order.
#   ./docker/deploy.sh            # build everything, migrate, start
#   ./docker/deploy.sh --no-build # restart with existing images
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

[ -f "$ENV_FILE" ] || { echo "Buat $ENV_FILE dulu (salin dari .env.prod.example)"; exit 1; }
grep -q '^APP_KEY=base64:' "$ENV_FILE" || { echo "APP_KEY belum diisi di $ENV_FILE (php artisan key:generate --show)"; exit 1; }

if [ "${1:-}" != "--no-build" ]; then
  # pm-nginx copies public/ out of the pm-api image, so pm-api must be built first.
  $COMPOSE build pm-api
  $COMPOSE build pm-web pm-nginx pm-backup
fi

$COMPOSE up -d --remove-orphans
$COMPOSE ps
echo
echo "Tahap berikutnya (hanya saat pertama kali): lihat docs/DEPLOY.md bagian 'Pengisian data awal'."
