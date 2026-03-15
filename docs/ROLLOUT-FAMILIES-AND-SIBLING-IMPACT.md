# Rollout families and sibling repo impact for the unified output / failure / recovery contract

**Status:** Active architecture map  
**Established:** 2026-03-14

---

## Purpose

This document maps the next rollout surface for the unified contract now defined across:

- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/AI-LANE-CONTRACT.md`

It answers four architecture questions before implementation beads land:

The strict cross-family guardrails that every rollout family must honor are defined in `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`; this document maps where those guardrails have to land.


1. Which `emotion-engine` scripts belong to which rollout families?
2. Which families already comply with the older AI-lane validator contract vs still lack the broader system contract?
3. Which sibling repos are directly impacted by the new contract, and where does sibling scope stop?
4. What implementation order is safest, and which existing beads are reused vs superseded?

This is intentionally a **planning/spec** document. It records the rollout map as it stood on 2026-03-14.

### 2026-03-15 closure addendum

The implementation status has moved forward materially since this map was first written. The pre-implementation gap language below should now be read as bounded historical planning context, not as the current live state.

As of 2026-03-15:

- shared contract plumbing (`ee-d4x.1`) is implemented in `emotion-engine`
- the four meaningful AI lanes (`ee-d4x.2`) now run through the shared envelope/runtime seam and can invoke bounded same-script AI recovery
- computed/report lanes (`ee-d4x.3`) and deterministic tool-wrapper lanes (`ee-d4x.4`) are also rolled onto the shared script-result contract
- the sibling `tools` cutover later landed, so Phase 2 now consumes `../tools/emotion-lenses-tool.cjs` directly rather than an engine-local canonical copy

For the concrete execution bead graph that implemented this order, see `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`.

---

## Scope boundary

### In scope

A repo or file is in scope if it does **one or more** of the following:

- emits or should emit a durable machine-readable script result consumed by the pipeline
- makes AI calls whose failures must remain machine-routable and replay-safe
- records, stores, validates, or replays provider failures that the recovery system depends on
- owns shared helpers that the recovery contract needs for envelope emission, recovery declarations, or AI recovery invocation

### Out of scope for this planning pass

These are **not** rollout targets unless a later bead widens scope:

- content-only repos with no runtime AI/error logic (for example `../goals`)
- generic retry primitives that do not own result envelopes or AI-specific failure semantics (for example `../retry-strategy`)
- one-off repro/debug scripts that are investigative rather than production pipeline lanes
- test fixtures and recorded outputs except where they must evolve to validate the new contract

### Sibling scope ends here

For the current contract rollout, sibling scope ends at:

- `../ai-providers`
- `../digital-twin-router`
- `../digital-twin-core`
- `../tools` *(only if this repo remains a maintained source for reusable AI helper behavior that mirrors `emotion-engine` expectations)*

It does **not** currently extend to `../goals`, `../retry-strategy`, `../cast`, or other nearby repos because they do not presently own the contract boundary being standardized.

---

## emotion-engine rollout families

## Family A — AI script lanes

These lanes already satisfy the repo's **AI-lane validator-tool contract** (`docs/AI-LANE-CONTRACT.md`) but do **not** yet satisfy the broader unified output/failure/recovery contract end-to-end.

### Files / lanes

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`
- supporting validators/helpers:
  - `server/lib/local-validator-tool-loop.cjs`
  - `server/lib/phase1-validator-tools.cjs`
  - `../tools/emotion-lenses-tool.cjs`
  - `server/lib/recommendation-validator.cjs`
  - `server/lib/recommendation-validator-tool.cjs`
  - `server/lib/structured-output.cjs`
  - `server/lib/json-validator.cjs`

### Already compliant

- Lane-specific JSON output contracts are defined.
- Final acceptance is validator-tool mediated for all meaningful current AI lanes.
- Shared parse/validation diagnostics and raw capture already exist in the strongest paths.
- Recommendation and Phase 2 provide the best current examples of bounded validator-aware retries.

### Gaps against the unified contract

- Success outputs are still primarily lane-local artifact objects, not guaranteed universal script envelopes.
- Hard failures still mostly throw errors instead of always emitting schema-validated failure envelopes.
- Deterministic recovery declarations are still implicit in helpers/control flow rather than script-owned contract data.
- AI recovery invocation and same-script re-entry are specified architecturally but not yet integrated into lane execution.
- Recovery lineage, next-action policy, and budget consumption are not yet first-class persisted outputs.

