# emotion-engine: commit latest benchmark-analysis changes, then review delta vs gold after reconciliation

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Commit and push the remaining local plan/report changes, then compare the corrected gold benchmark against the latest reconciled run for both dialogue and `music-vocals` to determine whether the real output delta is smaller than the current scoring suggests and whether the scoring system needs adjustment.

---

## Overview

We already corrected and pushed the `Master of Puppets` gold lyric truth itself. What remains locally is the execution plan/report layer documenting that rerun and comparison work. Derrick wants that preserved first so nothing is lost.

After checkpointing, the next job is an interpretation pass rather than another model change. We should inspect the actual delta between the corrected gold benchmark and the latest reconciled output for both dialogue and `music-vocals`, focusing on whether current benchmark penalties reflect meaningful semantic errors or mostly structural/index/timing differences that make the score look worse than the real quality gap. If the latter is true, the next useful lane may be benchmark scoring/comparator tuning rather than more prompt work.

---

## Tasks

### Task 1: Commit and push remaining plan/report changes

**Bead ID:** `ee-ukhc`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, commit and push the remaining local plan/report changes related to the corrected gold benchmark rerun and before/after comparison, without mixing in unrelated repo noise. Update this plan truthfully with the exact committed files, commit hash, and push result. Close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-commit-push-and-rerun-after-gold-lyrics-fix.md`
- `.plans/2026-04-06-commit-analysis-and-review-delta-vs-gold-after-reconciliation.md`
- refreshed benchmark report files as needed

**Status:** ✅ Complete

**Results:** Claimed `ee-ukhc`, then committed and pushed only the remaining corrected-truth rerun checkpoint files, leaving unrelated working-tree noise untouched.

Exact files committed:
- `.plans/2026-04-06-commit-push-and-rerun-after-gold-lyrics-fix.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/chunkAnalysis.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`

Exact git commands run:
- `git add -- .plans/2026-04-06-commit-push-and-rerun-after-gold-lyrics-fix.md benchmarks/fixtures/cod-test/_reports/artifact-results/chunkAnalysis.json benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json benchmarks/fixtures/cod-test/_reports/benchmark-summary.json benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `git commit -m "docs: checkpoint corrected-truth benchmark rerun"`
- `git rev-parse HEAD`
- `git push origin main`

Commit / push result:
- Commit: `218fd96d682fc3b69cd038d44807d2bf505c0ef5` (`218fd96` short)
- Commit message: `docs: checkpoint corrected-truth benchmark rerun`
- Push result: `main -> main` on `origin` (`git@github.com:getpeanutgallery/emotion-engine.git`), advancing remote from `78b04d8` to `218fd96`

Notes:
- This checkpoint preserves the rerun/comparison plan plus the refreshed benchmark report package produced after the corrected gold-truth rerun.
- I intentionally left unrelated modified plans, runtime artifacts, temp files, and config/output noise unstaged.

---

### Task 2: Review dialogue delta vs corrected gold after reconciliation

**Bead ID:** `ee-t57g`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the commit/push checkpoint is complete, compare the latest reconciled dialogue output against the corrected/current gold benchmark truth. Identify the major classes of mismatch (semantic text error, speaker mismatch, segmentation mismatch, timing drift, structural-only field mismatch, metadata mismatch) and assess whether the real human-perceived delta is smaller than the current score suggests. Update this plan truthfully with concrete examples and an evidence-backed judgment. Do not change code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-commit-analysis-and-review-delta-vs-gold-after-reconciliation.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-t57g` and compared the current reconciled dialogue artifact directly against the gold truth plus the benchmark report.

Files reviewed:
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

Current report snapshot:
- Benchmark status: `error`
- Accuracy: `58/195 = 29.74%`
- Coverage: `195/221 = 88.24%`
- Structural headline: truth has `20` dialogue segments; current reconciled output has `18`
- Report summary: `dialogueData benchmark errored: Truth object missing field present in output`

Major mismatch classes observed:

1. **Segmentation mismatch / merge-split cascade**
   - This is the dominant failure shape.
   - Truth splits the early block into:
     - `12-17` `Your streets... with your blood.`
     - `17-21` `Raul Menendez ignited global unrest...`
     - `22-24` `Menendez is a terrorist.`
   - Output instead produces:
     - `11-14` `Your streets shall once again run red.`
     - `16-24.5` `With your blood, Raul Menendez ignited global unrest on an unprecedented scale. Menendez is a te Paris.`
     - `25-28` `We're bringing peace and security to the world.`
   - That one re-chunking decision causes a long downstream index cascade where later truth lines are compared against the wrong output rows.
   - A similar merge happens late at `99-107`, where output combines truth segments `100-102` and `103-105` into one line: `So eager to leave, David. Killing a man is is a hell of a lot easier than killing the idea.`
   - The preorder CTA is also split into two output segments (`119-122` / `124-126`) instead of one truth segment at `122-124`.

