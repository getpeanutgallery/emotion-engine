# Fix raw folder placement mismatch vs actual phase output directories

## Context
The pipeline now uses semantic phase directories for outputs (e.g., `phase1-gather-context`), but raw capture helpers still route some raw artifacts to canonical legacy keys (e.g., `phase1-extract/raw`). This splits related artifacts across different phase roots and makes debugging/replay navigation inconsistent.

## Symptoms (with example paths)
For phase 1 context-gather scripts:

- Main phase outputs are written under:
  - `output/cod-test/phase1-gather-context/`
- Raw captures are written under:
  - `output/cod-test/phase1-extract/raw/`

Same mismatch appears in other runs, e.g.:

- `output/cod-test.bak-20260308-223937/phase1-gather-context/` vs `output/cod-test.bak-20260308-223937/phase1-extract/raw/`
- `output/cod-test.replay-bak-20260308-225652/phase1-gather-context/` vs `output/cod-test.replay-bak-20260308-225652/phase1-extract/raw/`

## Root cause hypothesis
`get-dialogue.cjs` and `get-music.cjs` create outputs in `phase1-gather-context` but request raw dir via:

- `getRawPhaseDir(outputDir, 'phase1-extract')`

`output-manager.getPhaseRawDirectory()` then deterministically writes to `<run>/phase1-extract/raw`, so raw capture is no longer colocated with the actual phase outputs.

## Proposed fix
1. Align phase key usage so phase1 scripts writing to `phase1-gather-context` also resolve raw to `phase1-gather-context/raw`.
2. Update `output-manager` raw directory creation helpers to include/recognize current phase names used by pipeline outputs.
3. Add migration/compat behavior if needed:
   - optionally support reading old `phase1-extract/raw` for replay/backward compatibility,
   - but write new artifacts to colocated current phase dirs.
4. Add tests asserting raw dir paths are sibling/child of each phase's real output directory.

## Acceptance criteria
- Phase1 raw artifacts are written to `output/<run>/phase1-gather-context/raw/` (not `phase1-extract/raw`) for current runs.
- Raw folder location for each phase matches the phase output directory naming used by scripts.
- Replay or existing references to legacy raw folders are either migrated or explicitly supported/documented.
- Automated tests cover raw path resolution for phase1/phase2/phase3 and catch regressions.
