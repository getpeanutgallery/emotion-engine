# Unified output / failure / recovery implementation execution graph

**Status:** Active execution map  
**Established:** 2026-03-14

---

## Purpose

This document converts the settled contract architecture into the concrete bead graph that implementation subagents should execute.

It complements, but does not replace:

- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`

The rollout is intentionally staged so later implementers do not have to rediscover:

1. what lands first
2. which bead blocks which other bead
3. which repo actually owns each change
4. which existing open beads are reused versus left separate

---

## Execution order at a glance

1. `ee-d4x.1` — shared `emotion-engine` plumbing
2. `ee-d4x.2` — `emotion-engine` AI lanes
3. `ee-d4x.3` — `emotion-engine` computed/report lanes
4. `ee-d4x.4` — `emotion-engine` deterministic tool-wrapper lanes
5. `ee-cwi.1` — sibling `ai-providers`
6. `ee-cwi.2` — sibling `digital-twin-router`
7. `ee-cwi.3` — sibling `digital-twin-core`
8. `ee-cwi.4` — conditional sibling `tools` alignment or deprecation decision
9. `ee-vaa` — final sanity sweep across repo + siblings

This is the practical dependency chain currently encoded in Beads. The `../tools` step is deliberately lower priority and conditional; it should not redefine the contract, only align to the canonical implementation or be explicitly reduced/deprecated.

---

## Concrete implementation beads

### `ee-d4x.1` — Implement shared script-result + recovery plumbing in emotion-engine

**Repo owner:** `emotion-engine`  
**Recommended subagent:** `coder` or `primary`

**Scope**

- add shared helpers/types/builders for universal success/failure envelopes
- centralize deterministic-recovery declaration lookup and lineage bookkeeping
- load and validate YAML-driven AI recovery policy/budget settings at runtime
- persist recovery refs, next-action metadata, and required raw/debug evidence hooks
- keep per-lane migration out of this bead except for any minimal proving hooks needed by the plumbing itself

**Why first**

Without this bead, every lane family would invent its own envelope/recovery wiring and the contract would drift immediately.

**Implementation status update — 2026-03-14**

This bead now has its first bounded implementation pass on `main`:

- added `server/lib/script-contract.cjs` as the shared runtime builder for canonical success/failure envelopes, deterministic declaration lookup, failure classification, next-action selection, lineage bookkeeping, and persistence of `script-results/` + `recovery/` refs
- added `server/lib/script-runner.cjs` so the phase runners can wrap existing legacy script returns without forcing per-lane migration yet
- wired `server/lib/phases/gather-context-runner.cjs`, `server/lib/phases/process-runner.cjs`, and `server/lib/phases/report-runner.cjs` through the shared runner so every script family now passes through the same contract seam
- extended `server/lib/config-loader.cjs` + `server/run-pipeline.cjs` to load, validate, normalize, and retain YAML-driven `recovery` policy/budget settings at runtime
- persisted shared execution metadata under `artifacts.__scriptExecution` plus per-script `phase*/script-results/*.json` and `phase*/recovery/*/{lineage,next-action}.json` refs so later lane migrations can attach richer raw/debug evidence without redesigning the substrate
- proved the substrate with new tests in `test/lib/script-contract.test.js`, config-loader coverage, and a full `npm test` pass

Per-lane migration is still intentionally deferred to `ee-d4x.2`, `ee-d4x.3`, and `ee-d4x.4`; the current pass establishes the shared plumbing layer and keeps existing script behavior intact unless the new wrapper adds metadata around it.

---

### `ee-d4x.2` — Roll unified envelope + recovery contract into emotion-engine AI lanes

**Repo owner:** `emotion-engine`  
**Recommended subagent:** `coder`

**Depends on:** `ee-d4x.1`

**Scope**

- migrate:
  - `get-dialogue.cjs`
  - `get-music.cjs`
  - `video-chunks.cjs`
  - `recommendation.cjs`
- keep and reuse the validator-tool work already landed in prior AI-lane rollout beads
- wrap lane outputs in the universal success/failure envelope
- make deterministic recovery declarations explicit where those lanes already have safe retry/rebuild behavior
- integrate bounded AI recovery using the settled YAML + guardrail contract

**Relationship to prior work**

This bead reuses, rather than supersedes, the older validator-contract work (`ee-qqg`, `ee-izr`, and the Phase 1/2/3 validator rollout plans).

**Implementation update — 2026-03-14**

- migrated `get-dialogue.cjs`, `get-music.cjs`, `video-chunks.cjs`, and `recommendation.cjs` onto the shared wrapper/runtime seam from `ee-d4x.1`
- made AI-lane deterministic strategy applicability explicit from configured retries/targets so exhausted validator/tool-loop attempts now advance into bounded AI recovery instead of reporting an ambiguous generic failure
- added the bounded AI recovery lane runtime/artifact persistence under `server/lib/ai-recovery-lane.cjs` and re-entry prompt helpers under `server/lib/ai-recovery-runtime.cjs`
- taught all four AI lanes to honor bounded `repairInstructions` / `boundedContextSummary` prompt addenda on same-script re-entry without widening scope into computed/report lane migration
- validated the rollout with contract + per-lane tests covering recovery envelopes, AI re-entry, and prompt integration

---

### `ee-d4x.3` — Roll universal script-result contract into computed/report lanes

**Repo owner:** `emotion-engine`  
**Recommended subagent:** `primary` or `coder`

**Depends on:** `ee-d4x.2`

**Scope**

- migrate:
  - `video-per-second.cjs`
  - `metrics.cjs`
  - `emotional-analysis.cjs`
  - `summary.cjs`
  - `final-report.cjs`
- explicitly decide whether `evaluation.cjs` remains canonical, becomes legacy-only, or is retired from the primary pipeline path
- define family-specific degraded-success vs recoverable-failure behavior for deterministic/reporting outputs

**Why after AI lanes**

The AI lanes already have the strongest output discipline. Let them prove the outer contract first, then broaden the contract to non-AI scripts.

---

**Implementation update — 2026-03-14**

- migrated `video-per-second.cjs`, `metrics.cjs`, `emotional-analysis.cjs`, `summary.cjs`, and `final-report.cjs` onto the shared success/failure envelope seam from `ee-d4x.1`
- each migrated lane now emits persisted `script-results/` + `recovery/` refs through the shared runtime and declares bounded degraded-success conditions for computed/report outputs instead of relying on ad-hoc logs
- `video-per-second.cjs` now hard-fails with `invalid_output` when no successful chunks remain, while partial chunk loss / uncovered seconds stay explicit degraded-success cases
- `summary.cjs` now prefers canonical `phase3-report/summary/*` report links, and `evaluation.cjs` is now explicitly documented as **legacy-only compatibility** rather than the canonical Phase 3 report path
- validation added focused contract coverage for computed/report lanes, including degraded-success envelopes, deterministic next-action on unrecoverable interpolation input, and the legacy-only evaluation status

---

### `ee-d4x.4` — Roll universal script-result contract into deterministic tool-wrapper lanes

**Repo owner:** `emotion-engine`  
**Recommended subagent:** `coder`

**Depends on:** `ee-d4x.3`

**Scope**

- migrate deterministic wrapper/artifact-production paths such as:
  - `get-metadata.cjs`
  - extractor/preflight helpers
  - video/audio utility layers
  - output persistence surfaces implicated in script completion/failure
- standardize failure categories and deterministic recovery declarations for tooling/artifact lanes
- keep scope on production pipeline surfaces, not repro-only scripts

**Why after computed/report lanes**

By this point the envelope semantics, degraded-success rules, and lineage bookkeeping should already be stable, making tool-wrapper adoption primarily a classification exercise instead of a design exercise.

---

### `ee-cwi.1` — Align ai-providers with recovery rollout substrate expectations

**Repo owner:** `../ai-providers`  
**Recommended subagent:** `primary` or `coder`

**Depends on:** `ee-d4x.4`

**Scope**

- stabilize adapter-side structured failure classification and raw/debug capture shape
- ensure failures remain machine-routable for `emotion-engine` envelopes and replay-backed recovery
- do **not** move script-envelope ownership into `ai-providers`

**Why first among siblings**

Provider/adaptor semantics feed the rest of the replay/persistence chain.

---

### `ee-cwi.2` — Align digital-twin-router recorded-failure metadata with recovery refs

**Repo owner:** `../digital-twin-router`  
**Recommended subagent:** `coder`

**Depends on:** `ee-cwi.1`

**Scope**

- preserve stable recorded-failure identifiers/metadata needed by `emotion-engine` failure envelopes and AI recovery artifacts
- keep router scope focused on persistence/replay fidelity, not recovery policy

---

### `ee-cwi.3` — Evolve digital-twin-core cassette schema for richer recorded failures

**Repo owner:** `../digital-twin-core`  
**Recommended subagent:** `coder`

**Depends on:** `ee-cwi.2`

**Scope**

- update cassette schema/validation/versioning only as required for the richer recorded failure shape
- keep this bead schema-focused and replay-focused

---

### `ee-cwi.4` — Decide tools repo alignment vs deprecation for shared emotion helper

**Repo owner:** `../tools`  
**Recommended subagent:** `primary`

**Depends on:** `ee-cwi.3`

**Scope**

- decide whether the lingering shared helper surface should be aligned to the canonical contract or explicitly reduced/deprecated
- if alignment is chosen, keep it downstream of the canonical `emotion-engine` implementation so `../tools` does not become the spec source by accident

**Special note**

This is a conditional bead. It should run only if `../tools` still matters as a maintained contract-relevant surface once the upstream implementation is real.

---

### `ee-vaa` — Final emotion-engine + polyrepo sanity sweep

**Repo owner:** `emotion-engine` coordination pass  
**Recommended subagent:** `primary`

**Depends on:** `ee-d4x.4`, `ee-cwi.3`  
**Conditional sweep expansion:** include `ee-cwi.4` outcomes when `../tools` remains in play

**Scope**

- scan `emotion-engine` plus the bounded sibling repos for missed AI call sites, weakly migrated lanes, stale envelope emitters, or bypasses around the recovery contract
- file follow-up beads for anything truly missed rather than smuggling new rollout work into the sweep

**Important**

`ee-vaa` remains a post-rollout audit. It is not a substitute for the implementation beads above.

---

## Existing beads reused vs superseded

### Reused directly

- `ee-cwi` remains the sibling-rollout epic and now owns child beads `ee-cwi.1` through `ee-cwi.4`
- `ee-vaa` remains the final sanity sweep bead
- older validator-contract beads and plans remain precedent/input for `ee-d4x.2`

### Reframed, not replaced

- `ee-cwi` is no longer a vague “roll it into every sibling repo” catchall; it is now a bounded sibling execution chain
- `ee-vaa` is explicitly sequenced after the rollout instead of being used as an early-gap inventory

### Intentionally left separate

The following open investigations remain independent and should not be silently folded into the rollout beads unless later evidence proves they are implementation prerequisites:

- `ee-58s` — provider_no_content / budget-pathology investigation
- `ee-bao` — stock-assets language / grounding-vs-persona investigation
- `ee-5dv` — recommendation invalid_output bug
- `ee-2fs` — recommendation input payload audit / grounding traceability
- `ee-0gv` — run-root `raw/` folder location investigation
- `ee-03m` — YAML-configurable FFmpeg settings feature

That separation is deliberate: these are still useful product/debug investigations, but the unified recovery rollout should not balloon by absorbing every adjacent open question.

---

## Suggested execution ownership model

- **Shared plumbing (`ee-d4x.1`)**: one focused implementation subagent
- **Lane-family migrations (`ee-d4x.2` to `ee-d4x.4`)**: one subagent per family bead, serialized in dependency order
- **Sibling repos (`ee-cwi.1` to `ee-cwi.4`)**: repo-local subagents in the owning repo, again serialized in dependency order unless a later review safely relaxes coupling
- **Final sweep (`ee-vaa`)**: one audit-oriented subagent after rollout lands

The graph is intentionally bounded and mostly serial because contract drift is more dangerous here than raw speed.
