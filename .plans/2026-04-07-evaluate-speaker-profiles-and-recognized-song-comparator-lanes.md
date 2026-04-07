# emotion-engine: evaluate `speaker_profiles` and `recognizedSong` comparator lanes after segment-alignment rollout

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Evaluate whether benchmark comparator changes for `speaker_profiles` and `recognizedSong` can further improve scoring honesty for the latest reconciled cod-test run without hiding real semantic errors.

---

## Overview

The prior two benchmark-honesty lanes are now landed: truth-declared `_benchmark.ignorePaths` removed metadata-only scoring noise, and time-aware alignment removed index-drift cascades for `dialogue_segments` and `vocal_segments`. That left the remaining artifact-level pain concentrated in adjacent comparator surfaces rather than the main segment arrays.

The handoff preserved in memory says the next evaluation target is `speaker_profiles` and `recognizedSong` specifically. That matches the latest plan results: dialogue still carries structural pain in `speaker_profiles`, while `music-vocals` still carries structural pain in `recognizedSong.candidates[*]`, related matched-lyric/time-range structures, and adjacent note/reporting surfaces. The next move should be comparator review first, not prompt tuning.

This lane should stay narrow and honest. Derrick’s clarification for this session is important: there is a real chance the latest dialogue and `music-vocals` outputs are already near the ceiling of what prompt shaping and tooling can truthfully recover, especially after the recent separation of lyrics out of dialogue and the famous-song correction work in `music-vocals`. That means the active question is not “how do we force the model closer to benchmark truth?” but “is the current grading model still judging the output fairly?”

So the sequence is: first inspect the current comparator behavior and benchmark reports for those two surfaces; then design the smallest truthful comparator improvements that reduce misleading hard errors without laundering real mistakes; then implement only the approved changes; then rerun focused validation against the existing reconciled cod-test outputs and judge whether the resulting score better matches human review.

---

## Tasks

### Task 1: Review current failures and design comparator changes for `speaker_profiles` and `recognizedSong`

**Bead ID:** `ee-a7p2`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current benchmark comparator behavior and latest cod-test reports for dialogue speaker_profiles and music-vocals recognizedSong structures. Identify exactly which hard errors or misleading failures remain after the ignore-path and time-aware segment-alignment lanes. Propose the smallest truthful comparator changes that would better match human judgment without hiding real semantic mistakes. Update the plan truthfully with the exact files inspected, the current failure shapes, and the recommended comparator strategy. Do not change code yet. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Design reviewed and documented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `test/lib/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/cod-test/phase1-gather-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-evaluate-speaker-profiles-and-recognized-song-comparator-lanes.md`
- `server/lib/benchmark-runner.cjs` (inspection only)
- `test/lib/benchmark-runner.test.js` (inspection only)
- `benchmarks/fixtures/cod-test/benchmark.json` (inspection only)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json` (inspection only)
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` (inspection only)
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` (inspection only)
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` (inspection only)

**Status:** ✅ Complete

