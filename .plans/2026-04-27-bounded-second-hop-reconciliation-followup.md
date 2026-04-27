# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement one extra bounded generic reconciliation hop for recognized-song lyric contamination, rerun `cod-test`, and verify whether the remaining three lyric lines are removed without harming legitimate spoken dialogue.

---

## Overview

The first generic reconciliation fix materially improved reconciled dialogue by removing most of the lyric contamination block and recovering the benchmark from the failed rerun, but three lyric lines still remain. The current recommendation is to do one more narrow pass rather than broadening the system into open-ended cluster propagation.

This follow-up should add exactly one additional bounded hop inside an already-recognized-song contamination cluster, keeping all behavior generic and local. After that lands, we rerun against the existing chunk-based Phase 2 pipeline surface and audit whether the extra hop is worthwhile. Whole-video Phase 2 architecture questions are intentionally deferred until after this bounded reconciliation slice.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Prior reconciliation under-removal plan | `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md` |
| `REF-02` | Audit explaining sparse anchors + one-hop limitation | `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md` |
| `REF-03` | Post-fix QA note showing 81.3 / 81.7 and 3 remaining lyric lines | `docs/2026-04-27-famous-song-reconciliation-postfix-qa-note.md` |
| `REF-04` | Post-fix audit recommending bounded stop or one more narrow pass | `docs/2026-04-27-famous-song-reconciliation-postfix-audit.md` |
| `REF-05` | Live reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-06` | Live reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-07` | Current reconciled dialogue artifact with 3 remaining lyric lines | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-08` | Current reconciliation ledger | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |

---

## Tasks

### Task 1: Implement one extra bounded reconciliation hop

**Bead ID:** `ee-qaz8`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** Implement one extra bounded generic hop for recognized-song lyric contamination in `reconcile-famous-song-phase1.cjs`. Claim the bead on start. Keep it generic: no video-specific or song-specific logic. The new behavior should allow one additional local propagation step beyond the current first-hop direct-vocal-support promotion, but not open-ended chain walking. Add/update tests proving the second hop removes the remaining middle lyric lines in the generic sparse-anchor scenario while still preserving legitimate spoken neighbors and preventing unbounded propagation. Update this plan with exact implementation details, run relevant validation, commit/push by default, and close the bead when done.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

**Status:** ✅ Complete

**Results:** Added a `MAX_DIRECT_VOCAL_PROMOTION_HOPS = 2` bounded promotion path in `reconcileDialogue()` so low-confidence direct-vocal-supported lyric contamination can travel exactly one extra local hop beyond the existing first-hop behavior without turning into open-ended propagation. The patch keeps the recognized-song gate, low-confidence fence, lyric-like neighbor screening, and `reconcileMusicVocals()` behavior intact. Updated tests now prove: (1) sparse-anchor cleanup reaches a true second-hop middle lyric line, (2) propagation stops before a third hop, and (3) legitimate spoken neighbors still remain preserved. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js`.

---

### Task 2: Rerun cod-test after the bounded second hop

**Bead ID:** `ee-k8qa`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** After the bounded second-hop fix lands, claim the bead and rerun the canonical `cod-test` pipeline. Compare the new reconciled dialogue result against both the prior post-fix run (`81.3 / 81.7 / extra_output_window_count 1`) and the earlier high-score baseline. Focus on whether the remaining three lyric lines are removed, whether any legitimate spoken lines are wrongly deleted, and whether the weak-line issue remains unchanged. Update this plan with exact commands, artifacts, and findings; write a concise QA note if useful; close the bead when done.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `docs/2026-04-27-bounded-second-hop-reconciliation-rerun-qa-note.md`
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

**Status:** ✅ Complete

**Results:** Claimed the bead with `bd update ee-k8qa --status in_progress --json`. Canonical validation/rerun commands executed from repo root:
1. `set -a && . ./.env && set +a && node validate-configs.cjs`
2. `set -a && . ./.env && set +a && node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`
3. After a transient first-attempt `OpenRouter: read ECONNRESET` failure in `server/scripts/get-context/get-dialogue.cjs`, reran step 2 successfully through Phase 1-3; it then exited non-zero at the expected benchmark-stage failure surface after refreshing the artifacts/reports.

Fresh rerun finding: the bounded second-hop logic did **not** get exercised on this canonical rerun because the fresh vocals recognition regressed and the reconciliation gate skipped entirely. `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` now shows `status: "skipped"`, trigger failures `statusRecognized`, `confidenceStrong`, `singlePrimaryCandidate`, `sufficientMatchedLyrics`, and `hasSupportingMusicConsensus`, with `recognizedSong.status: "unknown"`, `confidence: 0`, `candidates: []`, and `removedDialogueSegments: []`.

