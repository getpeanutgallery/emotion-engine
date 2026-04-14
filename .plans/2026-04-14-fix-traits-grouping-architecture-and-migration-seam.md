# Emotion Engine

**Date:** 2026-04-14  
**Status:** Complete — design package review-ready (not implementation-complete)  
**Agent:** Cookie 🍪

---

## Goal

Repair the traits-pivot design package so the deterministic speaker-grouping architecture and migration plan are strictly derived from the v1 closed `traits` contract, align on one reviewable JSON/YAML surface, and are safe to hand off for later implementation.

---

## Overview

The first repair pass fixed the major architectural problem: the grouping design now stays inside the actual v1 `traits` contract, the migration seam documents how traits mode bypasses legacy speaker-ID ownership, and the JSON/YAML artifact examples are no longer drifting into made-up fields. That was a real improvement over the earlier failed handoff.

The follow-up audit then found two narrow but blocking coherence issues: naming drift across the repaired docs, and inconsistent assumptions about the top-level `dialogue-data.json` envelope. A final consistency pass resolved both by locking one canonical deterministic bucket scheme, one canonical derived grouping field, and one explicit persisted envelope decision for traits-mode `dialogue-data.json`.

The final re-audit now passes. This lane is therefore complete as a **design-package repair and review handoff**, not as implementation work. The current codebase still reflects the legacy speaker-owned path; that is expected, documented by the migration seam, and intentionally not misrepresented as already implemented.

