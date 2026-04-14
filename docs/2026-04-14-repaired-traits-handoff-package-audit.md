# Repaired Traits Handoff Package Audit

**Date:** 2026-04-14  
**Auditor:** Cookie 🍪  
**Scope:** Independent audit of the repaired traits handoff package

Reviewed artifacts:
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`
- `docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md`
- `docs/2026-04-14-dialogue-traits-mode-migration-seam.md`
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`
- `docs/2026-04-14-dialogue-traits-pivot-design-audit.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/benchmark-runner.cjs`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

---

## Consistency-pass resolution note

The blockers identified in this audit were resolved by the final documentation consistency pass.

Locked terminology after the pass:
- deterministic buckets: `stable_identity_cues`, `delivery_cues`, `production_context_cues`, `gating_cues`
- canonical derived group field: `canonical_traits`
- sentinel handling remains a cross-cutting rules layer for `unknown`, `mixed`, and `variable`, not a separate bucket family

Locked persisted traits-mode `dialogue-data.json` envelope after the pass:
- required top-level `schema_version`
- required top-level `contract`
- required `contract.traits_contract_version`
- optional top-level `summary`
- optional top-level `handoffContext`

This note updates the implementation handoff posture without erasing the original audit findings below.

---

## Executive Conclusion

**Conclusion: FAIL — improved substantially, but not yet fully implementation-ready.**

The repaired package fixes the big structural problems called out in the prior audit:
- the grouping architecture is now bound to the actual v1 `traits` fields
- the migration seam now explicitly identifies and bypasses legacy speaker-normalization ownership in traits mode
- the JSON/YAML handoff no longer smuggles role labels, accent families, or other non-contract pseudo-fields into v1 examples
- the current code seam and benchmark state are documented honestly, not hand-waved

That said, the package still has **two remaining handoff blockers**:
1. **cross-doc bucket/output vocabulary drift** between the repaired grouping architecture doc and the JSON/YAML artifact-shape doc
2. **cross-doc ambiguity about the required top-level `dialogue-data.json` envelope** in traits mode

Those are not philosophical nits. They leave a future implementer unable to tell which bucket names, output object names, and top-level file contract are actually normative.

---

## Audit Goal Scorecard

### 1. Contract-faithful
**Status:** PASS with blocker notes

The repaired package is now materially more contract-faithful than the failed version.

Strong passes:
- `docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md` binds grouping input to the exact ten v1 fields from `docs/2026-04-14-dialogue-line-traits-contract.md`.
- It explicitly excludes prior drift terms like `vocal_texture`, `accent_family`, `role_mode`, `scene_function`, geography labels, and open-ended coded labels.
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` also keeps YAML examples tied to actual v1 fields instead of speculative feature names.

Remaining issue:
- the package is contract-faithful at the **field/value** layer, but not yet fully contract-faithful at the **derived bucket/output schema** layer because different docs name those derived containers differently.

### 2. Migration-safe
**Status:** PASS with blocker notes

The migration seam doc is the biggest improvement in the package.

Strong passes:
- `docs/2026-04-14-dialogue-traits-mode-migration-seam.md` explicitly calls out the legacy seams that must be bypassed or split in traits mode:
  - `normalizeDialogueSpeakerContract(...)`
  - `repairBoundaryContinuationSpeakerDrift(...)`
  - `shouldMergeAdjacentDialogueSegments(...)`
  - `mergeAdjacentDialogueSegments(...)`
  - speaker-registry chunk handoff
  - chunk `speaker_profiles` accumulation
  - benchmark/comparator ownership tied to `speaker_profiles`
- This matches the actual code seam in:
  - `server/lib/structured-output.cjs`
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/lib/phase1-validator-tools.cjs`
  - `server/lib/benchmark-runner.cjs`

Remaining issue:
- migration ownership is now explicit, but the exact **traits-mode source artifact shape** is not locked consistently across docs, which weakens implementation handoff.

### 3. Implementation-ready
**Status:** FAIL

The package is close, but not quite safe to hand to implementation without a short design-cleanup pass.

Main reason:
- a coder still has to guess which derived bucket names and output object names are canonical
- a coder still has to guess whether the top-level `dialogue-data.json` envelope requires `schema_version` and `contract`, or whether those are optional add-ons

