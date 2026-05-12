# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Improve dialogue benchmark scoring so correct dialogue text is rewarded even when runtime output has split or merged line boundaries relative to the golden benchmark.

---

## Overview

Current dialogue scoring is over-penalizing structural drift when the underlying text content is mostly right but line boundaries differ. The most visible examples are one truth line being emitted as two runtime lines, or two truth lines being emitted as one runtime line. In those cases, the benchmark currently loses score both on alignment and on downstream per-line comparisons, which makes the total score look worse than the actual transcript fidelity.

This lane should preserve honest scoring while reducing punishment for benign boundary variance. We should explicitly separate: (1) text-content fidelity, (2) segmentation/boundary fidelity, and (3) downstream traits/grouping fidelity. That lets the benchmark still report split/merge problems without letting them dominate transcript-accuracy judgment when the spoken words are substantially correct.

Direction locked from Derrick’s feedback: do not spend time on a composite/weighted master score. Instead, every comparison surface against golden truth should report its own percentage out of 100. For dialogue text specifically, the preferred direction is a normalized whole-transcript accuracy percentage that compares all runtime dialogue text against all golden truth dialogue text, so split/merge drift does not dominate the text-accuracy result. Structural issues like segmentation drift should remain visible as separate percentages or diagnostics, not as a hidden weighting system.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current audit showing dominant drift is upstream dialogue surface and examples of split/merge issues | `docs/2026-04-24-current-dialogue-vs-benchmark-audit.md` |
| `REF-02` | Current dialogue truth fixture | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-03` | Current dialogue benchmark result surface | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-04` | Current reconciled runtime dialogue surface | `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` |
| `REF-05` | Existing benchmark/scoring implementation | `server/` |

---

## Tasks

### Task 1: Design scoring options for split/merge-tolerant dialogue evaluation

