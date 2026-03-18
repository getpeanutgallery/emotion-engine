---
plan_id: plan-2026-03-13-schema-validator-rollout-across-ai-lanes
---
# emotion-engine: schema + validator rollout across all AI lanes

**Date:** 2026-03-13  
**Status:** In Progress  
**Agent:** Cookie 🍪

> **Historical status note (2026-03-18):** This file is an earlier planning artifact that was overtaken the same day by the broader unified success/failure/recovery architecture work and then concretized in the 2026-03-14 rollout plan. Treat it as a historical proposal, not a live in-progress rollout source of truth. The sibling-rollout epic `ee-cwi` and final sweep bead `ee-vaa` referenced by this planning line are now closed.

---

## Goal

Finish the next hardening step after `ee-of5`: ensure every meaningful AI lane in emotion-engine is schema-bound, returns JSON as the expected format, and uses consistent validation/repair handling — with bead breakdowns separated by lane/family instead of pretending one pass can finish everything.

---

## Overview

We now have shared infrastructure for normalized AI defaults/overrides and a growing structured-output foundation, but we do **not** yet have universal schema/validator enforcement across every AI lane. Recommendation is the strongest implementation today. Dialogue and music are materially improved, but not every lane uses the same validator/repair discipline, and sibling repos have not been rolled into this output-contract standard.

Derrick has now tightened the system requirement: **every meaningful AI lane must use a tool-mediated validator path for its JSON output.** Direct schema validation after the fact is no longer the target end-state; it may still exist as an internal helper, but the lane is not complete unless the AI is explicitly instructed to use the provided validator tool before final acceptance.

The important architectural point is that this work is both **shared** and **lane-specific**:
- shared parsing, validation, retry, tool-loop orchestration, and diagnostics infrastructure should be reused everywhere
- but each AI lane still needs its own expected JSON shape, constraints, and validator-tool contract

Documentation must stay current as part of the rollout, not as an afterthought. And completion cannot be declared just because the known lanes were refactored: we need an explicit end-of-rollout sanity sweep across emotion-engine and sibling repos to catch any remaining AI call sites that still bypass the required JSON validator-tool system. That sweep may legitimately discover additional follow-up beads before the refactor can be called complete.

So the correct rollout is not one vague mega-task. It is a sequence of beads that combine a hard validator-tool contract with per-lane schemas, documentation updates, verification, and a final repo/polyrepo sanity audit.

---

## Proposed bead breakdown

### Bead 1: Define the universal JSON/validation contract for AI lanes

**Proposed title:** `Define universal schema/validator contract for emotion-engine AI lanes`

**Purpose:**
- Establish the common contract every AI lane must follow.
- Decide what “done” means for a lane:
  - JSON-only response expectation
  - lane-specific schema validator
  - validator-tool loop is mandatory before final acceptance
  - retry/repair policy
  - raw capture + validation diagnostics

**Scope:**
- Document the contract in repo docs and/or shared helper comments.
- Inventory lane families and assign rollout scope.
- Clarify the mandatory validator-tool pattern and how lane-specific schemas plug into it.

**Expected outcome:**
- One canonical rollout spec that future lane beads implement against, with validator-tool mediation as a hard requirement.

---

### Bead 2: Finish Phase 1 schema/validator enforcement

**Proposed title:** `Enforce schema-bound JSON across Phase 1 dialogue/music/stitch lanes`

**Purpose:**
- Lock down Phase 1 so dialogue, music, and dialogue stitching all conform to the universal contract.

**Scope:**
- Audit current dialogue/music/stitch behavior.
- Close any remaining gaps between current structured-output handling and the universal contract.
- Ensure required fields and repair behavior are explicit.
- Update tests/docs.

**Expected outcome:**
- Phase 1 becomes fully schema-bound and consistently validated.

---

### Bead 3: Enforce schema/validator handling for Phase 2 chunk + emotion analysis lanes

**Proposed title:** `Enforce schema-bound JSON across Phase 2 chunk/emotion analysis lanes`

