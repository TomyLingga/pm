#!/bin/sh
# Daily PostgreSQL dump of the PM-App database (run by the pm-backup container's cron).
# Keeps BACKUP_KEEP_DAYS days of compressed dumps in /backups.
set -eu

# Connection: PG* variables, else the DB_* settings of pm-api/.env (env_file in docker-compose.yml).
: "${PGHOST:=pm-db}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=${DB_DATABASE:-pm}}"
: "${PGUSER:=${DB_USERNAME:-pm}}"
: "${PGPASSWORD:=${DB_PASSWORD:-}}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
: "${BACKUP_KEEP_DAYS:=14}"
DIR=/backups
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DIR/pm-$STAMP.sql.gz"

mkdir -p "$DIR"
echo "[$(date '+%F %T')] backup $PGDATABASE -> $FILE"
pg_dump --no-owner --no-privileges --format=plain "$PGDATABASE" | gzip -9 > "$FILE.part"
mv "$FILE.part" "$FILE"

# Prune old dumps
find "$DIR" -name 'pm-*.sql.gz' -mtime +"$BACKUP_KEEP_DAYS" -delete
echo "[$(date '+%F %T')] done ($(du -h "$FILE" | cut -f1)); kept: $(ls "$DIR" | wc -l) files"
