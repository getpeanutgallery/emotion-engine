# Peanut Gallery Emotion Engine

**Date:** 2026-04-28  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Define the next benchmark-honest Phase 2 slice for `cod-test`, confirm current readiness, and prepare the execution path so we can resume forward progress without re-opening the completed lyric anomaly lane.

---

## Overview

The immediate Phase 1 anomaly lane is done. The bounded bridge-rule is landed, regression-covered, and archived, and the latest handoff says the next session should move forward from **Phase 2 readiness / the next benchmark slice** rather than spending more time proving the exact `Your life burns faster` fallback path live.

This plan treats that handoff as the new source of truth. The first step is to re-ground ourselves in the current Phase 2 surfaces: what the canonical chunked benchmark currently produces, what the earlier whole-video Phase 2 prototype already proposed, and what benchmark-honest comparison path is most worth resuming now. Then we can convert that into explicit Beads and run the normal coder → QA → auditor loop against a narrow, reviewable slice instead of jumping straight into implementation blur.

The intent is not to quietly broaden scope. We should pick one concrete next slice, document why it is the right one, define success criteria and artifacts up front, and only then execute.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Session handoff and decision to move on from the anomaly slice | `/home/derrick/.openclaw/workspace/memory/2026-04-27.md` |
| `REF-02` | Durable QA note for the final bridge-rule rerun and benchmark interpretation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/docs/2026-04-27-bridge-rule-qa-rerun-note.md` |
| `REF-03` | Existing whole-video Phase 2 prototype design and rollout boundaries | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md` |
| `REF-04` | Current canonical cod-test config surface | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml` |

---

## Tasks

### Task 1: Audit current Phase 2 readiness surfaces

**Bead ID:** `ee-eryw`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Audit the current Phase 2 state for cod-test in projects/peanut-gallery/emotion-engine. Start by claiming the assigned bead with bd update <id> --status in_progress --json. Review the handoff memory, the 2026-04-27 bridge-rule QA note, the existing whole-video Phase 2 prototype note, and the current cod-test config/output surfaces. Produce a concise readiness memo that answers: what Phase 2 path is canonical today, what benchmark-honest side paths already exist, what artifacts/configs/logs are the best current baseline, and what concrete risks or blockers remain before the next narrow benchmark slice. Do not implement product changes yet. Close the bead only if the audit memo is complete and saved in the repo with exact artifact pointers.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`
- `docs/2026-04-28-phase2-readiness-audit.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-28-phase2-readiness-audit.md`. Audit conclusion: `configs/cod-test.yaml` now makes `server/scripts/process/whole-video-mimo.cjs` the active Phase 2 producer, but the benchmark/report/truth contract is still chunk-based (`benchmarks/fixtures/cod-test/benchmark.json` expects `phase2-process/chunk-analysis.json`). Captured the best live whole-video baseline (`output/cod-test/phase2-process/whole-video-analysis.json` plus raw/script-result companions), the best benchmark-honest archived chunk baseline (`output/_archives/cod-test-pre-ee-2czf-20260408-123814/.../chunk-analysis.json`), and the concrete blockers before the next narrow slice. Also recorded an artifact-quality blocker: the current live whole-video output contains impossible evidence timestamps (`198-206s` on a `140.017s` video), so timing guardrails are still needed before whole-video becomes an audit-grade comparison surface.

---

### Task 2: Define the next benchmark slice and execution contract