2. **Timing drift**
   - After the first early merge, many later segments drift just enough to fail the ±2s comparator.
   - Concrete report examples:
     - truth `22-24` vs output `25-28`
     - truth `24-26` vs output `29-31`
     - truth `35-36` vs output `37-40`
     - truth `98-99` vs output `94-96`
   - Human readers would still recognize several of these lines as the intended quote, but the benchmark records them as failures because the alignment window is tight and index-based.

3. **Speaker mismatch**
   - The report shows repeated exact-speaker failures (`Speaker 2` vs `Speaker 1`, `Speaker 7` vs `Speaker 4`, etc.).
   - Many of these appear to be secondary fallout from segment regrouping rather than fresh audible confusion in every line.
   - Example: truth `30-33` `Stop looking backwards, David...` is a good semantic match to output `32-36` `Stop looking backwards, David, but now this is what we do next.`, but the report still counts both speaker and speaker_id as failures because the row is no longer aligned to the same truth index.

4. **Semantic text error**
   - There are real wording mistakes, not just structural ones.
   - Best concrete examples:
     - `Menendez is a terrorist.` becomes garbled inside `Menendez is a te Paris.`
     - `So eager to leave daddy.` becomes `So eager to leave, David.`
     - `Killing the man...` becomes `Killing a man...`
     - `The hell it ain't!` becomes `The hell it isn't!` (much smaller meaning change)
   - These are audible/semantic misses that a human review should still count against quality.

5. **Missing / extra segments**
   - The report explicitly marks missing truth items at `dialogue_segments[18]` and `[19]` because the array is shorter.
   - In practice, those lines are not actually absent as human-perceived content: `No more games. This ends now.` exists at `111-113`, and the preorder CTA exists but is split into `Get the Reznov challenge pack.` + `And you pre-order now.`
   - The more materially missing dialogue content is the mid-trailer comms/fear block around `45-64`, where truth expects `You shall know fear.`, `Specter one, report.`, `Need a sitrep.`, `This isn't real.`, `The hell it ain't!`, but output realigns this stretch poorly and appears to drop `You shall know fear.` entirely.

6. **Structural-only / metadata mismatch**
   - The benchmark errors on extra top-level output fields that do not represent human-perceived transcript quality:
     - `analysisMode: chunked`
     - `timingMode: chunk_local`
     - `sourceStrategy: base64`
     - `coverage`
     - `provenance`
   - It also records many speaker-profile structural differences unrelated to whether the spoken lines themselves are understandable.

Evidence-backed judgment on real delta vs score:
- **Yes — the real human-perceived delta is smaller than the `29.74%` score suggests.**
- The current output is still materially wrong in places, especially the garbled `terrorist` line, the `daddy`→`David` miss, the lost `You shall know fear.` line, and the mid-trailer timing/ordering drift.
- But the benchmark score is being dragged down by a cascade of index-based failures after a few split/merge decisions, plus structural metadata errors that a human listener would not consider dialogue-quality failures.
- Concrete evidence for that understatement: several lines are effectively correct or near-correct in the current artifact even while scoring badly because of alignment drift — `They want you afraid...`, `It's time to wake up.`, `We're bringing peace and security to the world.`, `He refuses to let me go.`, `A lot of people counting on us for answers.`, `Pull it together, man!`, `You were never cut out to be a Mason.`, and `No more games. This ends now.`
- Net dialogue read: the lane is not good enough yet, but the benchmark score overstates the real quality gap because structural alignment failures are being counted like independent semantic failures.

---

### Task 3: Review music-vocals delta vs corrected gold after reconciliation

