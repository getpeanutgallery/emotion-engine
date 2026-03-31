---
plan_id: plan-2026-03-30-benchmark-iteration-harness-and-runner
bead_ids:
  - ee-ahtl
  - ee-qr2w
  - ee-pk7e
  - ee-7tla
---
# emotion-engine: benchmark iteration harness and runner

**Date:** 2026-03-30  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Codify a reusable benchmark-iteration harness for `emotion-engine` and add a small helper runner script so future sessions can execute controlled benchmark-improvement loops across dialogue and later artifacts without rediscovering the workflow.

---

## Overview

The benchmark core already knows how to compare produced artifacts against fixture truth and emit scores. What it does not yet encode is the disciplined optimization loop around those scores: how to define a lane, limit per-session attempts, enforce anti-overfitting guardrails, challenge proposed fixes before implementation, and keep a durable ledger of what was tried and how the score moved.

This lane should add that missing reusable shell without bloating the existing comparator core. The intended split is:
- benchmark runner core stays responsible for evaluation and reporting
- harness docs + lane config define optimization policy and constraints
- a lightweight helper script makes the workflow easy to resume and hard to do sloppily
- the current dialogue/gold optimization lane becomes the first consumer, not a one-off special case

The first implementation should stay modest and useful. We do not need a full autonomous optimizer. We do want enough structure that a future session or fresh subagent can load the lane definition, see the current baseline and attempt budget, scaffold a new attempt entry, and run the configured narrow benchmark path cleanly.

---

## Tasks

### Task 1: Define the reusable benchmark-iteration harness contract

**Bead ID:** `ee-ahtl`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, define the reusable benchmark-iteration harness contract for future benchmark tuning lanes. Create the benchmark-iteration doc that codifies terminology, per-attempt workflow, challenger rubric, session caps, stop conditions, anti-overfitting rules, and logging requirements. Keep it clearly separate from the existing truth benchmark comparator core. Create or update only source-owned docs and the active plan, claim the bead at start, and close it when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-benchmark-iteration-harness-and-runner.md`
- `docs/BENCHMARK-ITERATION-HARNESS.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-ahtl`, reviewed the existing comparator/scoring contract in `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md` plus the active dialogue iteration plan, and added a new source-owned contract doc at `docs/BENCHMARK-ITERATION-HARNESS.md`.

The new doc deliberately keeps the harness separate from the truth benchmark comparator core: comparator/reporting remains the evaluation engine, while the harness defines the improvement workflow and guardrails around that engine. The contract now codifies reusable terminology (`fixture`, `artifact`, `lane`, `attempt`, `baseline`, `challenger`, `challenger review`, `target score`, `session cap`, `narrow config`, `benchmark manifest`, `ledger`), the standard per-attempt loop, challenger-review questions, recommended session caps and mandatory stop conditions, anti-overfitting / anti-fixture-specialization rules, required ledger/logging expectations, and guidance for using narrow configs plus scoped benchmark manifests during iteration.

The contract stays generic on purpose: it references dialogue only as an example consumer and is written to apply equally to other structured artifacts or future non-dialogue benchmark lanes. No script was built in this task. Updated this active plan to reflect the exact files touched and the actual contract decisions landed in Task 1.

---

### Task 2: Add machine-readable lane config + durable ledger for the dialogue gold lane

**Bead ID:** `ee-qr2w`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, add the first machine-readable benchmark-iteration lane config plus a durable ledger file for the dialogue gold optimization loop. The lane should encode the narrow config path, benchmark manifest path, target accuracy, max attempts per session, allowed touch surfaces, required logging, and anti-specialization constraints. The ledger should capture the baseline and provide a durable place for attempt-by-attempt results across sessions. Keep the format generic enough for future artifacts/fixtures. Claim the bead at start and close it when complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/iterations/lanes/`
- `benchmarks/iterations/ledgers/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-benchmark-iteration-harness-and-runner.md`
- `benchmarks/iterations/lanes/dialogue-gold-optimization.json`
- `benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-qr2w`, reused the existing dialogue-only baseline artifacts from Task 1, and added the first reusable machine-readable lane/ledger contract pair under `benchmarks/iterations/`.