Post-review decisions from Derrick for the next revision lane:
- remove per-line `start` / `end` from the dialogue artifact because dialogue no longer owns timing
- require top-level `summary`
- remove persisted `handoffContext` for cleanliness
- keep the existing closed traits
- add two new closed fields in the next revision: `affect` and `delivery_stance`

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Prior pivot design plan and current recorded state | `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md` |
| `REF-02` | Closed v1 dialogue line `traits` contract | `docs/2026-04-14-dialogue-line-traits-contract.md` |
| `REF-03` | Validator and retry contract for invalid `traits` | `docs/2026-04-14-dialogue-traits-validator-retry-contract.md` |
| `REF-04` | First deterministic grouping architecture draft that needed repair | `docs/2026-04-14-deterministic-speaker-grouping-architecture.md` |
| `REF-05` | Initial independent audit identifying the blocking gaps | `docs/2026-04-14-dialogue-traits-pivot-design-audit.md` |
| `REF-06` | Current dialogue seam still assuming speaker-oriented flow | `server/scripts/get-context/get-dialogue.cjs` |
| `REF-07` | Current benchmark artifact shape to evolve | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-08` | Repaired contract-faithful grouping architecture | `docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md` |
| `REF-09` | Repaired migration seam for traits mode | `docs/2026-04-14-dialogue-traits-mode-migration-seam.md` |
| `REF-10` | Repaired JSON/YAML artifact ownership/examples | `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` |
| `REF-11` | Follow-up audit of repaired package | `docs/2026-04-14-repaired-traits-handoff-package-audit.md` |
| `REF-12` | Final re-audit confirming repaired package pass | `docs/2026-04-14-final-repaired-traits-package-reaudit.md` |

---

## Tasks

### Task 1: Repair the deterministic grouping architecture so it is contract-faithful

**Bead ID:** `ee-nu7r`  
**SubAgent:** `research`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-07`  
**Prompt:** Design-repair the deterministic grouping architecture doc so it is strictly grounded in the v1 closed `traits` contract. Remove or defer non-contract vocabulary. Define the normative field-to-bucket mapping from actual v1 `traits` fields into deterministic grouping buckets, including handling for `unknown`, `mixed`, and `variable`. Produce a corrected architecture doc or revision note under `docs/` that is implementation-ready and contract-faithful.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-14-deterministic-speaker-grouping-architecture-v1-traits-revision.md` and closed `ee-nu7r` (`Grouping architecture repaired to match traits contract`). The revised architecture now uses the exact ten v1 `traits` fields as the normative input surface, removes/defers non-contract vocabulary, defines the field-to-bucket mapping, and makes `unknown`, `mixed`, and `variable` first-class deterministic handling cases.

---

### Task 2: Design the explicit migration seam from speaker-owned Phase 1 flow to traits mode

**Bead ID:** `ee-z99g`  
**SubAgent:** `primary`  
**References:** `REF-03`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Define the migration seam plan for moving from the current speaker-ID-centered Phase 1 flow to `traits` mode. Document exactly which current seams must be bypassed, replaced, or adapted, including prompt contract, validator contract, normalization behavior, chunk handoff behavior, speaker-id-based repair helpers, adjacent merge logic, and benchmark/comparator migration. Produce a durable migration design doc under `docs/`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-dialogue-traits-mode-migration-seam.md`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-14-dialogue-traits-mode-migration-seam.md` and closed `ee-z99g` (`Traits-mode migration seam designed`). The migration design now explicitly requires traits mode to bypass legacy speaker normalization, speaker-drift repair, same-speaker adjacent merge logic, speaker registry handoff, and speaker-profile aggregation, while splitting dialogue-vs-grouping benchmark ownership cleanly.

---

### Task 3: Define contract-safe JSON/YAML ownership and example shapes for the repaired design

**Bead ID:** `ee-2cqs`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-05`, `REF-07`  
**Prompt:** Produce a design doc that shows the contract-safe JSON and YAML ownership boundaries and example shapes for the repaired traits-first flow. Include: `dialogue-data.json` line shape, deterministic grouping output shape(s), and the versioned YAML heuristics/rules structure, all strictly bound to the actual v1 `traits` contract and migration plan.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` and closed `ee-2cqs` (`Contract-safe JSON and YAML shapes defined`). The doc locks source-vs-derived ownership boundaries across `dialogue-data.json`, `speaker-grouping.json`, `dialogue-speakers.json`, and the versioned YAML heuristics surface. It later received a consistency-pass update so its naming and persisted-envelope decisions now align with the rest of the repaired package.

---

### Task 4: Independently audit the repaired handoff package

**Bead ID:** `ee-9hzh`  
**SubAgent:** `auditor`  
**References:** `REF-02`, `REF-03`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Independently audit the repaired design package: revised grouping architecture, migration seam plan, and JSON/YAML ownership examples. Verify that the package is now contract-faithful, migration-safe, and implementation-ready. Produce a durable audit doc with pass/fail findings and required fixes if any remain.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-repaired-traits-handoff-package-audit.md`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ❌ Failed

**Results:** Produced `docs/2026-04-14-repaired-traits-handoff-package-audit.md`. This historical audit bead remains `in_progress` because it surfaced two real blockers and was not closed after the failing review. The blockers were: (1) bucket/output naming drift across docs, and (2) inconsistent assumptions about whether top-level `dialogue-data.json` metadata such as `schema_version`, `contract`, and `contract.traits_contract_version` were required.

---

### Task 5: Final consistency pass across repaired docs

**Bead ID:** `ee-zow4`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Reconcile the repaired design package so the docs use one consistent naming scheme for grouping buckets and output fields, and so the top-level `dialogue-data.json` envelope requirements are explicitly aligned across the line contract, validator contract, migration seam, grouping architecture, and JSON/YAML artifact-shapes docs. Produce only documentation updates or an explicit consistency note; do not invent implementation work.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- repaired docs under `docs/`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Closed `ee-zow4` (`Repaired traits docs naming and envelope unified`). The consistency pass updated the reviewed traits docs so the package now uses one canonical deterministic bucket scheme (`stable_identity_cues`, `delivery_cues`, `production_context_cues`, `gating_cues`), one canonical derived grouping field (`canonical_traits`), and one explicit persisted `dialogue-data.json` envelope decision: top-level `schema_version`, `contract`, and `contract.traits_contract_version` are required; `summary` and `handoffContext` remain optional.

