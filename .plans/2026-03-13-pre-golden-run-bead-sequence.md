---
plan_id: plan-2026-03-13-pre-golden-run-bead-sequence
bead_ids:
  - ee-1er
  - ee-9or
  - ee-03m
  - ee-0gv
  - ee-2fs
  - ee-5dv
---
# emotion-engine: pre-golden-run bead execution sequence

**Date:** 2026-03-13  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Finish the remaining high-value emotion-engine beads in Derrick’s chosen order before attempting a new full golden `cod-test` run.

---

## Overview

The recommendation-lane failure now appears materially fixed for the real Phase 3 path after raising `max_tokens` and lowering thinking intensity. But Derrick wants the rest of the important debugging/configuration groundwork finished before a fresh full run, which is the right instinct: a clean golden run is more valuable when our observability, validation, and config surfaces are in better shape.

This plan intentionally follows Derrick’s chosen order. The sequence prioritizes observability first, then error taxonomy, then input-quality/config control, then output layout cleanup, and only then a final grounding audit. That order should maximize what we learn from the eventual full rerun and reduce the chance that we need to redo artifact or debug work after the fact.

---

## Execution Order

### Task 1: Improve provider error/debug capture and normalize it across adapters

**Bead ID:** `ee-1er`  
**SubAgent:** `main`

**Why first:**
- Best leverage for all future debugging.
- OpenRouter already exposes useful structured debug/error signals we can map into a uniform internal shape.
- If we improve this first, every later lane and the eventual golden run will produce better evidence.

**Target outcome:**
- Better structured error/debug capture across providers, not just OpenRouter.
- OpenRouter-specific metadata preserved in a consistent, sanitized, reusable way.
- Emotion-engine artifacts persist the most important debug fields reliably.

**Status:** ✅ Complete

**Results:** Added shared fallback helpers in `server/lib/ai-targets.cjs` so persisted raw captures can recover `errorStatus`, `errorRequestId`, `errorClassification`, and structured `errorResponse` from either `error.response`, sanitized `error.debug.response`, or `error.debug.providerError`. Updated raw/error persistence in `server/scripts/get-context/get-dialogue.cjs`, `server/scripts/get-context/get-music.cjs`, `server/scripts/process/video-chunks.cjs`, and `server/scripts/report/recommendation.cjs` so attempt captures and phase error logs use the same normalized fallback path. Also aligned provider-option normalization where these scripts call providers (`buildProviderOptions`) and documented the new capture behavior in `docs/DEBUG-CONFIG.md`. Added focused helper coverage in `test/lib/ai-targets.test.js`, extended recommendation raw-capture coverage in `test/scripts/recommendation.test.js`, and reran the directly affected suites: `node --test test/lib/ai-targets.test.js test/scripts/recommendation.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/video-chunks.test.js` → **77 passed / 0 failed**.

---

### Task 2: Categorize recent run errors by type/frequency

**Bead ID:** `ee-9or`  
**SubAgent:** `main`

**Why second:**
- We already saw suspicious output patterns in prior runs.
- Once error/debug capture is improved, this taxonomy work becomes more informative.
- This should tell us whether token budgets, thinking controls, validation tooling, or other protections need to be generalized beyond recommendation.

**Target outcome:**
- Clear grouped view of recent failures.
- Surface weird/error-prone lanes (including any “stock footage/assets” style red flags).
- Concrete follow-up recommendations for broadening validation / token / thinking controls across the pipeline.

**Status:** ✅ Complete

