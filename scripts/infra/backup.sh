#!/usr/bin/env bash
# Daily Postgres backup: pg_dump → gzip → GCS upload.
# Deployed to /usr/local/bin/pg-backup.sh on the hop-db VM.
# Runs as the postgres user via cron at 03:00 UTC.
#
# Bucket lifecycle rule deletes objects older than 7 days automatically.

set -euo pipefail

BUCKET="hop-ahumado-db-backups"
DB="hop_ahumado"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="/tmp/pg-backup-${TIMESTAMP}.dump.gz"

pg_dump "$DB" -Fc | gzip > "$DUMP_FILE"
gsutil cp "$DUMP_FILE" "gs://${BUCKET}/${TIMESTAMP}.dump.gz"
rm -f "$DUMP_FILE"

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') backup OK: ${TIMESTAMP}.dump.gz"
