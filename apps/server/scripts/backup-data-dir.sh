#!/usr/bin/env bash
# Snapshot LOK_DATA_DIR (character log, binds, watcher cursors, quarantine/drop files).
# No secrets — keys live in env, not the data dir.
#
# Usage:
#   LOK_DATA_DIR=./data ./scripts/backup-data-dir.sh
#   BACKUP_ROOT=/var/backups/bellgrave RETAIN=14 ./scripts/backup-data-dir.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${LOK_DATA_DIR:-$ROOT/data}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT/backups}"
RETAIN="${RETAIN:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_ROOT/lok-data-$STAMP.tar.gz"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "backup-data-dir: missing data dir: $DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
# Prefer flock so cron + live server do not race a torn journal copy.
if command -v flock >/dev/null 2>&1; then
  flock -n "$DATA_DIR/.backup.lock" tar -C "$(dirname "$DATA_DIR")" -czf "$OUT" "$(basename "$DATA_DIR")"
else
  tar -C "$(dirname "$DATA_DIR")" -czf "$OUT" "$(basename "$DATA_DIR")"
fi

echo "backup-data-dir: wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"

# Prune old snapshots (keep RETAIN newest).
mapfile -t OLD < <(ls -1t "$BACKUP_ROOT"/lok-data-*.tar.gz 2>/dev/null | tail -n +"$((RETAIN + 1))" || true)
for f in "${OLD[@]:-}"; do
  [[ -n "$f" ]] || continue
  rm -f "$f"
  echo "backup-data-dir: pruned $f"
done
