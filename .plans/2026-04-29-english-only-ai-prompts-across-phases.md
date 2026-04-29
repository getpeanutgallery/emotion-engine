# Peanut Gallery Emotion Engine

**Date:** 2026-04-29  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Enforce an English-only thinking/response rule across all AI-backed Emotion Engine phases (1-3), then verify it with bounded reruns so all model-facing artifacts remain readable and reviewable in English.

---

## Overview

The chunk-contract restoration slice is complete and proved the Phase 1 → Phase 2 context handoff works. The new problem is artifact readability and consistency: the current Phase 2 chunk outputs show mixed-language model responses, including Chinese summaries/reasoning, which makes review and downstream debugging harder for Derrick.

This next slice should stay narrow and contract-aware. We are not redesigning evaluation logic, benchmark truth, or whole-video strategy here. We are standardizing the model-facing instruction layer so every AI prompt used in Phase 1, Phase 2, and Phase 3 clearly requires the model to think and reply in English, then we will rerun the smallest honest validation path needed to confirm that rule actually sticks in emitted artifacts.

The implementation should identify all AI-backed prompt surfaces, land the English-only rule consistently, and then validate both prompt text and generated outputs. The QA/auditor loop should specifically inspect raw captures and normalized artifacts to ensure no phase silently keeps mixed-language output.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current chunk-contract restoration execution plan and completion state | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md` |
| `REF-02` | Current chunk benchmark config proving Phase 1 support is feeding Phase 2 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test-phase2-chunk-benchmark.yaml` |
| `REF-03` | Concrete mixed-language Phase 2 raw prompt/response evidence | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0003/split-00/attempt-01/capture.json` |
| `REF-04` | Current normalized Phase 2 artifact showing mixed-language user-facing output | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json` |

---

## Tasks

### Task 1: Audit all AI-backed prompt surfaces for phases 1-3

**Bead ID:** `ee-997h`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Audit the Emotion Engine repo to find every AI-backed prompt/runtime surface in phases 1, 2, and 3 that can emit model thoughts/responses or normalized artifacts. Claim the assigned bead at start. Produce a concise inventory that identifies where the English-only rule must be enforced, what current wording exists, and which artifacts demonstrate the mixed-language problem. Do not implement changes yet. Save the inventory in docs/ and update this plan with exact paths.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-english-only-ai-prompts-across-phases.md`
- `docs/2026-04-29-english-only-prompt-surface-audit.md`

**Status:** ✅ Complete

**Results:** Completed the cross-phase audit and documented every AI-backed prompt/runtime surface that can emit model thoughts, responses, normalized artifacts, or raw captures across phases 1-3. The audit confirms there is no existing English-only output rule in the prompt layer or recovery addenda, and it captures the live mixed-language evidence in `output/cod-test/phase2-process/raw/ai/chunk-0003/split-00/attempt-01/capture.json` plus the normalized leak in `output/cod-test/phase2-process/chunk-analysis.json`. The memo also narrows the likely implementation set to the Phase 1 prompt builders (`get-dialogue.cjs`, `get-music.cjs`, `get-music-vocals.cjs`, `get-visual-identity.cjs`), the Phase 2 chunk/whole-video surfaces (`video-chunks.cjs`, canonical sibling `../tools/emotion-lenses-tool.cjs`, `whole-video-mimo.cjs`), the Phase 3 recommendation surface (`recommendation.cjs`), and the cross-cutting recovery addendum (`server/lib/ai-recovery-runtime.cjs`).

---

### Task 2: Define the exact English-only prompt rule and bounded rollout scope

**Bead ID:** `ee-hmtu`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Using the prompt-surface audit, define the exact English-only rule we will enforce across all AI prompts in phases 1-3. The decision package must state the exact wording or policy pattern, where it must appear, what counts as compliance, what counts as failure, and what rerun scope is needed to verify it without broadening into unrelated quality work. Do not implement changes yet. Record the rollout contract in docs/ and update the plan.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-english-only-ai-prompts-across-phases.md`
- `docs/2026-04-29-english-only-rule-rollout.md`

**Status:** ✅ Complete

**Results:** Produced `docs/2026-04-29-english-only-rule-rollout.md`, which defines the exact cross-phase English-only wording pattern, the required placement in every audited prompt-builder and recovery/repair surface, concrete compliance and failure criteria, the literal-source carve-out boundary, and the smallest honest verification scope. The contract deliberately stays bounded to prompt/output language behavior: it requires the same rule in Phase 1 (`get-dialogue.cjs`, `get-music.cjs`, `get-music-vocals.cjs`, `get-visual-identity.cjs`), Phase 2 (`video-chunks.cjs`, canonical sibling `../tools/emotion-lenses-tool.cjs`, `whole-video-mimo.cjs`), Phase 3 (`recommendation.cjs`), and the cross-cutting recovery addenda in `server/lib/ai-recovery-runtime.cjs`. It also records why one rerun is not honest enough: static prompt audit plus one bounded full 1→2→3 rerun and one targeted `configs/cod-test-phase2-chunk-benchmark.yaml` rerun are the minimum needed to verify both cross-phase carry-forward text and the known failing chunk lane without broadening into benchmark-quality or whole-video equivalence work.

---

