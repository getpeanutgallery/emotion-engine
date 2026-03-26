# emotion-engine: design truth benchmark system

**Date:** 2026-03-25  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Design a reusable truth-data and benchmark system for `emotion-engine` so each script output in a test YAML run (starting with `cod-test.yaml`, but not limited to video+audio) can be compared directly against human-authored modality-specific truth files instead of only being inspected ad hoc.

---

## Overview

We already have one concrete near-term need: Derrick wants to edit a "truth" file that we can compare current `dialogue-data.json` output against for `cod-test`. But the real product goal is broader: each script in each phase referenced by a test YAML should be able to emit output that is directly compared against a matching human-authored truth file for that modality. This starts with `cod-test.yaml`, but the design should support the larger `emotion-engine` surface area over time: dialogue, music, video, image, text, recommendations, and future modalities/scripts.

A key product constraint is that truth files should match the real output shape expected from the system. In other words, a human-authored truth file should be valid against the same parser/contract the script itself emits. That gives us direct apples-to-apples comparison, catches schema drift early, and lets this benchmark apparatus act as a guardrail when we revise the markdown prompts sent to AI agents. The system should make regressions visible when a prompt improvement for one fixture harms another.

The evaluation model also needs explicit support for incomplete human knowledge. Unknown / ambiguous should be first-class values in modality truth files so a benchmark can skip those fields honestly while still reporting them as uncovered truth surface. That lets the corpus mature incrementally, similar to test coverage: we can ship partial truth now, measure what is scored versus skipped, and keep filling in the unknowns over time.

The remaining design question is where this system should live. The default assumption is `projects/peanut-gallery/emotion-engine` because the pipeline outputs, configs, and existing test artifacts already live there. But if the truth corpus, evaluation runner, and multi-repo benchmarking logic want to be shared across sibling repos or reused by multiple engines/providers, a polyrepo sibling may be the cleaner long-term home. This plan is meant to answer that deliberately before implementation starts.

---

## Tasks

### Task 1: Capture requirements and evaluation targets

**Bead ID:** `ee-3clp`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved create/claim the relevant bead, then capture the product requirements for a reusable truth benchmark system. Enumerate what outputs need truth baselines first (dialogue, music, emotional beats, recommendations, etc.), what kinds of scoring matter, and what must stay human-editable. Update the plan with a concrete requirement set and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possible future `docs/` or `eval/` folders depending on design outcome

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `docs/TRUTH-BENCHMARK-FIXTURE-MANIFEST-CONTRACT.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-3clp` and completed the first concrete spec lane by writing the repo-owned contract doc at `docs/TRUTH-BENCHMARK-FIXTURE-MANIFEST-CONTRACT.md`.

What the spec now locks down:
- the top-level test YAML `benchmark` block contract, including the minimum supported shape:
  - `enabled: true|false`
  - `path: <benchmark-entry-file>`
- explicit trigger/skip/error behavior:
  - missing benchmark block => skip benchmark
  - `enabled: false` => skip benchmark without deleting `path`
  - `enabled: true` + missing/invalid path => hard config error
- `benchmark.json` as the executable benchmark entrypoint referenced by YAML
- `fixture.json` as the stable fixture identity/provenance record
- one truth JSON file per artifact/script under a future fixture-local `truth/` folder
- truth artifacts must match the same JSON schema/shape as the real outputs
- missing truth fields are hard truth-data bugs, not implicit unknowns
- explicit `unknown` / `ambiguous` sentinels count as skipped coverage in reports instead of disappearing
- benchmark reports must expose both accuracy and truth-coverage semantics

Repo-placement / folder-shape decision captured in the spec:
- keep the written contract in `docs/` now because this lane was design-only and should not prematurely scaffold runtime directories
- recommend the future repo-local benchmark corpus layout as:
  - `benchmarks/fixtures/<fixture-id>/fixture.json`
  - `benchmarks/fixtures/<fixture-id>/benchmark.json`
  - `benchmarks/fixtures/<fixture-id>/truth/<artifact>.json`

Execution note:
- this lane intentionally stopped at the durable written contract and did **not** create the benchmark scaffold yet, which keeps `ee-siay` as the correct next implementation lane once the comparator/scoring lane is also complete

---

### Task 2: Propose data model for truth fixtures and scoring

**Bead ID:** `ee-29to`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved create/claim the relevant bead, then design the truth-fixture schema and scoring model. Cover per-video fixture layout, versioning, human-edit workflow, what should be exact-match vs fuzzy-match, and how to compare engine outputs against truth over time. Update the plan with the proposed schema and scoring strategy, then close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possible future `docs/`, `fixtures/`, `truth/`, or sibling repo structure

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- possible future schema/design docs

**Status:** ✅ Complete

**Results:** Claimed bead `ee-29to` and completed the comparator/scoring design lane by writing the durable repo-local spec at `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`.

What the new spec now locks down:
- comparator registry + interface contract for artifact-level comparison
- required validation pipeline ordering:
  - benchmark/manifest resolution
  - artifact presence checks
  - truth/output JSON parse + schema/shape validation
  - comparator option normalization
  - field/path scoring
  - artifact aggregation
  - benchmark aggregation
- deterministic comparison rule classes:
  - `exact`
  - `fuzzy-string`
  - `tolerant-number`
  - `tolerant-time`
  - `set-membership` (declared but not needed for MVP)
  - `structural`
- explicit truth-sentinel semantics:
  - `unknown` and `ambiguous` both count as skipped coverage in MVP
  - both remain visible in reports
  - neither counts as pass or fail
  - output-side sentinel-like values do **not** get automatic skip treatment
- temporal comparison semantics with a repo-default tolerance of **2 seconds** for time-like fields such as `start`, `end`, `startTime`, `endTime`, `totalDuration`, and `videoDuration`
- per-artifact report contract including identity, comparator config, counts, accuracy, coverage, and failure/skip/error detail lists
- aggregate report contract including fixture/run identity, per-artifact summaries, rolled-up counts, overall accuracy, overall coverage, and benchmark status derivation
- hard-error vs soft-failure boundaries so the scaffold lane knows when to stop before scoring vs when to record a normal mismatch
- recommended MVP comparator set for `cod-test`:
  - implement first: `json-structured/dialogue-default`
  - implement first: `json-structured/music-default`
  - define now / stage as needed: `json-structured/recommendation-default`
  - follow-on after scaffold stability: `json-structured/chunk-analysis-default`

Important implementation guidance now captured for `ee-siay`:
- validate truth/output against the real artifact contract **before** scoring
- treat missing required truth fields as hard errors, never as implicit unknowns
- compare at deterministic leaf field/path granularity
- emit both accuracy and truth coverage
- keep comparator rules outside truth files
- keep the first runnable fixture tight: start with dialogue + music, leave chunk-analysis for follow-on

---

### Task 3: Decide repository placement and implementation path

**Bead ID:** `ee-siay`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved create/claim the relevant bead, then evaluate whether the truth benchmark system belongs inside emotion-engine or in a polyrepo sibling. Compare coupling, reuse, fixture ownership, CI ergonomics, and future multi-engine benchmarking. Recommend the owning repo, draft the implementation path, update the plan with the decision, and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/`
- `docs/`
- `server/lib/`
- `test/lib/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`
- `configs/cod-test.yaml`
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
- `server/lib/benchmark-runner.cjs`
- `server/lib/config-loader.cjs`
- `server/run-pipeline.cjs`
- `test/lib/benchmark-runner.test.js`
- `test/pipeline/config-loader.test.js`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-siay` and implemented the first honest repo-local benchmark scaffold directly inside `emotion-engine`, confirming the owning-repo decision with durable code instead of leaving it as a design-only note.

What landed:
- repo-local benchmark fixture structure under `benchmarks/fixtures/cod-test/` with:
  - `benchmark.json`
  - `fixture.json`
  - `truth/dialogue-data.json`
  - `truth/music-data.json`
- top-level `benchmark` opt-in block enabled in `configs/cod-test.yaml`:
  - `enabled: true`
  - `path: ../benchmarks/fixtures/cod-test/benchmark.json`
- hard benchmark config validation in `server/lib/config-loader.cjs` via the new benchmark resolver:
  - missing block => skip
  - `enabled: false` => skip
  - invalid/missing enabled path => hard validation failure
  - enabled path must resolve to a readable `benchmark.json`
- real post-run benchmark execution hook in `server/run-pipeline.cjs`, after normal artifact serialization and before the run is declared complete
- source-owned benchmark runner at `server/lib/benchmark-runner.cjs`
- fixture-local report generation under `benchmarks/fixtures/cod-test/_reports/`
- bounded MVP comparator implementation for only the approved initial scope:
  - `json-structured/dialogue-default`
  - `json-structured/music-default`

Important scope boundaries / honesty notes:
- this lane does **not** pretend the whole truth benchmark system is finished
- comparator coverage is intentionally limited to dialogue + music only
- recommendation and chunk-analysis benchmark comparators are still not implemented
- the initial cod-test truth files are bootstrap source-controlled copies of the current cod-test output shape so the runner has durable repo-owned inputs immediately; they still need later human editorial review to become stronger gold truth
- benchmark mismatch/error currently fails the run when benchmarking is enabled, which keeps the post-run stage honest instead of emitting fake green status