**Purpose:**
- Phase 2 is where we already saw placeholder fallback, no-content issues, and suspicious semantic anomalies.
- This is the highest-value next non-recommendation enforcement lane.

**Scope:**
- Audit chunk-analysis output contracts.
- Audit emotion-lenses outputs.
- Replace weak/freeform or fallback-heavy handling with explicit schema validation + retry/repair.
- Determine whether certain Phase 2 turns should use validator tools, not just direct schema checks.

**Expected outcome:**
- Phase 2 stops silently accepting malformed or semantically weak JSON structures.

---

### Bead 4: Normalize Phase 3/report output contracts beyond recommendation

**Proposed title:** `Normalize schema/validator enforcement for Phase 3 reporting lanes`

**Purpose:**
- Recommendation is strongest today, but Phase 3/reporting should be reviewed as a family so no other report-style outputs remain weaker.

**Scope:**
- Audit all Phase 3/reporting AI outputs.
- Align them to the universal contract.
- Reuse the recommendation pattern where appropriate.

**Expected outcome:**
- Phase 3 becomes consistently strict about machine-readable outputs.

---

### Bead 5: Roll the schema/validator contract into sibling repos

**Proposed title:** `Roll schema-bound JSON validation contract into sibling AI repos`

**Purpose:**
- Extend the same output-discipline to relevant sibling repos after emotion-engine is clean.

**Scope:**
- Audit sibling repos with AI calls.
- Identify where they still accept freeform or weakly validated outputs.
- Apply the shared contract and lane-specific schemas where practical.
- Update sibling-repo docs as the rollout lands.

**Expected outcome:**
- The polyrepo starts converging on one AI output discipline instead of repo-by-repo drift.

---

### Bead 6: Run a final sanity sweep for missed AI call sites and rollout gaps

**Proposed title:** `Run final emotion-engine + polyrepo sanity sweep for missed AI call sites`

**Purpose:**
- Prevent false completion.
- Explicitly verify that every remaining AI-calling script has been checked against the contract.

**Scope:**
- Scan emotion-engine and relevant sibling repos for all AI call sites.
- Compare them against the rollout coverage.
- Identify any missed scripts or weakly refactored lanes.
- Create follow-up beads if the sweep finds remaining gaps.
- Update docs/checklists so the rollout state is visible and current.

**Expected outcome:**
- We either confirm the rollout is actually complete, or we surface the exact remaining work as new beads.

---

## Recommended execution order

1. **Define the universal contract first**
2. **Finish Phase 1**
3. **Finish Phase 2**
4. **Review/normalize Phase 3 family**
5. **Roll to sibling repos**
6. **Run the final sanity sweep**

Reasoning:
- contract first prevents inconsistent lane-by-lane invention
- Phase 1 is closest to done already
- Phase 2 is the most urgent quality/integrity risk after that
- sibling rollout should come after emotion-engine’s standard is clearly settled

---

## Relationship to current queue

This plan adds new work and may overlap with or sharpen existing beads like:
- `ee-bao` — stock-assets language investigation
- `ee-58s` — provider_no_content investigation
- `ee-2fs` — recommendation grounding / hallucination audit

Those investigations still matter, but this rollout plan is about **output-contract enforcement**, not diagnosis of one anomaly. In practice, stronger schema enforcement should make those investigations easier and cleaner.

---

## Success Criteria

- We create explicit beads for each major lane family instead of hiding this behind one vague epic.
- Each bead has a clear scope and a shared contract to implement.
- The contract requires tool-mediated JSON validation for every meaningful AI lane, not merely post-response schema checking.
- Documentation updates are part of the rollout work, not deferred cleanup.
- The rollout ends with an explicit sanity sweep across emotion-engine and relevant sibling repos.
- If that sweep finds missed AI call sites, we create follow-up beads instead of declaring completion early.
- The rollout plan is specific enough to execute immediately after approval.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

**Question for Derrick:** Is this rollout plan ready for me to create as Beads and start with the universal contract bead?
