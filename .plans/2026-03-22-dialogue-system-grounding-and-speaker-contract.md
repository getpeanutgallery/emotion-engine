# emotion-engine: dialogue system grounding and speaker contract

**Date:** 2026-03-22  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Resume the emotion-engine dialogue-system lane by fixing Phase 1 speaker attribution so dialogue context is more grounded, more truthful about capability limits, and more useful downstream in Phase 2/Phase 3 review.

---

## Overview

We are picking up from the 2026-03-20 clean `cod-test` acceptance pass and the 2026-03-21 human review / follow-up execution lane. That review confirmed a real dialogue-system problem: some consecutive lines in the persisted Phase 1 dialogue context are misattributed to the same speaker even when different people are talking. The strongest validated product output so far is still the recommendation layer, but the dialogue/speaker layer needs a more grounded contract before we should trust it as canonical context.

Derrick clarified the desired product behavior for this lane: Phase 1 dialogue output should expose richer speaker context that can be passed into Phase 2 chunk review, so the persona has better grounding about who is speaking each line and what can be cautiously inferred about that speaker. Some inferred traits — including age, ethnicity, gender, accent, personality-style cues, and similar descriptors — are considered potentially useful, but they must be explicitly framed as guesswork / inferred / non-authoritative rather than truth. That means this lane needs two things at once: a solid grounded mainline contract for speaker identity/linkage, and a clearly labeled speculative layer for inferred traits when present.

Validation should happen in two stages. First, run a modified `cod-test` config that performs only Phase 1 gather-context so Derrick can inspect the dialogue and music outputs together. If that looks good, run another modified `cod-test` config that completes only three Phase 2 video chunks, then compare those outputs against the original stored run to see whether the new dialogue/music context actually changes persona reasoning in useful ways. In parallel, we should explicitly evaluate whether the current `30s` music analysis window is the right semantic granularity, or whether it should move closer to the `5s` video chunk cadence while still preserving an overall trailer-wide music summary.

Task 1 investigation confirmed the owning fix surface is entirely inside `emotion-engine` itself, not a sibling polyrepo package. The persisted contract is produced in `server/lib/structured-output.cjs`, emitted by `server/scripts/get-context/get-dialogue.cjs`, and consumed downstream in `server/scripts/process/video-chunks.cjs`. No sibling package refresh was needed.

---

## Tasks

### Task 1: Reconstruct the live dialogue-system truth and implement the richer Phase 1 speaker contract

**Bead ID:** `ee-tad`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-tad with bd update ee-tad --status in_progress --json, then trace the current Phase 1 dialogue/speaker pipeline end-to-end. Use the reviewed cod-test artifacts plus the completed ee-l63 research findings to define and implement the truthful speaker contract we should emit now for downstream Phase 2 use. The output should preserve grounded speaker identity/linkage (anonymous speaker IDs, same-speaker linkage, cautious acoustic descriptors, confidence/abstain behavior) while also supporting an explicit speculative layer for inferred traits such as age, ethnicity, gender, accent, personality-style cues, and similar descriptors when useful. Those inferred traits must be clearly labeled as inferred/guesswork/non-authoritative, not blended into the core speaker identity contract, and should support abstention/confidence. Do not modify anything under node_modules. If the owning fix surface lives in a sibling polyrepo, make the change there, commit and push in the owning repo, then refresh/update emotion-engine packages cleanly as needed. Identify the smallest owning implementation surface, land the source-owned changes, add/adjust tests, and close ee-tad with a precise reason when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `server/scripts/process/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`
- `server/lib/structured-output.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/process/video-chunks.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/video-chunks.test.js`

**Status:** ✅ Complete

**Results:** Traced the live path end-to-end (`structured-output.cjs` → `get-dialogue.cjs` persisted `dialogue-data.json` → `video-chunks.cjs` Phase 2 prompt input) and implemented the richer speaker contract in-repo.

Delivered contract shape:
- `dialogue_segments[*].speaker_id` now carries a persisted anonymous same-speaker ID alongside the existing human-readable `speaker` label.
- `speaker_profiles[*]` now persists grounded speaker linkage separately from speculative traits:
  - `grounded.confidence` + `grounded.confidence_abstained`
  - `grounded.linked_segment_indexes` for explicit same-speaker linkage
  - `grounded.acoustic_descriptors` + `grounded.acoustic_descriptors_abstained`
  - `inferred_traits.disclaimer`, `inferred_traits.traits[]`, and `inferred_traits.abstained`