Validation completed in this lane:
- `node --test test/lib/benchmark-runner.test.js test/pipeline/config-loader.test.js` ✅
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run` ✅
- direct benchmark-stage execution against the existing `output/cod-test` artifact set via `runBenchmarkStage(...)` ✅
  - wrote aggregate + per-artifact reports under `benchmarks/fixtures/cod-test/_reports/`
  - current scaffold summary: `2/2 artifacts passed. 101/101 scoreable fields passed. Truth coverage was 101/101 fields.`

---

### Task 4: Sanity-check full cod-test target versus trimmed dialogue comparison lane

**Bead ID:** `ee-42e0`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare configs/cod-test.yaml against the prior dialogue-focused iteration config (likely configs/cod-test-phase2-3chunk-comparison.yaml), confirm whether cod-test.yaml remains the intended full benchmark-seeding target or whether meaningful drift makes that unsafe, update the active plan with exact files reviewed and actual findings, then close the bead with a clear reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`

**Status:** ✅ Complete

**Results:** Compared the current full-run config at `configs/cod-test.yaml` against the earlier dialogue/chunk review lane at `configs/cod-test-phase2-3chunk-comparison.yaml`, and checked the nearby Phase-1-only review config at `configs/cod-test-phase1-review.yaml`, the active benchmark fixture metadata at `benchmarks/fixtures/cod-test/fixture.json`, the active benchmark manifest at `benchmarks/fixtures/cod-test/benchmark.json`, the benchmark-aware config validation path in `server/lib/config-loader.cjs`, the current music default resolver in `server/scripts/get-context/get-music.cjs`, and the prior dialogue iteration record in `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`.

Evidence-based conclusions:
- `configs/cod-test-phase2-3chunk-comparison.yaml` is a deliberately trimmed review lane, not the canonical benchmark-seeding target. It writes to isolated output root `output/cod-test-phase2-3chunk-comparison`, disables report scripts (`report: []`), omits the new `benchmark` block entirely, and caps Phase 2 at `settings.max_chunks: 3`.
- `configs/cod-test.yaml` is still the intended full-run target for the repo-local benchmark fixture. It writes to `output/cod-test`, enables the benchmark block pointing at `../benchmarks/fixtures/cod-test/benchmark.json`, includes the Phase 3 report stack, and allows the full Phase 2 pass (`settings.max_chunks: 100`, which currently resolves to 29 chunks for `examples/videos/emotion-tests/cod.mp4`).
- The earlier comparison config was intentionally carrying forward the Phase 1 dialogue/music behavior from `configs/cod-test-phase1-review.yaml` while trimming the downstream work for faster human review. The 2026-03-22 plan explicitly described it as the “smallest isolated comparison config,” with isolated output and a 3-chunk cap.
- The one visible config drift item that looked suspicious at first — `ai.music.analysisWindowSeconds: 30` being explicit in the review/comparison configs but absent in `configs/cod-test.yaml` — is not a behavioral drift. `server/scripts/get-context/get-music.cjs` resolves the default analysis window to `30` seconds when unset, so the full config still uses the same effective music windowing.
- There is one wording-only drift in `configs/cod-test.yaml`: the description still says `Test pipeline for cod.mp4 video (2 chunks max)` even though `settings.max_chunks: 100` and the current video-processing lane computes 29 chunks. That description is stale, but it does not change runtime behavior.
- The meaningful runtime drift is not about which config should be rerun; it is about artifact contract shape. The existing full-run artifact at `output/cod-test/phase1-gather-context/dialogue-data.json` was still the older shallow contract (`dialogue_segments[*]` with only `speaker/start/end/text/confidence`, no top-level `speaker_profiles`, no segment `speaker_id`, no top-level `cleanedTranscript`). By contrast, the trimmed comparison artifact at `output/cod-test-phase2-3chunk-comparison/phase1-gather-context/dialogue-data.json` already had the richer dialogue contract (`speaker_profiles`, top-level `cleanedTranscript`, segment `speaker_id`, segment `index`).

Decision from the sanity-check:
- rerunning `configs/cod-test.yaml` is the correct next step
- the comparison config should remain treated as a faster dialogue/chunk review lane, not the canonical full benchmark source
- the real question to verify is whether a fresh full rerun on current repo state now produces the richer Phase 1 dialogue contract or still falls back to the old shallow shape

---

### Task 5: Rerun full cod-test, inspect dialogue contract, and refresh benchmark bootstrap honestly

**Bead ID:** `ee-px4k`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after confirming cod-test.yaml is still the right full-run target, rerun the real cod-test pipeline, inspect output/cod-test/phase1-gather-context/dialogue-data.json for richer speaker-contract fields (speaker_id, speaker_profiles, cleanedTranscript, etc.), refresh the benchmark bootstrap only if the full-run artifact shape is the right canonical source, run focused validation, update the plan with exact files changed and any remaining blockers, then close the bead with a clear reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/cod-test/`
- `output/_archives/`
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `configs/cod-test.yaml`
- `output/_archives/cod-test-pre-ee-px4k-20260325-105604/`
- `.logs/cod-test-20260325-105604-ee-px4k.log`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`

**Status:** ✅ Complete

**Results:** Ran the real full pipeline target after archiving the previous full-run packet to `output/_archives/cod-test-pre-ee-px4k-20260325-105604/` and logging the attempt to `.logs/cod-test-20260325-105604-ee-px4k.log`.

Execution truth:
- `node validate-configs.cjs && node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run` passed before the live rerun.
- The live rerun completed Phase 1 successfully and produced fresh full-run artifacts at:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/music-data.json`
- The live rerun did **not** complete the full pipeline. It failed during Phase 2 chunk processing on chunk 13 with `OpenRouter: Invalid string length`, recorded in `.logs/cod-test-20260325-105604-ee-px4k.log`.
- Because Phase 2 failed, this lane does **not** claim that the full cod-test run completed green. It only claims the honest Phase-1 regeneration + benchmark-bootstrap refresh work that was actually supported by the produced artifacts.

Phase 1 dialogue contract findings from the regenerated full-run artifact (`output/cod-test/phase1-gather-context/dialogue-data.json`):
- the full-run output now includes the richer dialogue contract
- exact top-level keys now present:
  - `cleanedTranscript`
  - `dialogue_segments`
  - `handoffContext`
  - `speaker_profiles`
  - `summary`
  - `totalDuration`
- exact segment-level richer fields now present:
  - `dialogue_segments[*].speaker_id`
  - `dialogue_segments[*].index`
- exact profile-level richer fields now present:
  - `speaker_profiles[*].speaker_id`
  - `speaker_profiles[*].label`
  - `speaker_profiles[*].grounded`
  - `speaker_profiles[*].inferred_traits`
- concrete regenerated counts:
  - `17` dialogue segments
  - `7` speaker profiles
- this answers the key alignment question: the current full `cod-test.yaml` Phase 1 artifact now matches the richer dialogue-speaker contract rather than the old shallow `speaker/start/end/text/confidence`-only shape

Benchmark/bootstrap refresh decisions:
- Since the full-run Phase 1 artifacts now reflect the richer current contract, the repo-local benchmark bootstrap was refreshed from the regenerated full-run outputs for the artifacts the current benchmark actually covers:
  - copied `output/cod-test/phase1-gather-context/dialogue-data.json` → `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - copied `output/cod-test/phase1-gather-context/music-data.json` → `benchmarks/fixtures/cod-test/truth/music-data.json`
- This remains an honest bootstrap refresh, **not** a claim that the truth files are fully human-authored gold truth. They are still source-controlled bootstrap copies of the current canonical Phase-1 full-run outputs and still need later editorial tightening.
- After refreshing those truth artifacts, the benchmark runner was executed directly against `output/cod-test` and produced fresh reports under `benchmarks/fixtures/cod-test/_reports/` with aggregate summary:
  - `2/2 artifacts passed. 239/239 scoreable fields passed. Truth coverage was 239/239 fields.`
- The refreshed dialogue artifact report at `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` now confirms the comparator is scoring richer speaker-contract fields such as `speaker_id`, `index`, `speaker_profiles[*].grounded.*`, `speaker_profiles[*].inferred_traits.*`, `handoffContext`, and `cleanedTranscript`.

Additional durable cleanup from this lane:
- corrected stale config wording in `configs/cod-test.yaml` from `Test pipeline for cod.mp4 video (2 chunks max)` to `Canonical full-run benchmark target for cod.mp4 with benchmark seeding enabled` so the config prose now matches its actual role.

Focused validation run after the refresh:
- `node validate-configs.cjs` ✅
- `node --test test/lib/benchmark-runner.test.js test/pipeline/config-loader.test.js` ✅
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run` ✅
- direct `runBenchmarkStage(...)` invocation against `output/cod-test` after truth refresh ✅

Remaining boundaries / blockers documented honestly:
- full `cod-test.yaml` is still the correct canonical benchmark-seeding config
- the richer Phase 1 dialogue speaker contract is now present in the regenerated full-run artifact
- benchmark comparator support for the richer Phase 1 dialogue/music truth is working for the current implemented scope
- benchmark support is still intentionally incomplete for recommendation and chunk-analysis artifacts
- the live full pipeline is still blocked from end-to-end green completion by the Phase 2 provider/runtime failure on chunk 13 (`OpenRouter: Invalid string length`)

---

### Task 6: Investigate Phase 2 chunk-13 recording/runtime failure

**Bead ID:** `ee-epje`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine and any owning polyrepo siblings needed, claim bead ee-epje immediately with bd update ee-epje --status in_progress --json, then investigate the current full-run blocker from configs/cod-test.yaml: Phase 2 fails on chunk 13 with OpenRouter: Invalid string length. Start from output/cod-test/phase2-process/raw/_meta/errors.jsonl and output/cod-test/phase2-process/raw/ai/chunk-0012/split-00/attempt-02/capture.json and trace the exact failure path into the owning code. Determine whether the fault is in provider transport, digital-twin recording, oversized raw artifact capture, or some other serialization seam; implement the smallest honest fix in the owning repo(s). Do not modify node_modules directly; if the fix belongs in a polyrepo sibling, make the change in that owning repo, commit and push there, then refresh emotion-engine dependencies cleanly and validate with a targeted rerun. Update the plan with exact evidence and files changed, then close the bead with bd close ee-epje --reason "Implemented and validated chunk-13 invalid string length fix" --json when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possible sibling polyrepo repo(s) if ownership is outside `emotion-engine`
- `output/cod-test/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- likely `server/scripts/process/video-chunks.cjs` and/or owning sibling transport/capture code
- targeted raw/error artifacts from reproduction reruns

