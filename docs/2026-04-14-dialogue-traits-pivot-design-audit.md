# Dialogue Traits Pivot Design Audit

**Date:** 2026-04-14  
**Auditor:** Cookie 🍪  
**Scope:** Independent audit of the dialogue-traits pivot design package

Reviewed artifacts:
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`
- `docs/2026-04-14-deterministic-speaker-grouping-architecture.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

---

## Executive Conclusion

**Conclusion: FAIL — not yet audit-ready as an implementation handoff.**

The package clearly captures the intended pivot direction and gets several important design decisions right:
- a **closed per-line `traits` schema** is explicitly defined
- allowed values are **enumerated and explicit**
- **model-side weighting/confidence-for-grouping** is intentionally removed
- invalid values are intended to **fail loudly**
- deterministic grouping is correctly framed as the **owner of `speaker_id` assignment**
- external YAML heuristics are correctly identified as the tuning surface

However, the package is **not yet coherent enough for direct implementation** because the grouping architecture and rollout guidance still leave critical contradictions with the current code seam:
- the architecture doc drifts away from the closed contract into a second, looser vocabulary
- the validator rollout guidance understates how much of `get-dialogue.cjs` still owns speaker identity behavior
- existing normalization/repair behavior in the codebase would blur ownership boundaries if left in place
- stable identity cues vs transient/context cues are not mapped cleanly enough from the actual contract into deterministic grouping buckets
- benchmark/tuning artifacts are described, but the contract between the actual `traits` schema and YAML heuristics is not tight enough yet to be benchmark-safe

Because of those gaps, **bead `ee-a82e` should remain open**.

---

## Pivot-goal scorecard

### 1. Closed schema
**Status:** PASS with caveat

The line-traits contract doc is strong here. It defines:
- one required `traits` object per line
- ten fixed required fields
- single-string enum values only
- no omitted fields, no arrays, no free text, no extras

Blocking caveat: the architecture doc does **not stay inside that closed schema**. It later discusses internal/grouping examples using fields and values that do not exist in the contract, which creates implementation ambiguity.

### 2. Explicit values
**Status:** PASS with caveat

The contract enumerates explicit values well, especially for:
- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`

Blocking caveat: the architecture doc’s examples switch to non-contract vocabulary like:
- `vocal_texture`
- `accent_family`
- `presentation`
- `intensity`
- `role_mode`
- `general_american`
- `feminine_coded`
- `taunt`
- `narration`

That undermines the “explicit values” promise by reopening a second uncontrolled vocabulary downstream.

### 3. No model-side weighting
**Status:** PASS

The design package consistently says weighting belongs in the deterministic layer, not in the prompt. The validator doc also avoids leaking prioritization language back into repair prompts. That part is solid.

### 4. Loud invalid-value handling
**Status:** PASS

The validator/retry contract is strong on:
- hard schema failures
- hard semantic failures
- explicit error codes
- no silent coercion
- bounded repair payloads
- durable logging/capture

This is implementation-ready in spirit, but see rollout/coherence failure notes below.

### 5. Deterministic grouping ownership
**Status:** PARTIAL / BLOCKED

Intent is correct: the architecture doc clearly states the grouping layer should own:
- candidate scoring
- blockers
- grouping
- `speaker_id`
- explainability artifacts

But the current repo seam still contains many places where dialogue generation itself owns speaker behavior. Without an explicit migration plan for those seams, ownership is not cleanly transferred yet.

### 6. Benchmark-friendly YAML heuristics
**Status:** PARTIAL / BLOCKED

The package correctly wants:
- versioned YAML rulesets
- replayable runs
- debug artifacts
- benchmark comparison outputs

But the proposed YAML examples are not contract-safe yet because they rely on field names and concepts that do not exist in the actual `traits` contract. That makes benchmark tuning brittle before implementation even starts.

---

## Major blocking findings

## Blocking finding 1 — The grouping architecture does not stay anchored to the closed `traits` contract

**Severity:** High

The contract doc defines one closed line schema. The architecture doc then says:
- “This document does not lock the exact traits fields”
- the grouping layer should canonicalize into buckets like `stable_identity`, `delivery_style`, `channel_production`, `role_context`
- worked examples and YAML examples use fields/values outside the contract

That creates a direct contradiction.

### Why this blocks implementation
A coder cannot safely implement the canonicalizer or YAML schema because the architecture currently points at a different feature language than the contract actually provides.

### Concrete examples of drift
The contract provides:
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`

