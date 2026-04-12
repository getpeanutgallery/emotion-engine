# Gemini Speaker-Continuity Comparison: New Rerun vs Prior Gemini vs Truth

**Date:** 2026-04-10  
**Plan:** `.plans/2026-04-10-gemini-speaker-continuity-hardening.md` (Task 4 / bead `ee-mud9`)  
**Scope:** Speaker-ID continuity and assignment movement toward benchmark truth.

## Inputs compared

- **New Gemini rerun (post continuity hardening):**
  - `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- **Prior Gemini baseline (pre continuity hardening):**
  - `docs/2026-04-10-gemini-dialogue-speaker-map.md` (ordered speaker map captured from the earlier run)
- **Benchmark truth:**
  - `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

> Note: the prior run source available for this task is the durable speaker-map doc, not a separate archived raw `dialogue-data.json` for the same run ID.

## Continuity/fragmentation metrics

| Metric | Prior Gemini | New Gemini rerun | Truth |
|---|---:|---:|---:|
| Dialogue segments | 32 | 29 | 20 |
| Distinct speaker IDs | 18 | 13 | 13 |
| Speaker IDs used once (singletons) | 15 (83.3%) | 8 (61.5%) | 9 (69.2%) |
| Adjacent same-speaker pairs | 12 | 11 | 3 |
| Speaker switches | 19 | 17 | 16 |

## Findings

### 1) Unnecessary speaker splits / over-fragmentation

**Improved.** The rerun reduces over-fragmentation in aggregate:

- Distinct speaker IDs dropped from **18 → 13** (matching truth count).
- Singleton IDs dropped from **15 → 8**, indicating less one-line speaker churn.
- End-cluster fragmentation in the prior run (`spk_002` → `spk_015` → `spk_016`) collapsed to one speaker ID in rerun (`spk_002` for all three lines).

### 2) Reused `speaker_id`s across adjacent lines

**Improved continuity, with some over-merge risk.**

- Lyric block stayed continuous and cleaner in rerun (single long run on one speaker ID).
- Villain-tail lines were grouped under one ID (`spk_002`), improving local continuity.
- However, some non-adjacent role boundaries were over-merged:
  - `Killing a man...` and `You were never cut out...` both mapped to `spk_002` in rerun, where truth separates these voices.

### 3) Did assignments move closer to truth?

**Mixed: structural continuity improved, per-line truth alignment did not clearly improve.**

- Truth-covered line count at high text similarity (>=0.75):
  - Prior: **19/20**
  - New: **18/20**
- Speaker-ID matches within covered lines:
  - Prior: **7**
  - New: **7**

Interpretation:
- The rerun is **closer to truth in speaker-count shape** (13 IDs vs prior 18, truth 13).
- But on **line-level speaker assignment**, it appears mostly lateral and slightly worse in a few tail lines due to aggressive merging.

### 4) Transcript quality while continuity changed

**Stayed acceptable; slightly cleaner on contamination.**

- Core trailer dialogue remains coherent and usable.
- Lyric contamination lines (<0.45 best similarity to any truth dialogue line) reduced from **11 → 8**.
- Minor lexical drift persists (`"the living"/"this world"` vs truth `"David"`, `"an idea"` vs `"the idea"`).

## Concrete deltas worth calling out

- **Positive continuity delta:**
  - Prior had extra split IDs in late villain sequence (`spk_015`, `spk_016`) that rerun removed.
- **Regression risk from over-merging:**
  - Rerun assigns both `"Killing a man..."` and `"You were never cut out..."` to `spk_002`; truth treats these as different speakers.

## Verdict

Speaker-continuity hardening achieved its primary intent: **fewer unnecessary speaker splits and less cast over-fragmentation**.  
Against truth, this is a **net structural improvement** (speaker inventory and continuity), but **not a clear per-line speaker-assignment win** yet. The rerun appears to trade some fragmentation errors for a smaller number of over-merge errors, while keeping transcript quality acceptable.
