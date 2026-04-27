# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate why recognized-song detection in the music-vocals lane sometimes collapses to `unknown` on canonical `cod-test` reruns, then propose a narrow fix or diagnostic improvement before further reconciliation evaluation.

---

## Overview

The bounded second-hop reconciliation work is implemented, tested, and pushed, but the latest canonical rerun did not exercise it because famous-song reconciliation never activated. The upstream gate failed when `music-vocals-data.json` returned `recognizedSong.status: "unknown"`, `confidence: 0`, and no candidates, even though lyric material was still present and the music lane independently reported a possible `Master of Puppets` match. That means we currently have an observability and/or stability problem in recognized-song activation, and additional reconciliation reruns will stay noisy until this is understood.

This slice should focus on diagnosis first. We need to determine whether the instability comes from prompt behavior, validator acceptance, whole-asset vs chunk interplay, provider variance, recovery/merge behavior, or some mismatch between music and music-vocals recognized-song handling. The outcome of this slice should be an approval-ready fix or instrumentation plan, not blind repeated reruns.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Bounded second-hop follow-up plan and latest rerun notes | `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md` |
| `REF-02` | Latest rerun QA note showing reconciliation skipped | `docs/2026-04-27-bounded-second-hop-reconciliation-rerun-qa-note.md` |
| `REF-03` | Latest rerun audit note distinguishing gate failure from reconciliation logic | `docs/2026-04-27-bounded-second-hop-reconciliation-audit-note.md` |
| `REF-04` | Live music-vocals script | `server/scripts/get-context/get-music-vocals.cjs` |
| `REF-05` | Live music script | `server/scripts/get-context/get-music.cjs` |
| `REF-06` | Famous-song reconciliation gate logic | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-07` | Latest failed recognized-song artifact | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-08` | Latest failed reconciliation ledger | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-09` | Current benchmark artifact result for reconciled dialogue | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-10` | Prior memory about Phase 1/2 context path and earlier grounding work | `memory/2026-03-21.md` |

---

## Tasks

### Task 1: Audit recognized-song instability in the music-vocals lane

**Bead ID:** `ee-xjdx`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Audit why the music-vocals lane sometimes returns `recognizedSong.status: unknown` on canonical `cod-test` reruns even when lyric material is still present and the music lane reports a possible song candidate. Claim the bead on start. Inspect prompt/runtime flow, validator behavior, whole-asset/chunk path, merge/recovery surfaces, and any diagnostics/raw captures that can explain the instability. Produce a concise repo note with a ranked root-cause hypothesis list and exact proposed next-step edits or instrumentation Derrick can approve directly. Update this plan with exact findings and leave later tasks pending.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-recognized-song-instability-audit.md`
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/2026-04-27-recognized-song-instability-audit.md`. The audit found that the strongest root cause is chunk-merge behavior in `server/scripts/get-context/get-music-vocals.cjs`, not validator rejection: raw captures show chunk `0002` and `0003` both returned `recognizedSong.status: "recognized"` for `Master of Puppets`, while chunk `0004` returned `unknown`; the script currently stores a single mutable `lastChunkRecognizedSong` and overwrites earlier recognized results with any later truthy `recognizedSong` object, including `unknown`. Whole-asset `ECONNRESET` fallback increased exposure by removing the whole-asset backstop, but the concrete bug is the last-chunk-wins aggregation path (`lastChunkRecognizedSong` assignment around lines 557/870-871 and final selection around lines 910-912). Recommended next step: a narrow approval-ready change in `server/scripts/get-context/get-music-vocals.cjs` to choose the best chunk-level recognized-song result instead of the last one, plus a targeted regression test in `test/scripts/get-music-vocals.test.js` where earlier chunks recognize the song and the final chunk returns `unknown` without erasing the final artifact-level recognition. Tasks 2-4 remain pending by design.

---

### Task 2: Implement the approved narrow fix or instrumentation

**Bead ID:** `ee-gr93`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** After Derrick approves the proposed direction, implement the narrow recognized-song stability fix or diagnostic instrumentation in the owning script/runtime files. Claim the bead on start. Keep the change generic and focused on reliable recognized-song activation/observability rather than broader pipeline redesign. Add/update tests, run relevant validation, update this plan with exact changes, commit/push by default, and close the bead when done.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/get-music-vocals.test.js`
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ✅ Complete

**Results:** Replaced chunk-level `recognizedSong` last-write-wins behavior in `server/scripts/get-context/get-music-vocals.cjs` with a narrow best-of-chunks selector that preserves the strongest chunk result when whole-asset recognition is absent. The selector stays generic: it prefers stronger statuses (`recognized` > `possible` > `multiple_possible` > `unknown` > `none_present`), then higher confidence, then more matched lyric evidence, while otherwise preserving existing lane behavior. Added a focused regression in `test/scripts/get-music-vocals.test.js` that simulates a three-chunk run where the middle chunk recognizes `Master of Puppets` and the final chunk returns `unknown`; the final artifact now correctly preserves the earlier recognized result and lyric segment. Validation run: `node --test test/scripts/get-music-vocals.test.js` ✅.

---

### Task 3: Confirm with a canonical rerun

**Bead ID:** `ee-xjf5`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-01`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** After the approved stability fix/instrumentation lands, claim the bead and run the canonical `cod-test` pipeline again. Verify whether recognized-song activation becomes reliable enough for reconciliation to run, and record the resulting dialogue reconciliation behavior and benchmark movement. Update this plan with exact commands, artifacts, and findings; write a concise QA note if useful; and close the bead when done.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- refreshed `output/cod-test/**` rerun artifacts
- refreshed `benchmarks/fixtures/cod-test/_reports/**` benchmark reports
- `docs/2026-04-27-recognized-song-instability-postfix-qa-note.md`
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ✅ Complete

