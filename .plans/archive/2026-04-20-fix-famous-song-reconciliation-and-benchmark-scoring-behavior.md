# Emotion Engine

**Date:** 2026-04-20  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Fix the benchmark behavior so completed `cod-test` runs score dialogue vs music-vocals content in a way that matches design intent: sung-vocals leakage left inside dialogue should be correctly reconciled into the separate music-vocals lane before benchmark comparison, rather than contaminating dialogue scoring.

---

## Overview

Current audit results show that the benchmark system is conceptually pointed at the reconciled surfaces, but in practice the current `cod-test` run did not get the intended behavior because famous-song reconciliation was skipped. The comparator itself does not rescue leaked lyric content by fallback; it simply scores whatever lands in the dialogue and music-vocals artifacts it is given.

That means the primary fix lane should target the **reconciliation gate and execution path**, not the comparator first. If reconciliation reliably rewrites the completed Phase 1 artifacts into the intended dialogue-vs-music-vocals split, then existing benchmark scoring can compare the right surfaces honestly. Only if reconciliation cannot be made reliable enough should we add a narrower comparator-side tolerance/remap fallback.

This plan therefore prioritizes: reproduce the reconciliation skip on the real benchmark shape, fix the gate/conditions in the famous-song reconciliation path, verify the reconciled artifacts actually differ when leakage exists, rerun the relevant comparator surfaces, and only then decide whether an additional comparator-side fallback is still necessary.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Readiness + scoring audit proving current mismatch | `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-vs-music-vocals-benchmark-scoring-audit.md` |
| `REF-02` | Current cod-test benchmark config | `benchmarks/fixtures/cod-test/benchmark.json` |
| `REF-03` | Baseline-resolution code path | `server/lib/phase1-baseline-resolution.cjs` |
| `REF-04` | Benchmark runner code path | `server/lib/benchmark-runner.cjs` |
| `REF-05` | Famous-song reconciliation implementation | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-06` | Current reconciliation evidence artifact | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-07` | Current raw dialogue artifact | `output/cod-test/phase1-gather-context/dialogue-data.json` |
| `REF-08` | Current reconciled dialogue artifact | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-09` | Current raw music-vocals artifact | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-10` | Current reconciled music-vocals artifact | `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` |
| `REF-11` | Existing grouping comparator rerun command | `scripts/qa/run-cod-task8-speaker-grouping.cjs` |
| `REF-12` | Prior skip investigation note | `docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md` |

---

## Tasks

### Task 1: Reproduce and explain the real-run reconciliation skip on the current benchmark shape

**Bead ID:** `ee-lggd`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-12`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, inspect the current real cod-test artifacts and code paths to explain exactly why famous-song reconciliation skipped or produced no effective rewrite on the current benchmark shape. Identify the gate/condition mismatch precisely and produce a durable note that distinguishes configuration intent from actual runtime behavior.

**Status:** ✅ Complete

**Results:** Reproduced the current `cod-test` skip against live runtime artifacts and wrote a durable audit note at `docs/research/2026-04-20-current-cod-famous-song-reconciliation-skip-audit.md`.

What actually happened is narrower than the earlier 2026-04-08 investigation: on the current code/run, the skip is **not** caused by lyric-order evidence anymore. Replaying `buildRecognitionGate()` against the live artifacts shows `vocalLyricEvidence.hasIndexOrderEvidence = true` and `dialogueLyricEvidence.hasIndexOrderEvidence = true`. The actual blocker is that `dialogueLyricEvidence.hasLyricTextEvidence = false`, because the current dialogue contamination shape is one long paraphrased lyric mashup at `dialogue_segments[11]`, while the reconciler only checks dialogue text against the music-vocals candidate’s short `matchedLyrics` list (`Master, master`, `I'll be your master`, `Master of puppets, I'm pulling your strings`) using a relatively high similarity threshold. That fails to count as strong cross-lane evidence, so the runtime gate falls back to requiring `musicData` supporting-song consensus. The supporting music lane is only `possible` at `0.64`, so the final skip reason remains `hasSupportingMusicConsensus`.

Configuration intent vs runtime behavior is now explicit in the note: `configs/cod-test.yaml` plus `server/lib/phase1-baseline-resolution.cjs` make the benchmark consume reconciled file paths whenever the reconciliation script is configured, but `server/scripts/get-context/reconcile-famous-song-phase1.cjs` still requires a second, stronger runtime authorization gate before any rewrite happens. On this run, the benchmark therefore scores `dialogue-data.reconciled.json` / `music-vocals-data.reconciled.json` even though both reconciled files are byte-identical to raw and the ledger status is `skipped`.

Concrete handoff for implementation bead `ee-hc0p`: do **not** primarily chase the old monotonic lyric-order theory; target the runtime dialogue-contamination evidence gate instead so this real benchmark shape can reach `status: applied` and produce materially different reconciled artifacts before scoring.

---

### Task 2: Implement the reconciliation-path fix so leaked vocals are actually moved/split before scoring

**Bead ID:** `ee-hc0p`  
**SubAgent:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`, `REF-12`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, implement the smallest durable fix that makes famous-song reconciliation actually apply on the real benchmark shape. The target behavior is that when dialogue output contains song lyrics/vocals that belong in the separate music-vocals lane, the reconciliation step rewrites the reconciled artifacts accordingly before benchmark scoring. Preserve honesty and provenance; do not fake a green comparator.

