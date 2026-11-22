#!/bin/sh
# FBSh-05: ugugdliin sangiin udur tutmiin nuutslult (suuliin 30 honogiinhiig hadgalna)
# Docker-d `backup` serwis udur bur awtomataar ajilluulna. Garaar: sh scripts/backup.sh
# Sergeeh: gunzip -c backups/dms_2026-11-16.sql.gz | psql "$DATABASE_URL"
set -eu
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$DIR"
FILE="$DIR/dms_$(date +%F_%H%M).sql.gz"
pg_dump --no-owner --clean --if-exists "${DATABASE_URL:?DATABASE_URL тохируулаагүй}" | gzip > "$FILE"
find "$DIR" -name 'dms_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Нөөц үүслээ: $FILE ($(du -h "$FILE" | cut -f1))"