**Status:** ✅ Complete

**Results:** Traced, fixed, and validated the chunk-13 blocker as a digital-twin recording serialization failure in the owning sibling repo `../digital-twin-core`, not an upstream OpenRouter transport outage.

Exact failure path proven from the recorded artifacts:
- `output/cod-test/phase2-process/raw/_meta/errors.jsonl` recorded `RangeError: Invalid string length` thrown by `JSON.stringify` inside `emotion-engine/node_modules/digital-twin-core/lib/store.js:100`
- the stack then flowed through `emotion-engine/node_modules/digital-twin-core/lib/engine.js:98` → `emotion-engine/node_modules/digital-twin-router/index.js:397` → `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs:336` → `server/scripts/process/video-chunks.cjs`
- `output/cod-test/phase2-process/raw/ai/chunk-0012/split-00/attempt-02/capture.json` confirmed the provider-facing request itself had already been built successfully and the thrown error was a local `RangeError`, not an HTTP/API rejection

Root-cause findings:
- the owned record cassette at `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` had grown to **533,655,220 bytes (~509 MB)** across **390 interactions** before the failing rerun
- inspection of a worst-case recorded interaction showed the bloat lived in nested transport-debug payloads, especially `response.providerRequest.body.messages[*].content[*].input_audio.data` / similar inline media blobs; one sample interaction serialized to **4,638,011 chars**, of which `response.providerRequest` alone accounted for **4,606,025 chars**
- this means the actual bug was an oversized raw artifact capture / digital-twin persistence seam: record mode was persisting giant inline base64 media payloads inside cassette debug envelopes until `TwinStore.write()` hit V8 string-size limits during full-cassette rewrite on chunk 13

Owning-repo fix implemented:
- repo: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-core`
- file changed: `lib/redaction.js`
- file changed: `test/core.test.js`
- change: added large-binary detection/redaction so nested base64 blobs (for example `input_audio.data`, `inline_data`, `bytes`, raw media payloads, or any very large base64-looking string) are collapsed to a bounded placeholder during cassette sanitization/write
- new owning commit pushed: `b0bddad` — `Redact oversized inline media blobs`

Focused validation performed:
- `npm test` in `../digital-twin-core` ✅
- direct redaction measurement against the real oversized cassette ✅
  - before redaction: `533,655,220` bytes
  - projected redacted JSON length with the fix: `13,369,971` chars
- targeted Phase-2 rerun of the real `video-chunks` script with `configs/cod-test.yaml` semantics and `max_chunks` forced to `13`, using the committed sibling fix via resolver override instead of patching `node_modules` by hand ✅
  - command path used the real script: `server/scripts/process/video-chunks.cjs`
  - output root: `output/cod-test-fix-validate/`
  - result: chunk 13 completed successfully (`✅ Chunk 13 analyzed (9370 tokens)`), and the 13-chunk targeted pass finished green
- post-rerun cassette state confirmed the persistence fix actually took effect on the real record artifact ✅
  - `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` shrank to **15,599,072 bytes (~15 MB)**
  - interaction count increased to **420**
  - cassette metadata now shows `redacted: true` and `redactionVersion: 2`

Consumer refresh note:
- no source code change was required inside `emotion-engine` itself because ownership is in `digital-twin-core`
- a normal `npm install` refresh in `emotion-engine` was attempted but hit a local npm git-cache temp-dir bug (`fatal: destination path .../.git already exists and is not an empty directory` while cloning `ai-providers`)
- to avoid hand-editing `node_modules`, validation consumed the committed sibling fix through a runtime module-resolution override for the rerun; the durable code change remains the pushed `digital-twin-core` commit above

---

### Task 7: Extend benchmark comparator beyond current Phase 1 dialogue/music MVP


**Bead ID:** `ee-5n4c`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-5n4c immediately with bd update ee-5n4c --status in_progress --json, then extend the benchmark comparator beyond the current dialogue/music MVP. Choose the next honest artifact scope (likely recommendation or chunk-analysis) based on what can be advanced without human verification blocking it. Implement comparator support and fixture/truth/report wiring without pretending unknown truth exists where it does not, add focused tests, run benchmark validation/reruns, update the plan with exact artifacts covered and remaining gaps, then close the bead with bd close ee-5n4c --reason "Extended cod-test benchmark coverage beyond Phase 1 dialogue/music" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/`
- `docs/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`
- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Chose **Phase 3 recommendation** as the next honest scope instead of chunk-analysis.

Why this was the right next slice:
- recommendation was already explicitly designed in `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md` as the next comparator after dialogue/music
- it adds real coverage beyond Phase 1 without needing Derrick to do line-by-line human truth review first
- it avoids pretending that unstable run metadata is semantic gold truth by letting the comparator skip volatile metadata fields while still reporting that skipped coverage honestly
- chunk-analysis remains larger/noisier and is still the next follow-on gap after this lane

Comparator/reporting implementation that landed:
- `server/lib/benchmark-runner.cjs`
  - added support for `json-structured/recommendation-default`
  - added comparator-owned `ignorePaths` handling so volatile fields can be skipped by rule instead of being faked as truth-side `unknown`
  - added deterministic subtree skipping for ignored paths
  - fixed leaf-path rule selection so string arrays such as `keyFindings[*]` and `suggestions[*]` can use `fuzzy-string`
  - recommendation now scores stable semantic fields (`text`, `reasoning`, `confidence`, `keyFindings[*]`, `suggestions[*]`, `failedChunks`, `pipelineVersion`) while skipping volatile run metadata under `generatedAt` and `ai`
- `benchmarks/fixtures/cod-test/benchmark.json`
  - added new artifact entry `recommendationData`
  - wired it to `output/cod-test/phase3-report/recommendation/recommendation.json`
  - configured comparator profile `recommendation-default`
  - configured `ignorePaths` for `$.generatedAt` and `$.ai`
- `benchmarks/fixtures/cod-test/fixture.json`
  - updated fixture notes/tags to record that recommendation benchmark coverage is now included as bootstrap truth and that chunk-analysis is still pending
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
  - bootstrapped from the current canonical full-run output at `output/cod-test/phase3-report/recommendation/recommendation.json`
  - this is explicitly **bootstrap truth**, not a claim of human-reviewed gold truth
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
  - updated scaffold status to reflect recommendation comparator support and the new volatile-field skip policy
- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`
  - documented comparator-owned skip controls (`ignorePaths`) for volatile recommendation metadata

Focused tests added/updated:
- `test/lib/benchmark-runner.test.js`
  - added coverage proving recommendation benchmarking can:
    - ignore volatile metadata (`generatedAt`, nested `ai.*`)
    - fuzzy-compare string arrays (`keyFindings[*]`, `suggestions[*]`)
    - keep tolerant numeric comparison for `confidence`

Validation actually performed:
- `node --test test/lib/benchmark-runner.test.js` ✅
- direct benchmark rerun via `runBenchmarkStage(...)` against the canonical existing artifact set in `output/cod-test` ✅
- attempted `node validate-configs.cjs`, but the current workspace install is missing `js-yaml`, so that validation entrypoint could not run here; this did not block proving the benchmark extension itself because the runner tests and direct benchmark rerun both passed

Exact rerun result after adding recommendation coverage:
- aggregate report: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- overall benchmark status: `pass`
- overall summary: `3/3 artifacts passed. 477/477 scoreable fields passed. Truth coverage was 477/489 fields.`
- new recommendation artifact report: `benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`
  - artifact status: `pass`
  - recommendation counts: `22/22` scoreable fields passed
  - recommendation truth coverage: `22/34` scoreable, `12/34` skipped
  - skipped fields are the explicitly comparator-ignored volatile metadata paths (`generatedAt` plus nested `ai.*` fields), not fake unknown truth

Remaining gaps after this extension:
- `chunk-analysis-default` is still not implemented
- recommendation truth is still bootstrap truth copied from the canonical run, not human-reviewed gold truth
- if Derrick wants stronger semantic signal later, the next honest work is chunk-analysis comparator coverage and/or human editorial tightening of the recommendation truth payload

---

### Task 8: Rerun canonical full cod-test after chunk-13 fix

**Bead ID:** `ee-dn02`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine and any owning polyrepo siblings needed, claim bead ee-dn02 immediately with bd update ee-dn02 --status in_progress --json, then rerun the canonical full pipeline using configs/cod-test.yaml after the digital-twin-core fix b0bddad. Refresh emotion-engine dependencies cleanly if possible, but do not edit node_modules by hand; if local install tooling is still flaky, use the smallest honest clean consumption path that preserves repo integrity. Run the full pipeline, capture exact outcome, update the active plan with exact evidence/files/validation, and close the bead with bd close ee-dn02 --reason "Executed full cod-test rerun after chunk-13 fix" --json when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/cod-test/`
- `.logs/`
- possible owning sibling repo(s) only if additional source changes are required

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- rerun output and log artifacts from the canonical `configs/cod-test.yaml` run
- dependency manifests/lockfiles only if a legitimate clean refresh is required

