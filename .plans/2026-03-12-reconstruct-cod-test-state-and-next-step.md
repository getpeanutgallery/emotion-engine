# emotion-engine: reconstruct cod-test state + plan next golden-run push

**Date:** 2026-03-12  
**Status:** Current (canonical plan)  
**Agent:** Cookie 🍪

---

## Goal

Capture the current verified state of `emotion-engine` before the next live run, so there is one truthful source of record for what is done, what is still open, and what should happen next.

---

## Current verified state

- The recommendation JSON reliability work in `server/scripts/report/recommendation.cjs` has been implemented locally.
- Recommendation tests are passing:
  - `node --test test/scripts/recommendation.test.js`
  - current result: **8 passing, 0 failing** on 2026-03-12
- The legacy `/.issues/` tracker has been migrated into Beads and the obsolete markdown issue files are deleted from the working tree.
- We do **not** yet have fresh live-provider validation for the repaired recommendation flow.
- Because live validation is still pending, the next truthful execution lane is validation, not more speculative planning.

---

## What changed in the recommendation reliability pass

The current uncommitted Phase 3 work is aimed at the exact `invalid_output` failure mode seen in the last `cod-test` run:

- recommendation responses now attempt JSON recovery from:
  - fenced ```json blocks
  - balanced object extraction from surrounding prose
  - lightly normalized candidates (BOM/code-fence stripping, trailing-comma cleanup)
- parse failures now preserve better raw capture/debug context for triage:
  - raw completion content is retained in raw capture
  - parse metadata is persisted when captureRaw is enabled
- tests now cover:
  - fenced JSON with trailing commas repaired successfully
  - malformed non-JSON responses being captured for debugging

This means the repo now has a concrete implementation + unit-test proof for the previously open recommendation JSON reliability lane.

---

## Canonical outstanding queue

The Beads tracker is now the canonical outstanding work list.

### Still open / still real

- `ee-2fs` — audit Phase 3 recommendation input payload / grounding provenance
- `ee-03m` — expose FFmpeg compression settings via YAML
- `ee-9or` — categorize recent run errors by type + frequency
- `ee-0gv` — investigate run-root `raw/` folder location / naming
- `ee-1er` — align OpenRouter + cross-provider debug/error capture

### Implemented but awaiting live validation before closure

- `ee-5dv` — recommendation invalid JSON failure
  - Code + tests now indicate the reliability fix is in place.
  - Keep the bead open until a live validation run confirms the repaired path in practice.

---

## Next execution lane

1. Run a **live Phase3-only validation** first using the existing Phase3-only config/workflow.
2. If Phase3-only succeeds, run the full live `configs/cod-test.yaml` flow.
3. If the full run succeeds, promote/record the fresh golden cassette.
4. If Phase3-only still fails, inspect the new raw captures first before changing scope.

This is the current best-order path because it validates the repaired failure mode cheaply before paying for a full end-to-end run.

---

## Plan status normalization

This file is the **canonical current-state plan**.

Everything older in `.plans/` should be read as one of:
- **Complete** — finished historical record
- **Superseded** — useful history, but no longer the active source of truth

No older March 9–10 plan should still be interpreted as active execution state.

---

## Final Results

**Status:** Ready for live validation

**What We Built:**
- A single canonical current-state plan reflecting the repo after the recommendation JSON reliability implementation, Beads migration, and plan cleanup.

**Verified evidence:**
- `server/scripts/report/recommendation.cjs`
- `test/scripts/recommendation.test.js`
- `node --test test/scripts/recommendation.test.js` → 8/8 passing

**Next step:**
- Live Phase3-only validation, then full `cod-test`, then golden cassette if successful.

**Commits:**
- Pending commit/push from the canonicalization pass.