**Status:** ✅ Complete

**Results:** Implemented a scoped runtime fix in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` that targets the actual current blocker from Task 1: dialogue lyric evidence was too strict because it only accepted a direct high-similarity match against the short `matchedLyrics` list. The new behavior keeps the strong recognized-song gate intact, but when evaluating the dialogue lane it now also allows a **composite anchored contamination bundle**: a low-confidence dialogue segment can count as lyric evidence if it carries multiple anchored phrase supports across the recognized song’s matched lyrics plus the actual music-vocals segment texts. This is specifically aimed at the current real leakage shape where one long paraphrased mashup contains several lyric anchors (`Obey your master`, `Master, master`, `Twisting your mind`, `you can't see`) without being close enough to any single short lyric fragment under the old threshold.

The removal path was updated to consume that same gate evidence instead of requiring only the old direct match, so the reconciler now actually removes the contaminated dialogue segment once the gate authorizes reconciliation. That keeps the change scoped to reconciliation behavior and preserves the benchmark runner’s current contract of reading reconciled paths (`REF-03`, `REF-04`) rather than adding comparator-side fakery.

Validation performed:
- `node --test test/scripts/reconcile-famous-song-phase1.test.js` → pass (14/14), including a new regression case that mirrors the current long-form `Master of Puppets` dialogue mashup shape.
- Replayed the reconciler on the live `output/cod-test` artifacts. The ledger flipped from `status: "skipped"` to `status: "applied"`, `trigger.reasons` became empty, `removedDialogueSegments` now records dialogue segment `11`, and the recorded evidence shows the new `composite_anchor_bundle` with vocal support from phrases like `Twisting your mind and smashing your dreams` and `Blinded by me, you can't see a thing`.
- Live artifact delta check after replay: `dialogue-data.reconciled.json` dropped from 18 to 17 segments and no longer contains the leaked lyric mashup, while `music-vocals-data.reconciled.json` now reflects one lyric normalization (`Obey your master!` → `I'll be your master`) where the existing correction rules already allowed it.

Concrete QA handoff for bead `ee-l3s6`: verify on the live `output/cod-test/phase1-gather-context/*` artifacts that (1) raw vs reconciled dialogue are no longer byte-identical, (2) ledger status is `applied`, (3) `removedDialogueSegments[0]` is the former dialogue segment 11 with `evidence.evidenceType = "composite_anchor_bundle"`, and (4) music-vocals reconciled output reflects the one permitted lyric correction without overcorrecting any of the skipped segments.

---

### Task 3: Verify reconciled artifacts differ meaningfully from raw artifacts when leakage exists