That guesswork is precisely what this repair pass was supposed to eliminate.

---

## Detailed Findings

## Finding 1 — Legacy speaker-normalization ownership is now explicitly contained in traits mode
**Severity:** Pass / major improvement

This was a prior blocker and is now adequately addressed at the design level.

### Evidence from current code
The current code still clearly owns speaker identity in the legacy path:
- `server/lib/structured-output.cjs`
  - `validateDialogueSegments(...)` requires legacy `speaker` / `speaker_id` / `confidence`
  - `normalizeDialogueSpeakerContract(...)` synthesizes and reconciles `speaker_id` and `speaker_profiles`
  - `validateDialogueTranscriptionObject(...)` always normalizes through that speaker contract
- `server/scripts/get-context/get-dialogue.cjs`
  - whole-asset prompt rules still say to reuse `speaker_id`
  - chunk prompt rules still say to preserve prior `speaker_id` continuity
  - `repairBoundaryContinuationSpeakerDrift(...)` rewrites `speaker_id`
  - `mergeAdjacentDialogueSegments(...)` merges by same-speaker logic
  - `buildStructuredSpeakerHandoff(...)` builds a speaker registry and continuity memory
  - chunk aggregation still accumulates `speaker_profiles`
- `server/lib/phase1-validator-tools.cjs`
  - validator tool contract still advertises `speaker_profiles` and legacy speaker fields
- `server/lib/benchmark-runner.cjs`
  - `dialogue-default` still has special handling for `speaker_profiles`

### Evidence from repaired docs
The repaired migration seam now explicitly contains/bypasses those seams in traits mode rather than pretending the validator swap alone is enough.

### Audit result
**Pass.** The repaired package now clearly states that traits mode must bypass legacy speaker-normalization ownership instead of inheriting it accidentally.

---

## Finding 2 — JSON shape ownership and YAML examples are now mostly bound to real v1 traits fields
**Severity:** Pass with blocker notes

This was another major repair.

### What is now correct
The repaired docs keep v1 examples tied to actual contract fields:
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `accent_strength`
- `pace`
- `energy`
- `channel_texture`
- `audibility`
- `overlap`

They no longer rely on prior drift terms like:
- `accent_family`
- `role_context`
- `presentation`
- `vocal_texture`
- `intensity`
- `cadence`

The reviewed benchmark artifact still shows exactly why the old package failed: open-ended `presentation` and `role` values, legacy `speaker_profiles`, and speaker-owned output. The repaired docs no longer model v1 around those shapes.

### Remaining problem
While the field ownership is repaired, the **derived bucket names** are not consistent across docs.

---

## Finding 3 — Cross-doc bucket/output vocabulary drift is still a blocker
**Severity:** High / blocking

The repaired package still uses two different names for the same deterministic layer concepts.

### In the grouping architecture revision
`docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md` defines buckets as:
- `stable_identity_cues`
- `delivery_cues`
- `production_context_cues`
- `uncertainty_sentinels`

It also shows output using names like:
- `canonical_traits`

### In the JSON/YAML artifact-shape doc
`docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` defines derived buckets as:
- `stable_identity`
- `transient_delivery`
- `production_context`
- `gating_signals`

It shows grouping output using names like:
- `canonical_profile`
- nested bucket containers
- `typical_audibility`
- `typical_overlap`

### Why this blocks implementation
A future implementer cannot know which of the following is normative:
- `stable_identity_cues` vs `stable_identity`
- `delivery_cues` vs `transient_delivery`
- `production_context_cues` vs `production_context`
- `uncertainty_sentinels` vs `gating_signals`
- `canonical_traits` vs `canonical_profile`

This affects:
- YAML schema design
- grouping-engine internal model
- explainability/debug artifact shape
- benchmark truth for grouping outputs
- any downstream deterministic projection

### Required fix
Pick **one canonical derived vocabulary** and rewrite both docs to match it exactly.

Recommended minimal fix:
- choose one bucket family and reuse it everywhere
- choose one output object name (`canonical_profile` or `canonical_traits`) and reuse it everywhere
- if `audibility` / `overlap` are meant to be gating-only, make that same wording appear in both docs

Until that is done, the package is not fully implementation-ready.

---