### Rollout priority

**First among script families.** These lanes already have the strongest structured-output discipline, so they are the safest place to attach universal envelopes and recovery metadata without inventing new output semantics from scratch.

---

## Family B — computed / aggregation / report-formatting scripts

These scripts are not AI lanes, but they are still meaningful pipeline scripts and therefore fall under the universal success/failure contract.

### Files / lanes

- `server/scripts/process/video-per-second.cjs`
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`
- `server/scripts/report/summary.cjs`
- `server/scripts/report/final-report.cjs`
- `server/scripts/report/evaluation.cjs` *(legacy combined report path; treat carefully and decide whether it remains active or should be explicitly downgraded/retired during rollout)*

### Already compliant

- These scripts are already clearly documented as non-AI in `docs/PIPELINE-SCRIPTS.md` and `docs/AI-LANE-CONTRACT.md`.
- Several already operate on deterministic, artifact-derived inputs and are therefore good candidates for the deterministic-first model.
- Some already encode degraded-but-usable outcomes in payloads (for example chunk/status aggregation patterns).

### Gaps against the unified contract

- No universal success/failure envelope is enforced consistently.
- Failure handling is not yet normalized into schema-validated failure JSON.
- Deterministic recovery declarations are not yet explicit even where safe replay/rebuild-from-artifact behavior exists.
- These lanes need script-family-specific rules for when degraded success is still a success envelope versus a recoverable failure.

### Rollout priority

**Second.** These lanes expand the contract from “AI hardening” into “system-wide script semantics” without needing live provider behavior.

---

## Family C — tool-wrapper / artifact-production scripts

These scripts or entry points primarily wrap deterministic tools or external utilities rather than AI generations, but they still need durable success/failure semantics.

### Files / lanes

- `server/scripts/get-context/get-metadata.cjs`
- related deterministic helpers that strongly influence script outcomes:
  - `server/lib/audio-preflight.cjs`
  - `server/lib/audio-chunk-extractor.cjs`
  - `server/lib/video-chunk-extractor.cjs`
  - `server/lib/video-utils.cjs`
  - `server/lib/artifact-manager.cjs`
  - `server/lib/output-manager.cjs`
  - `server/lib/persisted-artifacts.cjs`

### Already compliant

- Outputs are already machine-oriented artifacts, not prose.
- Most failures are deterministic/tooling failures and therefore easier to classify explicitly.
- These files are a natural fit for the deterministic recovery framework once declaration points are added.

### Gaps against the unified contract

- They do not yet emit universal script envelopes consistently.
- Failure codes/recovery eligibility are not standardized.
- Tool-wrapper failures need explicit rules for “retry same command”, “rebuild from source artifact”, “skip lane”, or “hard fail”.

### Rollout priority

**Third.** They should come after the AI lanes and computed lanes because they help complete system coverage, but they are less ambiguous once the shared envelope/orchestrator layer is ready.

---

## Family D — orchestrator / shared contract plumbing

This family is not a script family by itself, but it is the shared layer that must exist before the families above can adopt the contract cleanly.

### Files likely involved

- `server/run-pipeline.cjs`
- `server/lib/config-loader.cjs`
- `server/lib/output-manager.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/raw-capture.cjs`
- `server/lib/chunk-analysis-status.cjs`
- `server/lib/api-utils.cjs`
- `server/lib/ai-targets.cjs`
- `server/lib/logger.cjs`
- `server/lib/events-timeline.cjs`
- `server/lib/prompt-store.cjs`

### Already compliant

- The repo already has strong raw-capture, prompt-store, and provider-target infrastructure.
- Existing docs define the target architecture well enough to guide implementation.

### Gaps against the unified contract

- No single shared emitter/orchestrator currently guarantees universal success/failure envelopes for every script family.
- Deterministic recovery state and AI recovery lineage are not yet persisted centrally.
- YAML config does not yet serve as the canonical source for AI recovery selection/budgeting in running code.
- Cross-script artifact hydration and re-entry semantics need one shared owner before family-specific rollout begins.

### Rollout priority

**Zeroth / prerequisite layer.** At least a thin shared contract-plumbing slice should land before broad per-family migration, otherwise each lane will reinvent the envelope and recovery wiring.

---

## Family E — utilities, repro scripts, tests, and docs

### Files

- `scripts/analyze-recent-run-errors.cjs`
- `scripts/repro/*`
- tests under `test/`
- durable docs under `docs/`

### Status

- These are support surfaces, not primary rollout targets.
- They must be updated as verification/documentation surfaces when implementation lands.

### Priority

**Parallel with implementation**, but not as the first architecture target.

---

## Sibling repo impact map

## 1) `../ai-providers`

### Why it is in scope

This repo owns the provider adapter boundary that creates the raw response/error material consumed by `emotion-engine` and persisted by the digital-twin layer.

### Key files / surfaces

- `ai-provider-interface.js`
- `providers/openai.cjs`
- `providers/anthropic.cjs`
- `providers/gemini.cjs`
- `providers/openrouter.cjs`
- `test/provider-debug.test.cjs`

### Already compliant

- Provides a stable provider abstraction used by `emotion-engine`.
- Already carries normalized debug/error payload work from the earlier debug-capture sweep.
- Already integrates with `digital-twin-router` for record/replay.

### Gaps against the unified contract

- It does **not** and should **not** own the full script-level success/failure envelope.
- It may still need a stricter, stable provider-error classification contract so `emotion-engine` failure envelopes can reliably translate adapter failures into `failure.code`, `category`, `retryable`, and raw refs.
- Any structured provider response capture that AI recovery depends on must remain replay-safe and adapter-consistent.

### Contract role

**Transport/provider substrate, not script-envelope owner.**

---

## 2) `../digital-twin-router`

### Why it is in scope

This repo records and replays provider interactions, including normalized failure payloads. The unified recovery contract depends on those persisted failures staying machine-routable during replay.

### Key files / surfaces

- `index.js`
- `test/index.test.js`

### Already compliant

- Records normalized provider failures into replayable error responses.
- Preserves request IDs, status, classification, response payloads, and debug context more consistently than before.
- Already supports the transport-layer failure capture needed for debugging and deterministic replay.

### Gaps against the unified contract

- Cassette entries are still transport-centric; they do not yet know about higher-level recovery lineage refs or result-envelope metadata.
- If the recovery system needs canonical references from a script failure envelope back into persisted provider interactions, the router may need a stable recorded-error identifier or metadata slot.
- The repo should not absorb script-level recovery policy, but it may need to preserve enough metadata that replay reproduces the same failure-classification inputs.

### Contract role

**Failure persistence/replay boundary for provider interactions.**

---

## 3) `../digital-twin-core`

### Why it is in scope

This repo defines cassette structure and validation. If recorded failures need stronger machine-readable guarantees for replay-backed recovery, the cassette schema/validator is the durable source of truth.

### Key files / surfaces

- `lib/cassette.js`
- `lib/engine.js`
- `bin/cli.js`
- `test/core.test.js`

### Already compliant

- Owns the cassette schema and validator.
- Already validates basic cassette structure and drives replay/inspection.

### Gaps against the unified contract

- Current cassette validation is intentionally shallow: request and response must exist, but structured recorded-error shape is not deeply validated.
- No explicit cassette-version evolution path is documented yet for richer recorded error metadata or recovery-oriented refs.
- CLI/reporting surfaces may need to expose richer recorded failure metadata when validating/replaying cassettes.

### Contract role

**Durable schema owner for replay artifacts, not policy owner for script recovery.**

---

## 4) `../tools`

### Why it is conditionally in scope

This repo still contains `emotion-lenses-tool.cjs`, and `emotion-engine` tests reference `tools/emotion-lenses-tool.cjs`. If this repo remains a maintained reusable source, it should not drift into a weaker contract than the local engine copy.

### Key files / surfaces

- `emotion-lenses-tool.cjs`
- `test/emotion-lenses-tool.test.js`

### Already compliant

- Uses `ai-providers` and expects structured JSON output conceptually.
- Serves as a reusable/shared implementation surface for video emotion analysis logic.

### Gaps against the unified contract

- The current implementation still accepts markdown-fenced fallback parsing and synthesizes default success-like output when parsing fails.
- It does not use the validator-tool loop / Level 3 acceptance architecture documented in `emotion-engine`.
- It does not emit universal success/failure envelopes, deterministic recovery declarations, or AI recovery state.

### Contract role

**Legacy/shared helper surface that must either be aligned or explicitly deprecated.**

### Practical recommendation

Do **not** let `../tools` define the unified contract. Either:

1. align it after `emotion-engine` finishes the shared-plumbing rollout, or
2. formally reduce it to a legacy compatibility layer and keep the canonical contract in `emotion-engine`.

---

## Not direct rollout targets in this pass

## `../retry-strategy`

- Useful as a generic implementation primitive for delays/backoff.
- Not a contract owner for success/failure envelopes, recovery policy, or AI lineage.
- Only revisit if the implementation phase requires new generic retry primitives.

## `../goals`

- Content/spec input repo, not a runtime owner of machine-routable result/failure behavior.
- No direct rollout work needed for the unified output/recovery contract.

---

## Current beads reused vs superseded

## Reused directly

These beads still map cleanly into the unified architecture and remain valuable precedent or dependency input:

- `ee-qqg` — universal AI-lane validator contract
- `ee-0f7` — universal script success/failure contract
- `ee-32e` — AI recovery lane contract
- `ee-izr` — Phase 2 validator-tool rollout
- prior Phase 1 / Phase 3 validator-tool rollout beads documented in `.plans/2026-03-13-phase1-validator-tool-rollout.md` and `.plans/2026-03-13-phase3-validator-tool-rollout-and-doc-cleanup.md`
- sibling debug/failure capture sweep documented in `.plans/2026-03-13-sibling-repo-debug-failure-capture-sweep.md`

## Partially superseded / reframed

These are still open or historically useful, but the new architecture changes how they should be executed:

- `ee-cwi` — **reused as the parent sibling-rollout epic**, but now narrowed to repos that sit on the provider/replay/shared-helper boundary. It should no longer read as “roll the whole script envelope into every nearby repo.”
- `ee-vaa` — still needed, but it should become the **post-rollout sanity sweep** after the shared-plumbing and family migrations, not an early audit substitute.

## Not superseded by this planning pass

- investigation beads like `ee-58s`, `ee-bao`, `ee-5dv`, `ee-2fs`, `ee-0gv`, `ee-03m` remain independent unless a later execution-bead pass explicitly links or folds them in.

---

## Recommended implementation order

## 1. Shared plumbing in `emotion-engine`

Land the minimum shared layer that can:

- emit universal success/failure envelopes
- centralize deterministic recovery declaration lookup / bookkeeping
- wire YAML-driven AI recovery policy/budget selection
- persist lineage / next-action / raw refs without per-lane reinvention

This is the prerequisite that keeps the rest of the rollout coherent.

## 2. Attach the unified envelope to existing compliant AI lanes

Start with:

- `get-dialogue.cjs`
- `get-music.cjs`
- `video-chunks.cjs`
- `recommendation.cjs`

These lanes already have the strongest validation discipline, so they are the safest place to prove the new outer envelope and recovery decision model.

## 3. Migrate computed/report lanes

Move next to:

- `video-per-second.cjs`
- `metrics.cjs`
- `emotional-analysis.cjs`
- `summary.cjs`
- `final-report.cjs`
- evaluate whether `evaluation.cjs` is still canonical, legacy, or retirement-bound

This broadens the contract from AI-only success to system-wide script semantics.

## 4. Migrate deterministic tool-wrapper/artifact lanes

Cover:

- `get-metadata.cjs`
- preflight/extractor/tool-wrapper surfaces

By this point the envelope, failure codes, and deterministic recovery declarations should already exist, so tool-wrapper migration becomes classification work instead of architecture invention.

## 5. Roll the sibling boundary

In this order:

1. `../ai-providers` — stabilize adapter-side failure classification / structured capture expectations
2. `../digital-twin-router` — preserve replay-safe refs/metadata for failure envelopes
3. `../digital-twin-core` — validate any cassette schema/version changes needed by the richer recorded failure contract
4. `../tools` — align or deprecate the legacy shared helper surface

This is the safe order because provider semantics feed the router, and router persistence feeds cassette schema/validation.

## 6. Final sanity sweep

Run `ee-vaa` only after the above lands so the sweep can measure the real final state instead of re-listing known gaps.

---

## Practical summary

- `emotion-engine` AI lanes are **validator-contract compliant but not yet unified-envelope compliant**.
- `emotion-engine` computed and tool-wrapper lanes are the main repo-local gap after shared plumbing lands.
- Sibling scope is real but bounded: **provider adapters, replay router, cassette schema, and the lingering shared tool helper**.
- The contract rollout should proceed **inside `emotion-engine` first**, then move outward to sibling repos that preserve provider/replay semantics.
- `ee-cib` is fully resolved by this mapping/spec pass.
- `ee-cwi` is **not** fully implemented by this pass; what is resolved here is the sibling-scope definition and rollout order, not the sibling repo code rollout itself.