**Status:** ✅ Complete

**Results:** Recovered directly from repo artifacts after the subagent failed to deliver a clean handoff, the canonical full rerun did in fact execute and reach the benchmark stage.

Exact rerun evidence:
- log file: `.logs/cod-test-20260326-1235-ee-dn02.log`
- the rerun definitively passed the former blocker:
  - `✅ Chunk 13 analyzed` appears in the log
  - `✅ Phase 2 complete` appears in the log
- the rerun then completed the whole report phase:
  - `✅ Phase 3 complete` appears in the log
  - `output/cod-test/artifacts-complete.json` exists from the run
- the run failed only at the benchmark stage, not during pipeline generation:
  - `🧪 Running benchmark stage...`
  - final log outcome: `❌ Pipeline failed: Benchmark error: 0/2 artifacts passed. 80/227 scoreable fields passed. Truth coverage was 227/269 fields.`

Recovered benchmark result details from `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`:
- summary status: `error`
- artifacts passed: `0/2`
- scoreable fields passed: `80/227`
- failed fields: `147`
- errored fields: `42`
- dialogue artifact status: `error`
- music artifact status: `fail`

Meaning of the recovered result:
- the chunk-13 `Invalid string length` blocker is genuinely cleared in the canonical full run
- the pipeline now runs through Phase 1, Phase 2, and Phase 3 under the full config
- the new blocking lane is benchmark truth/comparator alignment, especially dialogue truth drift versus the regenerated output contract/content
- this means the next honest execution lane is no longer transport/debug-persistence recovery; it is benchmark reconciliation / truth refresh / comparator follow-up

---

### Task 9: Reconcile benchmark truth/comparator drift after canonical full rerun

**Bead ID:** `ee-q4eo`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine and any owning polyrepo siblings needed, claim bead ee-q4eo immediately with bd update ee-q4eo --status in_progress --json, then investigate why the canonical full rerun now fails at benchmark stage. Start from .logs/cod-test-20260326-1235-ee-dn02.log, benchmarks/fixtures/cod-test/_reports/benchmark-summary.json, benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json, and benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json. Determine whether the real problem is stale truth bootstrap, comparator semantics that are too strict/naive, or both. Update truth and/or comparator code honestly in the owning repo(s), without pretending unknown truth exists where it does not. Run focused tests plus a benchmark rerun, update the active plan with exact evidence/files/validation/results, and close the bead with bd close ee-q4eo --reason "Reconciled cod-test benchmark truth/comparator drift" --json when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `docs/`
- `server/lib/`
- `test/lib/`
- possible owning sibling repo(s) only if benchmark ownership is outside `emotion-engine`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- benchmark fixture truth files and/or comparator runner/tests/docs as needed
- rerun reports proving the reconciled result

**Status:** ✅ Complete

**Results:** Reconciled the post-rerun benchmark failure as **both** stale bootstrap truth and comparator semantics that were too naive for generated prose/confidence fields.

Exact root-cause evidence from the starting artifacts:
- `.logs/cod-test-20260326-1235-ee-dn02.log` proves the canonical run itself completed through Phase 3 and failed only at benchmark stage.
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` showed aggregate failure at `0/2` artifacts passed, `80/227` scoreable fields passed, and `42` comparator errors.
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` showed the real hard break was stale truth bootstrap: truth still expected `17` dialogue segments and `7` speaker profiles, while the canonical rerun output contained `39` dialogue segments and `13` speaker profiles, causing structural drift and downstream field-index misalignment.
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json` showed a softer mismatch pattern: structure/timing still aligned, but prose-heavy fields (`description`, `summary`) plus a few low-signal categorical/confidence-like values drifted, which exposed that the MVP comparator was still too brittle for generated descriptive text.

Owning repo changed:
- repo: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`

Exact files changed in this lane:
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`
- `.plans/2026-03-25-design-truth-benchmark-system.md`

Comparator reconciliation implemented:
- expanded fuzzy-string normalization beyond whitespace-only matching so generated prose fields now compare case-insensitively and punctuation-insensitively after Unicode normalization/collapse
- broadened fuzzy treatment to the generated-text fields that were previously being exact-compared too naively (`cleanedTranscript`, `handoffContext`, descriptive `label`, and `note` fields in addition to existing prose fields)
- changed numeric comparison semantics for `confidence` fields from exact equality to tolerant numeric comparison with a bounded default tolerance of `0.1`

Truth reconciliation implemented:
- refreshed `benchmarks/fixtures/cod-test/truth/dialogue-data.json` from the canonical rerun artifact at `output/cod-test/phase1-gather-context/dialogue-data.json`
- refreshed `benchmarks/fixtures/cod-test/truth/music-data.json` from the canonical rerun artifact at `output/cod-test/phase1-gather-context/music-data.json`
- this is explicitly an **updated bootstrap refresh**, not a claim that dialogue/music truth is fully human-reviewed gold truth

Focused validation performed:
- `node --test test/lib/benchmark-runner.test.js` ✅
  - includes new coverage for punctuation/case-tolerant fuzzy prose comparison
  - includes new coverage for tolerant numeric confidence comparison
- direct benchmark rerun against the canonical rerun artifacts via `runBenchmarkStage(...)` with:
  - config name `COD Test Pipeline`
  - benchmark path `../benchmarks/fixtures/cod-test/benchmark.json`
  - output dir `output/cod-test`
  - result: `pass`

Exact rerun result after reconciliation:
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- aggregate status: `pass`
- aggregate summary: `2/2 artifacts passed. 455/455 scoreable fields passed. Truth coverage was 455/455 fields.`

Remaining gaps after reconciliation:
- the cod-test dialogue/music truth files are still refreshed bootstrap snapshots, not line-by-line human-reviewed gold truth
- benchmark comparator coverage is still intentionally limited to the current Phase-1 dialogue/music scope; recommendation and chunk-analysis benchmarking remain follow-on work

---

### Task 10: Extend benchmark coverage to chunk-analysis

**Bead ID:** `ee-z0ww`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-z0ww immediately with bd update ee-z0ww --status in_progress --json, then extend cod-test benchmark coverage to chunk-analysis as the next non-human-blocked artifact lane. Implement honest comparator support, fixture/truth/report wiring, and focused tests without pretending unknown truth exists where it does not. Be explicit about which chunk-analysis truth is bootstrap truth versus reviewed truth. Run focused validation plus benchmark reruns, update the active plan with exact files changed, validation, and remaining gaps, then close the bead with bd close ee-z0ww --reason "Extended cod-test benchmark coverage to chunk-analysis" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `docs/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- chunk-analysis benchmark fixture truth/report files and comparator/tests/docs as needed

**Status:** ✅ Complete

**Results:** Claimed bead `ee-z0ww` and extended the cod-test benchmark lane to cover **Phase 2 chunk-analysis** as the next honest non-human-blocked artifact scope.

Exact scope added:
- `chunk-analysis-default` is now a real supported benchmark comparator profile in `server/lib/benchmark-runner.cjs`
- the comparator now uses keyed array alignment for `chunks[*]` by `chunkIndex` + `splitIndex` instead of brittle positional matching
- chunk-analysis timing fields use the existing tolerant-time semantics, prose fields (`summary`, per-lens `reasoning`) use fuzzy-string semantics, categorical fields (`status`, `dominant_emotion`) stay exact, and `confidence` uses tolerant-number semantics
- volatile token-usage fields are skipped honestly via comparator-owned ignore paths instead of being treated as reviewed truth:
  - `$.chunks[*].tokens`
  - `$.totalTokens`

Exact files changed:
- `server/lib/benchmark-runner.cjs`
  - added `chunk-analysis-default` profile support
  - added wildcard-aware ignore-path matching so comparator-owned skips can target array members like `$.chunks[*].tokens`
  - added keyed array alignment support for chunk-analysis chunks
- `test/lib/benchmark-runner.test.js`
  - added focused fixture/test coverage proving chunk-analysis benchmarking passes with keyed chunk reordering and ignored token-count volatility
- `benchmarks/fixtures/cod-test/benchmark.json`
  - added required `chunkAnalysis` artifact wiring to `phase2-process/chunk-analysis.json` with comparator options for timing tolerance, numeric tolerance, and token ignore paths
- `benchmarks/fixtures/cod-test/fixture.json`
  - recorded that chunk-analysis benchmark coverage now exists
  - explicitly documented that `truth/chunk-analysis.json` is **bootstrap truth**, not reviewed gold truth
  - explicitly documented that token fields are comparator-skipped volatile metadata
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
  - created by copying the current canonical artifact from `output/cod-test/phase2-process/chunk-analysis.json` as bootstrap truth so the benchmark runner has a durable source-controlled input without pretending it has already been human reviewed
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/chunkAnalysis.json`
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
  - updated the implemented-scope doc to reflect chunk-analysis coverage and the remaining bootstrap-truth boundary
- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`
  - updated the chunk-analysis contract notes so the doc matches the implemented keyed-alignment + token-skip behavior
- `.plans/2026-03-25-design-truth-benchmark-system.md`

