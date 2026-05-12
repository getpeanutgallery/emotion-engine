# emotion-engine: tune reconciliation lyric-correction conservatism and rerun

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Adjust the famous-song reconciliation rules so the system can safely correct more near-miss lyric variants when the song match is strong, then rerun cod-test to see whether reconciled music-vocals truthfulness improves without causing unsafe rewrites.

---

## Overview

The first reconciliation tranche produced a modest benchmark lift and clearly helped remove at least some lyric contamination from dialogue. But it was conservative enough that it produced zero actual lyric corrections in the observed run. That suggests the next useful lane is not replacing the architecture, but tuning the correction policy so it can act more often when the famous-song evidence is already strong.

This tranche should stay surgical. We do not want to weaken safeguards across the board or start rewriting lyrics opportunistically. Instead, we should identify exactly which thresholds or matching rules are currently too strict, loosen them in narrow evidence-backed ways, and validate that the system corrects more obvious near-miss cases without introducing bogus canonical rewrites.

---

## Tasks

### Task 1: Design the safe relaxation of lyric-correction rules in the reconciliation pass

**Bead ID:** `ee-ynrc`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-ynrc immediately with \`bd update ee-ynrc --status in_progress --json\`, then design a narrow follow-up to the famous-song reconciliation pass that safely relaxes lyric-correction conservatism. Determine which current thresholds or decision rules are preventing obvious near-miss lyric repairs, specify what to loosen and what must remain guarded, and describe how to validate that the pass corrects more near-miss lyrics without introducing unsafe overcorrection. Update this plan with an implementation-ready recommendation, do not change code in this task, and close bead ee-ynrc with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-tune-reconciliation-lyric-correction.md`

**Status:** ✅ Complete

**Results:** Designed an implementation-ready narrow follow-up for the reconciliation pass after reviewing the current script (`server/scripts/get-context/reconcile-famous-song-phase1.cjs`), its tests, and the latest reconciliation ledgers/artifacts.

Recommended tuning:

- **Keep the high-confidence recognition gate unchanged.** Do **not** loosen the top-level trigger yet. Keep:
  - `recognizedSong.status === "recognized"`
  - `recognizedSong.confidence >= 0.92`
  - exactly one candidate
  - `multipleSongsDetected !== true`
  - at least 2 matched lyric fragments
  - at least 1 recognized-song `timeRange`
  - at least one `timeRange` overlapping music-vocals coverage
  This is not the current bottleneck, and it is the main safeguard against unsafe rewrites on uncertain/unknown songs.

- **Identify the real blocker: `MIN_CORRECTION_SIMILARITY = 0.66` is too strict for obvious near-misses that add one noisy token or swap one weak token.** In the latest archived run (`output/_archives/cod-test-pre-ee-k4o2b-20260405-211939/phase1-gather-context/`), the pass skipped:
  - `"Come control your master" -> "Obey your master"` at similarity `0.5789`
  even though the song gate was strong and the phrase is an obvious near-miss inside the recognized-song range.

- **But do not simply lower the threshold globally.** The same review showed the opposite failure mode: the current logic already allowed an unsafe shortening:
  - `"Twisting your mind and smashing your dreams" -> "Twisting your mind"` at similarity `0.6667`
  That means the follow-up must be a **targeted relaxation plus a new anti-truncation guard**, not a blanket fuzzier rewrite rule.

Implementation-ready recommendation for Task 2:

1. **Split lyric correction into two lanes instead of one global threshold.**
   - **Lane A: conservative generic correction** — keep the existing `0.66` floor for ordinary fuzzy rewrites.
   - **Lane B: anchored near-miss correction** — allow a lower floor around **`0.58`** only when all of these extra guards pass:
     - segment is inside a recognized-song `timeRange`
     - segment confidence remains **`>= 0.85`**
     - source and target share a strong anchor, defined as either:
       - at least **2 contiguous tokens** in common, or
       - at least **2 shared tokens** covering **>= 60%** of the target tokens
     - token-count delta is small: **absolute difference <= 1** for short phrases (`<= 4` tokens) or **<= 2** for longer phrases
     - target is **not materially shorter** than source (see anti-truncation rule below)
   This specifically admits `"Come control your master" -> "Obey your master"` while still rejecting weak one-word overlaps.