**Bead ID:** `ee-d4ji`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Using the Phase 2 readiness audit and the cited references, define one concrete next benchmark slice for cod-test. Claim the assigned bead at start with bd update <id> --status in_progress --json. The deliverable should state the exact target slice, why it is the right next step now, what success/failure looks like, what config/artifact paths it will use, and what would count as honest comparison versus misleading comparison. Record the recommendation in the plan and, if useful, a short durable note in docs/. Do not do the implementation itself. Close the bead when the decision package is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`
- `docs/2026-04-28-next-phase2-slice-decision.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-28-next-phase2-slice-decision.md`. Recommendation: the next slice should be a **chunk-contract restoration benchmark slice** for `cod-test`, not a whole-video benchmark formalization slice. The decision package anchors the choice to the current contract mismatch: `configs/cod-test.yaml` produces `whole-video-analysis.json`, but benchmark truth/report consumers still require `chunk-analysis.json`. It defines the exact slice as a dedicated chunk-based Phase 2 benchmark lane using the current fresh Phase 1 context, existing chunk truth/report surfaces, and archived chunk baselines for honest comparison. It also records clear success/failure criteria, the expected slice-owned config path (`configs/cod-test-phase2-chunk-benchmark.yaml`), the intended producer (`server/scripts/process/video-chunks.cjs`), the runtime artifact target (`output/cod-test/phase2-process/chunk-analysis.json`), and explicit anti-patterns such as aliasing whole-video output into the chunk contract. This keeps the next implementation slice benchmark-honest and audit-friendly while leaving whole-video formalization for a later, separate contract change.

---

### Task 3: Prepare execution beads for the chosen slice

**Bead ID:** `ee-70qi` (prep/orchestration), execution beads `ee-70qi.1`, `ee-70qi.2`, `ee-70qi.3`  
**SubAgent:** `primary` (for `primary` workflow role)  
**Role:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `After the next Phase 2 slice is approved in the plan, claim the assigned bead with bd update <id> --status in_progress --json and create the repo-local execution beads needed for coder, QA, and auditor work on that exact slice. The bead set must reflect the chosen scope only, include dependencies where useful, and link the IDs back into the plan. Do not execute the implementation yet unless the orchestrator explicitly extends scope. Close the bead when the execution bead package is complete and documented.`

**Execution bead package:**
- `ee-70qi.1` — **Implement cod-test chunk-contract restoration benchmark slice** (`coder`): owns the dedicated chunk-benchmark config/path, restoration of truthful `phase2-process/chunk-analysis.json` production, reconnection of existing Phase 3/benchmark consumers to that real chunk artifact, and implementation-side validation/handoff notes.
- `ee-70qi.2` — **QA cod-test chunk-contract restoration benchmark slice** (`qa`): owns end-to-end rerun/verification that the dedicated chunk lane produces fresh chunk artifacts, drives downstream Phase 3/benchmark outputs from real chunk data, and does not smuggle whole-video output in as chunk-equivalent.
- `ee-70qi.3` — **Audit cod-test chunk-contract restoration benchmark slice** (`auditor`): owns the independent truth-check against the plan, readiness audit, slice decision doc, implementation diff, and QA evidence before declaring the slice done.

**Dependency order:**
- `ee-70qi.1` → `ee-70qi.2` → `ee-70qi.3`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`

**Status:** ✅ Complete

**Results:** Created a tightly scoped execution-bead package for the chosen chunk-contract restoration benchmark slice only. The coder bead (`ee-70qi.1`) is the single implementation lane, the QA bead (`ee-70qi.2`) is blocked on coder completion, and the auditor bead (`ee-70qi.3`) is blocked on QA completion. All three beads are children of the prep bead `ee-70qi`, keep the whole-video formalization work explicitly out of scope, and carry slice-specific acceptance criteria so the next coder can start immediately.

**Execution status update (2026-04-29 / `ee-70qi.1`):** ✅ Coder implementation complete. Added the dedicated slice config at `configs/cod-test-phase2-chunk-benchmark.yaml`, restored the benchmark contract entry for `phase2-process/chunk-analysis.json` in `benchmarks/fixtures/cod-test/benchmark.json`, and extended `test/pipeline/config-loader.test.js` to cover the dedicated config and restored chunk benchmark contract. A live rerun via `node server/run-pipeline.cjs --config configs/cod-test-phase2-chunk-benchmark.yaml --verbose` hydrated the current persisted Phase 1 packet from `output/cod-test`, regenerated a fresh `output/cod-test/phase2-process/chunk-analysis.json`, and produced Phase 3 outputs whose `implementationStatus.dataSource` is `derived-from-phase2.chunkAnalysis` instead of placeholder/not-applicable behavior. The benchmark advanced from a contract-mismatch artifact-absence failure to an honest comparable-state benchmark report at `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`, where `chunkAnalysis` is now evaluated as a real artifact (`status: fail`, `accuracyRate: 0.6648`, `coverageRate: 0.9490`) rather than missing. Exact files touched by coder work: `configs/cod-test-phase2-chunk-benchmark.yaml`, `benchmarks/fixtures/cod-test/benchmark.json`, `test/pipeline/config-loader.test.js`, `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`.