The architecture/YAML examples instead rely on:
- `vocal_texture`
- `intensity`
- `cadence`
- `phrasing`
- `accent_family`
- `role_mode`
- `scene_function`

Those are not small naming differences. They imply different semantics and different available evidence.

### Required fix
Before implementation, the architecture doc needs a **normative canonicalization map** from the actual contract fields to deterministic buckets. Example shape:
- `stable_identity`: `gender_presentation`, `age_impression`, `pitch_band`, `phonation`, `accent_strength`
- `transient_delivery`: `pace`, `energy`
- `production_context`: `channel_texture`, `audibility`, `overlap`
- no `role_context` unless a future contract explicitly adds it

If the team wants richer fields like `accent_family` or `role_mode`, those must be added through a revised contract doc first — not smuggled into the architecture doc.

---

## Blocking finding 2 — Stable identity cues are not separated cleanly enough from transient/context cues

**Severity:** High

The audit prompt specifically asked whether stable identity cues are separated cleanly enough from transient/context cues.

### Current state
The contract itself hints at a good split, but it never formally labels one. The architecture doc discusses the split conceptually, but then muddies it by introducing extra categories and examples not grounded in the contract.

### Clean split that seems intended but is not yet locked
**Likely stable-ish identity cues from the contract:**
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `accent_strength`

**Likely transient/context cues from the contract:**
- `pace`
- `energy`
- `channel_texture`
- `audibility`
- `overlap`

That split is reasonable, but the docs do not make it normative.

### Risk if left unresolved
If implementation starts now, one coder may treat `channel_texture` as a strong grouping signal while another treats it as weak/noisy context. Same problem for `overlap`, `audibility`, and `energy`. That would produce unstable heuristics and benchmark churn.

### Required fix
Add an explicit section to the architecture doc titled something like:
- **Normative feature-bucket mapping from traits contract v1**
- classify each contract field as `stable_identity`, `transient_delivery`, `production_context`, or `uncertainty/gating`
- state whether each class can contribute positive score, negative score, hard blocker behavior, or warnings only

Until that exists, the separation is directionally good but not implementation-safe.

---

## Blocking finding 3 — Validator rollout guidance is not coherent enough with the current code seam

**Severity:** High

The validator doc correctly says the current architecture already has a validator/retry loop and recommends replacing the dialogue contract. That part is true. But it understates how much speaker-oriented logic is still embedded outside the validator boundary.

### Evidence in current code
`server/scripts/get-context/get-dialogue.cjs` still deeply assumes speaker-owned output:
- prompt examples require `speaker`, `speaker_id`, `confidence`, `speaker_profiles`, `inferred_traits`
- chunk prompts do the same
- chunk handoff is literally a speaker registry and speaker continuity memory
- `repairBoundaryContinuationSpeakerDrift(...)` rewrites `speaker_id`
- `mergeAdjacentDialogueSegments(...)` merges by `speaker_id`
- chunk aggregation offsets and carries `speaker_profiles`
- final normalization passes through `validateDialogueTranscriptionObject(...)`

And `server/lib/structured-output.cjs` still does speaker normalization in validation:
- `normalizeDialogueSpeakerContract(...)` auto-generates/merges speaker identities
- `validateDialogueTranscriptionObject(...)` always normalizes through that speaker contract

`server/lib/phase1-validator-tools.cjs` also still advertises the legacy speaker/profile schema as the validator contract example.

### Why this blocks implementation
The docs currently make the pivot sound like a validator swap plus prompt change. In reality, the current seam includes:
- prompt contract
- validator contract
- normalization behavior
- chunk handoff behavior
- boundary-repair behavior
- merge behavior
- chunk aggregation behavior
- stitch/summary expectations

That is a broader migration than the design package currently records.