2. **Add an explicit anti-truncation / anti-fragment guard before any rewrite.** Never rewrite a segment to a candidate lyric when the rewrite would collapse a fuller lyric line down to a short matched fragment. Concretely, block correction when:
   - target token count is less than **75%** of source token count, **or**
   - source has **5+ tokens** and target is shorter by **more than 2 tokens**, **or**
   - the candidate lyric is a strict fragment of the current segment without evidence that the extra source tokens are just one leading/trailing filler token.

   This guard is meant to stop cases like:
   - `"Twisting your mind and smashing your dreams" -> "Twisting your mind"`
   - `"Master of puppets, I'm pulling your strings" -> "Master of puppets"`

3. **Require a phrase anchor, not just vague similarity.** A lowered threshold must still refuse candidates that only share one high-frequency token such as `master`. That means the relaxed lane should **not** fire for examples like:
   - `"Master, master" -> "Obey your master"`
   - `"Promised only lies" -> "Twisting your mind"`

4. **Keep correction targets constrained to the current recognized-song candidate’s matched lyric set for now.** Do not broaden this tranche into open-ended canonical lyric lookup or external lyric sourcing. The change should stay inside the current reconciliation architecture and simply become smarter about which matched fragment is safe to apply.

5. **Prefer false negatives once a segment looks like a complete alternate lyric line.** If a segment is already a coherent full line and the best candidate is materially shorter, keep the source text unchanged even if the song match is strong. This preserves safety until a later tranche intentionally adds richer canonical-line handling.

Validation plan for Task 2:

- Add focused unit tests in `test/scripts/reconcile-famous-song-phase1.test.js` that prove:
  - `"Come control your master"` now corrects to `"Obey your master"`
  - `"Control your master"` still corrects to `"Obey your master"`
  - `"Twisting your mind and smashing your dreams"` is **not** shortened to `"Twisting your mind"`
  - `"Master of puppets, I'm pulling your strings"` is **not** shortened to `"Master of puppets"`
  - `"Master, master"` is **not** rewritten to `"Obey your master"`
  - weak/ambiguous-song gates still produce no corrections

- Add one fixture-style reconciliation test using the latest real-shape phrases from the archived run so regression coverage matches the actual failure mode, not just synthetic toy strings.

- During rerun review, treat success as:
  - **more lyricCorrections than zero** on the obvious near-miss cases
  - continued removal of lyric contamination from dialogue
  - **no new fragment-shortening rewrites** in `famous-song-reconciliation.json`
  - no rewrites when recognition falls below the existing strong-song gate

- Review the reconciliation ledger directly after the rerun. The ledger is the primary acceptance artifact for this tranche: it should show the newly admitted near-miss repairs while skipped corrections remain for low-evidence or fragmentary cases.

Bottom line:
- The safe next move is **not** “lower the similarity threshold everywhere.”
- The safe next move is: **keep the strong song gate, add an anchored near-miss lane around ~0.58, and add a hard anti-truncation guard so fuller lyric lines cannot be rewritten to short matched fragments.**

---

### Task 2: Implement the relaxed lyric-correction rules and focused tests

