# emotion-engine: add time-aware segment alignment to benchmark scoring for dialogue and music-vocals

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Reduce benchmark score distortion from index-based segment comparison by adding time-aware segment alignment for dialogue and `music-vocals`, while preserving strict visibility into real semantic and timing mistakes.

---

## Overview

The ignore-path lane removed output-only operational metadata from core scoring, which made the benchmark more honest without hiding real content problems. The next major distortion is index-by-index segment comparison: once one early merge, split, or timing drift happens, later segments can be judged against the wrong truth entries and the score cascades downward harder than a human would judge.

This lane should address that specific failure mode. The target is not to make scoring lax; it is to align output segments to the most plausible truth segments using time-aware matching before semantic comparison. We should keep real misses visible: wrong text, missing segments, extra segments, and serious timing drift should still count. But small merge/split effects and mild timing shifts should stop poisoning the rest of the lane.

The safest path is to begin with design: inspect the current comparator/profile architecture, decide where segment alignment belongs, define matching rules and tie-break behavior, and decide how to report matched, unmatched, merged, split, and ambiguous cases. Then implement the alignment for dialogue and music-vocals only, add focused tests, and compare before/after benchmark behavior against the latest reconciled run.

---

## Tasks

### Task 1: Design time-aware alignment rules for dialogue and music-vocals scoring

