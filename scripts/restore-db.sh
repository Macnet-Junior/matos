#!/usr/bin/env bash
# Restore MatOS SQLite database from a backup produced by backup-db.sh.
# WARNING: overwrites the target DB. Stop the app first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_DB="$ROOT/packages/db/prisma/dev.db"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <backup.db> [target.db]" >&2
  exit 1
fi

SRC="$1"
DEST="${2:-${DATABASE_FILE:-$DEFAULT_DB}}"

if [[ ! -f "$SRC" ]]; then
  echo "error: backup not found: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
# Safety copy of current target if it exists
if [[ -f "$DEST" ]]; then
  SAFETY="${DEST}.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$DEST" "$SAFETY"
  echo "Saved existing DB to $SAFETY"
fi

cp -p "$SRC" "$DEST"
# Drop stale WAL/SHM so restored file is authoritative
rm -f "${DEST}-wal" "${DEST}-shm"

echo "Restored $SRC -> $DEST"
echo "Next: pnpm db:migrate (no-op if current) and restart pnpm dev"