**Bead ID:** `ee-dvm6`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after bead ee-ynrc is complete, claim bead ee-dvm6 with \`bd update ee-dvm6 --status in_progress --json\` and implement the approved narrow relaxation of famous-song lyric-correction rules in the reconciliation pass. Keep raw artifacts and baseline routing behavior intact, update focused tests to prove both increased correction of obvious near-misses and continued protection against unsafe rewrites, update this plan truthfully, commit after tests pass, do not push, and close bead ee-dvm6 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-tune-reconciliation-lyric-correction.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Implemented the approved narrow relaxation directly inside `server/scripts/get-context/reconcile-famous-song-phase1.cjs` without changing the top-level recognized-song gate, raw artifact writing, or baseline routing.

What changed in code:

- Kept the existing strong recognition trigger intact:
  - `recognizedSong.status === "recognized"`
  - `recognizedSong.confidence >= 0.92`
  - exactly one candidate
  - `multipleSongsDetected !== true`
  - matched-lyric / time-range sufficiency requirements unchanged
- Split lyric rewrite decisions into two lanes:
  - **generic lane** keeps the existing `0.66` correction floor
  - **anchored near-miss lane** allows lower-scoring corrections only when phrase anchoring and token-delta guards pass
- Added explicit helper logic for:
  - contiguous-token / shared-token phrase anchoring
  - short-vs-long phrase token-delta checks
  - anti-truncation / anti-fragment rejection before any rewrite
- Preserved correction targets as the matched lyric fragments from the recognized song candidate only.

Implementation note versus the design write-up:

- The approved plan said the relaxed lane should be around `~0.58`. Under the live scorer, the archived target case (`"Come control your master" -> "Obey your master"`) evaluates to `0.578947...`, so the implemented anchored-lane floor landed at **`0.57`** rather than exactly `0.58` to admit the approved real-world near-miss while staying narrow.

Focused test coverage added/updated in `test/scripts/reconcile-famous-song-phase1.test.js`:

- confirms `"Come control your master" -> "Obey your master"`
- confirms `"Control your master" -> "Obey your master"`
- confirms `"Twisting your mind and smashing your dreams"` is **not** shortened
- confirms `"Master of puppets, I'm pulling your strings"` is **not** shortened
- confirms weak / fragmentary cases such as `"Master, master"` stay unmodified
- confirms weak / ambiguous recognized-song evidence still skips reconciliation entirely
- includes a real-shape archived near-miss regression case plus direct helper assertions for the anchored lane and truncation guard

Validation run completed:

- `node --test test/scripts/reconcile-famous-song-phase1.test.js`
- Result: **8/8 tests passing**

---

### Task 3: Rerun cod-test and compare lyric-correction behavior

**Bead ID:** `ee-r4u4`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after bead ee-dvm6 is complete, claim bead ee-r4u4 with \`bd update ee-r4u4 --status in_progress --json\` and run a fresh cod-test with reconciliation enabled. Compare the resulting lyric-correction behavior against the prior reconciliation-backed run, capture whether more obvious near-miss lyric cases are corrected, whether dialogue contamination stays improved, and whether benchmark accuracy improves without unsafe rewrites. Update this plan truthfully with exact command, artifacts, benchmark deltas, and review conclusions. Do not push, and close bead ee-r4u4 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-tune-reconciliation-lyric-correction.md`
- fresh rerun artifacts/logs/reports

**Status:** ✅ Complete

**Results:** Claimed `ee-r4u4`, then launched a fresh reconciliation-enabled cod-test with the same command shape as the prior completed reconciliation run:

- **Exact command:** `set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE=record && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-081320-ee-r4u4-reconciliation-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`
- **Cassette target:** `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-081320-ee-r4u4-reconciliation-rerun.json`
- **Live log:** `.logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.log`
- **Time file:** `.logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.time` (created but empty because the run had to be terminated after the stall)
- **Preserved partial output:** `output/_archives/cod-test-pre-ee-r4u4-20260406-081320/`

The rerun completed Phase 1 and emitted fresh reconciled artifacts, but it did **not** finish end-to-end. The preserved event ledger at `output/_archives/cod-test-pre-ee-r4u4-20260406-081320/_meta/events.jsonl` ends with `provider.call.start` for Phase 2 `video-chunks` `chunkIndex: 3` (`seq: 513`) plus the prompt artifact write at `seq: 514`, with no matching `provider.call.end` / `run.end`. After waiting well beyond the prior successful wall-clock and confirming no forward progress, the hung process was terminated so the evidence could be documented truthfully.

**Comparison vs prior completed reconciliation-backed run** (`output/_archives/cod-test-pre-ee-k4o2a-20260405-210753/`):

