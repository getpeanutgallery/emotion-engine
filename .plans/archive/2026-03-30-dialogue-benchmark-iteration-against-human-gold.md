---
plan_id: plan-2026-03-30-dialogue-benchmark-iteration-against-human-gold
bead_ids:
  - ee-u577
  - ee-nmex
  - ee-35fc
---
# emotion-engine: dialogue benchmark iteration against human gold

**Date:** 2026-03-30  
**Status:** Partial (session-capped stop on 2026-03-30)  
**Agent:** Cookie 🍪

---

## Goal

Measure how the current `cod-test` dialogue output compares against the new human-verified gold benchmark, then iteratively improve the generic dialogue prompt/code path until the score is meaningfully better without overfitting to Call of Duty-specific semantics.

This plan also acts as the durable experiment ledger for future sessions: every proposal, rejection, accepted change, benchmark result, and next-step hypothesis for this lane should be written here so a fresh subagent can resume the loop without losing reasoning history.

---

## Overview

We are picking up immediately after the human-verified dialogue benchmark was created for `cod-test`. That benchmark is now the truth set for this lane, so the next work should stop guessing based on subjective spot checks and instead use a repeatable score loop: regenerate only the dialogue output we care about, compare it to the gold artifact, inspect the deltas, then make the next smallest prompt/code change and rerun.

Derrick also explicitly wants this lane to avoid unnecessary work by cloning `configs/cod-test.yaml` into a new narrow purpose-built config for benchmark iteration rather than reusing the broader canonical config directly. The narrow config should preserve only the benchmark-relevant dialogue regeneration path and any required wiring.

A hard constraint from Derrick is that the dialogue extraction prompt must remain portable. We are not allowed to cheat by making the prompt implicitly or explicitly specific to this trailer, Call of Duty, military language, named characters, or any other benchmark-only clue. Improvements need to come from better generic reasoning about speaker separation, attribution, acoustic evidence, temporal continuity, abstention behavior, and normalization logic that would also generalize to unrelated videos.

This lane should stay narrow. We only need to rerun the test path that regenerates the `cod-test` dialogue artifact and the comparison against the gold benchmark. We should avoid broader pipeline reruns unless a change proves that they are necessary. The benchmark score after each iteration should become the decision surface for whether a change helped, regressed, or merely shifted errors around.

## Harness wiring for this lane

This dialogue lane is now wired onto the reusable benchmark-iteration harness created in `.plans/2026-03-30-benchmark-iteration-harness-and-runner.md`.

**Canonical harness references:**
- Harness contract: `docs/BENCHMARK-ITERATION-HARNESS.md`
- Lane config: `benchmarks/iterations/lanes/dialogue-gold-optimization.json`
- Durable lane ledger: `benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json`
- Helper runner: `scripts/benchmark-iteration-runner.cjs`
- Reusable runner helpers: `server/lib/benchmark-iteration-runner.cjs`

**What owns what now:**
- this plan remains the human-readable execution/story log for dialogue tuning work
- the lane config owns machine-readable lane policy and allowed touch surfaces
- the durable ledger owns baseline facts and future session/attempt state for tooling
- the harness doc owns the reusable workflow/guardrail contract shared by future lanes

**Resume workflow for future sessions:**
1. Read this plan for narrative context and the latest accepted/rejected hypotheses.
2. Inspect the lane state with:
   - `node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id <session-id>`
3. Scaffold the next attempt record shape before touching code:
   - `node scripts/benchmark-iteration-runner.cjs scaffold --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id <session-id> --proposal "<one generic hypothesis>" --json`
4. Only after challenger review and one accepted main change, run the narrow lane:
   - `node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id <session-id> --verbose`
5. Copy the exact commands, files touched, results, and delta-vs-baseline back into this plan and the durable ledger entries for that session.