**Bead ID:** `ee-qtng`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the commit/push checkpoint is complete, compare the latest reconciled music-vocals output against the corrected/current gold benchmark truth. Identify the major classes of mismatch (semantic lyric error, missing segment, segment split/merge difference, timing drift, structural-only field mismatch, metadata mismatch) and assess whether the real human-perceived delta is smaller than the current score suggests. Update this plan truthfully with concrete examples and an evidence-backed judgment. Do not change code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-commit-analysis-and-review-delta-vs-gold-after-reconciliation.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-qtng` and compared the current reconciled music-vocals artifact directly against the corrected gold truth plus the benchmark report.

Files reviewed:
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

Current report snapshot:
- Benchmark status: `error`
- Accuracy: `44/96 = 45.83%`
- Coverage: `96/108 = 88.89%`
- Structural headline: truth has `12` vocal segments; current reconciled output has `10`
- Report summary: `musicVocalsData benchmark errored: Truth object missing field present in output`

Major mismatch classes observed:

1. **Timing drift / sequence offset**
   - This is the dominant shape.
   - Truth begins the recognizable sequence at `64-70` with:
     - `64-65` `Obey your master`
     - `68-70` `Your life burns faster`
   - Output does not begin until `76-80` with:
     - `76-78` `Obey your master`
     - `78-80` `Come crawling faster`
   - From there, several later lines are close in wording but shifted about 4-8 seconds later than truth, which triggers repeated tolerant-time failures.
   - Examples from the report:
     - truth `76-78` vs output `80-84`
     - truth `80-83` vs output `84-88`
     - truth `84-86` vs output `88-92`
     - truth `87-88` vs output `92-96`

2. **Semantic lyric error**
   - There is one obvious high-signal lyric miss in the early chant window:
     - truth `68-70`: `Your life burns faster`
     - output `78-80`: `Come crawling faster`
   - There is also a later content error where truth expects the question/answer pair:
     - `91-94` `Where’s the dreams that I’ve been after?`
     - `95.5-98` `You promised only lies`
   - but output instead repeats earlier material:
     - `98-102` `Just call my name, 'cause I'll hear you scream`
     - `102-104` `Master, master`
   - Those are real lyric-content misses, not just formatting differences.

3. **Missing / extra segments**
   - The report explicitly marks missing truth segments at:
     - `116-118` `Obey your master`
     - `127-130` `Master, master`
   - The current output does contain a late reprise, but it is incomplete and shifted:
     - `130-132` `Obey your master`
   - So the late return is partially present in human terms, but the benchmark is correct that the expected two-segment reprise shape is not there.

4. **Segmentation mismatch / repeated-line substitution**
   - Truth now splits the middle chant/question region into four segments:
     - `89-91` `Master, master`
     - `91-94` `Where’s the dreams that I’ve been after?`
     - `94-95.5` `Master, master`
     - `95.5-98` `You promised only lies`
   - Output instead gives:
     - `96-98` `Master, master`
     - `98-102` `Just call my name, 'cause I'll hear you scream`
     - `102-104` `Master, master`
   - So the structure is wrong in a way humans would notice, but part of the score loss is also because one repeated line substitution creates multiple row-by-row failures.

5. **Metadata / structural-only mismatch**
   - The report also fails fields that are not meaningful human lyric-quality deltas:
     - `performer: Metallica lead vocal` vs `Vocalist 1`
     - `delivery: chant` vs `sung`
     - extra output-only fields such as `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance`
   - Those inflate the failure count without meaning the heard lyric text is equally bad.

Concrete examples where the output is better than the raw score implies:
- Once the sequence gets going, several core lyric lines are semantically right or very close:
  - output `80-84` `Master of puppets, I'm pulling your strings`
  - output `84-88` `Twisting your mind and smashing your dreams`
  - output `88-92` `Blinded by me, you can't see a thing`
  - output `92-96` `Just call my name, 'cause I'll hear you scream`
- Those lines map to the corrected gold truth closely in wording, but they still fail many benchmark fields because they arrive late and are compared by rigid row alignment.

Evidence-backed judgment on real delta vs score:
- **Yes — the real human-perceived delta is smaller than the `45.83%` score suggests, though the lane still has meaningful quality problems.**
- The score is depressed by repeated timing/row-alignment failures, exact performer/delivery mismatches, and output-only structural metadata fields.
- But unlike dialogue, the music-vocals lane still has important audible content defects that humans would care about: it misses the early `64-70` chant placement, invents `Come crawling faster`, drops the `Where’s the dreams... / You promised only lies` pair, and under-delivers the late reprise.
- Net music-vocals read: the current artifact is closer to the corrected gold than the score alone implies because much of the main `80-96s` lyric run is substantively right, but the benchmark is also exposing real remaining gaps in recall, ordering, and reprise coverage.

---

### Task 4: Judge whether benchmark scoring/comparator adjustments are warranted