- The validator/normalizer auto-generates stable anonymous IDs and abstaining speaker profiles even when the model only returns the legacy minimal segment shape, so old/simple model outputs still land as the new truthful contract.
- Prompt instructions for both whole-file and chunked dialogue extraction now explicitly separate grounded identity from inferred guesswork and tell the model to abstain when uncertain.
- Chunked/stitch dialogue outputs are normalized through the same contract before persistence so Phase 1 outputs stay consistent across both execution paths.
- Phase 2 now receives both overlapping dialogue segments and the full grounded `speaker_profiles` collection via `dialogueContext.speakers` for downstream use in ee-9bh / ee-0ky validation.

Tests run:
- `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-dialogue.test.js test/scripts/video-chunks.test.js`
- `npm test`

Results:
- Both test runs passed.
- Full repo suite result: `309` passing, `0` failing.
- No `node_modules` edits were made.
- No sibling polyrepo/package refresh was required.
- Ready for `ee-9bh`: the next task can now run a Phase 1-only cod-test and inspect the new persisted dialogue/music artifacts with the richer speaker contract in place.

---

### Task 2: Run a Phase 1-only cod-test validation for dialogue + music review

**Bead ID:** `ee-9bh`  
**SubAgent:** `primary`  
**Prompt:** `After Task 1 lands, create or claim the needed bead, then run a modified cod-test config that performs only the Phase 1 gather-context work needed to emit dialogue and music artifacts for review. Preserve exact config/file changes, output paths, and log paths. Compare the new dialogue and music artifacts against the previous known run where useful, and capture the review packet in the plan so Derrick can inspect both together. Close the bead only after the Phase 1-only validation artifacts are generated and documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- modified or new Phase 1-only cod-test config
- validation artifacts to be determined
- `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Run a 3-chunk Phase 2 comparison against the original stored cod-test run

**Bead ID:** `ee-0ky`  
**SubAgent:** `primary`  
**Prompt:** `If the Phase 1-only dialogue/music review passes, create or claim the needed bead, then run a modified cod-test config that processes only three Phase 2 video chunks. Compare the resulting chunk prompts/outputs against the original stored run and determine whether the new dialogue/music context is actually being consumed and whether it changes persona judgments in a useful, more grounded way. Preserve exact config paths, logs, output paths, and comparison notes in the plan. Close the bead only after the before/after comparison is documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- modified or new 3-chunk cod-test config
- comparison artifacts to be determined
- `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Decide whether music analysis should stay at 30s windows or move closer to 5s chunk cadence

**Bead ID:** `ee-9hk`  
**SubAgent:** `coder`  
**Prompt:** `During or after the validation passes, create or claim the needed bead and evaluate whether the current 30-second music analysis windows are the right semantic granularity for Phase 2 chunk review, or whether music should move closer to the 5-second video chunk cadence while still retaining an overall trailer-wide music summary. Use evidence from the new validation artifacts, implementation cost, prompt utility, and likely signal quality to recommend a durable direction. If a small safe implementation change is clearly justified, note it; otherwise capture the decision and rationale for a later lane.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- music pipeline files to be determined

**Files Created/Deleted/Modified:**
- analysis or implementation files to be determined
- `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Optional follow-up — beta inferred speaker traits experiment

**Bead ID:** `ee-avf` (blocked on `ee-tad`)  
**SubAgent:** `coder`  
**Prompt:** `Only if Derrick still wants a separate beta experiment after the grounded speaker-contract work is complete: claim bead ee-avf with bd update ee-avf --status in_progress --json, then refine the inferred speaker traits layer in Phase 1 dialogue context. Keep it clearly marked as inferred/assumed/non-authoritative, include confidence and abstention, and ensure it remains separate from the core grounded speaker identity contract. Add tests and documentation, then close ee-avf with an exact reason when complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- dialogue pipeline files to be determined

**Files Created/Deleted/Modified:**
- beta-traits implementation/test files to be determined
- `.plans/2026-03-22-dialogue-system-grounding-and-speaker-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Task 1 landed the grounded/speaker-contract implementation inside `emotion-engine`. Phase 1 dialogue artifacts now persist anonymous speaker IDs, explicit same-speaker linkage, cautious acoustic descriptor handling with abstention, and a clearly separated speculative `inferred_traits` layer. Phase 2 prompt-building now receives those speaker profiles as structured context. Remaining plan work is the validation/execution follow-through in `ee-9bh`, `ee-0ky`, and `ee-9hk`.

**Commits:**
- `83d59a0` - Add grounded dialogue speaker contract

**Lessons Learned:** The most durable truth boundary is not “ask the model for demographic facts,” it is “persist grounded anonymous linkage by default, and force anything trait-like into an explicitly speculative lane with abstention.” That keeps the current system honest while still making future downstream experimentation possible.

---

*Started on 2026-03-22*