**Results:** Inspected the current comparator implementation in `server/lib/benchmark-runner.cjs`, the benchmark manifest in `benchmarks/fixtures/cod-test/benchmark.json`, the focused regression coverage in `test/lib/benchmark-runner.test.js`, the latest cod-test reports in `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`, `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`, and `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`, plus the underlying truth/output payloads in `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`, `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, and `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`.

Current comparator behavior after the ignore-path and time-aware segment-alignment lanes:
- `dialogue_segments` and `vocal_segments` are the only arrays with time-aware matching today.
- `speaker_profiles` still falls back to raw array-index comparison with exact nested-array matching.
- `recognizedSong` structures still fall back to raw nested array/object comparison: exact array order/length for `evidence`, `matchedLyrics`, and `timeRanges`, plus exact/fuzzy leaf comparison on prose fields.

Remaining failure shape for dialogue `speaker_profiles`:
- All 19 hard errors in `dialogueData` now come from `speaker_profiles` structural mismatches, not from `dialogue_segments`.
- The latest output collapses the truth’s 13 speaker profiles down to 5 synthetic profiles (`spk_001`..`spk_005`), so index-based comparison produces misleading hard errors for missing truth items and extra output items even though this is a modeling miss, not a benchmark-runner malfunction.
- Nested arrays inside matched profile slots also produce hard errors on extras (`grounded.linked_segment_indexes[*]`, `grounded.acoustic_descriptors[*]`) because generic array comparison escalates missing/extra elements to `error`.
- Some current failures are honest and should remain as penalties: wrong grouping of lines into the same speaker, wrong inferred traits, wrong acoustic descriptors, and confidence drift.
- Some current failures are misleading and should not remain exact-scored as identity fields: `speaker_profiles[*].speaker_id` and `speaker_profiles[*].label` are synthetic numbering artifacts, so exact equality there does not reflect human judgment.

Remaining failure shape for music-vocals `recognizedSong`:
- The song identity is basically right: truth and output both say `recognized`, both choose `Master of Puppets` by `Metallica`, and both say `multipleSongsDetected=false`.
- The remaining hard errors are narrow and structural: `recognizedSong.candidates[0].evidence[1]` missing, `recognizedSong.candidates[0].matchedLyrics[3]` extra, and `recognizedSong.candidates[0].timeRanges[2]` missing.
- The remaining ordinary failures are mostly comparator-shape problems rather than song-ID problems: exact-array comparison penalizes different but still valid lyric excerpts in `matchedLyrics`, shorter/longer supporting prose in `evidence` and `primaryEvidence`, and merged/split span reporting in `timeRanges`.
- Real semantic misses are still present and should continue to score as failures: the output misses the early 64–70s chant window, omits the 116–118 reprise, shifts the late reprise to 130–132, and substitutes some different lyric lines.

Recommended smallest truthful comparator strategy (design only; no code changes yet):
- For `speaker_profiles`, add a profile-specific comparator lane instead of generic index comparison.
- In that lane, treat `speaker_id` and `label` as non-semantic synthetic identifiers for scoring purposes.
- Align truth/output speaker profiles by their grounded evidence rather than by array index — preferably by overlap between `grounded.linked_segment_indexes`, using the existing time-aware `dialogue_segments` alignment map so a profile is judged by which truth dialogue segments it actually covers, not by arbitrary local numbering.
- After that alignment, keep scoring real semantic fields (`acoustic_descriptors`, inferred traits, grounded confidence, linked coverage overlap), but downgrade extra/missing nested items inside `speaker_profiles` from hard `error` to scored `fail` where the issue is ordinary under/over-clustering rather than comparator corruption.
- For `recognizedSong`, keep exact song identity checks (`status`, `title`, `artist`, `multipleSongsDetected`) but add a narrow recognized-song comparator lane for the candidate support structures.
- In that lane, compare `matchedLyrics` and `evidence` as fuzzy unordered support lists (best-match / overlap-based) rather than exact positional arrays, so different valid lyric anchors stop looking catastrophically wrong while incorrect lyric support still fails.
- Also compare `timeRanges` with time-aware span alignment instead of exact positional arrays, so merged/split range reporting becomes partial failure rather than hard structural error.
- Do not blanket-ignore these fields: the goal is to preserve penalties for missing chant windows, wrong lyric anchors, and genuinely bad speaker clustering while removing synthetic-ID and exact-array-shape noise that currently overstates how wrong the output is.

---

### Task 2: Implement the approved narrow comparator changes

**Bead ID:** `ee-rh9z`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved narrow comparator changes for the speaker_profiles and/or recognizedSong benchmark surfaces. Keep the change honest and as small as possible: reduce misleading structural errors, preserve real semantic/timing penalties, add focused regression tests, and update the plan truthfully with exact behavior changes. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Comparator changes implemented and tested" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-evaluate-speaker-profiles-and-recognized-song-comparator-lanes.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Recovery bead `ee-5q20` re-inspected the Task 2 landing directly and found the earlier suspect note was stale. The narrow comparator lane work is visibly present in the current working tree and now directly verified in both code and tests.

Directly verified behavior in `server/lib/benchmark-runner.cjs`:
- `speaker_profiles` now uses a dedicated comparator lane under the `dialogue-default` profile.
- Profile alignment is no longer raw array-index based; it aligns truth/output profiles by overlap in `grounded.linked_segment_indexes`, translated through the existing `dialogue_segments` truth→output alignment map.
- Synthetic `speaker_id` and `label` fields are skipped inside matched profile comparisons.
- Nested `speaker_profiles` structure mismatches now score as ordinary `fail` field results instead of hard `error` comparator breakage when the issue is clustering structure drift (for example extra/missing linked segments or acoustic descriptors).
- Real semantic comparisons remain active for grounded confidence, acoustic descriptors, inferred traits, and linked-segment coverage.
- `recognizedSong` now uses a dedicated comparator lane under the `music-vocals-default` profile.
- Song identity fields still compare directly (`status`, candidate `title`, candidate `artist`, `multipleSongsDetected`).
- Candidate `evidence` and `matchedLyrics` now use fuzzy unordered support-list alignment instead of exact positional array matching.
- Candidate `timeRanges` now use time-aware span alignment instead of exact positional array matching, so missing lyric windows still fail but no longer cascade as hard structural errors.

Focused regression tests directly verified in `test/lib/benchmark-runner.test.js`:
- `benchmark runner - speaker_profiles comparator aligns by grounded segment evidence and downgrades clustering structure misses to failures`
- `benchmark runner - recognizedSong support comparator treats support lists as unordered fuzzy evidence while preserving missing time-range failures`

Commands run and outcomes:
- `bd update ee-5q20 --status in_progress --json` — claimed repair bead.
- `grep -nE "speaker_profiles|recognizedSong|matchedLyrics|timeRanges|evidence|linked_segment_indexes|dialogue_segments|compare" ...` plus targeted `sed -n` ranges on the three task files — used to inspect only the relevant comparator/test/plan sections.
- `git diff -- server/lib/benchmark-runner.cjs test/lib/benchmark-runner.test.js .plans/2026-04-07-evaluate-speaker-profiles-and-recognized-song-comparator-lanes.md` — confirmed the actual Task 2 working-tree changes.
- `node --test test/lib/benchmark-runner.test.js --test-name-pattern "speaker_profiles comparator|recognizedSong support comparator"` — passed (`20/20` in the file run, including both target regressions; 0 failures).

Files changed in the verified Task 2 landing:
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `.plans/2026-04-07-evaluate-speaker-profiles-and-recognized-song-comparator-lanes.md`

Tradeoffs / remaining boundary:
- This repair lane verified comparator honesty wiring and focused regressions only; it did **not** yet rerun the broader cod-test benchmark outputs. That remains Task 3.
- The recovery conclusion is that Task 2 does not need further code repair before validation; it needed truthful re-inspection and plan correction.
---

### Task 3: Rerun focused benchmark validation and judge score honesty

**Bead ID:** `ee-phb8`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the narrowest truthful benchmark validation against the existing cod-test reconciled outputs after the comparator changes land. Compare before vs after specifically for dialogue speaker_profiles and music-vocals recognizedSong-related structures. Show which penalties disappeared because of better comparator behavior, which substantive failures remain, and whether the benchmark now better matches human judgment. Update the plan truthfully with commands, artifact paths, and before/after results. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Validation completed and summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `tmp/task3-comparator-validation/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-evaluate-speaker-profiles-and-recognized-song-comparator-lanes.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `tmp/task3-comparator-validation/before-head-fixture/benchmark.json`
- `tmp/task3-comparator-validation/before-head-reports/benchmark-summary.json`
- `tmp/task3-comparator-validation/before-head-reports/benchmark-summary.md`
- `tmp/task3-comparator-validation/before-head-reports/artifact-results/dialogueData.json`
- `tmp/task3-comparator-validation/before-head-reports/artifact-results/musicVocalsData.json`
- `tmp/task3-comparator-validation/before-after-summary.json`

