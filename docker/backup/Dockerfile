# pm-backup — cron + pg_dump (same major version as pm-db). The schedule comes from BACKUP_CRON at run time.
FROM postgres:17-alpine
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && echo "Asia/Jakarta" > /etc/timezone
COPY docker/backup/backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
# Baseline dump at start-up, then crond in the foreground; job output goes to the container log.
CMD ["sh", "-c", "echo \"${BACKUP_CRON:-15 1 * * *} /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1\" > /etc/crontabs/root && backup.sh && exec crond -f -d 8"]
