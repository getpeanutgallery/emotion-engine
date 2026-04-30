# 2026-04-30 Phase 2 trusted-window benchmark maintenance note

## Scope

This slice refreshes `benchmarks/fixtures/cod-test/truth/chunk-analysis.json` only for the approved trusted Phase 2 windows:

- refreshed: `3-4, 8-15, 17, 22-27`
- explicitly frozen / excluded: `0-2, 5-7, 16, 18-21`

Critical boundary: excluded chunks were **not** normalized from current live output into benchmark truth during this maintenance pass.

## What changed

### Truth surface refreshed from current repaired Phase 2 output

Source used for approved windows:
- `output/cod-test/phase2-process/chunk-analysis.json`

Target updated:
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`

Refreshed chunk windows and rationale:

- `3-4`
  - Updated from current live output because the villain / unrest / explosion sequence is now visually grounded enough to trust for bounded truth maintenance.
- `8-15`
  - Updated from current live output because the mid-trailer action run is the clearest trusted region in the forensic review: chunk-local visuals, pacing, and summaries align materially better with the repaired lane.
- `17`
  - Updated from current live output because the snowy Alaska combat window remains visually grounded and directionally trustworthy even though it sits near excluded neighbors.
- `22-27`
  - Updated from current live output because the late trailer / climax / end-card stretch is the strongest trusted region, including the strongly anchored Xbox-logo ending at chunk `27`.

### Structural coherence update

- `persona.config.chunkDuration` was updated from `8` to `5` in `truth/chunk-analysis.json`.
- Reason: the truth artifact already uses 5-second chunk boundaries throughout; leaving the stale top-level `8` value would keep an artificial whole-artifact mismatch unrelated to the trusted/excluded semantic slice.
- This was treated as a bounded coherence repair, not as semantic normalization of excluded chunks.

## What stayed frozen on purpose

The following chunk windows were left unchanged in benchmark truth:

- `0-2`
  - opening chunk region still shows contamination / generic reasoning risk
- `5-7`
  - dialogue-heavy stretch remains out of scope for this truth refresh
- `16`
  - live artifact still admits weak chunk-local grounding
- `18-21`
  - skepticism shortlist remains quarantined; do not launder into truth

## Regenerated benchmark surfaces

After the bounded truth refresh, benchmark report surfaces were regenerated so the fixture report reflects the updated trusted-window truth while preserving excluded-window failures for the quarantined regions.
