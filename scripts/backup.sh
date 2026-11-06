#!/bin/sh
# Daily MongoDB backup. Cron:  0 2 * * * /path/to/twwios-app/scripts/backup.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T mongo mongodump --archive --gzip --db trios > "backups/trios-$(date +%F).gz"
find backups -name 'trios-*.gz' -mtime +14 -delete
