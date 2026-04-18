# Emotion Engine

**Date:** 2026-04-15  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Define the deterministic YAML heuristics contract that will decide whether dialogue lines with v2 traits belong to an existing speaker group or constitute a new speaker, so implementation can proceed against a review-approved grouping policy instead of vague heuristic prose.

---

## Overview

This plan intentionally comes **before** Phase 1 implementation of the new dialogue traits contract. Derrick wants the grouping heuristics contract defined first so we do not land the richer traits system in code without also deciding how those traits are meant to support speaker continuity and grouping.

This is design work, not runtime implementation. The lane should translate the **latest locked persisted traits JSON shape** and all recent review/audit work into an explicit YAML contract for deterministic grouping. The heuristics must match the revised source-truth envelope from the latest session: no per-line timing in persisted `dialogue-data.json`, required top-level `summary`, no `handoffContext`, closed traits object, deterministic grouping owns `speaker_id`, and the newer v3-family trait fields (`transmission_medium`, `spatial_texture`, `interpersonal_stance`, `delivery_overlay`) instead of the earlier stored-v2 names. That includes field bucket mapping, compatibility/versioning, positive and negative evidence rules, blocker rules, reliability/gating use, ambiguity handling, and any guardrails needed to keep grouping logic faithful to the closed source-truth philosophy.

The resulting package should be durable, reviewable, and implementation-guiding. It should point back to the current trait-contract docs and the recent discussion/audit trail rather than inventing a fresh architecture from scratch.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Revised maximalist dialogue traits contract v2 | `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md` |
| `REF-02` | Revised dialogue traits architecture note v2 | `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md` |
| `REF-03` | Revised full enum audit v2 | `docs/2026-04-15-dialogue-traits-full-enum-audit-v2.md` |
| `REF-04` | Calibration artifact | `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` |
| `REF-05` | Current v2 package audit | `docs/2026-04-15-dialogue-traits-vnext-v2-package-audit.md` |
| `REF-06` | Earlier artifact-shape / YAML boundary doc | `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` |
| `REF-07` | Prior YAML-contract motivation + recent session discussion | current session |
| `REF-08` | High-level bead for this lane | `ee-0ski` |
| `REF-09` | Earlier stored-v2 JSON/YAML boundary doc to supersede where needed | `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` |

---

## Tasks

### Task 1: Draft the deterministic grouping heuristics YAML contract for the locked traits JSON shape

**Bead ID:** `ee-kvnb`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-07`, `REF-09`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-kvnb` on start with `bd update ee-kvnb --status in_progress --json`. Draft a review-ready deterministic YAML heuristics contract for grouping dialogue lines against the **latest locked persisted traits JSON shape**, not the earlier stored-v2 field names. The YAML must align to the closed source-truth envelope: required top-level `summary`, no per-line `start`/`end`, no `handoffContext`, no grouping outputs in source truth, deterministic grouping owns `speaker_id`, and the newer per-line fields including `transmission_medium`, `spatial_texture`, `interpersonal_stance`, and `delivery_overlay`. Define compatibility/versioning, bucket mappings, positive/negative evidence rules, blocker rules, ambiguity handling, reliability/gating usage, thresholds/tie-breaks, and any warning-level cross-field checks needed. Keep it faithful to the closed-contract/source-truth philosophy and directly usable for later implementation. Close `ee-kvnb` when done.

**Status:** ✅ Complete

**Results:** Drafted the review-ready v3-aligned heuristics package and recorded the exact artifact paths: `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml` and companion summary `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`. The YAML locks compatibility to the latest persisted source-truth envelope (`dialogue_schema_version: 1.x`, `traits_contract_version: 3.x`, `grouping_output_version: 3.x`), requires top-level `summary`, forbids source-truth timing/handoff/speaker fields, maps the new v3 fields into `stable_identity_cues`, `delivery_cues`, `production_context_cues`, and `gating_cues`, and defines explicit positive evidence, negative evidence, blocker, abstention, ambiguity, threshold, tie-break, cleanup, and warning-level cross-field guardrail policy. It also records supersession notes so older stored-v2 names like `channel_texture` and `delivery_stance` are treated as historical-only, not normative contract fields. References validated: `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-09`.

---

### Task 2: Audit the heuristics contract for coherence with the locked traits JSON shape and recent design decisions