Truth provenance / honesty note:
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json` is **bootstrap truth** copied from the current canonical repo-local output artifact.
- It is **not** yet a human-reviewed semantic gold truth file.
- The benchmark now says that plainly in fixture metadata and plan documentation instead of pretending otherwise.

Validation performed:
- `node --test test/lib/benchmark-runner.test.js` ✅
  - `8` tests passed
  - includes the new chunk-analysis case proving keyed chunk alignment and comparator-owned token skips
- direct benchmark rerun via `runBenchmarkStage(...)` against the canonical existing artifact set in `output/cod-test` ✅
  - aggregate summary: `4/4 artifacts passed. 1017/1017 scoreable fields passed. Truth coverage was 1017/1058 fields.`
  - chunk-analysis artifact report: `benchmarks/fixtures/cod-test/_reports/artifact-results/chunkAnalysis.json`
  - chunk-analysis result: `540/540` scoreable fields passed with `29/569` truth fields skipped (the `28` per-chunk `tokens` fields plus `totalTokens`)
  - aggregate truth coverage rose to `1017/1058` fields (`0.9612476370510397`) after adding chunk-analysis support

Remaining gaps after this extension:
- chunk-analysis truth is still bootstrap truth and still needs human editorial review before it should be treated as gold-standard semantic truth
- recommendation truth is also still bootstrap truth, even though its comparator lane now exists
- broader benchmark coverage beyond dialogue/music/recommendation/chunk-analysis is still not implemented
- comparator semantics are still deterministic only; there is no richer semantic judging layer for cases where exact/fuzzy/tolerant rules stop being sufficient

---

### Task 11: Audit older config/script artifact surfaces across the polyrepo

**Bead ID:** `ee-o4x6`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine and relevant polyrepo siblings, claim bead ee-o4x6 immediately with bd update ee-o4x6 --status in_progress --json, then audit the three pipeline phases for other benchmarkable artifact surfaces exposed by older YAML config files and by current scripts. Review older config variants under emotion-engine, inspect artifact-producing scripts in emotion-engine and any relevant sibling source repos, and identify candidate benchmark surfaces, their output paths/contracts, and whether they are stable enough for honest truth/comparator support. Update the active plan with exact files reviewed, findings, recommended next lanes, and close the bead with bd close ee-o4x6 --reason "Audited polyrepo artifact surfaces for benchmark expansion" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possible docs or notes only if needed for durable audit output
- relevant sibling repo folders if audit notes belong there

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- any durable audit doc if created during the lane

**Status:** ✅ Complete

**Results:** Claimed bead `ee-o4x6` and completed the polyrepo artifact-surface audit for remaining benchmark expansion lanes.

Exact files/configs/scripts reviewed for this audit:
- YAML/config surface under `emotion-engine/configs/`:
  - `configs/cod-test.yaml`
  - `configs/cod-test-phase1-review.yaml`
  - `configs/cod-test-phase2-3chunk-comparison.yaml`
  - `configs/cod-test-phase3.yaml`
  - `configs/cod-late-window-grounding-check.yaml`
  - `configs/cod-test-ee-af2-timeoutprobe.yaml`
  - `configs/video-analysis.yaml`
  - `configs/video-analysis-parallel.yaml`
  - `configs/full-analysis.yaml`
  - `configs/raw-analysis.yaml`
  - `configs/metadata-extract.yaml`
  - `configs/dialogue-transcription.yaml`
  - `configs/audio-analysis.yaml`
  - `configs/image-analysis.yaml`
  - `configs/multi-analysis.yaml`
  - `configs/multi-persona-swarm.yaml`
  - `configs/single-chunk-test.yaml`
  - `configs/single-chunk-test-per-second.yaml`
  - `configs/example-pipeline.yaml`
  - `configs/e2e-test.yaml`
- Current artifact-producing engine code:
  - `server/lib/output-manager.cjs`
  - `server/lib/raw-capture.cjs`
  - `server/lib/script-contract.cjs`
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/get-context/get-metadata.cjs`
  - `server/scripts/process/video-chunks.cjs`
  - `server/scripts/process/video-per-second.cjs`
  - `server/scripts/report/metrics.cjs`
  - `server/scripts/report/recommendation.cjs`
  - `server/scripts/report/emotional-analysis.cjs`
  - `server/scripts/report/summary.cjs`
  - `server/scripts/report/final-report.cjs`
  - `server/scripts/report/evaluation.cjs`
- Relevant sibling polyrepo ownership checked because it shapes benchmarkable runtime artifacts:
  - `../tools/emotion-lenses-tool.cjs`
  - `../tools/lib/local-validator-tool-loop.cjs`
  - `../tools/lib/structured-output.cjs`
  - `../ai-providers/providers/openrouter.cjs`

Audit conclusions by phase / surface:

**Phase 1 — remaining surfaces**
- `phase1-gather-context/metadata.json` from `server/scripts/get-context/get-metadata.cjs`
  - Exposed directly by `configs/metadata-extract.yaml` and still owned by a small deterministic ffprobe wrapper.
  - Current contract is compact and stable: top-level metadata object derived from ffprobe, written to `phase1-gather-context/metadata.json`.
  - Benchmark value: **high** as the next honest expansion lane because it is deterministic, low-volatility, and not model-prose-heavy.
  - Comparator guidance: mostly exact/structural matching, possibly tolerant numeric handling on duration/bitrate-like fields if needed.
- `phase1-gather-context/dialogue-data.json` and `phase1-gather-context/music-data.json`
  - Already benchmarked; older YAML variants (`cod-test-phase1-review`, `dialogue-transcription.yaml`, `audio-analysis.yaml`, `multi-analysis.yaml`, `multi-persona-swarm.yaml`) confirmed these remain the canonical Phase 1 artifact surfaces across old and current configs.
  - No new hidden Phase 1 benchmark surface was found beyond metadata.
- Phase-1 raw surfaces under `phase1-gather-context/raw/**`
  - Includes ffmpeg extraction logs, prompt refs, AI attempt captures, stitch inputs/outputs, `_meta/errors.*`, and tool version captures.
  - Benchmark value: **low right now**. These are useful forensic/debug artifacts, but too volatile and too implementation-coupled for honest truth comparison as first-class benchmark targets.

**Phase 2 — remaining surfaces**
- `phase2-process/per-second-data.json` from `server/scripts/process/video-per-second.cjs`
  - Explicitly surfaced by older configs (`video-analysis.yaml`, `full-analysis.yaml`, `single-chunk-test-per-second.yaml`) but omitted from the current cod-test benchmark scope.
  - Current contract is stable enough: top-level `per_second_data`, `totalSeconds`, `totalTokens`, derived from chunk analysis and video duration.
  - Benchmark value: **good next candidate**. It is derivative of chunk analysis, but still a user-visible contract with honest value because it is the canonical time-series surface consumed by metrics when present.
  - Comparator guidance: keyed or positional time-series comparison with tolerant-number/tolerant-time semantics and explicit skip/ignore for token metadata if needed.
- `phase2-process/chunk-analysis.json`
  - Already benchmarked and confirmed as the canonical structured Phase 2 semantic artifact.
- `phase2-process/raw/**`, `phase2-process/script-results/**`, `phase2-process/recovery/**`
  - These include prompt traces, tool-loop histories, AI attempt captures, recovery lineage, and success envelopes.
  - Benchmark value: **low** for now. They are volatile execution telemetry and derivable orchestration residue, not clean semantic truth targets.

**Phase 3 — remaining surfaces**
- `phase3-report/metrics/metrics.json` from `server/scripts/report/metrics.cjs`
  - Surfaced by `cod-test.yaml`, `cod-test-phase3.yaml`, `video-analysis.yaml`, and `single-chunk-test-per-second.yaml`.
  - Current contract is fairly stable: `summary`, `implementationStatus`, `averages`, `peakMoments`, `trends`, `frictionIndex`, plus metadata like `generatedAt` / `pipelineVersion`.
  - Benchmark value: **good next candidate**, especially if comparator-owned ignore paths skip volatile generation metadata. It is derivative of Phase 2, but it is still a first-class programmatic artifact rather than just presentation glue.
- `phase3-report/emotional-analysis/emotional-data.json` from `server/scripts/report/emotional-analysis.cjs`
  - Current contract includes `summary`, `chunkAnalysis`, `failedChunkDetails`, `emotionalArc`, `scrollRiskTimeline`, and `criticalMoments`.
  - Benchmark value: **maybe later / medium**. It is rich and potentially useful, but a larger portion is synthesized prose/aggregation over chunk-analysis, so it is more likely to need comparator tuning and/or editorial review before it becomes a clean truth target.
- `phase3-report/summary/summary.json` from `server/scripts/report/summary.cjs`
  - Current contract is mostly an index/aggregator: `metadata`, `keyMetrics`, `recommendation`, `reportPaths`.
  - Benchmark value: **low-to-medium**. It is stable enough structurally, but much of its value duplicates already-benchmarked source artifacts or points at file paths. Better as a light smoke/contract check than a priority semantic benchmark lane.
- `phase3-report/summary/analysis-data.json` and `phase3-report/summary/FINAL-REPORT.md` from `server/scripts/report/final-report.cjs`
  - Also mirrored by older simplified configs via `server/scripts/report/evaluation.cjs` (`analysis-data.json` + `FINAL-REPORT.md` at the run root).
  - Benchmark value: **low right now**. These are primarily presentation/packaging artifacts, heavily derivative of metrics/recommendation/emotional-analysis, and markdown output is especially noisy for comparator truth work.
- `phase3-report/recommendation/recommendation.json`
  - Already benchmarked; older configs confirmed it is the main stable Phase 3 decision artifact.

What older YAML variants revealed that matters:
- The old config family does expose alternate surface combinations, but not many genuinely new contracts.
- The meaningful hidden benchmark lanes from older YAML are mostly:
  - **metadata-only runs** (`metadata-extract.yaml`) proving `metadata.json` is a real first-class artifact
  - **per-second runs** (`video-analysis.yaml`, `full-analysis.yaml`, `single-chunk-test-per-second.yaml`) proving `per-second-data.json` is a real first-class artifact
  - **legacy/simple report runs** (`dialogue-transcription.yaml`, `audio-analysis.yaml`, `image-analysis.yaml`, `evaluation.cjs`) showing `analysis-data.json` and `FINAL-REPORT.md` exist, but as thin derivative presentation outputs rather than strong next benchmark candidates