**Validated Task 4 resume check (workflow-only, no tuning loop started):**
- `inspect` surfaced the wired lane/ledger/config/manifest/output/report references successfully.
- `scaffold` produced an attempt-1 JSON record shape for session `2026-03-30-task-4-resume-check` without mutating the ledger.
- `run --dry-run --verbose --json` validated that the lane executes only the narrow config `configs/cod-test-dialogue-benchmark-baseline.yaml`, which in turn runs only `server/scripts/get-context/get-dialogue.cjs` against `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`.
- A follow-up `inspect` still reported `nextAttemptNumber = 1`, `sessionAttemptCount = 0`, and `remainingAttempts = 5`, confirming the lane can be resumed cleanly without consuming an attempt or rerunning unrelated work.

---

## Tasks

### Task 1: Reconstruct the benchmark evaluation loop and record the current baseline

**Bead ID:** `ee-u577`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, identify the exact command/config path needed to regenerate only the cod-test dialogue output and compare it against the human-verified gold benchmark. Use the narrowest possible rerun scope. Record the current baseline score, summarize the main error buckets, and document the exact artifacts/commands used. Do not widen the run to unrelated phases unless strictly required. If you create a bead for this task, claim it at start with bd update <id> --status in_progress --json and close it on completion with a precise reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `benchmarks/fixtures/cod-test/dialogue-only/`
- `output/cod-test-dialogue-benchmark-baseline/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md`
- `configs/cod-test-dialogue-benchmark-baseline.yaml`
- `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`
- `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/dialogue-data.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`
- `.logs/cod-test-dialogue-benchmark-baseline-20260330-ee-u577.log`

**Status:** ✅ Complete

**Results:** Reconstructed the narrowest runnable loop by creating a dedicated config copy at `configs/cod-test-dialogue-benchmark-baseline.yaml` and a dialogue-only benchmark manifest at `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`. The exact commands used were:
1. `bd update ee-u577 --status in_progress --json`
2. `node server/run-pipeline.cjs --config configs/cod-test-dialogue-benchmark-baseline.yaml --dry-run --verbose`
3. `node server/run-pipeline.cjs --config configs/cod-test-dialogue-benchmark-baseline.yaml --verbose 2>&1 | tee .logs/cod-test-dialogue-benchmark-baseline-20260330-ee-u577.log`

The narrow run executed only `server/scripts/get-context/get-dialogue.cjs`, wrote the regenerated artifact to `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/dialogue-data.json`, and compared it against the human-reviewed gold truth at `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

Measured baseline from `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`:
- benchmark status: `error`
- artifact status: `dialogueData = error`
- accuracy: `132 / 311` scoreable fields passed = `42.44%`
- coverage: `311 / 338` truth fields scoreable = `92.01%`
- failed fields: `179`
- errored fields: `26`

Main mismatch/error buckets from `dialogueData.json`:
- `dialogue_segments.text` fuzzy mismatches: `20`
- `dialogue_segments.speaker` exact mismatches: `20`
- `dialogue_segments.speaker_id` exact mismatches: `20`
- `dialogue_segments.end` tolerant-time mismatches: `19`
- `dialogue_segments.start` tolerant-time mismatches: `16`
- `speaker_profiles.grounded.acoustic_descriptors[0]` fuzzy mismatches: `13`
- `speaker_profiles.inferred_traits.traits[0]` fuzzy mismatches: `13`
- structural error bucket: `7` missing tail `dialogue_segments[23..29]` entries because output produced `23` segments while truth expects `30`
- structural error bucket: `19` missing/extra `speaker_profiles` linked/profile entries, including truth length `14` vs output length `17`

Observed high-signal baseline behavior: the run tracks the opening truth reasonably, then drifts into a shifted transcript/speaker registry, misses the human-reviewed lyric/promo tail, and therefore cascades into timing, speaker, transcript, handoff-context, and speaker-profile mismatches. This establishes the current baseline cleanly without changing prompt behavior yet.

---

### Task 2: Improve generic dialogue prompt/code behavior against the measured deltas

**Bead ID:** `ee-nmex`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, use the measured baseline deltas against the human gold benchmark to improve the dialogue prompt/code path. Keep the prompt generic and portable: do not mention or imply Call of Duty, military context, named characters, trailer-specific lore, or benchmark-specific hints. Prefer improvements rooted in generic speaker continuity, acoustic-first attribution, abstention logic, segment stitching, normalization, and evaluation-informed prompt wording. Make the smallest source-owned change, add/adjust tests where warranted, rerun only the narrow cod-test dialogue benchmark path, and report whether the score improved. If you create a bead for this task, claim it at start with bd update <id> --status in_progress --json and close it on completion with a precise reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `configs/` (if narrow run helpers are needed)
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md`
- `server/scripts/get-context/get-dialogue.cjs` (attempt 1 only; reverted after rejection)
- `test/scripts/get-dialogue.test.js`
- `server/lib/ffmpeg-config.cjs`
- `test/lib/ffmpeg-config.test.js`
- `test/scripts/get-music.test.js`