---

### Task 6: Re-audit the final repaired package

**Bead ID:** `ee-vrmk`  
**SubAgent:** `auditor`  
**References:** `REF-02`, `REF-03`, `REF-08`, `REF-09`, `REF-10`, `REF-11`, `REF-12`  
**Prompt:** Independently re-audit the design package after the final consistency pass. Verify there is no remaining naming drift, the top-level `dialogue-data.json` envelope is locked consistently, and the package is review-ready for Derrick to inspect the JSON/YAML shapes.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-14-final-repaired-traits-package-reaudit.md`
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-14-final-repaired-traits-package-reaudit.md` and closed `ee-vrmk` (`Final repaired traits package audited and review-ready`). The re-audit passed all targeted checks: no remaining naming drift, the persisted `dialogue-data.json` envelope is locked consistently, the package stays strictly bound to the closed v1 `traits` contract, and the docs remain honest that current code is still legacy speaker-owned. This is a **design-package pass** only.

---

### Task 7: Update the living plan and prepare review handoff for Derrick

**Bead ID:** `ee-xpj5`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-05`, `REF-11`, `REF-12`  
**Prompt:** Update this living plan with what was actually produced, the follow-up audit result, and the exact review-ready JSON/YAML artifacts Derrick should inspect next. Do not invent implementation work.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-14-fix-traits-grouping-architecture-and-migration-seam.md`

**Status:** ✅ Complete

**Results:** Updated this plan to record the full repaired-doc outcome, the historical failed audit state, the closed final consistency/re-audit beads, and the exact review handoff. Derrick should inspect next, in order: (1) `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` for the review-ready `dialogue-data.json`, `speaker-grouping.json`, `dialogue-speakers.json`, and YAML ruleset shapes; (2) `docs/2026-04-14-dialogue-line-traits-contract.md` for the persisted traits-mode envelope and per-line contract; and (3) `docs/2026-04-14-dialogue-traits-mode-migration-seam.md` for the explicit boundary that keeps this package design-ready for implementation without claiming implementation is done.

---

## Final Results

**Status:** ✅ Complete — review-ready design package (not implementation-complete)

**What We Built:** Repaired the traits-first design handoff so the grouping architecture, migration seam, and JSON/YAML artifact-shape docs now form one coherent package. The package is contract-faithful to the closed v1 `traits` line contract, uses one canonical deterministic vocabulary, and cleanly separates source dialogue artifacts from derived grouping artifacts.

**Reference Check:** `REF-02`, `REF-08`, `REF-09`, `REF-10`, and `REF-12` are now aligned. `REF-11` remains preserved as the historical failed audit that justified the final consistency pass. The plan intentionally records that the current code still follows the legacy speaker-owned path from `REF-06`; this lane fixed the design package and review handoff, not the implementation.

**Review Handoff for Derrick:**
- Primary JSON/YAML review doc: `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`
  - inspect the persisted traits-mode `dialogue-data.json` envelope
  - inspect the derived `speaker-grouping.json` shape
  - inspect the derived `dialogue-speakers.json` projection boundary
  - inspect the YAML bucket / blocker / threshold vocabulary
- Supporting contract doc: `docs/2026-04-14-dialogue-line-traits-contract.md`
- Supporting migration-boundary doc: `docs/2026-04-14-dialogue-traits-mode-migration-seam.md`
- Audit confirmation: `docs/2026-04-14-final-repaired-traits-package-reaudit.md`

**Commits:**
- Not recorded in this documentation-only handoff update.

**Lessons Learned:** A design repair lane needed two audits because the first “repair” solved architecture but still left terminology and persisted-envelope drift. Keeping the historical failed audit in the plan makes the final pass result more trustworthy and shows exactly why this package is now review-ready.

---

*Completed on 2026-04-14*