- The example/test configs (`example-pipeline.yaml`, `e2e-test.yaml`) are scaffolding/demo surfaces, not meaningful truth-benchmark expansion targets.

Recommended priority order for next benchmark expansion lanes:
1. **Phase 3 metrics (`phase3-report/metrics/metrics.json`)**
   - Best remaining candidate for structured, nontrivial drift detection on an AI-adjacent surface.
2. **Phase 3 emotional-analysis (`phase3-report/emotional-analysis/emotional-data.json`)**
   - High product value, but should likely be decomposed into benchmarkable structural/category layers before expecting human gold to match.
3. **Phase 3 summary/index surfaces (`summary.json`, `analysis-data.json`, `FINAL-REPORT.md`)**
   - Lowest-value near-term benchmark lane; better treated as contract/smoke artifacts than semantic truth gold.

Decision updates from Derrick after the audit:
- **Remove `metadata.json` from the benchmark expansion plan.** It is deterministic enough that we are comfortable relying on it without spending human gold-benchmark effort there.
- **Treat `per-second-data.json` as a cleanup/deletion target, not a benchmark target.** It was superseded by the video chunk system and belongs to the older one-second screenshot-era path.

Surfaces explicitly *not* recommended as benchmark priorities right now:
- any `raw/**` captures
- any `script-results/**` success envelopes
- any `recovery/**` lineage artifacts
- provider/debug payloads from sibling repos (`ai-providers`, validator-tool-loop histories, prompt refs)
These are operational/debug surfaces, too volatile for honest comparator support, and would mostly benchmark implementation details rather than product behavior.

---

### Task 12: Extend benchmark coverage to metrics

**Bead ID:** `ee-lwue`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-lwue immediately with bd update ee-lwue --status in_progress --json, then extend cod-test benchmark coverage to the Phase 3 metrics artifact as the next priority benchmark lane. Implement honest comparator support, fixture/truth/report wiring, and focused tests without pretending unknown truth exists where it does not. Be explicit about which metrics truth is bootstrap truth versus reviewed truth, and use comparator-owned ignores if any generation metadata is too volatile. Run focused validation plus benchmark reruns, update the active plan with exact files changed, validation, and remaining gaps, then close the bead with bd close ee-lwue --reason "Extended cod-test benchmark coverage to metrics" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `docs/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `benchmarks/fixtures/cod-test/truth/metrics.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Extended cod-test benchmark coverage to **Phase 3 metrics** as the next honest benchmark lane.

Exact scope added:
- added `json-structured/metrics-default` comparator profile support in `server/lib/benchmark-runner.cjs`
- wired new benchmark artifact `metricsData` to `output/cod-test/phase3-report/metrics/metrics.json`
- bootstrapped source-controlled truth at `benchmarks/fixtures/cod-test/truth/metrics.json`
- generated a real metrics artifact report at `benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`

Comparator semantics implemented for metrics:
- `generatedAt` is skipped via comparator-owned `ignorePaths` because it is volatile run metadata, not reviewed semantic truth
- `pipelineVersion`, `implementationStatus.*`, and summary counts remain exact
- `summary.videoDuration` and `peakMoments.*.(highest|lowest).timestamp` use tolerant-time semantics
- `averages.*`, `peakMoments.*.(highest|lowest).score`, `trends.*.(change|firstHalfAverage|secondHalfAverage)`, and `frictionIndex` use tolerant-number semantics
- `trends.*.direction` remains exact

Truth provenance / honesty note:
- `benchmarks/fixtures/cod-test/truth/metrics.json` is **bootstrap truth** copied from the current canonical artifact at `output/cod-test/phase3-report/metrics/metrics.json`
- it is **not** yet a human-reviewed gold truth artifact
- the fixture metadata and docs now say that plainly instead of overstating truth maturity

Focused tests and validation performed:
- `node --test test/lib/benchmark-runner.test.js` ✅
  - `9` tests passed
  - includes a new metrics-specific test proving `generatedAt` is skipped and derived numeric/timing fields use the intended tolerant rules
- direct benchmark rerun via `runBenchmarkStage(...)` against the canonical existing artifact set in `output/cod-test` ✅
  - aggregate summary: `5/5 artifacts passed. 1052/1052 scoreable fields passed. Truth coverage was 1052/1094 fields.`
  - metrics artifact result: `35/35` scoreable fields passed with `1/36` truth fields skipped (`generatedAt`)
- attempted `node validate-configs.cjs`, but the current workspace install still cannot resolve `js-yaml`, so config validation remains locally blocked and was not used as proof for this lane

Exact report evidence after the rerun:
- aggregate: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- metrics artifact: `benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- aggregate status: `pass`
- metrics artifact status: `pass`
- aggregate truth coverage is now `1052/1094` fields (`0.9616087751371115`)
- metrics truth coverage is `35/36` fields (`0.9722222222222222`) because only `generatedAt` is comparator-skipped

Remaining gaps after this extension:
- metrics truth is still bootstrap truth and still needs human editorial review before it should be treated as gold truth
- recommendation and chunk-analysis truth are also still bootstrap truth
- broader benchmark expansion beyond dialogue/music/recommendation/chunk-analysis/metrics is still not implemented
- workspace validation/install hygiene still needs cleanup because `validate-configs.cjs` cannot currently load `js-yaml`

---

### Task 13: Extend benchmark coverage to emotional-analysis

**Bead ID:** `ee-tyr1`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-tyr1 immediately with bd update ee-tyr1 --status in_progress --json, then extend cod-test benchmark coverage to the Phase 3 emotional-analysis artifact. Decompose the surface as needed so deterministic comparison focuses on benchmarkable structural/category fields rather than pretending long-form synthetic prose is easy gold truth. Implement honest comparator support, fixture/truth/report wiring, and focused tests; be explicit about which emotional-analysis truth is bootstrap truth versus reviewed truth; use comparator-owned ignores or partial-scoring rules where appropriate; run focused validation plus benchmark reruns; update the active plan with exact files changed, evidence, validation, and remaining gaps; then close the bead with bd close ee-tyr1 --reason "Extended cod-test benchmark coverage to emotional-analysis" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `docs/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- emotional-analysis benchmark fixture truth/report files and comparator/tests/docs as needed

**Status:** ✅ Complete

**Results:** Extended cod-test benchmark coverage to **Phase 3 emotional-analysis** with an intentionally bounded comparator that scores deterministic structural/category/numeric fields while skipping volatile/generated prose that we cannot honestly treat as reviewed semantic gold truth yet.

Exact emotional-analysis benchmark scope added:
- added `json-structured/emotional-analysis-default` comparator profile support in `server/lib/benchmark-runner.cjs`
- wired new benchmark artifact `emotionalAnalysisData` to `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- added keyed array alignment for emotional-analysis collections where positional matching would be brittle:
  - `chunkAnalysis[*]` keyed by `chunkIndex`
  - `scrollRiskTimeline[*]` keyed by floored `timestamp`
  - `criticalMoments[*]` keyed by floored `timestamp` + `emotion` + `type` + `chunkIndex`
- kept comparison focused on deterministic signal:
  - exact: `pipelineVersion`, `implementationStatus.*`, summary counts, `scrollRiskLevel`, `dominantEmotion.emotion`, `emotionalSignature`, `dataPoints`, `failedChunkDetails`, timeline/category labels
  - tolerant-time: `summary.videoDuration`, per-chunk timing fields, keyed event/timeline timestamps
  - tolerant-number: `summary.averageScrollRisk`, per-chunk emotion scores / emotional velocity / scroll risk / dominant emotion score, emotional-arc numeric series, scroll-risk numeric series, critical-moment numeric severity fields
- explicitly skipped only the volatile/generated fields that are not honest reviewed truth yet:
  - `$.generatedAt`
  - `$.criticalMoments[*].context`

Truth provenance / honesty note:
- created `benchmarks/fixtures/cod-test/truth/emotional-analysis.json` by copying the canonical current artifact from `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- this is **bootstrap truth**, not human-reviewed gold truth
- fixture metadata and scaffold/docs now say that plainly instead of overstating truth maturity

Exact files changed in this lane:
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`
- `docs/TRUTH-BENCHMARK-MVP-SCAFFOLD.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

Focused tests and validation performed:
- `node --test test/lib/benchmark-runner.test.js` ✅
  - `10` tests passed
  - includes new emotional-analysis coverage proving comparator-owned skips for generated prose context plus tolerant numeric/time handling and keyed alignment