**Status:** ✅ Complete (session-capped stop for 2026-03-30)

**Results:** Ran two narrow harness attempts in session `2026-03-30-dialogue-opt-loop` and stopped early rather than spend the remaining cap because the only fully scored change materially regressed the benchmark. Attempt 1 was a generic challenger that rejected full-span bracketed no-dialogue placeholders in chunked dialogue output so the target chain would fall through instead of locking in false negatives; it passed challenger review on genericity/scope, but the narrow rerun surfaced an orthogonal transport bug (`openai/gpt-audio` fallback hard-failed on `input_audio.format = mpeg`) before the benchmark could complete, so the change was rejected and reverted. Attempt 2 then targeted that newly surfaced generic transport issue by normalizing MP3 dialogue/music attachments to `audio/mp3`; focused tests passed and the narrow benchmark completed, but accuracy regressed from `42.44%` to `35.65%` and coverage regressed from `92.01%` to `85.50%`, so the baseline was not superseded.

---

### Task 3: Iterate until we hit a sensible stopping point and document the tradeoffs

**Bead ID:** `ee-35fc`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, continue narrow benchmark-driven dialogue iterations as long as each pass remains clearly useful. After each run, compare the new score versus the prior baseline, summarize what improved/regressed, and stop when gains flatten, risk of overfitting rises, or the score is good enough for now. Keep the final notes explicit about why we stopped and whether the resulting prompt/code still appears generic enough to generalize beyond cod-test. If you create a bead for this task, claim it at start with bd update <id> --status in_progress --json and close it on completion with a precise reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- Potentially the same code/test/output paths as Task 2

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md`
- Final touched source/test/output files to be determined during execution

**Status:** ✅ Complete (stopped early to avoid thrash)

**Results:** The lane reached a sensible stop point for this session after two attempts. One accepted generic challenger exposed a source-owned transport compatibility bug but could not be fairly scored and was reverted; the next accepted generic challenger fixed that bug but produced a clear benchmark regression (`-6.79` accuracy points, `-6.51` coverage points). That is enough negative signal to stop rather than consume the remaining three attempts without a stronger evidence-backed hypothesis. Follow-up inspection showed the first local divergence does correlate with fallback chunks, but the major collapse appears later in non-fallback Gemini flash-lite chunk outputs plus normal stitching of those bad inputs. Next session should pick up with **Option B**: a narrow single-model comparison run using a stronger primary chunk-transcription model to isolate whether the current flash-lite-first heterogeneous path is a core source of the drift.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Executed the active dialogue benchmark optimization loop for one session against the reusable harness/ledger, recorded one rejected hypothesis and one fully scored regression, and landed one durable generic infrastructure fix (`audio/mp3` MP3 attachment normalization) that keeps OpenRouter/OpenAI audio fallbacks from fatally rejecting MP3 chunks on `input_audio.format = mpeg`.

**Commits:**
- Pending commit for this session's harness + dialogue-iteration work.

**Lessons Learned:** The benchmark is still dominated by transcript/speaker drift and missing tail segments, but the cleanest next move is not another transport tweak. The next pickup should test **Option B**: a narrow single-model comparison run that uses a stronger primary chunk-transcription model instead of the current flash-lite-first heterogeneous path, so we can isolate whether mixed-path / lightweight-primary chunking is a core driver of the drift.

---

## Iteration Protocol

- **Lane config:** `benchmarks/iterations/lanes/dialogue-gold-optimization.json`
- **Durable ledger:** `benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json`
- **Harness contract:** `docs/BENCHMARK-ITERATION-HARNESS.md`
- **Runner entrypoint:** `scripts/benchmark-iteration-runner.cjs`
- **Session try cap:** maximum `5` benchmarked improvement attempts per session unless Derrick explicitly extends it.
- **Target stop score:** stop early if dialogue benchmark accuracy reaches `>= 90%` against the human gold.
- **Per-try loop:**
  1. propose one concrete generic fix hypothesis
  2. challenge that hypothesis before implementation
  3. either reject it with rationale or accept it for a single narrow change
  4. rerun the narrow dialogue benchmark
  5. record score deltas, what changed, what regressed, and the next hypothesis
- **One main change per try:** avoid bundling multiple unrelated fixes into the same benchmark pass.
- **Fresh-session continuity:** future sessions should read this plan first, then continue from the latest logged attempt instead of rediscovering old ideas.

## Experiment Ledger

### Baseline

- **Run Type:** dialogue-only baseline
- **Config:** `configs/cod-test-dialogue-benchmark-baseline.yaml`
- **Benchmark Manifest:** `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`
- **Result:** `42.44%` accuracy (`132 / 311`) with `92.01%` coverage (`311 / 338`)
- **Status:** `error`
- **Main Error Buckets:**
  - transcript text drift
  - speaker attribution drift
  - speaker_id drift
  - start/end timing misalignment
  - speaker profile descriptor / inferred-trait drift
  - missing final dialogue tail segments
  - extra/misaligned speaker profiles after drift
- **Current Best Hypothesis Pool:**
  - improve segment stitching / seam continuity
  - improve speaker handoff continuity rules
  - improve tail handling for lyric/promo separation
  - improve normalization resilience after segmentation drift

### Attempt Template

For each attempt, record:
- **Attempt #:**
- **Session ID:**
- **Proposal:**
- **Challenge Review:**
- **Decision:** accepted / rejected
- **Implemented Change:**
- **Files Touched:**
- **Exact Commands:**
- **Benchmark Result:** accuracy / coverage / status
- **Report References:** summary json / summary md / artifact result / log / output artifact
- **Delta vs Prior:**
- **Observed Tradeoffs / Regressions:**
- **Next Hypothesis:**

### Attempt 1 — rejected after run surfaced an orthogonal blocker

- **Attempt #:** 1
- **Session ID:** `2026-03-30-dialogue-opt-loop`
- **Proposal:** Reject full-span bracketed no-dialogue placeholders in chunked dialogue output so the target chain falls through instead of locking in false negatives.
- **Challenge Review:**
  - **Benchmark evidence:** baseline drift includes a long false no-dialogue/music span and a missing lyric/promo tail.
  - **Genericity check:** applies to any chunked dialogue transcription pipeline that receives stage-direction placeholders instead of real spoken/sung words.
  - **Regression risk:** medium, because promoting failover can expose target-compatibility issues or alternate-model drift.
  - **Scope check:** narrow; one acceptance-rule change in `get-dialogue` plus one regression test.
  - **Success signal:** same narrow lane completes and improves accuracy without COD-specific wording.
- **Decision:** Rejected after run.
- **Implemented Change:** Added a guard in `server/scripts/get-context/get-dialogue.cjs` to treat a full-span bracketed no-dialogue placeholder as retryable and added a targeted test in `test/scripts/get-dialogue.test.js`; both were reverted after the run exposed a separate fallback transport bug before fair scoring.
- **Files Touched:**
  - `server/scripts/get-context/get-dialogue.cjs` (reverted)
  - `test/scripts/get-dialogue.test.js`
- **Exact Commands:**
  - `bd update ee-nmex --status in_progress --json`
  - `node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop`
  - `node --test test/scripts/get-dialogue.test.js`
  - `node scripts/benchmark-iteration-runner.cjs scaffold --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop --proposal "Reject full-span bracketed no-dialogue placeholders for chunked dialogue transcription so the target chain falls through instead of locking in false negatives." --json`
  - `node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop --verbose`
- **Benchmark Result:** unscored / inconclusive; pipeline failed during Phase 1 fallback, so no trustworthy benchmark delta was established.
- **Report References:**
  - `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/raw/_meta/errors.summary.json`
  - `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0002/attempt-01/capture.json`
  - `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0002/attempt-02/capture.json`
- **Delta vs Prior:** not scored.
- **Observed Tradeoffs / Regressions:** The challenger itself was plausible, but it immediately revealed a generic transport compatibility bug in the target chain: `openai/gpt-audio` rejected MP3 chunk attachments because the request labeled them as `mpeg` instead of `mp3`.
- **Next Hypothesis:** Fix MP3 attachment MIME/format normalization first so fallback-capable attempts can be evaluated honestly.

### Attempt 2 — generic transport fix, benchmark regression

- **Attempt #:** 2
- **Session ID:** `2026-03-30-dialogue-opt-loop`
- **Proposal:** Normalize MP3 dialogue attachments to `audio/mp3` so OpenRouter/OpenAI audio fallbacks can execute instead of fatally rejecting `input_audio.format = mpeg`.
- **Challenge Review:**
  - **Benchmark evidence:** attempt 1 exposed a hard 400 from the dialogue target chain that blocked fair scoring.
  - **Genericity check:** applies to any MP3-backed dialogue/music extraction path using OpenRouter/OpenAI audio input handling.
  - **Regression risk:** medium; transport normalization can change which downstream target answers and therefore change benchmark behavior.
  - **Scope check:** narrow; one MIME mapping change plus expectation updates in focused tests.
  - **Success signal:** focused tests pass, narrow lane completes, and benchmark holds or improves versus baseline.
- **Decision:** Accepted, but baseline not superseded.
- **Implemented Change:** Changed MP3 MIME normalization in `server/lib/ffmpeg-config.cjs` from `audio/mpeg` to `audio/mp3` and updated focused expectations in dialogue/music/ffmpeg-config tests.
- **Files Touched:**
  - `server/lib/ffmpeg-config.cjs`
  - `test/lib/ffmpeg-config.test.js`
  - `test/scripts/get-dialogue.test.js`
  - `test/scripts/get-music.test.js`
- **Exact Commands:**
  - `node --test test/lib/ffmpeg-config.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js`
  - `node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop`
  - `node scripts/benchmark-iteration-runner.cjs scaffold --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop --proposal "Normalize MP3 dialogue attachments to audio/mp3 so OpenRouter/OpenAI audio fallbacks can execute instead of fatally rejecting input_audio.format=mpeg." --json`
  - `node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-opt-loop --verbose`
- **Benchmark Result:** `35.65%` accuracy (`82 / 230`), `85.50%` coverage (`230 / 269`), status `error`.
- **Report References:**
  - `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
  - `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.md`
  - `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`
  - `output/cod-test-dialogue-benchmark-baseline/phase1-gather-context/dialogue-data.json`
- **Delta vs Prior:** `-6.79` accuracy points vs baseline; `-6.51` coverage points vs baseline.
- **Observed Tradeoffs / Regressions:** The transport bug is fixed generically, but the completed run produced only `21` dialogue segments versus the truth’s `30`, worsening already-bad tail coverage and structural speaker-profile drift.
- **Next Hypothesis:** Narrow the rolling handoff memory so later chunks reuse acoustic speaker registry cues without inheriting too much recent transcript text, which may be amplifying lexical drift and missing-tail collapse.

## Guardrails

- Only rerun the path that regenerates `cod-test` dialogue output unless a broader rerun becomes strictly necessary.
- The dialogue prompt must remain generic and reusable across arbitrary video types.
- Do not improve benchmark score by introducing COD-specific, militaristic, or named-entity hints.
- Favor source-owned fixes in `emotion-engine`; avoid sibling repo changes unless the true owning surface demands it.
- Use the human-verified benchmark score as the main decision signal, not vibes.
- The goal is to improve the underlying dialogue system and generic prompting behavior, not to specialize for this fixture.