**Execution status update (2026-04-29 / `ee-70qi.2`):** ✅ QA verified the bounded chunk-contract restoration slice end-to-end. Independent QA re-read the readiness/slice references plus coder commit `429d95f6da5da81bb1af2c29d22c546799774b60`, ran the slice-focused config-loader test coverage, and performed a fresh dedicated-config rerun with `node server/run-pipeline.cjs --config configs/cod-test-phase2-chunk-benchmark.yaml --verbose`. That rerun regenerated `output/cod-test/phase2-process/chunk-analysis.json` with 28 successful provider-facing chunks (plus one skipped terminal micro-chunk under 1s), drove Phase 3 outputs whose implementation metadata remains derived from `phase2.chunkAnalysis`, and exercised the benchmark/report surfaces against a real chunk artifact rather than failing on a missing/mismatched contract. The benchmark stage still exits non-zero because current outputs do not yet match fixture truth closely enough (`0/8` artifacts passed), but the relevant contract-restoration acceptance criteria were satisfied: `chunkAnalysis` is scored as a real artifact (`truth_chunk_count: 28`, `output_chunk_count: 28`, `chunk_timeline_pct: 100`, `chunk_persona_contract_pct: 100`) and the stale whole-video artifact still explicitly declares `comparisonHints.safeForChunkEquivalence: false` / `safeForPhase3Metrics: false`, so whole-video output is not being treated as chunk-equivalent. QA caveat for audit: the broad `node --test test/pipeline/config-loader.test.js` suite still contains an unrelated pre-existing failure for missing `configs/video-analysis.yaml`, so QA relied on the targeted dedicated-config subtest plus the fresh end-to-end rerun for this slice. Exact files touched by QA work: `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`, plus regenerated runtime/report artifacts under `output/cod-test/` and `benchmarks/fixtures/cod-test/_reports/` from the fresh rerun.

**Execution status update (2026-04-29 / `ee-70qi.3`):** ✅ Auditor PASS on the chosen slice. Independent audit re-read the plan, `docs/2026-04-28-phase2-readiness-audit.md`, `docs/2026-04-28-next-phase2-slice-decision.md`, coder commit `429d95f6da5da81bb1af2c29d22c546799774b60`, and the current repo state after QA rerun. Audit confirmed the implementation stayed within the chunk-contract restoration scope: `configs/cod-test.yaml` still keeps the canonical whole-video producer untouched, while the new dedicated slice config `configs/cod-test-phase2-chunk-benchmark.yaml` isolates the benchmark lane to `server/scripts/process/video-chunks.cjs` with `gather_context: []` and the expected shared runtime target `output/cod-test/phase2-process/chunk-analysis.json`. Fresh current-state evidence shows `output/cod-test/phase2-process/script-results/video-chunks.success.json` truthfully produced the chunk artifact from 28 successful chunks, downstream Phase 3 consumers now report `implementationStatus.dataSource = derived-from-phase2.chunkAnalysis`, and the benchmark report now scores `chunkAnalysis` as a real compared artifact (`truth_chunk_count: 28`, `output_chunk_count: 28`, `chunk_timeline_pct: 100`, `chunk_persona_contract_pct: 100`, `accuracyRate: 0.6519`, `coverageRate: 0.9490`) instead of failing on a missing/mismatched contract. The stale whole-video artifact remains explicitly non-equivalent (`comparisonHints.safeForChunkEquivalence: false`, `safeForPhase3Metrics: false`), so the slice does not silently treat whole-video output as chunk-equivalent. Auditor caveats recorded but not slice-blocking: the benchmark remains red for real quality mismatches in multiple artifacts, and `node --test test/pipeline/config-loader.test.js` still contains the unrelated pre-existing missing-`configs/video-analysis.yaml` failure outside this slice. Exact files touched by auditor work: `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md` only.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A dedicated, audit-bounded `cod-test` chunk benchmark lane that restores truthful production of `output/cod-test/phase2-process/chunk-analysis.json`, reconnects the existing Phase 3/benchmark consumers to that real chunk artifact, and leaves the canonical whole-video lane explicitly out of chunk-equivalence claims.

**Reference Check:** `REF-02`, `REF-03`, and `REF-04` remain satisfied through the bounded slice choice recorded in `docs/2026-04-28-phase2-readiness-audit.md` and `docs/2026-04-28-next-phase2-slice-decision.md`: the canonical `cod-test` config still points at whole-video, the dedicated slice config owns the restored chunk benchmark lane, and the benchmark/report worldview stays chunk-based for this slice without whole-video masquerade.

**Commits:**
- `429d95f6da5da81bb1af2c29d22c546799774b60` - Restore cod-test chunk benchmark lane

**Lessons Learned:** Contract-restoration success must stay distinct from benchmark-quality success. For `cod-test`, restoring a truthful chunk artifact and reconnecting downstream consumers was enough to pass this slice even though the benchmark remains red for real content differences and an unrelated config-loader fixture gap still needs separate cleanup.

---

*Completed on 2026-04-29*