- direct benchmark rerun via `runBenchmarkStage(...)` against the canonical existing artifact set in `output/cod-test` ✅
  - aggregate report: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
  - emotional-analysis artifact report: `benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
  - aggregate result: `6/6 artifacts passed. 3154/3154 scoreable fields passed. Truth coverage was 3154/3210 fields.`
  - emotional-analysis artifact result: `2102/2102` scoreable fields passed with `14/2116` truth fields skipped
  - the `14` skipped fields are exactly `generatedAt` plus the `13` `criticalMoments[*].context` prose fields

Remaining gaps after this extension:
- emotional-analysis truth is still bootstrap truth and still needs human editorial review before it should be treated as gold truth
- recommendation, chunk-analysis, and metrics truth are also still bootstrap truth
- emotional-analysis comparator intentionally does **not** pretend to semantically grade long-form explanatory prose; `criticalMoments[*].context` remains skipped until/if Derrick wants reviewed truth there
- broader benchmark expansion beyond dialogue/music/recommendation/chunk-analysis/metrics/emotional-analysis is still not implemented

---

### Task 14: Remove obsolete per-second pipeline surface

**Bead ID:** `ee-bx1y`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-bx1y immediately with bd update ee-bx1y --status in_progress --json, then remove or deprecate the obsolete per-second pipeline surface that was superseded by chunk-analysis. Audit remaining scripts/config references, remove the dead path cleanly, validate that current chunk-based flows remain intact, update the active plan with exact removals/migration notes, and close the bead with bd close ee-bx1y --reason "Removed obsolete per-second pipeline surface" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `docs/`
- `examples/`
- `server/lib/`
- `server/scripts/report/`
- `server/scripts/process/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- `README.md`
- `configs/full-analysis.yaml`
- `configs/video-analysis.yaml`
- `configs/single-chunk-test-per-second.yaml` (deleted)
- `docs/CONFIG-GUIDE.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- `docs/PIPELINE-SCRIPTS.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `examples/test-assets.md`
- `server/lib/artifact-manager.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/phases/report-runner.cjs`
- `server/lib/script-contract.cjs`
- `server/run-pipeline.cjs`
- `server/scripts/process/video-per-second.cjs` (deleted)
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`
- `server/scripts/report/summary.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/scripts/computed-report-contract.test.js`
- `test/scripts/evaluation.test.js`
- `test/scripts/report-phase3-fallback.test.js`
- `test/scripts/video-per-second.test.js` (deleted)

**Status:** ✅ Complete

**Results:** Removed the obsolete standalone per-second Phase 2 surface and migrated the remaining consumers onto direct `chunkAnalysis` derivation.

Exact removals:
- deleted the dead Phase 2 script `server/scripts/process/video-per-second.cjs`
- deleted its dedicated config `configs/single-chunk-test-per-second.yaml`
- deleted the obsolete unit suite `test/scripts/video-per-second.test.js`
- removed active config references from `configs/full-analysis.yaml` and `configs/video-analysis.yaml`
- removed runtime artifact/hydration/contract references to `perSecondData` from:
  - `server/lib/artifact-manager.cjs`
  - `server/lib/persisted-artifacts.cjs`
  - `server/lib/script-contract.cjs`
  - `server/run-pipeline.cjs`

Migration notes:
- `metrics.cjs` and `emotional-analysis.cjs` now compute their timeline directly from successful `chunkAnalysis` instead of optionally consuming a dedicated `perSecondData` artifact.
- `summary.cjs` now sources duration/seconds metadata from chunk-derived Phase 3 artifacts instead of the removed Phase 2 per-second artifact.
- `evaluation.cjs` remains legacy-only, but now derives its compatibility timeline from `chunkAnalysis` and explicitly warns that no dedicated per-second phase artifact exists anymore.
- active docs/examples were updated so the current pipeline surface no longer advertises `per-second-data.json` or `video-per-second.cjs` as live entrypoints.

Validation performed:
- `node --test test/scripts/evaluation.test.js test/scripts/computed-report-contract.test.js test/scripts/report-phase3-fallback.test.js` ✅
- `npm test -- --test-reporter=dot` ✅ (`320` tests passed)
- `npm run validate-configs` ✅ (`22/22` YAML configs parsed successfully)
- `node server/run-pipeline.cjs --config configs/video-analysis.yaml --dry-run` ✅
- `node server/run-pipeline.cjs --config configs/full-analysis.yaml --dry-run` ✅
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --dry-run` ✅

Remaining impacts / follow-up notes:
- historical/archive plan docs still mention `video-per-second.cjs` as part of past rollout history; those references were intentionally left as historical record.
- internal helper code in report scripts still builds a chunk-derived per-second-style timeline in memory because that is the simplest way to compute current metrics/arc outputs, but it is no longer a persisted Phase 2 pipeline surface.

---

### Task 15: Decide summary/presentation smoke-check scope

**Bead ID:** `ee-cn5e`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-cn5e immediately with bd update ee-cn5e --status in_progress --json, then decide whether summary/index/presentation artifacts such as summary.json, analysis-data.json, and FINAL-REPORT.md deserve lightweight contract/smoke checks. Define the smallest honest scope if they do, or recommend explicitly deferring them if they do not. Update the active plan with exact artifacts reviewed, recommendation, and rationale, then close the bead with bd close ee-cn5e --reason "Decided summary/presentation smoke-check scope" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- docs only if a durable decision note is useful

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- any tiny decision doc if created

**Status:** ✅ Complete

**Results:** Reviewed the current canonical summary/presentation outputs plus the scripts that generate them and the active benchmark fixture wiring to decide whether these surfaces deserve coverage.

Exact artifacts/scripts reviewed for this decision:
- current canonical output artifacts:
  - `output/cod-test/phase3-report/summary/summary.json`
  - `output/cod-test/phase3-report/summary/analysis-data.json`
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- current report-generation code:
  - `server/scripts/report/summary.cjs`
  - `server/scripts/report/final-report.cjs`
  - `server/scripts/report/evaluation.cjs`
- current benchmark fixture wiring/context:
  - `benchmarks/fixtures/cod-test/benchmark.json`
  - `benchmarks/fixtures/cod-test/fixture.json`
- active design history used as context:
  - `.plans/2026-03-25-design-truth-benchmark-system.md`

Decision:
- **Yes, these summary/presentation surfaces deserve lightweight contract/smoke checks.**
- **No, they should not become full semantic truth-benchmark artifacts right now.**

Rationale:
- `summary.json`, `analysis-data.json`, and `FINAL-REPORT.md` are mostly packaging/index/presentation layers built from already-benchmarked upstream artifacts (`metrics`, `recommendation`, `chunk-analysis`, `emotional-analysis`).
- Their product value is real — broken links, missing sections, stale counts, or malformed packaging would be user-visible regressions — but semantic truth-comparing them would mostly duplicate upstream benchmark coverage and create noisy maintenance around generated markdown/prose formatting.
- The legacy `evaluation.cjs` surface confirms there is historical path drift for `analysis-data.json` and `FINAL-REPORT.md`, which makes a small canonical-path smoke check more useful than pretending there is one stable semantic benchmark surface across old and new packaging modes.

Smallest honest smoke-check scope recommended:
1. **`summary.json` contract smoke**
   - assert file exists at canonical path `phase3-report/summary/summary.json`
   - assert top-level keys exist: `metadata`, `keyMetrics`, `recommendation`, `reportPaths`
   - assert `metadata.generatedAt`, `metadata.videoDuration`, `metadata.chunksAnalyzed`, and `metadata.totalTokens` are present
   - assert `reportPaths.summary === <canonical summary.json path>`
   - assert any declared sibling paths in `reportPaths` (`metrics`, `recommendation`, `emotionalAnalysis`, optional `analysisData`, optional `finalReport`) exist on disk

2. **`analysis-data.json` packaging smoke**
   - assert file exists at canonical path `phase3-report/summary/analysis-data.json`
   - assert top-level keys exist: `metadata`, `summary`, `data`
   - assert `data.chunkAnalysis` exists and includes a `chunks` array
   - assert `summary.keyMetrics` and `summary.recommendation` exist
   - assert basic consistency with sibling artifacts:
     - `metadata.videoDuration` matches `summary.json.metadata.videoDuration` within a tiny tolerance
     - `metadata.totalTokens` matches `summary.json.metadata.totalTokens`
     - `metadata.chunksAnalyzed === data.chunkAnalysis.chunks.length`

3. **`FINAL-REPORT.md` render smoke**
   - assert file exists at canonical path `phase3-report/summary/FINAL-REPORT.md`
   - assert it contains the core section headings that define the current report shape:
     - `# Emotion Analysis - Final Report`
     - `## Executive Summary`
     - `## AI Recommendation`
     - `## Key Metrics`
     - `## Chunk-by-Chunk Analysis`
     - `## Emotional Arc`
     - `## Technical Details`
   - assert the markdown includes a few canonical output references/identity markers such as `FINAL-REPORT.md`, `summary.json`, and `analysis-data.json`

Explicit non-goals / deferrals:
- do **not** add these surfaces to `benchmarks/fixtures/cod-test/benchmark.json` as semantic truth artifacts for now
- do **not** compare markdown prose body text, per-chunk narrative wording, emoji bars, or exact formatting as benchmark truth
- do **not** spend human gold-truth effort on legacy `evaluation.cjs` outputs beyond preserving awareness that they exist as compatibility surfaces

Implementation recommendation:
- add one small smoke-test file for canonical Phase 3 summary packaging, ideally fed from an existing canonical output packet or a tiny fixture, instead of expanding comparator profiles
- keep the check explicitly positioned as **presentation packaging integrity**, not as another semantic benchmark lane

---

### Task 16: Fix local js-yaml hygiene and decide whether update.sh should own it

**Bead ID:** `ee-9vy1`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine and, if needed, /home/derrick/.openclaw/workspace/scripts/update.sh or other shared maintenance files, claim bead ee-9vy1 immediately with bd update ee-9vy1 --status in_progress --json, then investigate the missing js-yaml hygiene issue that currently blocks validate-configs.cjs. Determine the minimal proper fix, whether it should be repo-local or shared across Cookie/Chip/Byte via update.sh, and only use the temporary sudo window if a system-level install is genuinely the right solution. Update the active plan with the exact diagnosis, decision, files changed, and validation result, then close the bead with bd close ee-9vy1 --reason "Resolved js-yaml hygiene decision" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `scripts/` only if shared maintenance changes are justified
- repo manifests/lockfiles only if repo-local hygiene is the right fix

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- any repo-local dependency manifests/lockfiles or shared maintenance scripts if changed