**Status:** ✅ Complete

**Results:** Ran a controlled comparator A/B against the same existing reconciled outputs in `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` and `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`, using `HEAD` benchmark-runner code as the before baseline and the current working-tree benchmark-runner as the after case.

Commands run:
- `git show HEAD:server/lib/benchmark-runner.cjs > server/lib/benchmark-runner.HEAD.cjs`
- custom Node harness (via `node <<'JS' ... JS`) to:
  - load `configs/cod-test.yaml`
  - generate `tmp/task3-comparator-validation/before-head-fixture/benchmark.json` pointing at the real truth/output artifacts but a temp report dir
  - run `server/lib/benchmark-runner.HEAD.cjs` against the current reconciled cod-test outputs for the before snapshot
  - run `server/lib/benchmark-runner.cjs` against the same outputs to refresh the real report set under `benchmarks/fixtures/cod-test/_reports/`
  - write combined focused comparison data to `tmp/task3-comparator-validation/before-after-summary.json`
- targeted Node inspection commands to extract focused `speaker_profiles` and `recognizedSong` path deltas from the before/after reports

Artifacts produced / refreshed:
- Before snapshot: `tmp/task3-comparator-validation/before-head-reports/benchmark-summary.json`
- Combined focused A/B summary: `tmp/task3-comparator-validation/before-after-summary.json`
- Refreshed current reports: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`, `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`, `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`, `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

