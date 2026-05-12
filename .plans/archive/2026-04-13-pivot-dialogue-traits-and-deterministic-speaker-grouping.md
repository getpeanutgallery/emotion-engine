# Emotion Engine

**Date:** 2026-04-13  
**Status:** Blocked  
**Agent:** Cookie 🍪

---

## Goal

Replace model-authored speaker identities with a closed per-line `traits` contract in `dialogue-data.json`, then define the deterministic speaker-grouping architecture and versioned YAML heuristics format that will own `speaker_id` assignment.

---

## Overview

After reviewing the recent Gemini continuity iteration work, Derrick decided the next major direction should not be another narrow prompt-only attempt to make the dialogue model manage persistent speaker identities directly. The core issue is architectural: the dialogue model is producing strong dialogue text, but it is being asked to do several jobs that are better split apart.

The new direction is to keep the dialogue model generic and asset-agnostic. Instead of asking it to emit `speaker_id` assignments, the dialogue model should emit a per-line `traits` object inside `dialogue-data.json`. That `traits` object will use a strict, closed JSON contract with explicitly allowed values so the model is never guessing the vocabulary. Invalid key/value combinations should be rejected loudly by validation and retried, similar to malformed JSON handling today.

A new deterministic Phase 1 script will later consume `dialogue-data.json`, use the per-line `traits` data plus a separately versioned YAML heuristics/rules file, and produce speaker grouping / `speaker_id` results. The weighting logic belongs entirely to the deterministic layer, not to the dialogue prompt. This preserves genericity, supports benchmark-driven tuning, and lets future iteration happen through versioned heuristics experiments rather than fragile identity-prompt wording.

The design lane completed and produced the expected spec documents, but the independent audit did **not** approve the package as an implementation handoff. The audit found that the line-traits contract and validator/retry design are directionally strong, while the grouping architecture and migration story still leave blocking contradictions with the current speaker-owned code seam. This plan is therefore now a living record of a **blocked handoff**, not an implementation-complete design package.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Pivot capture and deferred follow-up tasks | `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md` |
| `REF-02` | Resume / active-lane context from prior prompt-iteration work | `.plans/2026-04-13-emotion-engine-resume-next-lane.md` |
| `REF-03` | Active dialogue prompt implementation seam | `server/scripts/get-context/get-dialogue.cjs` |
| `REF-04` | Current benchmark artifact shape to evolve | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-05` | Produced design doc: closed line-traits contract | `docs/2026-04-14-dialogue-line-traits-contract.md` |
| `REF-06` | Produced design doc: validator and retry contract | `docs/2026-04-14-dialogue-traits-validator-retry-contract.md` |
| `REF-07` | Produced design doc: deterministic grouping architecture | `docs/2026-04-14-deterministic-speaker-grouping-architecture.md` |
| `REF-08` | Independent audit of the design package | `docs/2026-04-14-dialogue-traits-pivot-design-audit.md` |

---

## Key Decisions Captured

- Pivot away from model-authored speaker identity assignment.
- Keep the dialogue model focused on line extraction plus per-line speaker `traits` description.
- Remove the concept of speaker identities from the dialogue AI model script.
- `dialogue-data.json` should move toward a shape like:

```json
{
  "index": 0,
  "text": "They want you afraid.",
  "traits": {}
}
```

- The schema must be closed and explicit: allowed variables and values should be obvious to the model.
- Do not ask the model to weight traits or signal importance between fields.
- Do not include a model confidence value in this version.
- Invalid schema values should fail loudly and trigger retry/recovery.
- A new deterministic Phase 1 `get-speakers`-style script should own speaker grouping.
- Heuristic weights/rules should live outside the script in a versioned YAML file so they can be cloned, tuned, benchmarked, archived, and rerun cleanly.
- Benchmark-driven iteration over heuristics is the intended long-term improvement path.
- Reconciliation remains responsible for combining Phase 1 outputs before Phase 2; `get-speakers` does not need to solve music-vocals concerns directly.
- The design lane is **not** yet an implementation-safe handoff; the next lane must tighten the architecture-to-contract mapping and migration seam before coder work begins.

---

## Tasks

### Task 1: Design the closed `traits` contract for `dialogue-data.json`

**Bead ID:** `ee-ngyp`  
**SubAgent:** `research`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-ngyp` with `bd update ee-ngyp --status in_progress --json` when you start. Review the current dialogue prompt seam and current `dialogueData.json` artifact shape. Design an implementation-ready closed `traits` contract for per-line dialogue entries in `dialogue-data.json`. The contract must use explicit allowed fields and explicit allowed values, remain generic/asset-agnostic, avoid weighting semantics and model confidence, and support abstention/unknown handling without open-ended vocabulary. Write a durable design doc under `docs/` with the exact JSON shape, field definitions, allowed values, invalid-value policy, and at least one worked example line. When finished, close bead `ee-ngyp` with `bd close ee-ngyp --reason "Traits contract designed" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ✅ Complete

**Results:** Closed as designed. Produced `docs/2026-04-14-dialogue-line-traits-contract.md`, which defines the closed per-line `traits` contract: ten required fields, explicit enums, explicit abstention tokens, removal of `speaker` / `speaker_id` / `confidence`, and loud invalid-value handling. This doc survived audit as one of the strongest pieces of the package, though its downstream architecture mapping still needs tightening per `REF-08`.

---

### Task 2: Define validator and retry semantics for invalid `traits`

**Bead ID:** `ee-a6lj`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-03`, `REF-05`, `REF-06`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-a6lj` with `bd update ee-a6lj --status in_progress --json` when you start. Using the pivot goals and the traits-contract design output from `ee-ngyp`, define the validator/retry contract for invalid `traits` values. Specify what is schema-invalid vs semantically invalid, how failures should surface, what retry payload/message shape the dialogue phase should get, and what durable artifacts/logging should exist for debugging. Write a durable design doc under `docs/` that is implementation-ready for a later coder. When finished, close bead `ee-a6lj` with `bd close ee-a6lj --reason "Traits validator and retry contract designed" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ✅ Complete