The lane config now lives at `benchmarks/iterations/lanes/dialogue-gold-optimization.json` using contract version `ee.benchmark-iteration-lane/v1`. It intentionally stays generic: top-level keys separate artifact identity, fixture identity, run scope (`narrowConfigPath`, `benchmarkManifestPath`, `ledgerPath`), targets, session policy, change policy, and logging requirements. The config encodes the lane id/display name, artifact key (`dialogueData`), fixture id (`cod-test`), narrow config path (`configs/cod-test-dialogue-benchmark-baseline.yaml`), benchmark manifest path (`benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`), target accuracy (`0.9`), required benchmark status (`pass`), max scored attempts per session (`5`), allowed touch surfaces, required logging fields/artifacts, and explicit generic-only / anti-specialization constraints.

The durable ledger now lives at `benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json` using contract version `ee.benchmark-iteration-ledger/v1`. It records the active baseline as the Task 1 dialogue-only run, including the exact commands used, baseline report references, output/log paths, and the known baseline metrics already established: benchmark status `error`, accuracy `132/311` (`0.42443729903536975`), coverage `311/338` (`0.9201183431952663`), plus the previously identified mismatch buckets (text drift, speaker/speaker_id drift, timing drift, profile drift, missing tail segments, and speaker-profile structural divergence). The ledger also provides a generic history shape with session records, a flat attempts array for future tooling, and `nextAttemptNumber` so later sessions can append scored attempts cleanly without scraping markdown.

This task stayed strictly in the data/ledger-contract layer: no runner implementation and no prompt/code benchmark tuning changes were made here. Updated the active harness plan to reflect the actual file layout and results landed in Task 2.

---

### Task 3: Implement a lightweight benchmark-iteration runner script