Before → after aggregate benchmark totals (same outputs, comparator-only change):
- overall: `1515/2942` passed, `59` errored fields, coverage `2942/3047` → `1514/2954` passed, `37` errored fields, coverage `2954/3037`
- `dialogueData`: `error` → `fail`; `69/192` passed with `19` errored fields → `67/198` passed with `0` errored fields
- `musicVocalsData`: still `error`; `42/83` passed with `5` errored fields → `43/89` passed with `2` errored fields

Focused `speaker_profiles` before → after:
- Focused issue count: `72` → `61`
- Hard comparator errors inside `speaker_profiles`: `19` → `0`
- Disappeared penalties caused by old comparator behavior:
  - raw `speaker_id` / `label` mismatches from index-based alignment
  - generic extra-array hard errors such as `speaker_profiles[0].grounded.linked_segment_indexes[4]` and extra `grounded.acoustic_descriptors[*]`
  - blanket `Output array missing item present in truth` errors for `speaker_profiles[5]` through `speaker_profiles[12]`
- What remains is substantive and more human-legible:
  - the model still collapses 13 truth speaker profiles down to 5 output profiles
  - several truth speakers have no aligned output profile at all (`speaker_profiles[truth=1]`, `[truth=3]`, `[truth=6]`, `[truth=7]`, `[truth=8]`, `[truth=9]`, `[truth=11]`, `[truth=12]`)
  - matched profiles still over-claim or under-cover grounded segment evidence
  - inferred traits, descriptor confidence, and descriptor/note content still miss meaningfully in the aligned profiles
- Judgment: this lane now scores closer to human judgment. The benchmark no longer pretends the main problem is synthetic profile numbering or array bookkeeping; it now penalizes the real miss, which is under-clustered / mis-clustered speaker identity evidence.

Focused `recognizedSong` before → after:
- Focused issue count: `14` → `16`
- Hard comparator errors inside `recognizedSong`: `3` → `0`
- Disappeared penalties caused by old comparator behavior:
  - exact-position array errors on `evidence`, `matchedLyrics`, and `timeRanges`
  - the old hard errors at `recognizedSong.candidates[0].evidence[1]`, `matchedLyrics[3]`, and `timeRanges[2]`
- What remains is substantive and better shaped:
  - `recognizedSong.primaryEvidence` still differs
  - support evidence remains incomplete / mismatched rather than merely reordered
  - matched lyric support still misses key truth anchors and includes unsupported extras
  - time-range penalties now point to the real misses: the early chant window is badly shifted (`64–70` truth versus later output alignment), the `116–118` reprise is still missing, and the late reprise is still off enough to fail (`127` truth start vs `130` output start)
- Music-vocals artifact status still stays `error`, but not because of `recognizedSong`; the remaining hard errors are outside this lane at `recognitionNotes[1]` and `qualityNotes[1]`.
- Judgment: this lane also now matches human judgment better. The benchmark is no longer shouting about list ordering; it is correctly penalizing missing lyric anchors, unsupported lyric excerpts, and genuinely wrong/missing timing support for a song identity that is otherwise basically correct.

Recommendation:
- Treat the current comparator work as successful honesty validation rather than a prompt-tuning lead.
- `speaker_profiles` scoring is materially better and should stand unless Derrick wants even finer partial-credit tuning for unmatched profile count versus trait errors.
- `recognizedSong` scoring is also materially better and should stand; the remaining penalties look real.
- If any follow-up is needed, it should target other remaining hard-error surfaces (`recognitionNotes`, `qualityNotes`, `musicData` structural extras), not more comparator laundering for these two lanes.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Validated the new `speaker_profiles` and `recognizedSong` comparator lanes against the existing reconciled cod-test outputs, refreshed the live cod-test benchmark reports, and captured a controlled `HEAD`-vs-current A/B snapshot showing which penalties were removed as comparator noise versus which substantive misses still remain.

**Commits:**
- Pending.

**Lessons Learned:** The current cod-test outputs appear close to the practical ceiling for these two surfaces. The important win here was grading honesty: eliminate synthetic-ID and array-shape noise, keep real penalties for collapsed speaker clustering, unsupported lyric evidence, and missing/misaligned chant/reprise windows.

---

*Drafted on 2026-04-07*