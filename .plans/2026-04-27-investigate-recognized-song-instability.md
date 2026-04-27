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
- fresh rerun artifacts/reports
- optional QA note
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ⏳ Pending

**Results:** Pending.

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
- audit note if needed
- `.plans/2026-04-27-investigate-recognized-song-instability.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Planned on 2026-04-27*