That means the remaining lyric lines were **not** removed; the reconciled dialogue instead re-expanded to a full lyric burst in `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`: indexes `13` `Obey your master`, `14` `Come crawling faster`, `15` `Master of puppets, I'm pulling your strings`, `16` `Twisting your mind and smashing your dreams`, `17` `Blinded by me, you can't see a thing`, `18` `Just call my name, 'cause I'll hear you scream`, `19` `Master, master`, `20` `Just call my name, 'cause I'll hear you scream`, `21` `Master, master`, plus late index `27` `Obey your master`.

Fresh benchmark comparison from `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`:
- earlier high-score baseline: `dialogue_text_full_transcript_pct=90.7`, `dialogue_text_windowed_pct=90.7`, `extra_output_window_count=0`
- prior post-fix run (`REF-03`): `dialogue_text_full_transcript_pct=81.3`, `dialogue_text_windowed_pct=81.7`, `extra_output_window_count=1`
- fresh bounded-second-hop rerun: `dialogue_text_full_transcript_pct=65.8`, `dialogue_text_windowed_pct=66.5`, `dialogue_boundary_pct=14.3`, `output_segment_count=29`, `extra_output_window_count=7`
- the fresh rerun is also slightly worse than the earlier failed rerun documented in `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md` (`66.5 / 67.2 / 6`)

Collateral-removal read: no legitimate spoken lines were wrongly removed by reconciliation in this run because reconciliation removed nothing. Nearby spoken lines still present in the reconciled artifact include `This isn't real.`, `The hell it ain't!`, `Pull it together, man`, `So eager to leave, David`, `Killing the man is a hell of a lot easier than killing the idea`, `You were never cut out to be a Mason`, `No more games, this ends now`, and the preorder line.

Weak-line status: unchanged. `You shall know fear.` remains absent from the fresh reconciled dialogue, and the fresh benchmark still aligns truth index `9` against output index `9` (`Spectre 1 report`) rather than recovering the line.

Wrote the concise QA note to `docs/2026-04-27-bounded-second-hop-reconciliation-rerun-qa-note.md`. References validated: `REF-03`, `REF-05`, `REF-07`, `REF-08`. 

---

### Task 3: Independent audit of the second-hop outcome

**Bead ID:** `ee-lang`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** Independently audit the post-rerun outcome after the bounded second-hop reconciliation fix. Claim the bead on start. Verify whether the score change is real, whether the remaining lyric contamination was actually reduced for the right reason, whether legitimate spoken dialogue stayed intact, and whether the bounded-hop design is good enough to stop on before deeper Phase 2 architecture work. Update this plan with the verdict and close the bead when done.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-bounded-second-hop-reconciliation-audit-note.md`
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

**Status:** ✅ Complete

**Results:** Independent audit confirms the bad rerun is mainly explained by upstream recognized-song failure, not by evidence that the bounded second-hop implementation regressed dialogue reconciliation. `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows `status: "skipped"` with failed trigger reasons `statusRecognized`, `confidenceStrong`, `singlePrimaryCandidate`, `sufficientMatchedLyrics`, and `hasSupportingMusicConsensus`; `trigger.recognizedSong` is `status: "unknown"`, `confidence: 0`, `candidates: []`; and `decisions.removedDialogueSegments` is empty. Because `buildRecognitionGate()` must pass before `reconcileDialogue()` can remove any lyric contamination, the new hop logic from `5ba0151` did not get a chance to execute on this run. Supporting evidence: `output/cod-test/phase1-gather-context/music-vocals-data.json` still contains eleven sung lyric segments (`"Obey your master"`, `"Master of puppets, I'm pulling your strings"`, `"Master, master"`, etc.), while `output/cod-test/phase1-gather-context/music-data.json` independently reports `recognizedSong.status: "possible"` for `Master of Puppets` at `confidence: 0.7`, so the failure is in recognition activation/gating rather than absence of lyric material. Recommendation: do not judge the bounded second-hop logic from this rerun; treat it as landed and unit-tested but unproven under live rerun conditions, and prioritize recognized-song stability/diagnostics before further reconciliation evaluation. Wrote concise audit note to `docs/2026-04-27-bounded-second-hop-reconciliation-audit-note.md`. References validated: `REF-03`, `REF-04`, `REF-05`, `REF-07`, `REF-08`.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented and validated a bounded second-hop lyric-reconciliation change, reran the canonical `cod-test` pipeline, and independently audited the failed rerun. The audit distinguishes implementation correctness from live-run instability: the rerun regression is best explained by upstream recognized-song detection failing to activate, which caused reconciliation to skip before the new logic could run.

**Reference Check:** `REF-03`, `REF-04`, `REF-05`, `REF-07`, and `REF-08` were all rechecked during audit. No evidence from the live rerun contradicts the implementation behavior proven by commit `5ba0151` and its tests; the live run simply did not reach that path.

**Commits:**
- `5ba0151` - Add bounded second-hop lyric reconciliation

**Lessons Learned:** A single live rerun is not a valid reconciliation verdict when the recognized-song gate is unstable. Separate "recognizer activated reliably" from "reconciliation behaved correctly once activated," otherwise regressions get misattributed.

---

*Planned on 2026-04-27*