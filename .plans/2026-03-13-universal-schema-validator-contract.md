# emotion-engine: define universal schema/validator contract for AI lanes

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Define the universal contract every meaningful AI lane in emotion-engine should follow for machine-readable outputs: JSON-only expectation, lane-specific schema validation, retry/repair behavior, diagnostics/raw capture, documentation requirements, and rules for when tool-mediated validation is required versus direct schema validation.

---

## Overview

emotion-engine already had strong pieces in place before this bead: shared JSON parsing/repair, lane-specific validators for several lanes, consolidated target retry/failover handling, and rich raw capture in the strictest paths. What it lacked was one durable, repo-level statement of the contract tying those pieces together and classifying which current lanes are merely close versus actually done.

The audit confirmed that different lanes do need different schemas, but they should not need different philosophies. The shared philosophy is now documented as a repo contract: every structured AI lane must ask for JSON-only output, validate against a lane-specific schema, surface shared parse/validation diagnostics, feed invalid output through retry/repair, preserve raw evidence when debug capture is enabled, and document which enforcement level it uses.

The biggest architectural distinction is now explicit: **direct schema validation** is the default for single-shot structured lanes, while **tool-mediated validation** is reserved for higher-risk outputs where acceptance should depend on an inner local-validator loop before final submission. Recommendation remains the reference implementation for that stricter pattern.

---

## Audit findings

### Current meaningful AI lanes in emotion-engine

1. **Phase 1 dialogue transcription** (`server/scripts/get-context/get-dialogue.cjs`)
   - Whole-file and chunk transcription paths both use `parseAndValidateJsonObject(...)` with `validateDialogueTranscriptionObject(...)`
   - Invalid output becomes retryable failure with structured diagnostics
   - Raw capture persists attempt payloads when `debug.captureRaw: true`
   - **Classification:** Level 2 — direct schema validation with retry
   - **Status:** Partial

2. **Phase 1 dialogue stitch** (`server/scripts/get-context/get-dialogue.cjs`)
   - Uses `validateDialogueStitchObject(...)`
   - Structured parse/validation + retry path exists
   - Raw capture + prompt references are already present
   - **Classification:** Level 2 — direct schema validation with retry
   - **Status:** Partial

3. **Phase 1 music analysis** (`server/scripts/get-context/get-music.cjs`)
   - Uses `validateMusicAnalysisObject(...)`
   - Invalid output becomes retryable failure with validation summary
   - Raw capture is present
   - Still carries legacy-format compatibility / older weaker helper code in the file
   - **Classification:** Level 2 — direct schema validation with retry
   - **Status:** Partial

4. **Phase 2 video chunk emotion analysis** (`server/scripts/process/video-chunks.cjs`, `server/lib/emotion-lenses-tool.cjs`)
   - Uses `validateEmotionStateObject(...)` through the tool helper
   - Invalid output is retried through consolidated AI target handling
   - Raw capture is present
   - Enforcement is still split across shared validator output plus lane-local checks like `getSchemaFailureReason(...)` and chunk-status gates
   - **Classification:** Level 2 — direct schema validation with retry
   - **Status:** Follow-up needed

5. **Phase 3 recommendation** (`server/scripts/report/recommendation.cjs`)
   - Uses strict lane schema validator + explicit local validator tool contract
   - Includes tool loop, validator-call budgets, and final-artifact revalidation
   - Richest raw capture of provider boundary + validator state
   - **Classification:** Level 3 — tool-mediated validation / repair loop
   - **Status:** Compliant

### Important non-findings / boundaries

- `get-metadata.cjs` is not an AI lane; it is ffprobe-based and out of scope.
- Report scripts such as `emotional-analysis.cjs`, `metrics.cjs`, `summary.cjs`, and `final-report.cjs` are currently computed / synthesis scripts, not additional structured AI lanes in scope for this bead.
- Some older weaker parser helpers remain in files (notably in `get-music.cjs` and `get-dialogue.cjs`), but they are not the main active enforcement path for the audited structured lanes.

---

## Tasks

### Task 1: Audit current enforcement patterns across emotion-engine AI lanes

