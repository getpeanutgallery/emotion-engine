# Remove empty legacy `phase1-extract/` folder from new runs

## Context
We moved Phase 1 outputs to `phase1-gather-context/` and aliased legacy `phase1-extract` → `phase1-gather-context` for raw directory resolution.

However, new runs still create a legacy folder:
- `output/<run>/phase1-extract/raw/`

This folder is currently **empty**, and its presence is confusing during QA/manual inspection. New runs should not create legacy output directories unless explicitly needed.

## Current symptoms
In a fresh `cod-test` run:
- `output/cod-test/phase1-extract/` exists
- `output/cod-test/phase1-extract/raw/` exists
- both are empty (no files)

## Root cause
`server/lib/output-manager.cjs` intentionally creates the legacy directory in `createRawDirectories()`:

- Comment: “Backward compatibility: also creates … `phase1-extract/raw/` as a legacy path.”
- Code path creates `legacyPhase1RawDir = <run>/phase1-extract/raw` and `mkdir -p` it.

Even though `getPhaseRawDirectory()` resolves `phase1-extract` to `phase1-gather-context`, the explicit legacy mkdir keeps producing `phase1-extract/` in every run.

## Proposed fix
- Stop creating the legacy directory by default.
  - Remove `legacyPhase1RawDir` creation from `createRawDirectories()`.
- Keep *read/resolve* compatibility:
  - `resolveRawPhaseKey('phase1-extract') -> 'phase1-gather-context'` should remain.
- If we truly need a legacy write path for older tooling, gate it behind an explicit option (env or config), or only create it when we actually write a file there.

## Acceptance criteria
- New runs do **not** contain `output/<run>/phase1-extract/` unless explicitly requested.
- Raw artifacts for phase 1 are colocated at:
  - `output/<run>/phase1-gather-context/raw/`
- Tests updated/added to prevent regression (assert `phase1-extract` is absent by default).