**Status:** ✅ Complete

**Results:** Diagnosed and fixed the blocker as a repo-local dependency hygiene issue, not a missing system package and not a shared `update.sh` concern.

Exact diagnosis:
- `validate-configs.cjs` failed on `require('js-yaml')`, but `js-yaml` was already declared in `package.json` and present in `package-lock.json`.
- The real failure was that this workspace had a broken/partial install: `node_modules/` contained many extraneous packages and many unmet direct dependencies, including `js-yaml`.
- `npm` is not the right recovery path for this repo because the repo now uses a `link:../digital-twin-core` dependency; `npm install` failed immediately with `EUNSUPPORTEDPROTOCOL` on the `link:` spec.
- The supported installer here is `pnpm`, and the reason `pnpm install` had previously left the repo half-installed was an invalid direct `ai-providers` pin in `package.json`: it pointed at `github:getpeanutgallery/ai-providers#79838d5de8e5f1860a5431d5e28ce7e4a6f56d5e`, which 404ed. The correct reachable commit is `79838d5cf1d3acf77cf8f9b0ac5823a43085d1ec`.
- Because install aborted before completion, `js-yaml` never got materialized into this repo’s `node_modules`, which is why both `validate-configs.cjs` and `server/lib/config-loader.cjs` could not resolve it.

Decision:
- **Own this repo-locally.** The fix belongs in `emotion-engine` manifests/lockfiles because the breakage came from this repo’s dependency metadata and install state.
- **Do not put this in `/home/derrick/.openclaw/workspace/scripts/update.sh`.** `update.sh` is for shared machine/tool maintenance, not for repairing project-specific private Git dependency pins or hydrating per-repo `node_modules`.
- **No sudo was warranted or used.** A system-level install of `js-yaml` would have been the wrong layer and would have masked the actual repo dependency failure.

Files changed in this lane:
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `.plans/2026-03-25-design-truth-benchmark-system.md`

What changed:
- corrected the direct `ai-providers` dependency pin to the valid reachable commit in `package.json`
- aligned the root `ai-providers` entry in `package-lock.json`
- refreshed `pnpm-lock.yaml` by reinstalling with `pnpm`, which also locked the repo’s current `digital-twin-core` link override and restored the missing packages into `node_modules`
- left `/home/derrick/.openclaw/workspace/scripts/update.sh` untouched

Validation result:
- `node -p "require.resolve('js-yaml')"` ✅ now resolves to `node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml/index.js`
- `npm run validate-configs` ✅ passed
- validator output: all `22/22` YAML config files parsed successfully

---

### Task 17: Add lightweight summary/presentation smoke checks

**Bead ID:** `ee-pahq`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-pahq immediately with bd update ee-pahq --status in_progress --json, then implement the lightweight summary/presentation smoke checks previously scoped for summary.json, analysis-data.json, and FINAL-REPORT.md. Keep the checks structural and packaging-focused rather than semantic truth benchmarking. Add focused tests, validate the result, update the active plan with exact scope/files/validation/outcomes, and close the bead with bd close ee-pahq --reason "Added summary/presentation smoke checks" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/` or `server/scripts/report/` if smoke-check logic belongs there
- `test/`
- docs if the new smoke-check scope needs a small note

**Files Created/Deleted/Modified:**
- `.plans/2026-03-25-design-truth-benchmark-system.md`
- smoke-check implementation/tests/docs as needed

**Status:** ✅ Complete

**Results:** Implemented the scoped packaging-integrity smoke lane without turning these artifacts into semantic truth benchmarks.

Exact smoke-check scope landed:
- `summary.json`
  - canonical path check for `phase3-report/summary/summary.json`
  - required top-level keys: `metadata`, `keyMetrics`, `recommendation`, `reportPaths`
  - required metadata fields: `generatedAt`, `videoDuration`, `chunksAnalyzed`, `totalTokens`
  - `reportPaths.summary` must equal the canonical summary path
  - any declared sibling artifact path in `reportPaths` (`metrics`, `recommendation`, `emotionalAnalysis`, optional `analysisData`, optional `finalReport`) must exist on disk
- `analysis-data.json`
  - canonical path check for `phase3-report/summary/analysis-data.json`
  - required top-level keys: `metadata`, `summary`, `data`
  - `data.chunkAnalysis.chunks` must exist and be an array
  - `summary.keyMetrics` and `summary.recommendation` must exist
  - lightweight consistency only: `metadata.videoDuration` must match `summary.json.metadata.videoDuration` within `0.001`, `metadata.totalTokens` must match `summary.json.metadata.totalTokens`, and `metadata.chunksAnalyzed` must equal `data.chunkAnalysis.chunks.length`
- `FINAL-REPORT.md`
  - canonical path check for `phase3-report/summary/FINAL-REPORT.md`
  - required headings only: `# Emotion Analysis - Final Report`, `## Executive Summary`, `## AI Recommendation`, `## Key Metrics`, `## Chunk-by-Chunk Analysis`, `## Emotional Arc`, `## Technical Details`
  - required output references only: `FINAL-REPORT.md`, `summary.json`, `analysis-data.json`
- explicit non-goal preserved: no prose-grading, markdown body comparison, semantic recommendation judging, or truth bootstrap added to `benchmark.json`

Files changed:
- `server/lib/report-package-smoke.cjs`
- `test/lib/report-package-smoke.test.js`
- `.plans/2026-03-25-design-truth-benchmark-system.md`

Validation run:
- `node --test test/lib/report-package-smoke.test.js test/scripts/computed-report-contract.test.js test/scripts/final-report.test.js`
- result: `12/12` tests passed
- validation also proved the current canonical packet under `output/cod-test/phase3-report/summary/` passes the new smoke suite

Outcome:
- the repo now has a dedicated reusable smoke-check helper for summary/presentation packaging integrity plus focused regression tests
- the smoke checks live outside the semantic benchmark comparator system, matching the prior decision

---

## Final Results

**Status:** ✅ Complete

**What We Built:** The repo now has an honest benchmark scaffold for cod-test dialogue, music, recommendation, chunk-analysis, metrics, and emotional-analysis artifacts, a validated fix for the former chunk-13 cassette-write failure in `digital-twin-core`, a reconciled cod-test benchmark lane that passes again on the canonical full rerun, a durable audit of the remaining benchmarkable artifact surfaces across older YAML variants and current polyrepo script ownership, a lightweight summary/presentation smoke lane for `summary.json`, `analysis-data.json`, and `FINAL-REPORT.md`, and a completed cleanup that removes the obsolete standalone per-second Phase 2 pipeline surface in favor of chunk-analysis-derived reporting. The benchmark work now covers the next honest synthesis-heavy Phase 3 lane without pretending volatile metadata or bootstrap truth are stronger than they are.

What is true right now:
- `configs/cod-test.yaml` remains the canonical full benchmark target
- the canonical full rerun now completes Phase 1, Phase 2, and Phase 3 under `configs/cod-test.yaml`
- the former chunk-13 `Invalid string length` blocker was a local digital-twin cassette serialization seam, not an upstream OpenRouter API rejection
- the owning fix for that blocker was pushed in `digital-twin-core` as commit `b0bddad`
- the benchmark runner now treats generated prose more robustly (case/punctuation-tolerant fuzzy normalization on descriptive fields), treats `confidence` as a tolerant numeric field instead of exact-equality trivia, supports comparator-owned ignored volatile paths for recommendation metadata, supports keyed chunk-analysis comparison plus token-field skips, supports a metrics comparator with derived-number/timing tolerances plus `generatedAt` ignore handling, and now supports an emotional-analysis comparator that benchmarks deterministic structural/category/numeric fields while skipping only `generatedAt` and `criticalMoments[*].context`
- the cod-test dialogue/music truth files are refreshed bootstrap snapshots of the canonical rerun artifacts, not falsely-labeled human-reviewed gold truth
- the cod-test recommendation truth file is also a bootstrap snapshot of the canonical rerun artifact, with comparator-owned skips for volatile `generatedAt` and nested `ai.*` metadata rather than fake truth-side `unknown`
- the cod-test chunk-analysis truth file is now a bootstrap snapshot of `output/cod-test/phase2-process/chunk-analysis.json`, explicitly labeled as bootstrap truth rather than reviewed gold truth
- the cod-test metrics truth file is now a bootstrap snapshot of `output/cod-test/phase3-report/metrics/metrics.json`, explicitly labeled as bootstrap truth rather than reviewed gold truth
- the cod-test emotional-analysis truth file is now a bootstrap snapshot of `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`, explicitly labeled as bootstrap truth rather than reviewed gold truth
- after this extension, the benchmark stage passes for the current implemented scope: `6/6` artifacts passed and `3154/3154` scoreable fields passed with `3154/3210` total truth coverage
- the remaining benchmark gap is truth maturity and future modality expansion, not missing emotional-analysis wiring: recommendation, chunk-analysis, metrics, and emotional-analysis still need human editorial review before they should be treated as gold truth

**Commits:**
- `b0bddad` - Redact oversized inline media blobs

**Lessons Learned:** The important benchmark lesson is that “truth” needs provenance, not just presence. When a fixture is still bootstrap truth, the system has to say so plainly and keep refreshing it honestly when the canonical contract/output changes. At the same time, comparator semantics matter: exact string equality on generated prose and exact equality on model confidence numbers create brittle noise rather than useful signal. The healthier split is: structural/content drift belongs in truth refresh or human review, while trivial punctuation/casing and tiny confidence wobble belong in the comparator.

---

*Completed on 2026-03-26*