**Bead ID:** `ee-j3kr`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-06`, `REF-07`, `REF-09`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, wait until draft bead `ee-kvnb` is complete, then claim bead `ee-j3kr` with `bd update ee-j3kr --status in_progress --json`. Independently audit the drafted YAML heuristics contract. Verify that it matches the latest locked traits JSON shape and architecture decisions, preserves the source-truth/grouping boundary, handles ambiguity and abstention honestly, does not smuggle in role/lore identity logic, and does not regress to the earlier stored-v2 names/boundaries except where explicitly called out as superseded history. Close `ee-j3kr` when the audit is written.

**Status:** ✅ Complete

**Results:** Wrote the independent durable audit note at `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-audit.md`. Audit verdict: the package passes for contract direction and parser/decision-ledger implementation against the locked v3 source-truth shape, preserves the source-truth/grouping boundary, uses the new normative fields (`transmission_medium`, `spatial_texture`, `interpersonal_stance`, `delivery_overlay`), and keeps abstention/ambiguity honest without role/lore leakage. One focused blocking gap remains before treating scorer/blocker behavior as fully locked: `field_policies.phonation.blocker_when` is internally ambiguous and should be normalized or removed before runtime blocker execution relies on it. Safe implementation seam now: schema/compatibility validation, YAML parser/loading, decision-ledger scaffolding, and source-truth boundary enforcement. References validated: `REF-01`, `REF-02`, `REF-05`, `REF-06`, `REF-07`, `REF-09`. Exact audit file path recorded here for handoff.

---

### Task 3: Update the living plan with final heuristics-contract decisions and next implementation seam

**Bead ID:** `ee-3tys`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-05`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, after beads `ee-kvnb` and `ee-j3kr` are complete, claim bead `ee-3tys` with `bd update ee-3tys --status in_progress --json`. Update this plan with what was actually decided, what remains conditional, and the exact next implementation seam for `ee-gqnc`. Record any required supersession notes where the new heuristics/YAML contract intentionally differs from the older stored-v2 artifact-shape document. Close `ee-3tys` when done.

**Status:** ✅ Complete

**Results:** Updated the living plan to reflect the actual end state of the heuristics package rather than the original expected handoff. Final decisions recorded: the v3 heuristics package is accepted as the review-approved design baseline for the locked source-truth envelope; it passes for v3 contract direction plus the immediate implementation seam of schema/compatibility validation, YAML parser/loading, decision-ledger/explainability scaffolding, and source-truth boundary enforcement for follow-on bead `ee-gqnc`. The audit outcome is now captured here explicitly: the package is coherent with the locked v3 contract/parser/decision-ledger/source-boundary implementation path, preserves the source-truth/grouping ownership boundary, and supersedes the older stored-v2 artifact-shape expectations wherever they still mention historical field families. The remaining conditional gap is also recorded explicitly: phonation blocker semantics are **not** yet fully locked because `field_policies.phonation.blocker_when` is ambiguous as written, so runtime scorer/blocker execution should not yet treat that clause as authoritative until normalized or replaced. Supersession note recorded: `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` remains useful as historical boundary motivation, but the active normative heuristics contract is now the 2026-04-16 v3 ruleset/contract pair and uses `transmission_medium`, `spatial_texture`, `interpersonal_stance`, and `delivery_overlay` instead of the older stored-v2 artifact-shape vocabulary. References validated in this finalization pass: `REF-01`, `REF-05`, `REF-07`, `REF-08`, `REF-09`. 

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A review-approved v3 deterministic speaker-grouping heuristics package consisting of the ruleset YAML, companion contract summary, independent audit note, and this finalized plan. The package is now truthfully documented as passing for the v3 contract/parser/decision-ledger/source-boundary implementation seam, while also preserving the one remaining conditional gap: phonation blocker semantics are not fully locked because `field_policies.phonation.blocker_when` is ambiguous.

**Reference Check:** `REF-01`, `REF-05`, `REF-07`, `REF-08`, and `REF-09` are satisfied for this planning/finalization lane. The final package preserves the locked source-truth boundary from the v2 design docs, adopts the normative v3 field family, and explicitly supersedes the older stored-v2 artifact-shape expectations wherever they conflict with the 2026-04-16 heuristics package.

**Commits:**
- Pending.

**Lessons Learned:** Locking the YAML contract and an independent audit before runtime code was the right move; it made the true implementation seam obvious. The next safe implementation work for `ee-gqnc` is narrow and concrete: schema/compatibility validation, YAML parser/loading, decision-ledger/explainability scaffolding, and source-truth boundary enforcement. The scorer itself should treat phonation blocker behavior as conditional until the ambiguous `blocker_when` clause is normalized.

---

*Completed on 2026-04-16*