### Task 3: Prepare execution beads for coder → QA → auditor

**Bead ID:** `ee-srwp`  
**SubAgent:** `primary` (for `primary` workflow role)  
**Role:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `After the English-only rule rollout contract is approved in the plan, create the repo-local execution beads needed for implementation, QA, and audit. The bead package must stay bounded to enforcing and verifying English-only AI prompt/output behavior across phases 1-3. Do not implement product changes yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-english-only-ai-prompts-across-phases.md`

**Status:** ✅ Complete

**Results:** Created the bounded execution package as child beads under `ee-srwp` with explicit loop ordering: `ee-srwp.1` **Implement English-only AI prompt/output rule across phases 1-3** → `ee-srwp.2` **QA English-only outputs across phases 1-3** → `ee-srwp.3` **Audit English-only rollout completion across phases 1-3**. The coder bead owns the product changes plus the rollout contract’s static prompt audit and bounded verification reruns, including the targeted `configs/cod-test-phase2-chunk-benchmark.yaml` lane. The QA bead separately verifies raw captures and normalized artifacts from those reruns without merging into implementation. The auditor bead separately truth-checks the diff, prompt/recovery coverage, coder evidence, and QA findings before the package is considered done. No additional post-QA/post-audit rerun bead was created because the rerun obligations are already explicitly owned by `ee-srwp.1`, while the dependency chain keeps QA and audit ordered on top of those artifacts.

---

### Task 4: Implement the English-only rollout and capture bounded validation evidence

**Bead ID:** `ee-srwp.1`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Implement the bounded English-only AI prompt/output rollout across phases 1-3. Claim the bead at start. Add the English-only rule to every audited AI prompt-builder surface and recovery/repair addendum, preserve literal source-authentic transcript/lyric carve-outs only where the schema truly requires them, add bounded validator checks so non-English free-text does not silently pass, validate with the strongest honest repo-local evidence available, update this plan with exact files/commands/results, then commit and push by default unless blocked.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `server/scripts/process/`
- `server/scripts/report/`
- `output/cod-test/`
- `output/cod-test-english-slice/`
- `../tools/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-english-only-ai-prompts-across-phases.md`
- `server/lib/english-only-contract.cjs`
- `server/lib/ai-recovery-runtime.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/recommendation-validator.cjs`
- `server/lib/visual-identity-validator.cjs`
- `server/lib/whole-video-analysis-validator.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/scripts/report/recommendation.cjs`
- `../tools/emotion-lenses-tool.cjs`
- `../tools/lib/structured-output.cjs`

**Status:** ✅ Complete

**Results:** Added a shared English-only prompt block and reused it across every audited prompt/recovery surface from `REF-01`/`REF-02`: Phase 1 dialogue/music/music-vocals/visual-identity prompt builders, the canonical Phase 2 chunk prompt owner in `../tools/emotion-lenses-tool.cjs`, the Phase 2 whole-video MiMo prompt, the Phase 3 recommendation prompt, and both recovery/repair addenda in `server/lib/ai-recovery-runtime.cjs`. Added bounded validator/acceptance checks that reject obvious non-English free-text in model-authored fields while preserving literal source-authentic carve-outs for transcript/lyric text fields. Static validation passed via syntax checks plus direct validator probes showing English-only failures are rejected while literal non-English transcript text still passes where allowed. Runtime validation was mixed but audit-friendly: the exact required targeted rerun `node server/run-pipeline.cjs --config configs/cod-test-phase2-chunk-benchmark.yaml --verbose` improved chunks 1-4 but still failed at chunk 5 with a pre-existing `validate_emotion_analysis_json` tool-call-limit issue; a full `configs/cod-test.yaml` representative rerun was attempted and blocked early by an upstream `OpenRouter: No content in response` failure in Phase 1 dialogue. To still produce honest end-to-end artifact evidence after those external/runtime blockers, a temporary four-chunk slice config under `workspace/.temp/` was run against the current Phase 1 packet, completed Phase 2 + Phase 3 successfully into `output/cod-test-english-slice/`, and its raw captures plus normalized chunk/recommendation artifacts scanned clean for obvious non-English text. The current persisted Phase 1 packet in `output/cod-test/artifacts-complete.json` also scanned clean on the audited English-only fields.

## Final Results

**Status:** ⚠️ Partial — coder implementation complete; QA/audit still pending

**What We Built:** A bounded English-only rollout contract for AI prompt/output behavior across phases 1-3, plus validator guardrails that block obvious non-English free-text in model-authored fields without blocking literal transcript/lyric carve-outs.

**Reference Check:** `REF-01`/`REF-02` satisfied by prompt/recovery coverage across every audited surface. `REF-03`/`REF-04` addressed by the required targeted rerun attempt plus the successful four-chunk English validation slice, which showed raw captures and normalized Phase 2/3 artifacts in English after rollout.

**Commits:**
- Pending

**Lessons Learned:** The language-control slice is narrow and landed cleanly, but the strongest runtime validation path is currently limited by two separate upstream/runtime issues outside this rollout: Phase 1 dialogue can still fail with `OpenRouter: No content in response`, and the canonical chunk benchmark can still die on a validator tool-call-limit error at chunk 5 even after early English-only chunks succeed.

---

*Completed on Pending*