### Required fix
Add a concrete rollout plan with named migration seams, at minimum:
1. replace validator tool contract example
2. replace `validateDialogueTranscriptionObject(...)` with traits-first validation
3. remove/feature-flag `normalizeDialogueSpeakerContract(...)` from the dialogue lane
4. remove/replace speaker-based chunk handoff
5. disable speaker-id-based boundary repair and merge helpers in the dialogue lane
6. introduce deterministic post-pass grouping artifact generation
7. update benchmark comparators and truth expectations to score deterministic outputs, not AI-authored speaker structures

Without that seam map, implementation will likely leave old speaker behavior partially active.

---

## Blocking finding 4 — Legacy speaker normalization behavior would blur ownership boundaries if left in place

**Severity:** High

This is the single most important code-level risk.

### Current behavior
`normalizeDialogueSpeakerContract(...)` in `server/lib/structured-output.cjs`:
- synthesizes/normalizes `speaker_id`
- maps label continuity to generated IDs
- merges speaker profiles by ID/label
- derives normalized `speaker_profiles`
- rewrites each line with normalized `speaker` and `speaker_id`

This means the validator layer is not just checking structure. It is **actively manufacturing and reconciling speaker identity state**.

### Why this is incompatible with the pivot
The pivot says:
- dialogue model emits text + traits only
- deterministic grouping owns `speaker_id`

If the validator or normalizer still manufactures `speaker_id` during dialogue validation, then deterministic grouping no longer owns identity. Ownership becomes blurred again.

### Additional blur points in `get-dialogue.cjs`
- `repairBoundaryContinuationSpeakerDrift(...)` mutates prior segment speaker ownership
- `mergeAdjacentDialogueSegments(...)` merges lines based on same-speaker identity
- chunk handoff carries speaker registry and inferred traits into later chunk prompting

These are all legacy speaker-ownership behaviors.

### Required fix
Before implementation starts, the design package should explicitly require one of these two outcomes:

**Preferred:**
- traits-mode dialogue validation path contains **no speaker normalization at all**
- no `speaker_id`, no `speaker_profiles`, no speaker handoff, no speaker-based repair helpers

**Temporary migration fallback:**
- all speaker-normalization logic is fenced behind a legacy codepath/feature flag
- the new traits-mode path bypasses it completely

This must be an explicit design requirement, not an implied cleanup.

---

## Blocking finding 5 — The architecture doc introduces `role_context` even though the contract intentionally rejects role semantics

**Severity:** Medium-High

The contract doc explicitly says per-line `traits` must not claim:
- character identity
- role labels like `news anchor`, `villain`, `soldier`, `announcer`
- scene function

But the architecture doc introduces `role_context` and examples like:
- `briefing voice`
- `promo voice`
- `antagonist taunt`
- `teammate chatter`
- `role_mode`
- `scene_function`

### Why this matters
That reopens exactly the type of semantic inference the contract just closed off. Even if the deterministic layer owns it, there is no source for those values in the actual contract. So either:
- the deterministic layer is expected to infer them from nowhere, or
- the model will be pressured back into producing them indirectly

Both are bad.

### Required fix
Remove `role_context` from the v1 deterministic architecture unless and until the traits contract explicitly adds deterministic-safe role fields.

For v1, the grouping layer should operate on contract-derived cues only.

---

## Blocking finding 6 — Benchmark-friendly YAML heuristics are the right direction, but the spec is not yet benchmark-safe

**Severity:** Medium-High

The package wants benchmarkable YAML tuning, which is good. But the current YAML example is not yet safe enough to implement because:
- it references non-contract fields
- it does not define a normative canonicalizer input schema
- it does not define how unknown/mixed/variable values propagate into scoring vs blockers vs abstentions
- it does not define the exact benchmark truth/output transition from current `dialogueData.json`

### Evidence from current benchmark artifact
The reviewed benchmark artifact is still entirely speaker-oriented and shows the old failure mode:
- dialogue output still contains `speaker`, `speaker_id`, `speaker_profiles`, `inferred_traits`
- failures include open vocabulary like `presentation`, `role`, `masculine-coded voice`, `news anchor`, `commercial announcer`
- comparator/truth still score speaker-owned structures directly

That evidence strongly supports the pivot, but it also shows benchmark migration is still a design task, not just a later implementation detail.

### Required fix
Add a benchmark migration section covering:
- what becomes the new benchmark truth for `dialogue-data.json` lines
- what becomes the benchmark truth for deterministic grouping output
- whether benchmark comparison is line-text only in dialogue phase and grouping-aware in the grouping phase
- how current `dialogueData` truth is split between line traits truth and grouping truth