**Bead ID:** `ee-hauq`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Review the current dialogue benchmark scoring behavior and design scoring approaches that preserve honest text evaluation when runtime dialogue is split or merged differently from truth. Derrick’s current preference is: no composite/weighted master score; instead every comparison to golden truth should output a percentage out of 100. Compare at least these options: (1) concatenated/full-text normalized comparison as the primary dialogue-text percentage, (2) local many-to-many alignment windows as a secondary or diagnostic mechanism, (3) boundary/segmentation scoring reported as its own separate percentage or diagnostic, and (4) any hybrid reporting model you judge strongest without reintroducing a hidden weighted total. Cite how each option would behave on the known COD examples from REF-01. Recommend a preferred reporting/scoring model and explain tradeoffs, gaming risk, implementation complexity, and how to keep segmentation problems visible without letting them distort transcript text accuracy.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-dialogue-split-merge-scoring-options.md`
- `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md`

**Status:** ✅ Complete

**Results:** Completed the research/design writeup in `docs/2026-04-24-dialogue-split-merge-scoring-options.md`. Reviewed the current benchmark behavior and concrete COD evidence in `REF-01`, `REF-03`, and `REF-04`, plus the existing comparator behavior in `REF-05`. Compared four approaches: full-transcript normalized text scoring, local many-to-many alignment windows, separate boundary/segmentation scoring, and a no-rollup hybrid. Recommended a three-surface model with no composite score: `dialogue_text_full_transcript_pct` as the primary dialogue-text percentage, `dialogue_text_windowed_pct` as the local split/merge-tolerant corroborating percentage, and `dialogue_boundary_pct` as the explicit segmentation percentage. The memo includes implementation-ready output fields, alignment constraints, gaming-risk analysis, and COD example behavior for the split (`truth 0` vs runtime `0+1`), merge (`truth 4+5` vs runtime `5`), missing line (`truth 9`), wording corruption (`truth 7`, `16`), and punctuation/hyphenation drift (`truth 19`) cases. References validated: `REF-01`, `REF-03`, `REF-04`, `REF-05`. No code changes were made in this task; this was design-only research handoff for the coder lane.

---

### Task 2: Implement the chosen scoring model in benchmark code

**Bead ID:** `ee-nkmv`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-05`  
**Prompt:** After the scoring design is approved, implement the chosen split/merge-tolerant dialogue scoring model in the benchmark code. Preserve clear diagnostic reporting for segmentation drift, but prevent benign split/merge variance from crushing overall text-fidelity score. Add or update tests to prove the intended behavior on concrete examples.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md`

**Status:** ✅ Complete

**Results:** Implemented the recommended three-surface dialogue scoring model in `server/lib/benchmark-runner.cjs` with no composite/weighted master score. Dialogue artifact benchmark results now include a dedicated `dialogueScoring` block exposing `dialogue_text_full_transcript_pct` (headline whole-transcript token edit-distance percentage), `dialogue_text_windowed_pct` (secondary local many-to-many window percentage), and `dialogue_boundary_pct` (separate split/merge boundary percentage), plus supporting diagnostics for segment counts, split/merge counts, missing/extra window counts, normalization profile, and `window_alignments`. Preserved existing time-aware per-field benchmark diagnostics and structural failures so split/merge/missing/extra behavior is still inspectable, while the new headline transcript score is no longer crushed by benign boundary drift. Updated benchmark summary/report shaping so the three dialogue percentages and diagnostic counts render in artifact summaries and `benchmark-summary.md`. Added focused regression coverage in `test/lib/benchmark-runner.test.js` proving: (1) split+merge drift can retain `100%` transcript/windowed text while boundary score drops and split/merge events are surfaced, and (2) a missing-line case lowers transcript/windowed percentages while reporting `missing_truth_window_count` without inventing split/merge events. Validation run: `node --check server/lib/benchmark-runner.cjs && node --test test/lib/benchmark-runner.test.js test/lib/report-package-smoke.test.js`. References validated: `REF-01`, `REF-03`, `REF-05`. Landed in commit `acd0b95` (`Add split-merge tolerant dialogue benchmark scoring`) and pushed to `main`.

---

### Task 3: Verify scoring behavior on cod-test benchmark surfaces

**Bead ID:** `ee-1mdy`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** After implementation, run the relevant benchmark/test flow and verify that dialogue text which is materially present but differently split/merged now scores much more honestly, while segmentation drift still appears in diagnostics. Confirm whether the resulting score breakdown better matches human judgment on the current COD fixture.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- benchmark reports as produced by the run
- `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md`

**Status:** ✅ Complete

**Results:** Claimed the bead, read the design/implementation/test context in `docs/2026-04-24-dialogue-split-merge-scoring-options.md`, `server/lib/benchmark-runner.cjs`, and `test/lib/benchmark-runner.test.js`, then ran two QA validations against the real cod fixture surfaces: `node --test test/lib/benchmark-runner.test.js` and a direct benchmark rerun via `runBenchmarkStage(...)` against the existing `output/cod-test` artifacts loaded from `configs/cod-test.yaml`. The focused regression tests passed (`27/27`). The regenerated cod-test report surface at `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` now exposes the intended three-way dialogue scoring block on the real fixture: `dialogue_text_full_transcript_pct=90.7`, `dialogue_text_windowed_pct=90.7`, and `dialogue_boundary_pct=0.0`, with `truth_segment_count=20`, `output_segment_count=17`, `split_event_count=1`, `merge_event_count=3`, `missing_truth_window_count=0`, and `extra_output_window_count=0`. Concrete observed window alignments match the design intent: the early split (`truth[0] -> output[0,1]`) preserved `100%` text similarity while boundary status became `split`; the early merge (`truth[4,5] -> output[5]`) preserved `100%` text similarity while boundary status became `merge`; later windows with real content loss or wording damage dropped the local text percentages (`truth[7] -> output[7]` at `90.9%`, `truth[8,9,10] -> output[8]` at `56.3%`, `truth[11,12] -> output[9]` at `57.1%`, `truth[13] -> output[10]` at `80%`, `truth[16] -> output[13]` at `92.9%`). This means benign split/merge variance no longer crushes transcript scoring, but real line loss / wording corruption still lowers the text surfaces exactly where a human would expect. The separate `dialogue_boundary_pct=0.0` honestly surfaces that segmentation fidelity is still poor across the full fixture because every alignment is not boundary-perfect, even though transcript fidelity is much higher. On the current cod-test fixture, that result matches human judgment substantially better than the older one-to-one structural text penalty: the run still has serious dialogue-content and ordering problems in the middle/late section, but the headline dialogue-text score is no longer falsely dominated by split/merge-only structure drift.

---

### Task 4: Independent audit of final scoring behavior

**Bead ID:** `ee-8dpo`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Independently audit the implemented scoring behavior and verify that the new model improves honesty for split/merge cases without hiding real dialogue errors. Confirm that missing lines, lyric leakage, or wording corruption still reduce score appropriately, and that only benign boundary variance is de-emphasized.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md`