**Bead ID:** `ee-jj17`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after reviewing dialogue and music-vocals deltas, assess whether the current scoring/comparator system is overstating the real quality gap. Point to the exact rules or failure shapes that seem too harsh if applicable, and recommend whether to keep the scoring as-is or plan a scoring-system adjustment lane. Update this plan truthfully with a recommendation and rationale. Do not change code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-commit-analysis-and-review-delta-vs-gold-after-reconciliation.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-jj17` and traced the observed harshness back to the actual comparator configuration and implementation.

Files/code reviewed:
- `benchmarks/fixtures/cod-test/benchmark.json`
- `server/lib/benchmark-runner.cjs`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

What the current scoring system is actually doing:
- `benchmark.json` uses `json-structured` for both `dialogueData` and `musicVocalsData` with only:
  - `profile: dialogue-default` / `music-vocals-default`
  - `timingToleranceSeconds: 2`
  - `unknownSentinels: ["unknown", "ambiguous"]`
- There are **no** `ignorePaths` configured for dialogue or music-vocals.
- In `server/lib/benchmark-runner.cjs`, extra output keys are treated as hard structural errors via `emitHardError(..., "Truth object missing field present in output", ...)` during object walk.
- Arrays only get key-based alignment for a few special cases (`chunk-analysis-default` and `emotional-analysis-default`). `dialogue_segments` and `vocal_segments` do **not** have a keyed/time-aware alignment path, so they fall back to strict index-by-index comparison.
- The default fuzzy-string field set also includes `summary`, `label`, and `note`, which means descriptive speaker-profile prose and summary text are being scored alongside the core transcript/lyric content.

Why the system is overstating the real quality gap:

1. **Index-based array comparison amplifies one split/merge into dozens of failures**
   - In `compareArtifact`, if no array alignment key exists, arrays are walked strictly by index.
   - That is exactly what we see in both lanes:
     - dialogue: one early merge/split causes downstream timing, speaker, and text comparisons to be made against the wrong rows
     - music-vocals: one sequence offset causes several later lines that are semantically close to fail on timing and row mismatch
   - This is the biggest source of perceived harshness.

2. **Extra output metadata currently becomes artifact-level `error`, not just ignorable noise**
   - Dialogue and music-vocals both error because output contains fields the truth intentionally omits, such as:
     - `analysisMode`
     - `timingMode`
     - `sourceStrategy`
     - `coverage`
     - `provenance`
   - Those fields are operational metadata, not benchmarked human-perceived quality. But today they still contribute hard structural errors and force status `error`.
   - Current evidence:
     - dialogue has `26` errored fields, all structural
     - music-vocals has `12` errored fields, all structural

3. **Comparator is scoring descriptive metadata too heavily for these lanes**
   - Dialogue accumulates many failures inside `speaker_profiles`, including descriptor labels and review notes that are compared with fuzzy-string rules.
   - Music-vocals takes exact-match failures on `performer` and `delivery` (`Metallica lead vocal` vs `Vocalist 1`, `chant` vs `sung`) even when the lyric text itself is close.
   - Those fields are useful diagnostics, but they should not carry the same practical weight as whether the transcript/lyrics are actually right.

4. **±2s timing tolerance is reasonable for exact segment QA but too harsh when alignment itself is unstable**
   - The tolerance in `benchmark.json` is only `2` seconds for both lanes.
   - Once a line is merged, shifted, or split, many otherwise recognizable lines fail repeatedly on start/end even when the human-perceived content is still mostly there.
   - The result is a strict schema/alignment score masquerading as a pure semantic quality score.

Recommendation:
- **Do not replace the current scoring immediately, but do plan a scoring-system adjustment lane.**
- Best interpretation of the current score today:
  - it is still useful as a **strict regression / schema-parity signal**
  - it is **not** a faithful standalone measure of human-perceived dialogue/lyric quality for reconciliation outputs
- So the right move is not "keep as-is and trust it literally," and also not "throw it away." It should be reframed and supplemented.

Recommended adjustment-lane scope:
1. Add comparator-owned ignores for output-only operational metadata in dialogue/music-vocals (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`, and likely some diagnostic summary fields).
2. Add keyed or time-window alignment for `dialogue_segments` and `vocal_segments` so split/merge drift does not cascade row-by-row through the entire artifact.
3. Separate **core semantic fields** from **diagnostic metadata** in scoring/reporting.
   - Example: transcript/lyric text + approximate timing + presence/absence = primary score
   - speaker-profile prose, performer naming, delivery labels, and review notes = secondary diagnostics
4. Keep the current raw strict score available as a secondary "schema fidelity" metric for debugging regression shape.

Bottom-line judgment:
- **Yes, the current comparator/scoring system is overstating the real quality gap, especially for reconciled dialogue and music-vocals.**
- The evidence points to comparator harshness more than to a totally broken model: index-based array matching, hard errors for extra output metadata, and equal treatment of descriptive metadata versus core semantic content are the main distortion sources.
- Recommendation: **plan a scoring-system adjustment lane** rather than treating the current percentage as the final truth about human-perceived quality.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A clean git checkpoint for the remaining corrected-truth rerun plan/report package, plus an evidence-backed review of how the latest reconciled dialogue and music-vocals outputs differ from the corrected gold benchmark and whether the benchmark score is overstating the real quality gap.

**Commits:**
- `218fd96d682fc3b69cd038d44807d2bf505c0ef5` - `docs: checkpoint corrected-truth benchmark rerun`

**Lessons Learned:** The current benchmark percentages for reconciled dialogue/music-vocals are directionally useful but too harsh to treat as pure human-quality scores. The biggest distortion is not just bad content; it is comparator behavior — index-based array alignment, hard errors on output-only metadata, and scoring of descriptive diagnostics alongside core transcript/lyric truth.

---

*Completed on 2026-04-06*
