# MatOS SQLite backup & restore

Phase 4 hardening — local SQLite only (no hosted DB yet).

## Backup

```bash
# Default: packages/db/prisma/dev.db → ./backups/matos-sqlite-<UTC>.db
./scripts/backup-db.sh

# Custom source + destination directory
./scripts/backup-db.sh /abs/path/to/dev.db /abs/path/to/out-dir

# Or via env
DATABASE_FILE=/abs/path/dev.db ./scripts/backup-db.sh
```

Uses `sqlite3 .backup` when available (consistent online copy); otherwise `cp`.

## Restore drill

1. Stop the app (`Ctrl+C` on `pnpm dev`).
2. Pick a backup file under `backups/` or artifacts.
3. Restore:

```bash
./scripts/restore-db.sh backups/matos-sqlite-YYYYMMDDTHHMMSSZ.db
# optional target:
# ./scripts/restore-db.sh path/to/backup.db /abs/path/packages/db/prisma/dev.db
```

4. Confirm schema: `pnpm db:migrate`
5. Start app: `pnpm dev`
6. Spot-check `/map`, `/activity`, `/workflows`.

The restore script copies any existing target to `*.pre-restore-<UTC>` before overwrite.

## Smoke artifact

Overnight Phase 4 writes a smoke backup to:

`/workspace/matos-artifacts/backup-smoke/`

## Notes

- Do not commit `*.db` backups to git.
- For production hosts later: schedule `backup-db.sh` + off-box copy; rotate retention.
