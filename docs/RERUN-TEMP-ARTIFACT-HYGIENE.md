# Rerun temp artifact hygiene

Repo-local rerun/debug breadcrumbs should live under `.tmp/<bead-id>/`, not at repo root.

## Canonical helper

Use:

```bash
eval "$(./scripts/bead-temp-paths.sh ee-1234 rerun)"
```

That creates `.tmp/ee-1234/` and exports stable scratch paths such as:

- `EE_BEAD_TMP_DIR`
- `EE_BEAD_CMD_FILE`
- `EE_BEAD_LOG_FILE`
- `EE_BEAD_TIME_FILE`
- `EE_BEAD_TS_FILE`
- `EE_BEAD_CASS_FILE`
- `EE_BEAD_ARCHIVE_FILE`

## Intended layout

```text
.tmp/
  ee-1234/
    rerun-cmd
    rerun-log
    rerun-timelog
    rerun-ts
    rerun-cass
    rerun-archive
```

## Migration note

On 2026-04-10, legacy root-level `.tmp-ee-*` files were migrated into `.tmp/<bead-id>/legacy-*` where possible. This preserves existing breadcrumbs while clearing repo-root clutter.