**Results:** Ran the canonical rerun path as `set -a && . ./.env && set +a && node validate-configs.cjs && node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`. `node validate-configs.cjs` passed, and the rerun refreshed `output/cod-test/**` plus `benchmarks/fixtures/cod-test/_reports/**`; log: `.logs/cod-test-20260427-133555-ee-xjf5-rerun.log`. The core stability objective was met: fresh `output/cod-test/phase1-gather-context/music-vocals-data.json` preserved a strong recognized-song result instead of collapsing to `unknown` (`status: "recognized"`, `confidence: 0.95`, one `Master of Puppets` candidate, seven matched lyric fragments, `multipleSongsDetected: false`). Fresh `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` then shows reconciliation activating successfully (`status: "applied"`, `trigger.passed: true`, no failing trigger reasons) with six dialogue removals at indexes `13, 14, 15, 17, 23, 24`. The refreshed dialogue benchmark report at `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` improved materially versus both comparison points: current rerun `dialogue_text_full_transcript_pct=92.9`, `dialogue_text_windowed_pct=93.1`, `dialogue_boundary_pct=0.0`, `output_segment_count=20`, `extra_output_window_count=0`; prior known-good post-fix run documented in `docs/2026-04-27-famous-song-reconciliation-postfix-qa-note.md` was `81.3 / 81.7 / 1`; recent failed rerun documented in `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md` was `66.5 / 67.2 / 6`. The refreshed reconciled dialogue artifact still is not perfect—`output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` keeps an anomalous line `"Your life burns faster"` and the benchmark summary still ends red overall (`0/7 artifacts passed`, `373/680` scoreable fields passed, truth coverage `680/1182`)—but this QA lane confirms the recognized-song activation no longer collapsed in this rerun and reconciliation finally had a fair chance to execute. Wrote concise QA note to `docs/2026-04-27-recognized-song-instability-postfix-qa-note.md`. No provider/runtime instability (such as the earlier whole-asset `ECONNRESET` fallback shape) surfaced in this rerun beyond the expected benchmark-stage failure.

---

### Task 4: Independent audit of the stabilization outcome

**Bead ID:** `ee-mx55`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** Independently audit the post-fix/post-rerun outcome. Claim the bead on start. Verify whether recognized-song instability was actually addressed, whether reconciliation finally had a fair chance to execute, and what that means for the next Phase 1/Phase 2 decisions. Update this plan with the verdict and close the bead when done.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-recognized-song-instability-outcome-audit.md`
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ✅ Complete

**Results:** Independently audited the live rerun against the post-fix artifacts, the reconciliation ledger, the benchmark reports, the truth fixtures, and the landed fix in `server/scripts/get-context/get-music-vocals.cjs` (`git show eb2860b -- server/scripts/get-context/get-music-vocals.cjs test/scripts/get-music-vocals.test.js`). Verdict: the recognized-song collapse bug was actually fixed in the live rerun. Fresh `output/cod-test/phase1-gather-context/music-vocals-data.json` now preserves `recognizedSong.status: "recognized"`, `confidence: 0.95`, one `Master of Puppets` candidate, and seven matched lyric fragments instead of regressing to `unknown`. Fresh `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows `status: "applied"` / `trigger.passed: true`, proving reconciliation finally got a fair chance to execute, and it removed the six expected lyric-contamination dialogue segments (`13, 14, 15, 17, 23, 24`). The dialogue benchmark improvement in `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` (`92.9 / 93.1`, `extra_output_window_count=0`) is therefore attributable to the expected cause: reconciliation could finally remove obvious lyric contamination after the music-vocals artifact kept the recognized-song identity. The remaining reconciled line `"Your life burns faster"` is real but belongs to a different slice: it survives because the current recognized-song matched-lyrics set did not include that exact line, so the current policy had no direct support to remove it, even though benchmark truth also contains that lyric on the music-vocals side. That makes it a content-quality / lyric-coverage follow-up, not evidence that recognized-song instability remains unresolved. Wrote concise audit note to `docs/2026-04-27-recognized-song-instability-outcome-audit.md`. This instability slice is complete enough to move on.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Diagnosed and fixed the music-vocals recognized-song collapse caused by last-chunk overwrite behavior, validated the change with a targeted regression test, reran the canonical `cod-test` pipeline, and independently confirmed that the fix held up in live artifacts and re-enabled famous-song reconciliation.

**Reference Check:** `REF-04`, `REF-06`, `REF-07`, `REF-08`, and `REF-09` were satisfied for this slice. The fix changed the `music-vocals` aggregation behavior in the narrow place the audit identified, the rerun artifact preserved recognized-song identity, the reconciliation gate passed, and the downstream dialogue benchmark improvement matched the expected lyric-removal effect. Remaining `"Your life burns faster"` contamination is tracked here as an out-of-scope follow-up issue rather than a reference failure for this slice.

**Commits:**
- `eb2860b` - Fix music vocals recognized-song chunk aggregation

**Lessons Learned:** A provider/runtime wobble can expose aggregation bugs that were previously masked by whole-asset success, so chunk fallback paths need their own durable winner-selection logic rather than last-write-wins state. Also, once reconciliation is finally allowed to run, remaining transcript anomalies should be triaged separately as content-quality or policy-coverage issues instead of being lumped back into recognition stability.

---

*Planned on 2026-04-27*