**Bead ID:** `ee-qqg`  
**SubAgent:** `main`  
**Prompt:** `You are executing bead ee-qqg in /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine. Claim it immediately with \`bd update ee-qqg --status in_progress --json\`. Audit the current AI lanes in emotion-engine and classify their current enforcement level: plain JSON prompt only, schema validation with retry, validator-tool mediated repair loop, or weaker/freeform handling. Record that audit in the active plan before defining the universal contract.`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-universal-schema-validator-contract.md`
- `docs/AI-LANE-CONTRACT.md`

**Status:** ✅ Complete

**Results:** Audited all meaningful AI lanes. Recommendation is the only current Level 3 tool-mediated lane. Dialogue transcription, dialogue stitch, and music are Level 2 but still partial because the contract was not durably documented and some legacy compatibility/weaker helpers remain. Video chunk emotion analysis is Level 2 but needs explicit normalization because enforcement is split across shared and local checks.

---

### Task 2: Define the universal contract and enforcement levels

**Bead ID:** `ee-qqg`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-qqg, define the universal schema/validator contract for emotion-engine AI lanes. Specify: required JSON-only expectation, lane-specific schema requirement, shared validation diagnostics, retry/repair expectations, raw capture expectations, documentation requirements, and explicit enforcement levels for when direct schema validation is sufficient versus when tool-mediated validation should be mandatory. Write this in durable repo documentation and summarize it in the active plan.`

**Files Created/Deleted/Modified:**
- `docs/AI-LANE-CONTRACT.md`
- `README.md`
- `.plans/2026-03-13-universal-schema-validator-contract.md`

**Status:** ✅ Complete

**Results:** Added `docs/AI-LANE-CONTRACT.md` as the durable repo contract. It defines the universal invariants, enforcement levels (Level 0-3), required diagnostics/raw capture, retry/repair expectations, documentation obligations, and explicit rules for when direct schema validation is sufficient versus when tool-mediated validation is required.

---

### Task 3: Map existing lanes to the new contract and identify rollout gaps

**Bead ID:** `ee-qqg`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-qqg, map the existing emotion-engine AI lanes to the new universal contract: identify which lanes already comply, which partially comply, and which require follow-up in the Phase 1 / Phase 2 / Phase 3 / sibling rollout beads. Make the mapping concrete enough that later beads can be executed without re-inventing scope.`

**Files Created/Deleted/Modified:**
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-universal-schema-validator-contract.md`

**Status:** ✅ Complete

**Results:** Added a concrete lane mapping to the contract doc and this plan:
- **Compliant:** recommendation
- **Partial:** dialogue transcription, dialogue stitch, music
- **Follow-up needed:** video chunk emotion analysis

This now gives the downstream Phase 1 / Phase 2 rollout beads a concrete target state instead of a vague “tighten JSON” mandate.

---

### Task 4: Verify documentation clarity and close the bead

**Bead ID:** `ee-qqg`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-qqg, verify that the written contract is concrete enough to drive the downstream rollout beads and the final sanity sweep. Ensure docs are current, the active plan records the enforcement model and lane mapping, and close ee-qqg with \`bd close ee-qqg --reason "Universal schema/validator contract defined for AI lanes" --json\`.`

**Files Created/Deleted/Modified:**
- `docs/AI-LANE-CONTRACT.md`
- `README.md`
- `.plans/2026-03-13-universal-schema-validator-contract.md`

**Status:** ✅ Complete

**Results:** Verified the contract is specific enough to drive the remaining rollout beads and the final sanity sweep. No golden run was started. README now points to the new contract doc.

---

## Success Criteria

- A written universal contract exists for AI lane output enforcement. ✅
- It clearly separates shared infrastructure from lane-specific schemas/tools. ✅
- It defines when tool-mediated validation is required versus when direct schema validation is acceptable. ✅
- It includes documentation expectations. ✅
- It maps current lanes to compliance levels so downstream beads have concrete scope. ✅

---

## Constraints

- This bead defines the contract; it does not try to finish the entire rollout itself. ✅ honored
- The contract must be practical enough to support the final sanity sweep. ✅ met
- Do not start a golden run in this lane. ✅ no golden run started

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A durable repo contract for structured AI lanes in `docs/AI-LANE-CONTRACT.md`, plus a concrete audit of current emotion-engine lanes and their enforcement status.

**Current lane mapping:**
- **Recommendation:** compliant / Level 3 / tool-mediated validator loop
- **Dialogue transcription:** partial / Level 2 / direct schema validation with retry
- **Dialogue stitch:** partial / Level 2 / direct schema validation with retry
- **Music:** partial / Level 2 / direct schema validation with retry
- **Video chunk emotion analysis:** follow-up needed / Level 2 / direct schema validation with retry, but still split across shared + local enforcement

**Docs updated:**
- `docs/AI-LANE-CONTRACT.md`
- `README.md`
- `.plans/2026-03-13-universal-schema-validator-contract.md`

**Commits:**
- Not created in this bead.

**Lessons Learned:** The repo was already closer to a universal contract than it looked; the missing piece was not only code hardening but writing down the enforcement levels and making explicit that lane-specific schemas are mandatory while retry/diagnostics/raw-capture behavior should stay shared.

---

*Completed on 2026-03-13*