**Bead ID:** `ee-pk7e`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement a lightweight helper script for benchmark-iteration lanes. It should read the lane config, validate key paths, surface target/max-attempt metadata, inspect the existing ledger state enough to determine baseline/prior attempt context, and help scaffold or execute the configured narrow benchmark loop in a disciplined way. Keep the first version simple, source-owned, and well documented; do not build a giant autonomous system. Add focused tests if the repo has an obvious place for them, update docs/plan, and close the bead when complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `scripts/`
- `server/lib/`
- `docs/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-benchmark-iteration-harness-and-runner.md`
- `scripts/benchmark-iteration-runner.cjs`
- `server/lib/benchmark-iteration-runner.cjs`
- `docs/BENCHMARK-ITERATION-HARNESS.md`
- `README.md`
- `test/lib/benchmark-iteration-runner.test.js`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-pk7e` and implemented the first reusable runner as a deliberately small two-layer helper:
- CLI entrypoint: `scripts/benchmark-iteration-runner.cjs`
- reusable loader/runner helpers: `server/lib/benchmark-iteration-runner.cjs`

The v1 command shape is:
- `node scripts/benchmark-iteration-runner.cjs inspect --lane <lane.json> [--session-id <id>] [--json]`
- `node scripts/benchmark-iteration-runner.cjs scaffold --lane <lane.json> [--session-id <id>] [--proposal "..."] [--json] [--write <file>]`
- `node scripts/benchmark-iteration-runner.cjs run --lane <lane.json> [--session-id <id>] [--dry-run] [--verbose] [--capture-output] [--log-file <file>] [--json]`

Implemented behavior stays generic to future non-dialogue lanes: it reads the machine-readable lane and ledger, validates that the lane/ledger/narrow-config/benchmark-manifest wiring is coherent, checks baseline artifact references, surfaces lane metadata + target score + session cap + next attempt number, optionally counts attempts already recorded for a supplied session id, scaffolds a contract-shaped JSON attempt record, and can execute the configured narrow benchmark loop through `server/run-pipeline.cjs` before summarizing score deltas versus the active baseline.

This intentionally does **not** auto-mutate the durable ledger yet and does **not** start the 5-attempt tuning loop. That keeps the first version small, source-owned, and inspectable while still making resume/scaffold/run flows concrete and disciplined.

Docs were updated in `docs/BENCHMARK-ITERATION-HARNESS.md` and `README.md` with the exact script path, commands, and current limitations. Added focused tests at `test/lib/benchmark-iteration-runner.test.js` covering lane loading, scaffold generation, and dry-run execution of the configured narrow loop.

Validation run/results for Task 3:
- `node --test test/lib/benchmark-iteration-runner.test.js` ✅
- `node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-task-2-contract-bootstrap` ✅
- `node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-runner-v1 --dry-run --verbose --capture-output --log-file .logs/benchmark-iteration-runner-dry-run.log` ✅

Observed baseline/context surfaced cleanly for the current dialogue lane: target accuracy `90%`, session cap `5`, next attempt number `1`, baseline status `error`, baseline accuracy `42.44%`, and baseline coverage `92.01%`.

---

### Task 4: Wire the current dialogue benchmark plan to the new harness and validate the workflow

**Bead ID:** `ee-7tla`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, wire the existing 2026-03-30 dialogue benchmark iteration plan to the new harness doc/lane/ledger/script. Validate that the dialogue lane can be resumed cleanly using the new structure without rerunning unrelated work. Update both plans with exact references and usage notes, then close the bead when complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `benchmarks/iterations/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-30-benchmark-iteration-harness-and-runner.md`
- `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md`
- any new harness files created by Tasks 1-3

**Status:** ✅ Complete

**Results:** Wired the active dialogue iteration plan onto the new harness surfaces so future sessions now have one clear resume path instead of an ad hoc markdown-only workflow.

Updated `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md` with exact references to:
- `docs/BENCHMARK-ITERATION-HARNESS.md`
- `benchmarks/iterations/lanes/dialogue-gold-optimization.json`
- `benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json`
- `scripts/benchmark-iteration-runner.cjs`
- `server/lib/benchmark-iteration-runner.cjs`

Added explicit usage notes describing the future-session resume sequence: read the dialogue plan for narrative context, run `inspect` to recover the live lane state and remaining attempt budget, run `scaffold` to produce the next attempt record shape before editing code, then run the narrow lane only after challenger review and one accepted main change.

Workflow-focused validation stayed intentionally narrow and did **not** start the 5-attempt tuning loop:
- `node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-task-4-resume-check --json` ✅
- `node scripts/benchmark-iteration-runner.cjs scaffold --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-task-4-resume-check --proposal "Resume from baseline with one generic dialogue-continuity hypothesis" --json` ✅
- `node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-task-4-resume-check --dry-run --verbose --json` ✅
- post-validation re-inspect confirmed `nextAttemptNumber = 1`, `sessionAttemptCount = 0`, and `remainingAttempts = 5` ✅

What this validated exactly: the lane/ledger/config/manifest wiring resolves cleanly, the helper surfaces the existing baseline/report references without rediscovery, dry-run execution stays on the dialogue-only path (`configs/cod-test-dialogue-benchmark-baseline.yaml` → `server/scripts/get-context/get-dialogue.cjs` → `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`), and no attempt budget or ledger state is consumed simply by resuming/inspecting/scaffolding the lane.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A reusable benchmark-iteration harness for `emotion-engine` consisting of a generic workflow contract (`docs/BENCHMARK-ITERATION-HARNESS.md`), the first machine-readable lane config (`benchmarks/iterations/lanes/dialogue-gold-optimization.json`), the first durable lane ledger (`benchmarks/iterations/ledgers/dialogue-gold-optimization-ledger.json`), and a lightweight helper runner (`scripts/benchmark-iteration-runner.cjs`, `server/lib/benchmark-iteration-runner.cjs`) with focused tests. The active dialogue/gold plan is now explicitly wired onto that structure for future-session resumption.

**Commits:**
- Pending.

**Lessons Learned:** Keep the first harness deliberately small: inspect/scaffold/dry-run support was enough to make future-session resume practical without prematurely automating ledger mutation or the tuning loop itself. The key win was making lane state machine-readable while preserving the markdown plan as the human-readable reasoning log.

---

## Guardrails

- Keep the benchmark comparator/scoring core stable unless the true harness need exposes a missing seam.
- Favor a small useful runner over a large speculative automation system.
- The lane config and ledger format must generalize beyond `cod-test` and beyond dialogue.
- Preserve the anti-overfitting rules: no fixture-specific semantic hints or benchmark-cheating workflow.
- After this harness lands, the current dialogue optimization loop should use it rather than remain ad hoc.