---

## Non-blocking strengths

These parts are good and should be preserved:

### Strong point 1 — The line-level contract is disciplined
The contract doc is the strongest artifact in the package. It is tight, specific, and anti-drift.

### Strong point 2 — The validator doc understands “no silent coercion”
That is exactly right for this pivot.

### Strong point 3 — The grouping layer is correctly framed as deterministic and explainable
The desire for:
- candidate ledgers
- blockers
- score contributions
- ruleset versioning
- replayable debug artifacts
is all good.

### Strong point 4 — The benchmark artifact itself validates the need for the pivot
The current benchmark report shows why the old speaker/profile contract is failing:
- open vocabulary
- role/speculation leakage
- speaker overproduction / misalignment
- ownership confusion

That supports the pivot strongly.

---

## Specific audit answers to requested scrutiny

## A. Are stable identity cues separated cleanly enough from transient/context cues?
**Answer:** Not yet.

The intended split is visible, but it is not yet formalized against the actual v1 contract. The architecture doc drifts into extra categories and non-contract features, so the separation is not clean enough for implementation.

**Needed before implementation:** a normative field-to-bucket map for every contract field.

## B. Is validator rollout guidance coherent with the current code seam?
**Answer:** Not yet.

The validator/retry design is good in isolation, but the rollout guidance is too narrow relative to the current seam. `get-dialogue.cjs`, `structured-output.cjs`, and `phase1-validator-tools.cjs` all still embed speaker-owned behavior.

**Needed before implementation:** an explicit migration plan for prompt, validator, normalization, chunk handoff, repair helpers, and benchmark wiring.

## C. Could old speaker-normalization behavior blur ownership boundaries?
**Answer:** Yes — definitely.

The current normalization and repair helpers would absolutely blur the new ownership boundary if reused during the pivot. This is the clearest blocking risk in the package.

**Needed before implementation:** explicit requirement that traits-mode bypasses all legacy speaker normalization/repair behavior.

---

## Recommended next-step tasks before implementation

These should be completed before assigning the implementation bead.

### Required fix 1 — Amend the architecture doc to bind directly to the v1 traits contract
Add:
- a normative field-to-bucket canonicalization table
- bucket behavior rules
- explicit treatment of `unknown`, `mixed`, and `variable`
- removal of non-contract example vocabulary from worked examples and YAML

### Required fix 2 — Remove or defer `role_context` from v1
If it is not in the contract, it should not be in the grouping spec.

### Required fix 3 — Add an explicit migration-seam plan for `get-dialogue.cjs`
Document the exact legacy code areas that must be replaced, bypassed, or feature-flagged.

### Required fix 4 — Explicitly forbid legacy speaker normalization in traits mode
Call out these as incompatible with the pivoted path:
- `normalizeDialogueSpeakerContract(...)`
- speaker-id-based boundary repair
- speaker-id-based merge helpers
- speaker registry chunk handoff
- validator examples that advertise `speaker_profiles`

### Required fix 5 — Add benchmark migration guidance
Define:
- dialogue-phase truth shape after pivot
- grouping-phase truth/output shape
- comparator ownership split
- what replaces current direct scoring of AI-authored speaker structures

---

## Suggested implementation lane after design fixes

Once the above fixes land, the implementation lane should likely proceed in this order:
1. replace validator-tool contract and `validateDialogueTranscriptionObject(...)` with traits-mode validation
2. replace prompt examples and prompt rules to emit traits-only line objects
3. remove/bypass legacy speaker normalization and handoff behavior in traits mode
4. emit traits-only `dialogue-data.json`
5. add deterministic grouping engine + YAML ruleset validator
6. emit `speaker-grouping.json` and `dialogue-speakers.json`
7. migrate benchmark comparators/truth to the new split

---

## Final audit disposition

**Disposition:** ❌ Fail / blocking gaps remain

The package has the right strategy, and two of the three docs are close to implementation-ready in isolation. But as a package, it is still missing the seam-tightening needed to prevent the old speaker-normalization architecture from leaking into the new deterministic ownership model.

**Do not close bead `ee-a82e` yet.**