**Bead ID:** `ee-6rwg`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current benchmark comparator/profile architecture and design a time-aware segment alignment strategy for dialogue and music-vocals scoring. Define candidate matching rules, tie-break behavior, handling for split/merged segments, handling for unmatched truth/output segments, and how these cases should appear in reports. Update this plan truthfully with exact files involved, proposed algorithm, and design decisions. Do not change code yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `test/lib/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`
- `server/lib/benchmark-runner.cjs` (inspected)
- `test/lib/benchmark-runner.test.js` (inspected)
- `benchmarks/fixtures/cod-test/benchmark.json` (inspected)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` (inspected)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` (inspected)
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` (inspected)
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` (inspected)
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` (inspected)

**Status:** ✅ Complete

**Results:** Inspected the current comparator architecture in `server/lib/benchmark-runner.cjs`. Today, arrays either align by explicit keys (`chunk-analysis-default`, `emotional-analysis-default`) or fall back to raw index order. `dialogue-default` and `music-vocals-default` currently use the raw-index path, so one missing/merged segment causes every later segment to be compared against the wrong truth item. The live cod-test reports show exactly that cascade: dialogue misalignment after the missing `"You shall know fear."` line drags later spoken segments onto the wrong truth rows, and music-vocals misalignment from earlier truth-only chant segments drags the whole lyric sequence forward.

**Design decisions:**
- Add a narrow time-aware alignment lane only for `$.dialogue_segments` under `dialogue-default` and `$.vocal_segments` under `music-vocals-default`.
- Keep the implementation inside the benchmark comparator/reporting flow, centered in `server/lib/benchmark-runner.cjs`, with focused regression coverage in `test/lib/benchmark-runner.test.js`.
- Use monotonic one-to-one alignment, not global fuzzy transcript scoring. We still want real semantic/timing errors to fail; we only want to stop index drift from poisoning later comparisons.
- Candidate matches are truth/output segment pairs whose timing is plausibly related: primary signal is interval overlap; fallback is near-start/near-end/near-center timing within a bounded search window so short adjacent segments can still align when overlap is light.
- Candidate ranking / tie-breaks: prefer larger overlap ratio first, then smaller center-time delta, then smaller start-time delta, then smaller absolute index drift. This preserves local timeline order and favors the human-obvious match.
- Alignment should be monotonic across the array: once a later output segment is matched to a later truth segment, earlier truth segments cannot be matched afterward. This avoids pathological crossovers.
- Split/merged handling for this lane is intentionally conservative:
  - one truth segment split into multiple output segments: match the best single output segment to that truth segment and leave the additional output segment(s) unmatched_output; report them explicitly instead of silently collapsing them.
  - multiple truth segments merged into one output segment: match the best single truth segment to that output segment and leave the remaining truth segment(s) unmatched_truth; report them explicitly.
  - if a split/merge suspicion exists because adjacent unmatched items overlap the matched partner’s time window, surface that suspicion in alignment metadata/reasons, but do not grant score credit for text that only exists across multiple unmatched segments.
- Unmatched truth segments should no longer become comparator `error`s for these two arrays. They should become scored structural `fail`s tied to the segment path/reason (for example `unmatched_truth_segment` / `unmatched_output_segment`) so the artifact can fail honestly without escalating to a hard comparator error just because lengths differ.
- Reporting shape: keep existing `fieldResults`/`failures` compatibility, but add alignment metadata at the artifact level for these arrays so reports can show matched pairs plus unmatched truth/output segments and why they were left unmatched. The report should make it obvious which penalties disappeared due to better alignment versus which real content/timing failures remain.
- Non-target arrays such as `speaker_profiles`, `recognizedSong.candidates[*].matchedLyrics`, or `recognizedSong.candidates[*].timeRanges` stay on the existing comparator behavior in this lane. The change is intentionally narrow to dialogue/music-vocals primary segment arrays.

**Proposed algorithm:**
1. Detect whether the current array path is an alignment-enabled path (`dialogue_segments` or `vocal_segments`) for the current comparator profile.
2. Build candidate pairings using timing fields (`start`, `end`) and original indexes. A pair is eligible if it has positive overlap, or if its start/center/end delta is within a bounded alignment window derived from `timingToleranceSeconds` (for this lane, effectively several tolerance widths, wide enough to recover from one missed segment but not so wide that unrelated distant segments match).
3. Score each candidate by overlap ratio + timing closeness, then compute the best monotonic one-to-one assignment across the two ordered lists.
4. For matched pairs, recurse into normal object comparison using synthetic alignment-aware paths (so all the existing exact/fuzzy/tolerant leaf rules still apply).
5. For unmatched truth items, emit structural fails marking missing output coverage for that specific segment.
6. For unmatched output items, emit structural fails marking extra output segments.
7. Attach alignment metadata to the artifact result so before/after analysis can explain recovered matches, unmatched segments, and any suspected split/merge cases.

---

### Task 2: Implement time-aware alignment in the benchmark comparator for dialogue and music-vocals

**Bead ID:** `ee-u5z4`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the design is complete, implement time-aware segment alignment in the benchmark comparator/reporting flow for dialogue and music-vocals. Keep the implementation narrow to those lanes unless the architecture strongly prefers a reusable abstraction. Preserve visibility into real semantic/timing failures, update this plan truthfully with the exact files and behavior changes, add focused tests, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Implemented narrow time-aware alignment for `dialogue-default`/`$.dialogue_segments` and `music-vocals-default`/`$.vocal_segments` in `server/lib/benchmark-runner.cjs`.

**Behavior changes:**
- Added `getTimeAwareArrayAlignmentConfig`, `getSegmentTiming`, `scoreTimeAwareSegmentCandidate`, and `alignTimeAwareSegments` helpers.
- The comparator now detects the two target array paths and runs a monotonic dynamic-programming alignment pass before recursing into per-field comparison.
- Candidate scoring prefers stronger time overlap, then closer center/start/end timing, then smaller index drift; this encodes the design tie-breaks into the alignment score.
- Matched pairs are now compared under alignment-aware paths like `dialogue_segments[truth=18,output=15].text`, which makes recovered alignment visible in reports.
- Unmatched truth/output segments for these arrays are emitted as structural `fail`s instead of hard array `error`s, preserving honest penalties without treating the whole tail as a comparator break.
- Artifact results now include an `alignments` section showing matches, unmatched truth/output segments, and split/merge suspicion reasons when nearby unmatched segments suggest that shape.
- Non-target arrays still use the prior behavior; keyed alignment stays unchanged for chunk analysis / emotional analysis arrays, and raw index comparison still applies outside the two targeted segment lanes.

**Tests added:**
- `benchmark runner - dialogue comparator uses time-aware alignment to avoid cascade after a missing middle segment`
- `benchmark runner - music-vocals comparator uses time-aware alignment to recover later lyric matches after early truth-only chant segments`

**Validation command:**
- `node --test test/lib/benchmark-runner.test.js`
- Result: 18/18 tests passed, including the two new alignment regressions.

---

### Task 3: Validate before-vs-after scoring with the latest reconciled run

**Bead ID:** `ee-2y1s`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after time-aware alignment is implemented, run the narrowest truthful benchmark comparison against the latest reconciled output and compare before/after results for dialogue and music-vocals. Show which penalties disappeared because of better alignment, which real failures remain, and whether the score now better matches human judgment. Update this plan truthfully with commands, artifacts, before/after numbers, and your recommendation on whether the alignment lane is sufficient or if further comparator changes are still needed.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`

**Status:** ✅ Complete

**Results:** Ran the narrowest truthful comparison by re-running only the benchmark stage against the existing reconciled outputs in `output/cod-test`.