**Results:** Closed as designed. Produced `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`, which specifies parse/schema/semantic validation stages, stable error codes, bounded repair payloads, durable capture artifacts, and explicit no-silent-coercion rules. Audit judged this doc strong in isolation, but not sufficient by itself because the migration guidance still understates how much of the current code seam remains speaker-owned (`REF-08`).

---

### Task 3: Design deterministic speaker-grouping architecture and YAML heuristics format

**Bead ID:** `ee-e4os`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-07`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-e4os` with `bd update ee-e4os --status in_progress --json` when you start. Design the deterministic speaker-grouping architecture that will consume `dialogue-data.json` traits and emit grouped speaker assignments. Define ownership boundaries, inputs/outputs, the shape and versioning strategy for the external YAML heuristics/rules file, how deterministic scoring/grouping should remain explainable, and what artifacts should be produced for benchmark-driven tuning. Write a durable architecture doc under `docs/` with worked examples. When finished, close bead `ee-e4os` with `bd close ee-e4os --reason "Deterministic speaker-grouping architecture designed" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-deterministic-speaker-grouping-architecture.md`
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ✅ Complete

**Results:** Closed as designed, but this doc is the main source of the package-level audit failure. It produced the intended architecture artifact and correctly placed `speaker_id` ownership in a deterministic post-pass, yet the audit found blocking drift away from the actual closed `traits` contract: non-contract vocabulary in worked examples/YAML, no normative field-to-bucket canonicalization map, no explicit handling of `unknown` / `mixed` / `variable`, and a v1 `role_context` concept that reopens semantics the contract explicitly rejected (`REF-08`).

---

### Task 4: Audit the design package and surface implementation-ready next steps

