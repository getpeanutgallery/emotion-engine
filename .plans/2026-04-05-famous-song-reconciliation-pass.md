# emotion-engine: add famous-song reconciliation pass for dialogue and music-vocals

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Add a post-Phase-1 reconciliation step that uses the music-vocals lane's famous-song recognition as evidence to clean up dialogue/music-vocals conflicts, remove likely wrong lyric claims, and correct near-miss lyric text when the recognized song evidence is strong enough.

---

## Overview

The recent prompt-only and boundary-handling tranches appear to have hit their ceiling. The underlying models are still weak at reliably distinguishing spoken dialogue from sung vocals in noisy mixed-media trailer audio, so simply pushing harder on prompts is no longer producing meaningful gains. That makes a dedicated reconciliation stage the most promising next experiment.

The proposed direction is not a generic router. Instead, it is a targeted cleanup pass that consumes the existing Phase 1 artifacts: `dialogueData`, `musicData`, and `musicVocalsData`. When `music-vocals` strongly recognizes a famous song and has convincing lyric evidence, the reconciliation step can use that as high-confidence context to: (1) remove likely lyric contamination from dialogue, (2) retain or refine lyric segments in music-vocals, and (3) potentially replace close misheard lyric variants with canonical song lyrics when the match is strong enough and the timing/audio evidence supports the correction.

This should likely be implemented as a new script rather than cramming more duties into `get-dialogue.cjs` or `get-music-vocals.cjs`. A separate reconciliation script keeps responsibilities clearer, keeps prompt context smaller, and makes it easier to inspect raw-vs-reconciled outputs. The raw Phase 1 outputs from dialogue/music/music-vocals should remain preserved as first-party source artifacts for audit and later comparison. The reconciled output should be produced as an additional baseline artifact set that downstream whole-video and future chunk/video systems consume by default when reconciliation is configured for that run. Benchmarking for this lane must be updated to compare against the reconciled dialogue/music-vocals baseline rather than the raw pre-reconciliation artifacts; otherwise the new pass will not register its improvements. Baseline routing should be automatic: if the reconciliation script is present in the active config/pipeline, benchmark/downstream consumers should resolve to reconciled artifacts and fail if those expected reconciled artifacts are missing; if the reconciliation script is not present, the system should continue using raw dialogue/music/music-vocals artifacts without error.

---

## Tasks

### Task 1: Design the famous-song reconciliation script and decision rules