**Commands used:**
- `node --test test/lib/benchmark-runner.test.js`
- `node - <<'NODE' ... runBenchmarkStage({ config, configPath, outputDir }) ... NODE` using `configs/cod-test.yaml`, `server/lib/benchmark-runner.cjs`, and the existing `output/cod-test` artifacts.
- `git show HEAD:benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `git show HEAD:benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `git show HEAD:benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

**Before vs after (checked-in reports at `HEAD` vs freshly rerun reports):**
- `dialogueData`
  - before: accuracy `0.29743589743589743`, passed `58`, failed `137`, errored `26`
  - after: accuracy `0.359375`, passed `69`, failed `123`, errored `19`
  - segment-array hard errors: `2 -> 0` (`dialogue_segments[18]` and `[19]` stopped erroring and are now aligned/scored)
- `musicVocalsData`
  - before: accuracy `0.4583333333333333`, passed `44`, failed `52`, errored `12`
  - after: accuracy `0.5060240963855421`, passed `42`, failed `41`, errored `5`
  - segment-array hard errors: `2 -> 0` (`vocal_segments[10]` and `[11]` stopped erroring and are now aligned/scored)
- benchmark summary totals
  - before: passed `1506`, failed `1452`, errored `78`
  - after: passed `1515`, failed `1427`, errored `59`

**Penalties that disappeared because of better alignment:**
- Dialogue: the old raw-index cascade used to drop the tail entirely once truth/output counts diverged, which produced hard errors for `dialogue_segments[18]` (`No more games! This ends now.`) and `dialogue_segments[19]` (`Get the Reznov challenge pack when you preorder now!`). After alignment, those segments are compared as `dialogue_segments[truth=18,output=15]` and `dialogue_segments[truth=19,output=17]`, so timing/text/speaker issues are scored honestly instead of the tail vanishing behind array drift.
- Music-vocals: the old raw-index comparator incorrectly penalized the whole lane from the opening missing chant fragments onward (`vocal_segments[0].start`, `[0].end`, `[1].text`, `[2].start`, `[2].end`, etc.). After alignment, the later lyric run is re-anchored to its true timing window (`truth 2 -> output 0`, `truth 3 -> output 2`, `truth 4 -> output 3`, `truth 6 -> output 4`, `truth 7 -> output 5`, `truth 9 -> output 6`, `truth 11 -> output 9`), so those cascade timing penalties disappear.

**Real failures that remain visible after alignment:**
- Dialogue still has real transcript/speaker issues in matched segments, for example:
  - `dialogue_segments[truth=2,output=2].text` (truncated / partial line)
  - `dialogue_segments[truth=3,output=3].text` (merged extra phrase)
  - `dialogue_segments[truth=7,output=6].text` (semantic paraphrase drift)
  - `dialogue_segments[truth=17,output=14].speaker*` and `confidence` (voice attribution mismatch)
  - unmatched truth segments at `truth=4`, `truth=13`, `truth=15`, and unmatched output `output=16`
- Music-vocals still has real content issues, for example:
  - `truth=2 -> output=0` still compares `"Master of puppets I’m pulling your strings"` against `"Obey your master"`
  - `truth=3 -> output=2`, `truth=4 -> output=3`, `truth=6 -> output=4`, `truth=7 -> output=5`, `truth=9 -> output=6` remain semantically wrong even though timing now lines up
  - unmatched truth segments at `truth=0`, `1`, `5`, `8`, `10` and unmatched outputs at `output=1`, `7`, `8` make the missing/split/merged cases explicit
- Both artifacts still end in overall `error` because non-target arrays (`speaker_profiles` in dialogue; `recognizedSong.candidates[*]`, `recognitionNotes`, `qualityNotes` in music-vocals) still use the prior structural comparator behavior and still produce hard errors.

**Recommendation:**
- The new alignment lane is clearly worth keeping. It improves score fidelity for the two targeted segment arrays and better matches human judgment because later segments are no longer punished just because an earlier segment went missing.
- It is **not** sufficient to make either artifact pass overall. The remaining benchmark pain is now more honestly concentrated in two places:
  1. genuine transcript/content/speaker mistakes in the reconciled output; and
  2. non-target structural comparator behavior on related arrays (`speaker_profiles`, `recognizedSong.*`, note lists).
- If the goal is specifically better human-aligned scoring for dialogue/music-vocals primary segment arrays, this lane is sufficient. If the goal is to remove the remaining artifact-level `error` statuses, the next comparator changes should target adjacent structured arrays separately rather than broadening this segment matcher into a generic fuzzy system.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Narrow time-aware benchmark alignment for `dialogue_segments` and `vocal_segments`, implemented directly in `server/lib/benchmark-runner.cjs` with focused regression coverage in `test/lib/benchmark-runner.test.js`. The comparator now aligns those arrays by timing before field comparison, records alignment metadata in artifact reports, and converts unmatched segment cases into explicit structural fails instead of letting raw index drift corrupt the rest of the lane.

**Commits:**
- None in this subagent session (per instruction, did not push).

**Lessons Learned:** Keeping the change scoped to the primary segment arrays was the right trade-off. It materially improved score honesty for dialogue/music-vocals without obscuring real semantic failures, but neighboring structured arrays still need their own comparator strategy if we want artifact-level status to reflect human judgment end-to-end.

---

*Completed on 2026-04-06*