**Bead ID:** `ee-a82e`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-a82e` with `bd update ee-a82e --status in_progress --json` when you start. Independently audit the traits-contract, validator/retry, and deterministic-grouping design docs produced by the earlier beads. Verify they satisfy the pivot goals: closed schema, explicit values, no model-side weighting, loud invalid-value handling, deterministic grouping ownership, and benchmark-friendly YAML heuristics. Identify gaps, ambiguities, contradictions, or risky seams, and produce an audit doc with clear pass/fail findings and concrete next-step recommendations for the implementation lane. Close bead `ee-a82e` only if the design package is audit-ready as a handoff; otherwise leave clear failure notes. If closing, use `bd close ee-a82e --reason "Design package audited and ready for implementation planning" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-dialogue-traits-pivot-design-audit.md`
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ❌ Failed

**Results:** Produced `docs/2026-04-14-dialogue-traits-pivot-design-audit.md` and **did not close**. The audit conclusion is **FAIL — not yet audit-ready as an implementation handoff**. Exact blocking gaps now recorded:
- the grouping architecture does not stay anchored to the closed v1 `traits` contract and drifts into a second non-contract vocabulary
- stable identity cues vs transient/context cues are not formalized as a normative field-to-bucket mapping from the actual contract
- validator rollout guidance is not coherent enough with the current code seam in `server/scripts/get-context/get-dialogue.cjs`, `server/lib/structured-output.cjs`, and `server/lib/phase1-validator-tools.cjs`
- old speaker-normalization behavior would blur ownership boundaries if left active in traits mode, especially `normalizeDialogueSpeakerContract(...)`, speaker-id-based boundary repair, speaker-id-based merge helpers, and speaker-registry chunk handoff
- the architecture introduces `role_context` / role semantics even though the line-traits contract explicitly rejects role labels and scene-function semantics
- benchmark/YAML tuning guidance is directionally right but not benchmark-safe yet because it depends on non-contract fields and lacks a contract-safe canonicalizer/migration story

---

### Task 5: Update the living plan with actual outcomes and handoff state

**Bead ID:** `ee-r43x`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-r43x` with `bd update ee-r43x --status in_progress --json` when you start. After the design and audit beads complete, update `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md` so it accurately records what happened, what docs were produced, what the audit concluded, and the exact next implementation-ready lane. If the repo is in a coherent state for commit/push, include that recommendation in the plan, but do not invent implementation work. Close bead `ee-r43x` with `bd close ee-r43x --reason "Plan updated with design-lane results" --json`.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ✅ Complete

**Results:** Updated the living plan to record the actual design-lane outcome: three design docs produced, three design beads closed (`ee-ngyp`, `ee-a6lj`, `ee-e4os`), audit bead `ee-a82e` left open/in-progress after a fail disposition, and the package explicitly marked as **blocked for implementation handoff** pending a fix/planning lane that resolves the documented contract/migration contradictions.

---

## Final Results

**Status:** ❌ Blocked

**What We Built:**
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`
- `docs/2026-04-14-deterministic-speaker-grouping-architecture.md`
- `docs/2026-04-14-dialogue-traits-pivot-design-audit.md`

These documents capture the pivot direction and preserve the strongest design decisions, but the package is **not yet approved** as a coder handoff.

**Reference Check:**
- `REF-05`: satisfied as a produced contract doc
- `REF-06`: satisfied as a produced validator/retry doc
- `REF-07`: produced, but requires revision before implementation planning
- `REF-08`: independent audit completed and recorded the blocking gaps that now govern next steps

**Bead Outcome Summary:**
- ✅ `ee-ngyp` — closed (`Traits contract designed`)
- ✅ `ee-a6lj` — closed (`Traits validator and retry contract designed`)
- ✅ `ee-e4os` — closed (`Deterministic speaker-grouping architecture designed`)
- ❌ `ee-a82e` — left open / in progress because the audit failed the package as an implementation handoff
- ✅ `ee-r43x` — closed (`Plan updated with design-lane results`)

**Concrete Next Lane / Fix Lane:**
Create and execute an **implementation-planning / design-fix lane** before any coder implementation bead. That lane should produce a revised architecture/handoff package that:
1. binds the grouping architecture directly to the v1 `traits` contract with a normative field-to-bucket canonicalization table
2. explicitly classifies each contract field as stable identity, transient delivery, production context, or uncertainty/gating, including how `unknown`, `mixed`, and `variable` propagate through scoring/blockers/warnings
3. removes or defers `role_context` and any other non-contract semantic categories from v1
4. documents the exact migration seams in `get-dialogue.cjs`, `structured-output.cjs`, and `phase1-validator-tools.cjs`
5. explicitly forbids legacy speaker normalization/repair behavior in traits mode
6. defines benchmark truth/comparator migration for traits-only dialogue output plus deterministic grouping output

**Commit / Push Recommendation:**
The repo now has coherent design-lane documentation and an explicit audit fail record. It is reasonable to commit the documentation updates as a design-handoff checkpoint, but **not** to treat the package as implementation-approved until the fix lane above lands.

**Commits:**
- None recorded in this plan update.

**Lessons Learned:**
- The closed contract and validator design can look implementation-ready in isolation while still failing as a package because the migration seam is broader than the validator boundary.
- Architecture docs must stay tightly bound to the contract vocabulary they are supposed to consume; otherwise the handoff quietly reopens the same ambiguity the pivot was trying to remove.
- Independent audit was valuable here because it caught ownership leakage from the legacy speaker-normalization path before implementation began.

---

*Design lane updated on 2026-04-14 after independent audit.*
