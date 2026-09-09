#!/usr/bin/env bash
# Backup MatOS SQLite database (safe online copy via sqlite3 .backup when available).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_DB="$ROOT/packages/db/prisma/dev.db"
SRC="${DATABASE_FILE:-${1:-$DEFAULT_DB}}"
DEST_DIR="${2:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST_DIR"

if [[ ! -f "$SRC" ]]; then
  echo "error: database file not found: $SRC" >&2
  echo "hint: set DATABASE_FILE or pass path as \$1" >&2
  exit 1
fi

DEST="$DEST_DIR/matos-sqlite-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$SRC" ".backup '$DEST'"
else
  # Fallback: filesystem copy (ok when app is idle)
  cp -p "$SRC" "$DEST"
fi

# Also copy WAL/SHM if present (filesystem fallback consistency)
if [[ -f "${SRC}-wal" ]]; then
  cp -p "${SRC}-wal" "${DEST}-wal" 2>/dev/null || true
fi
if [[ -f "${SRC}-shm" ]]; then
  cp -p "${SRC}-shm" "${DEST}-shm" 2>/dev/null || true
fi

SIZE="$(wc -c < "$DEST" | tr -d ' ')"
echo "Backup written: $DEST ($SIZE bytes)"
echo "$DEST"