**Bead ID:** `ee-spzt`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design a new post-Phase-1 reconciliation script that consumes dialogueData, musicData, and musicVocalsData and uses famous-song recognition evidence to resolve dialogue/music-vocals conflicts. Specify when it should remove lyric contamination from dialogue, when it may correct near-miss lyric text to canonical song lyrics, how strong recognizedSong evidence must be, what safeguards prevent overcorrection on unknown/non-famous songs, what the output artifact(s) should be, how raw pre-reconciliation artifacts remain preserved for audit/comparison, and how downstream whole-video/chunk systems plus benchmarking should consume the reconciled result by default only when the reconciliation script is present in the active config. Include the automatic path-resolution rule: reconciliation configured => use reconciled baseline and fail if missing; reconciliation absent => use raw baseline with no error. Update this plan with an implementation-ready recommendation, but do not change code in this task.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-reconciliation-pass.md`

**Status:** ✅ Complete

**Results:** Designed an implementation-ready reconciliation pass with these narrow rules:

- **New script shape:** add a dedicated Phase 1 post-pass script at `server/scripts/get-context/reconcile-famous-song-phase1.cjs`. It should run after `get-dialogue.cjs`, `get-music.cjs`, and `get-music-vocals.cjs`, consume `dialogueData`, `musicData`, and `musicVocalsData`, and emit reconciled Phase 1 artifacts without mutating the raw source artifacts.
- **Recognition gate:** only reconcile when `musicVocalsData.recognizedSong.status === "recognized"`, `musicVocalsData.recognizedSong.confidence >= 0.92`, there is exactly one primary candidate, `multipleSongsDetected !== true`, and that candidate includes at least **2 matched lyric fragments** plus at least **1 timeRange** overlapping a music-vocals segment. `musicData.recognizedSong` may be used only as supporting evidence; it must not independently trigger reconciliation.
- **Dialogue lyric-contamination removal rule:** mark a dialogue segment as lyric contamination only when all of these hold: (1) it overlaps a recognized-song candidate `timeRange` or a music-vocals segment by at least **0.75 seconds** or **50%** of the dialogue segment, (2) its text has strong lexical overlap with canonical song lyrics or the matched lyric fragments, (3) the dialogue confidence is **<= 0.96** or the segment is very short/refrain-like, and (4) there is no strong spoken-dialogue signal such as surrounding conversational context or a neighboring same-speaker sentence that forms a coherent spoken run. Matching contaminated dialogue segments should be removed from the **reconciled** dialogue artifact, not from the raw artifact.
- **Near-miss lyric correction rule:** only correct a music-vocals segment to canonical famous-song lyrics when the segment already lands inside the recognized-song time range, the recognized song passes the gate above, and the existing segment text is a clear near-miss rather than a different plausible utterance. Concretely: require segment confidence **>= 0.85**, lexical similarity to a canonical lyric line of roughly **0.70+**, timing alignment within the candidate time range, and no competing candidate with similar confidence. Example: `Control your master` may be normalized to canonical `Obey your master`; clearly different spoken lines must not be rewritten.
- **Safeguards / no-overcorrection policy:** do **not** correct or remove anything when song status is `possible`/`multiple_possible`, when multiple candidate songs remain live, when matched lyrics are sparse, when overlap is weak, or when the text could plausibly be intentional trailer dialogue. Unknown or non-famous songs should remain untouched. This pass is only for high-confidence famous-song grounding and should prefer false negatives over false positives.
- **Output artifacts / paths:** preserve raw artifacts at existing paths:
  - `phase1-gather-context/dialogue-data.json`
  - `phase1-gather-context/music-data.json`
  - `phase1-gather-context/music-vocals-data.json`
  Emit reconciled companions alongside them:
  - `phase1-gather-context/dialogue-data.reconciled.json`
  - `phase1-gather-context/music-vocals-data.reconciled.json`
  - `phase1-gather-context/famous-song-reconciliation.json` (decision ledger containing trigger evidence, removed dialogue segment indexes, lyric corrections, skipped-correction reasons, and source artifact paths)
  `musicData` remains raw-only unless a later task proves a need for a reconciled companion.
- **Automatic baseline routing:** baseline resolution should be driven by the active config’s gather-context scripts. If `reconcile-famous-song-phase1.cjs` is present in the active config, downstream consumers must treat the reconciled dialogue/music-vocals files as the active baseline and fail fast if either reconciled file is missing. If that script is absent, downstream consumers must keep using the raw files with no error.
- **Benchmark/downstream consumer rule:** implement a single artifact-resolution helper so benchmark manifests, whole-video context assembly, and future chunk/video consumers all resolve Phase 1 inputs the same way: prefer `*.reconciled.json` only for runs whose active config includes the reconciliation script; otherwise resolve the legacy raw paths. Benchmarks should compare dialogue and music-vocals against the reconciled artifacts for reconciliation-enabled runs so gains register in scoring, while the raw artifacts stay available for audit and diffing.
- **Implementation scope control:** keep the first implementation whole-asset only, based on existing full-timeline `recognizedSong` and `vocal_segments` evidence. Do not introduce generic fuzzy routing, non-famous-song lyric repair, or music-lane text rewriting in the first pass.

---

### Task 2: Implement the reconciliation script and wire the reconciled baseline into downstream context

**Bead ID:** `ee-707o`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved famous-song reconciliation pass as a new script rather than overloading get-dialogue/get-music-vocals unless design review proves otherwise. Consume dialogueData, musicData, and musicVocalsData, resolve likely dialogue/music-vocals conflicts using recognizedSong evidence, remove likely wrong lyric claims, and correct near-miss lyric text only when safeguards are satisfied. Preserve the raw pre-reconciliation artifacts unchanged for audit/comparison, but produce reconciled dialogue/music-vocals baseline artifacts for downstream use. Wire downstream whole-video/chunk consumers and benchmark evaluation to use the reconciled baseline automatically when the reconciliation script is present in the active config, and otherwise fall back to raw artifacts without error. Add a fail-fast guard only for runs where reconciliation is configured but the reconciled artifacts are missing. Add focused tests, update this plan truthfully, commit after tests pass, and do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-reconciliation-pass.md`
- `configs/cod-test.yaml`
- `configs/cod-test-phase1-review.yaml`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/benchmark-runner.cjs`
- `server/run-pipeline.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `test/scripts/tool-wrapper-contract.test.js`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Implemented the first-pass reconciliation lane as a dedicated Phase 1 script at `server/scripts/get-context/reconcile-famous-song-phase1.cjs` plus a shared baseline resolver at `server/lib/phase1-baseline-resolution.cjs`.