**Status:** ✅ Complete

**Results:** Independent audit passed. Re-read the design doc (`docs/2026-04-24-dialogue-split-merge-scoring-options.md`), implementation (`server/lib/benchmark-runner.cjs`), focused regressions (`test/lib/benchmark-runner.test.js`), real cod artifact surface (`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`), and this plan before auditing. Confirmed from code that the new model returns three independent dialogue percentages/diagnostics only — `dialogue_text_full_transcript_pct`, `dialogue_text_windowed_pct`, and `dialogue_boundary_pct` — plus counts/alignment metadata; there is no composite or weighted master score surface being introduced anywhere in the artifact or summary output. Confirmed from focused tests that benign split/merge drift now keeps transcript/windowed text at `100%` while boundary percentage drops and split/merge events are still exposed, and that missing lines still lower both text percentages while surfacing `missing_truth_window_count` instead of being hidden behind split/merge logic. Confirmed from the live cod report surface that this behavior holds on the real fixture: the early split (`truth[0] -> output[0,1]`) and early merge (`truth[4,5] -> output[5]`) preserve `100%` local text similarity while boundary status is `split` / `merge`; real wording corruption still lowers the right text surfaces (`truth[7] -> output[7]` at `90.9%`, `truth[13] -> output[10]` at `80%`); and the larger bad merge window (`truth[8,9,10] -> output[8]` at `56.3%`, plus `truth[11,12] -> output[9]` at `57.1%`) shows that real dialogue loss / leakage is still visible and still drags transcript honesty down rather than being masked by the split/merge-tolerant model. The cod artifact summary now honestly reads as high-but-imperfect transcript fidelity (`dialogue_text_full_transcript_pct=90.7`, `dialogue_text_windowed_pct=90.7`) with explicitly poor segmentation fidelity (`dialogue_boundary_pct=0.0`), which matches the intended reporting contract. Residual concern only: lyric leakage is demonstrated in the real cod surface and still penalized there, but there is not yet a dedicated named regression test that isolates lyric leakage as a standalone fixture the way split/merge and missing-line cases are isolated.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed the research/design phase for split/merge-tolerant dialogue scoring, implemented the new three-surface dialogue scoring block in the benchmark runner, QA-verified the resulting cod-test report surfaces against the existing real fixture outputs, and independently audited the final behavior. Dialogue benchmark artifact results and markdown summaries now surface `dialogue_text_full_transcript_pct`, `dialogue_text_windowed_pct`, and `dialogue_boundary_pct` side by side, along with explicit split/merge/missing/extra window diagnostics, without introducing a composite/weighted master score.

**Reference Check:** Task 1 design work validated against `REF-01`, `REF-03`, `REF-04`, and `REF-05`. Task 2 implementation validated against `REF-01`, `REF-03`, and `REF-05`. Task 3 QA validated the live cod-test report surfaces against `REF-02`, `REF-03`, and `REF-04`. Task 4 audit revalidated the design doc, implementation, focused regressions, and live cod report surface against the locked reporting requirements. No deliberate deviations from the locked reporting constraint: no composite score, separate percentages only.

**Commits:**
- `acd0b95` - Add split-merge tolerant dialogue benchmark scoring

**Lessons Learned:** The current benchmark’s time-aware one-to-one alignment prevents some cascade after missing segments, but it still over-penalizes benign split/merge variance at the text layer. The cleanest fix is to separate whole-transcript text accuracy from boundary accuracy rather than trying to make a single rollup number do both jobs. Weighting the secondary windowed score across matched and unmatched windows was also necessary so missing lines reduce that percentage instead of hiding behind only matched local windows.

---

*Completed on 2026-04-24*