**Results:** Added a repeatable analyzer at `scripts/analyze-recent-run-errors.cjs` plus an npm entrypoint `npm run analyze:recent-errors`, then generated durable checked-in reports at `docs/reports/cod-test-recent-run-error-taxonomy.md` and `docs/reports/cod-test-recent-run-error-taxonomy.json`. The scan covered 49 `capture.json` artifacts plus 7 logged error entries under `output/cod-test/**`. The dominant hard-failure bucket was **provider_no_content** (11, all in `phase2-process`, all from `qwen/qwen3.5-397b-a17b`). The next major hard-failure buckets were **placeholder_fallback** (3, Phase 2 structured-output parse failures across Gemini Pro + GLM) and **invalid_json** (3, Phase 3 recommendation failures, including the recent 2026-03-13 reruns). The recommendation reruns also showed explicit **token/thinking-budget coupling**: attempts 02 and 03 hit `MAX_TOKENS` at `max_tokens=900` while spending 861/896 and 863/896 completion tokens on reasoning, which strongly supports generalizing token budgets and stricter thinking defaults across strict-JSON lanes. The report also surfaced a real semantic anomaly cluster: **13 stock-assets / corporate-footage style outputs**, concentrated in late Phase 2 chunk summaries and one recommendation artifact, which should be treated as a grounding-review signal rather than automatically trusted fact. Verification run: `node scripts/analyze-recent-run-errors.cjs` ✅.

---

### Task 3: Move FFmpeg compression settings into YAML

**Bead ID:** `ee-03m`  
**SubAgent:** `main`

**Why third:**
- Input quality directly affects hallucination risk and persona output quality.
- Derrick needs explicit control over compression/quality in YAML before the next serious run.
- This is foundational config work that should be settled before another golden-run attempt.

**Target outcome:**
- FFmpeg quality/compression knobs exposed and documented in YAML.
- Config becomes the canonical source of truth for media preprocessing quality.
- Reduced ambiguity around whether bad inputs are contributing to bad AI outputs.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Rethink run-root raw folder layout

**Bead ID:** `ee-0gv`  
**SubAgent:** `main`

**Why fourth:**
- This is investigation + cleanup that affects how we reason about outputs and debug artifacts.
- Better to settle the layout before the next full run if we are going to change it.
- Avoids doing a golden run into a structure we already suspect is confusing.

**Target outcome:**
- Decide whether run-level raw artifacts stay where they are or move.
- If changed, document and implement the migration carefully.
- Clarify run-level vs phase-level artifact responsibilities.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Audit recommendation grounding / hallucination risk

**Bead ID:** `ee-2fs`  
**SubAgent:** `main`

**Why fifth:**
- Derrick expects earlier work may reduce or eliminate this concern.
- Best to do this after observability, error taxonomy, config control, and artifact-structure cleanup are in place.
- If the issue remains, we’ll have stronger tooling and cleaner artifacts to diagnose it properly.

**Target outcome:**
- Confirm whether recommendation claims are grounded in the real inputs.
- If not, identify exactly where grounding breaks.
- Decide whether the next golden run is trustworthy enough or needs one more fix.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 6: Reassess for new beads, then run the next golden test

**Bead ID:** `ee-5dv` (reassessment / closure gate)  
**SubAgent:** `main`

**Why last:**
- After the ordered beads above, we pause and check whether new work was discovered.
- If no important new blockers appear, we proceed to the next full golden run.
- At that point `ee-5dv` should either close cleanly or split into any newly discovered residual issue.

**Target outcome:**
- Explicit go/no-go decision for the next full `cod-test` run.
- No surprise “we should have fixed this first” leftovers.

**Status:** ⏳ Pending

**Results:** Pending.

---

## Derrick’s Rationale Captured

- `ee-1er`: observability first, using OpenRouter’s existing structure as a strong source of truth for our own normalized error/debug model.
- `ee-9or`: recent run outputs contained suspicious signals, and this pass may reveal that token/thinking/validation controls should be generalized across all AI calls.
- `ee-03m`: FFmpeg/media quality must be YAML-controlled so low-quality inputs do not poison downstream persona outputs.
- `ee-0gv`: artifact-layout confusion should be resolved before another full-from-scratch run.
- `ee-2fs`: likely reduced by earlier fixes, and if still present after them, we’ll have better evidence to diagnose it.

---

## Success Criteria

- We execute the remaining beads in Derrick’s chosen order.
- We do not start a new golden run until this ordered prework is complete or explicitly reprioritized.
- We reassess whether any new beads were created before triggering the next full run.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

**Question for Derrick:** Is this execution order plan ready to start with `ee-1er`?