- **Lyric-correction behavior:** the fresh Phase 1 ledger now shows **1** applied lyric correction and **1** removed dialogue contamination segment, versus the prior completed reconciliation run’s **5** lyric corrections and **0** removed dialogue segments.
  - **Fresh applied correction:** `58.0-61.2` rewrote `"Obey your master, master"` → `"Obey your master"`.
  - **Fresh removed dialogue contamination:** dialogue segment index `16` (`115.0-117.5`) with text `"Obey your master!"` was removed as `likely_lyric_contamination`.
  - **Prior completed run corrections:** the earlier reconciliation-backed run corrected five isolated `"Master"` fragments to `"Master, master"`, but did not remove any dialogue segment.
- **Do more obvious near-miss lyric cases get corrected?** **Partially yes, but not in a simple “more corrections overall” sense.**
  - The tuned pass did correct a previously more substantial near-miss (`"Obey your master, master"` → `"Obey your master"`), which is a stronger correction than the prior run’s repeated single-token `"Master"` expansions.
  - But the fresh ledger recorded **fewer** reconciliation rewrites overall (`1` vs `5`) because the underlying `music-vocals` output itself arrived much closer to canonical lyrics, so there were fewer correction candidates to reconcile.
- **Does dialogue contamination stay improved?** **Yes, and it improved further in this fresh Phase 1 output.**
  - The fresh reconciled dialogue no longer contains the earlier bogus lyric spillover such as `"I'm a monster."`, `"Control."`, `"Master of the bullet and the blade."`, `"Crushing your bones, smashing your teeth."`, or the long `"... Obey your master."` contaminated segment that appeared in the prior completed reconciliation-backed run.
  - Instead, the fresh reconciled dialogue keeps only spoken trailer lines plus one explicit contamination removal recorded in the ledger.
- **Unsafe rewrites check:** **No new unsafe rewrite evidence found in the fresh Phase 1 artifacts.**
  - The fresh ledger still skips a tempting shortening rewrite with `reason: "target_too_short_relative_to_source"` for a candidate `"Master of puppets"`, showing the new anti-truncation guard is still active.
  - Remaining skipped candidates are low-similarity `"Obey your master"` proposals, not evidence of aggressive overreach.
- **Benchmark delta:** **Unavailable from this fresh rerun.** Because the pipeline never reached `run.end`, there is no trustworthy fresh benchmark/report completion to compare against the prior completed reconciliation-backed run’s `1928/2994` passed (`64.4%`). Any benchmark/report files still present under `output/cod-test/` or `benchmarks/fixtures/cod-test/_reports/` after the stall are not reliable as a fresh ee-r4u4 result because this rerun did not complete the full pipeline.
- **Review conclusion:** the reconciliation tuning appears directionally good on the fresh Phase 1 evidence: it preserved safety guards, removed one clear dialogue-contamination segment, and repaired one more meaningful near-miss lyric phrase while the base `music-vocals` output itself came back substantially cleaner and more canonical than the prior completed run. But the requested fresh benchmark-accuracy judgment remains unresolved because the rerun re-entered the known OpenRouter Phase 2 stall family before benchmark completion.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented the approved reconciliation-tuning tranche in `8533f9e`, validated it with focused tests, then ran a fresh reconciliation-enabled cod-test attempt for bead `ee-r4u4`. That rerun produced useful new Phase 1 evidence: one real near-miss lyric correction, one explicit dialogue-contamination removal, cleaner/canonical `music-vocals` output, and no sign that the anti-truncation safeguards regressed. The run did not finish end-to-end, so benchmark accuracy could not be freshly re-measured.

**Commits:**
- `8533f9e` - Tune reconciliation lyric correction conservatism
- No additional Task 3 commit created

**Lessons Learned:** The tuning improved the *quality* of the reconciler’s best correction more than the *count* of corrections in this fresh sample. The bigger blocker is still operational: Phase 2 provider stalls can prevent benchmark-backed judgment even when Phase 1 reconciliation behavior looks better and remains safe.

---

*Started on 2026-04-05*
