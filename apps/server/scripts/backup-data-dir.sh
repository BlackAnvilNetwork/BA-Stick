#!/usr/bin/env bash
# Snapshot LOK_DATA_DIR (character log, binds, watcher cursors, quarantine/drop files).
# No secrets — keys live in env, not the data dir.
#
# Atomic staging copy (cp -a → tar) so a live server cannot tear the archive.
# Exclusive flock on .backup.lock serializes concurrent backup jobs.
# Does not truncate or rewrite lok-world.lock (server advisory lock file).
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
BACKUP_LOCK="$DATA_DIR/.backup.lock"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "backup-data-dir: missing data dir: $DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/lok-backup-stage.XXXXXX")"
cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

do_snapshot() {
  # Copy the live tree to a private stage, then tar the stage (never tar in place).
  cp -a "$DATA_DIR" "$STAGE/data"
  rm -f "$STAGE/data/lok-world.lock" "$STAGE/data/.backup.lock"
  find "$STAGE/data" -name '*.tmp' -delete 2>/dev/null || true
  tar -C "$STAGE" -czf "$OUT" data
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_LOCK"
  if ! flock -n 9; then
    echo "backup-data-dir: another backup is running (.backup.lock)" >&2
    exit 1
  fi
  do_snapshot
  flock -u 9 || true
else
  do_snapshot
fi

echo "backup-data-dir: wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"

mapfile -t OLD < <(ls -1t "$BACKUP_ROOT"/lok-data-*.tar.gz 2>/dev/null | tail -n +"$((RETAIN + 1))" || true)
for f in "${OLD[@]:-}"; do
  [[ -n "$f" ]] || continue
  rm -f "$f"
  echo "backup-data-dir: pruned $f"
done
