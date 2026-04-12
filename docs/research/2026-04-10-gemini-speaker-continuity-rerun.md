# Gemini Dialogue-Only Rerun After Speaker-Continuity Hardening

**Date:** 2026-04-10  
**Config:** `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`  
**Bead:** `ee-r261`

## Run Command (repo-normal dotenv-loading path)

```bash
npm run pipeline -- --config configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml --verbose
```

## Primary Artifacts

- Log: `.logs/20260410-151350-cod-dialogue-compare-gemini-3.1-pro-preview-ee-r261.log`
- Dialogue output: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- Script success envelope: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`
- Phase error summary: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/raw/_meta/errors.summary.json`
- Prior Gemini speaker map baseline (earlier run): `docs/2026-04-10-gemini-dialogue-speaker-map.md`

## Result Summary

### 1) Valid dialogue output still produced

Yes. `get-dialogue` completed successfully on attempt 1 and emitted a valid `dialogue-data.json` plus `get-dialogue.success.json` contract artifact.

### 2) Speaker-ID fragmentation behavior change

Compared with the earlier Gemini baseline documented in `docs/2026-04-10-gemini-dialogue-speaker-map.md`:

- Prior baseline: **32 segments**, speaker IDs through **`spk_018`** (18 distinct IDs).
- Hardened rerun: **29 segments**, speaker IDs through **`spk_013`** (13 distinct IDs).

Notable continuity improvements in this rerun:

- The Metallica lyric block stays on a single speaker (`spk_011`) instead of being split across additional IDs.
- Villain-taunt cluster near the end is now consistently assigned to `spk_002`:
  - "So eager to leave this world."
  - "Killing a man is a hell of a lot easier than killing an idea."
  - "You were never cut out to be a Mason."

Overall, this run shows **reduced speaker proliferation** and better reuse of existing IDs in adjacent lines.

### 3) Transcript quality check

Transcript quality appears to remain strong enough for dialogue analysis:

- Core COD trailer lines are still present and coherent.
- Key quote fidelity remains high (minor wording drift still exists in places, e.g., "this world" vs expected phrase variants in truth fixtures).
- No obvious collapse into malformed or empty dialogue output.

### 4) Remaining failure type attribution

The run still exits non-zero at pipeline level, but the failure is **not** transport/provider instability and not a dialogue-lane validator failure in this attempt.

Observed failure:

- `Produced artifact missing for musicData: .../phase1-gather-context/music-data.json`

Interpretation:

- `get-dialogue` lane itself succeeded (provider + tool-loop path healthy in this run).
- Remaining top-level failure is a **benchmark/config contract expectation mismatch** for this dialogue-only lane (pipeline still expects `musicData` artifact during benchmark stage), not a Gemini transport break.

## Conclusion

The speaker-continuity hardening appears to have improved fragmentation behavior while preserving usable transcript quality. The currently blocking failure is downstream benchmark/config wiring (`musicData` expectation), not the Gemini dialogue extraction itself in this rerun.