**Bead ID:** `ee-l3s6`  
**SubAgent:** `qa`  
**References:** `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, verify that after the fix, the reconciliation step produces meaningful differences between raw and reconciled dialogue/music-vocals artifacts on the leakage case. Confirm that lyric content is removed from reconciled dialogue where appropriate and represented in the reconciled music-vocals lane.

**Status:** ✅ Complete

**Results:** Inspected the live `output/cod-test/phase1-gather-context/*` reconciliation artifacts and wrote a durable QA note at `docs/research/2026-04-20-cod-famous-song-reconciliation-qa-verification.md`.

What actually happened is the fix now produces a real, scoped rewrite rather than byte-identical "reconciled" files. `famous-song-reconciliation.json` now reports `status: "applied"` with no trigger reasons. `dialogue-data.json` and `dialogue-data.reconciled.json` are no longer byte-identical: the reconciled dialogue lane drops from 18 segments to 17 by removing former segment `11`, the long lyric-mashup leakage segment. The ledger records that removal under `decisions.removedDialogueSegments[0]` with `index = 11` and `evidence.evidenceType = "composite_anchor_bundle"`, backed by anchor hits from both matched lyrics and nearby vocal-segment phrases.

The music-vocals lane changed in a deliberately narrow way. `music-vocals-data.json` and `music-vocals-data.reconciled.json` differ, but only one segment text was normalized: vocal segment `4` changed from `Obey your master!` to `I'll be your master`, exactly matching the single entry in `decisions.lyricCorrections`. Segment count stayed 14→14, and the ledger’s skipped corrections for segments `3`, `5`, `8`, `9`, `10`, and `12` remained skipped and unchanged in the reconciled artifact, so the fix did not overcorrect the rest of the vocal lane.

Concrete handoff for auditor bead `ee-gz79`: the reconciliation-path QA gate is satisfied; audit can now focus on rerunning comparator surfaces to determine whether benchmark evidence now reflects the intended dialogue-vs-music-vocals split, rather than spending more time on whether reconciliation actually rewrote the artifacts.

---

### Task 4: Rerun the relevant comparison surfaces and decide whether comparator-side fallback is still needed

**Bead ID:** `ee-gz79`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-05`, `REF-08`, `REF-10`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, rerun the relevant comparator surfaces after the reconciliation fix and determine whether the benchmark evidence now matches intended design. If reconciliation alone is still insufficient, specify whether a comparator-side tolerance/remap fallback is still justified and exactly what problem it would solve.

**Status:** ✅ Complete

**Results:** Reran the comparison layer without re-calling upstream models by refreshing both (1) `node scripts/qa/run-cod-task8-speaker-grouping.cjs` and (2) the benchmark stage directly against the existing `output/cod-test` artifacts via `runBenchmarkStage()` loaded from `server/lib/benchmark-runner.cjs`. Wrote the durable audit note at `docs/research/2026-04-20-cod-benchmark-postfix-dialogue-vs-vocals-audit.md`.

What actually happened: the benchmark remains red overall, but the evidence now reflects the intended dialogue-vs-music-vocals split materially better than before. `famous-song-reconciliation.json` is now `status: "applied"`, the reconciled dialogue lane shrank from 18 to 17 segments by removing the former lyric-mashup segment 11, and refreshed `dialogueData.json` now benchmarks the reconciled surface without that leaked `Master of Puppets` blob present in dialogue. The refreshed dialogue artifact improved to `19/39` scoreable passes (`0.4872`) with only `2` deferred-contract drift mismatches left; the remaining dialogue reds are mostly honest transcript/summary/contract mismatches rather than cross-lane contamination.

The music-vocals surface remains red (`44/89` scoreable passes, `0.4944`), but its remaining failures are now the right kind of failures to own in that lane: extra vocal segments, lyric ordering/content mismatches, performer/delivery labeling drift, and missing evidence/time ranges. Speaker grouping also reran successfully and stayed red for its own runtime-alignment/reuse reasons (`9` mismatches across reuse misses, assignment drift, and one extra/missing segment case), which are unrelated to the dialogue-vs-vocals lane-routing bug.

Audit conclusion: **comparator-side fallback is no longer needed for the original dialogue-vs-music-vocals contamination problem.** The reconciliation-path fix is sufficient to route the leaked lyric material into the intended lane before scoring. Any future comparator tuning should target separate residual issues (for example performer-label aliasing or other narrowly-scoped truth/runtime tolerance), not lane-routing rescue.

---

### Task 5: Consolidate final readiness for broader reruns

**Bead ID:** `ee-au9z`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-05`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, consolidate the implementation, QA, and audit results into a crisp readiness call for broader reruns. State whether the benchmark now behaves according to intended dialogue-vs-music-vocals design, what still remains red honestly, and the exact next safe rerun command/lane.

**Status:** ✅ Complete

**Results:** Consolidated the implementation, QA, and audit outputs into the final readiness call: the benchmark now behaves according to the intended dialogue-vs-music-vocals lane-routing design because reconciliation is genuinely applied before scoring, but the repo is not green overall. Remaining red is now honest residual work in `musicVocalsData`, dialogue summary/transcript/trait drift, and speaker-grouping runtime alignment, not the old contamination bug. Exact next-safe lane after this fix was to continue with real residuals rather than add comparator-side fallback, starting with dialogue summary/transcript contract drift on the v3 dialogue surface.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Reproduced the real reconciliation skip cause on the live benchmark shape, fixed the reconciliation gate so long-form lyric contamination is actually authorized and removed before scoring, QA-verified that reconciled dialogue/music-vocals artifacts now differ meaningfully from raw, and re-ran the relevant comparator surfaces to prove the original dialogue-vs-music-vocals contamination bug is resolved without comparator-side fallback.

**Reference Check:** `REF-01` remains the historical proof of the pre-fix scoring problem; `REF-05`/`REF-06` now show a real `applied` reconciliation ledger and material raw-vs-reconciled artifact delta; `REF-08` and `REF-10` now represent the intended post-reconciliation scoring surfaces; `REF-11` reruns confirm the remaining reds belong to their own residual lanes rather than the original lane-routing bug.

**Commits:**
- Pending wrap-up commit/push.

**Lessons Learned:** Fixing the reconciliation path upstream was the right lever. Once the benchmark consumed genuinely reconciled artifacts, the need for comparator-side rescue disappeared and the remaining benchmark red became much more useful because it reflects real residual product gaps instead of cross-lane contamination.

---

*Drafted on 2026-04-20*