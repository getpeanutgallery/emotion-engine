# Gemini Speaker-Continuity Approved-Doc Rerun (ee-2xb5)

**Date:** 2026-04-10  
**Config:** `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`  
**Bead:** `ee-2xb5`

## Source of truth used for implementation

- `docs/2026-04-10-gemini-speaker-continuity-prompt-review-editable.md`

Applied the approved replacement continuity wording into:

- `server/scripts/get-context/get-dialogue.cjs`
  - `buildTranscriptionPrompt` speaker rules
  - `buildChunkTranscriptionPrompt` speaker rules
  - `buildStructuredSpeakerHandoff` voice-separation reminders

## Run command (repo-normal env-loading style)

```bash
npm run pipeline -- --config configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml --verbose
```

## Primary artifacts

- Log: `.logs/20260410-170209-cod-dialogue-compare-gemini-3.1-pro-preview-ee-2xb5.log`
- Dialogue output: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- Script success envelope: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`

## Outcome vs truth and prior run

Comparison references:

- Truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Prior continuity-hardened rerun metrics: `docs/research/2026-04-10-gemini-speaker-continuity-comparison-vs-truth.md`

### Snapshot metrics

| Metric | Prior continuity rerun | This approved-doc rerun | Truth |
|---|---:|---:|---:|
| Dialogue segments | 29 | 32 | 20 |
| Distinct speaker IDs | 13 | 15 | 13 |
| Speaker singletons | 8 | 10 | 9 |
| Speaker switches | 17 | 19 | 16 |
| Adjacent same-speaker pairs | 11 | 12 | 3 |
| Truth lines covered (best text sim >= 0.75) | 18/20 | 19/20 | 20/20 |
| Speaker matches on covered truth lines | 7/18 | 7/19 | 20/20 |

## Required assessment

### 1) Whether valid dialogue output still succeeds

**Yes.** `get-dialogue` completed and emitted valid `dialogue-data.json` + success envelope. No JSON-contract failure.

### 2) Whether speaker continuity/fragmentation looks better or worse

**Worse than the immediately prior continuity rerun.**

- Speaker inventory regressed from **13 -> 15** IDs.
- Segments rose from **29 -> 32**.
- Singleton speakers rose from **8 -> 10**.

The approved-doc prompt reduced one specific over-merge tendency in the trailer tail (it now separates `"Killing a man..."` and `"You were never cut out..."` instead of forcing both onto one ID), but overall it reintroduced more splitting elsewhere.

### 3) Whether transcript quality remains usable

**Yes, usable.**

- Dialogue remains coherent and analyzable.
- Truth text coverage is still strong (**19/20** lines at >=0.75 similarity).
- Minor lexical drift persists but no malformed output collapse.

### 4) Remaining failure class

Primary remaining model failure class: **speaker-ID instability / over-fragmentation under short, high-variance voice snippets**.

- The model still mints extra IDs for nearby lines where continuity should likely hold.
- We now appear to be trading prior over-merge risk for renewed over-splitting.

Pipeline-level non-dialogue failure remains unchanged:

- `Produced artifact missing for musicData .../phase1-gather-context/music-data.json`

So top-level run still ends in benchmark-stage contract mismatch, even when dialogue extraction itself succeeds.

## Verdict

Using the approved continuity prompt wording preserved valid transcript generation and usability, but **did not improve net speaker continuity vs the previous hardened rerun**. The dominant residual error class is still speaker assignment instability (fragmentation), with benchmark wiring (`musicData` expectation) still causing top-level pipeline failure.