## Finding 4 — The top-level `dialogue-data.json` envelope is not fully reconciled across docs
**Severity:** High / blocking

The repaired docs still disagree on the exact top-level traits-mode artifact shape.

### Line contract / validator contract posture
`docs/2026-04-14-dialogue-line-traits-contract.md` and `docs/2026-04-14-dialogue-traits-validator-retry-contract.md` mostly frame the required output in terms of:
- `dialogue_segments`
- `summary`
- optional `handoffContext`
- optional timing

### JSON/YAML artifact-shape posture
`docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` marks the required top-level shape as including:
- `schema_version`
- `contract.artifact`
- `contract.mode`
- `contract.traits_contract_version`
- `dialogue_segments`

### Migration seam posture
`docs/2026-04-14-dialogue-traits-mode-migration-seam.md` describes traits-mode output as:
- `dialogue_segments[*].index`
- `start?`
- `end?`
- `text`
- `traits`
- `summary`
- optional `handoffContext`
- additive metadata

It does **not** lock the same `schema_version` + `contract` envelope that the artifact-shape doc marks as required.

### Why this blocks implementation
A coder cannot tell whether the traits-mode validator should:
- require `schema_version` and `contract`
- allow them optionally
- inject them later in a writer/adapter step

That affects:
- prompt examples
- validator schema
- benchmark fixture truth
- migration rollout sequencing

### Required fix
Make one explicit decision and state it in all three places:
- **Option A:** `schema_version` + `contract` are mandatory in v1 source artifacts
- **Option B:** they are optional in first implementation, then required in a later revision

Right now the docs imply both.

---

## Finding 5 — The benchmark migration direction is now correct
**Severity:** Pass

The package now correctly treats the current benchmark artifact as evidence of the legacy failure mode rather than as something traits mode should preserve.

Strong passes:
- the migration seam doc says `dialogue-data.json` truth should stop scoring speaker-owned structures in traits mode
- it calls for a separate grouping artifact and separate grouping comparator ownership
- this matches the current reality in `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`, which is still dominated by speaker/profile failures

This part is review-ready.

---

## Finding 6 — Validator/retry semantics are sufficiently aligned with the repaired package
**Severity:** Pass

The validator/retry doc remains strong and still fits the repaired package:
- hard invalidation for legacy speaker fields in strict traits mode
- no silent coercion
- machine-readable retry payloads
- durable failure artifacts
- contract-safe semantic checks

No new blocker found here.

---

## Pass/Fail Matrix

| Area | Result | Notes |
| --- | --- | --- |
| v1 traits field/value contract | PASS | Closed and explicit |
| migration seam for legacy speaker ownership | PASS | Explicitly bypassed/contained in traits mode |
| binding YAML examples to real v1 fields | PASS | Major repair from previous failure |
| benchmark migration direction | PASS | Correctly split toward dialogue truth vs grouping truth |
| deterministic bucket/output naming consistency | FAIL | Cross-doc naming drift remains |
| top-level `dialogue-data.json` source artifact shape | FAIL | `schema_version` / `contract` envelope not fully reconciled |
| overall implementation-readiness | FAIL | Needs one more cleanup pass before coding |

---

## Recommended Next Steps Before Reviewing JSON/YAML with Derrick

1. **Unify the deterministic bucket vocabulary across docs**
   - choose one canonical set of bucket names
   - update both the grouping architecture doc and JSON/YAML doc to match exactly

2. **Unify the grouping output shape vocabulary across docs**
   - choose `canonical_profile` or `canonical_traits`
   - make the example output schema identical in both docs

3. **Lock the top-level traits-mode `dialogue-data.json` envelope**
   - decide whether `schema_version` + `contract` are mandatory in v1 source artifacts
   - update the line contract, validator contract, migration seam, and artifact-shape doc to match

4. **Do one final terminology scrub**
   - remove any residual bucket-name aliases that would let implementation drift reappear

After those fixes, this should be ready for code implementation review.

---

## Final Disposition

**Disposition:** ❌ Fail / blocked for one more doc-cleanup pass

The repaired package fixed the original architectural and migration-seam failures, and it is much closer to handoff-ready. But it still leaves two contract-shape ambiguities that are large enough to cause implementation drift.

**Do not close bead `ee-9hzh` yet.**