What shipped:
- The new script reads `dialogueData`, `musicData`, and `musicVocalsData`, preserves the raw artifact files untouched, and writes:
  - `phase1-gather-context/dialogue-data.reconciled.json`
  - `phase1-gather-context/music-vocals-data.reconciled.json`
  - `phase1-gather-context/famous-song-reconciliation.json`
- The trigger stays conservative: reconciliation only applies for strong single-candidate `recognizedSong` evidence with matched lyric fragments and time-range overlap. Otherwise the script still emits reconciled companion files, but they remain identical to raw and the ledger records a skipped pass.
- Dialogue cleanup removes likely lyric contamination only when overlap, lyric similarity, and weak/short spoken evidence all align.
- Music-vocals correction only rewrites near-miss lyric text for confident in-range segments; weak/ambiguous evidence is left unchanged.
- Baseline routing is now centralized in `server/lib/phase1-baseline-resolution.cjs` and used by:
  - `server/lib/persisted-artifacts.cjs` for later phase-only hydration
  - `server/lib/benchmark-runner.cjs` so reconciliation-enabled runs benchmark against reconciled dialogue/music-vocals outputs
  - `server/run-pipeline.cjs` because persisted-artifact hydration now passes the active config through the resolver
- `configs/cod-test.yaml` and `configs/cod-test-phase1-review.yaml` now include the reconciliation script so those runs opt into reconciled baselines automatically.

Focused validation completed:
- `node --test test/scripts/reconcile-famous-song-phase1.test.js test/scripts/tool-wrapper-contract.test.js test/lib/benchmark-runner.test.js`
- `npm run validate-configs`

Focused test coverage added for:
- raw artifact preservation
- reconciled artifact + ledger creation
- conditional persisted/baseline routing to reconciled outputs when configured
- fail-fast only when reconciliation is configured but the reconciled artifact is missing
- no overcorrection when recognized-song evidence is weak/ambiguous

Caveats / scope intentionally not expanded in this task:
- `musicData` remains raw-only; no reconciled music companion was introduced.
- The first implementation is whole-asset only and depends on the existing `recognizedSong` + matched-lyric evidence already present in Phase 1 outputs.
- No fresh `cod-test` rerun or benchmark delta review was done here; that remains Task 3.

---

### Task 3: Run a fresh cod-test and compare reconciled vs raw behavior

**Bead ID:** `ee-hk49`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the reconciliation pass lands, run a fresh cod-test and compare the resulting reconciled baseline behavior against the prior raw-only runs. Capture whether dialogue contamination decreases, whether music-vocals lyric corrections improve truthfulness, and whether whole-video/chunk baseline context is measurably better. Update this plan truthfully with exact command, artifacts, benchmark deltas, and review conclusions. Do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-reconciliation-pass.md`
- fresh rerun artifacts/logs/reports

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-05*
