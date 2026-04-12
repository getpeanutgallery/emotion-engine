# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Harden the dialogue prompt / JSON contract so Gemini can reliably emit schema-valid dialogue transcription output, then rerun the Gemini dialogue-only compare lane to see whether it becomes benchmarkable and competitive against the human-verified truth.

---

## Overview

The current Gemini lane appears to fail for two interacting reasons: provider/transport instability and prompt/schema ambiguity. The most actionable lever on our side is the dialogue contract itself, especially the shape expectations around `acoustic_descriptors`, where Gemini oscillated between plain strings and object forms using `value` instead of the required `label` field.

This plan keeps scope intentionally narrow. We are not trying to redesign the full dialogue pipeline or compare models again from scratch. We are trying to make the dialogue JSON shape unmistakable, add regression coverage that proves the intended structure, and rerun the Gemini dialogue-only config under the hardened contract. If the rerun still fails, the remaining blame shifts more credibly toward transport/provider instability rather than our prompt ergonomics.

---

## Tasks

### Task 1: Audit current dialogue prompt + schema contract for ambiguous shape language

**Bead ID:** `ee-t2u4`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-t2u4` with `bd update ee-t2u4 --status in_progress --json`, inspect the current dialogue prompt, validator expectations, and any recovery/tool-loop guidance used by the dialogue transcription lane. Identify every place the expected JSON shape is ambiguous or inconsistent, especially around `acoustic_descriptors`, document exactly what needs to change, then close the bead with `bd close ee-t2u4 --reason "Audited dialogue prompt/schema ambiguity for Gemini JSON failures" --json`.

**Folders Created/Deleted/Modified:**
- `server/`
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-gemini-dialogue-json-contract-audit.md`

**Status:** ✅ Complete

**Results:** Completed an end-to-end contract audit across `get-dialogue` prompts, structured validator rules, local lean repair loop behavior, and prompt-facing docs/tests. Found a primary blocker: both whole/chunk prompt examples use `acoustic_descriptors` as string arrays while the validator requires object entries with required `label` (plus optional `confidence`). Logged exact file/line references and concrete wording changes to harden the canonical JSON shape.

---

### Task 2: Harden prompt wording and any supporting schema examples for canonical JSON shape

**Bead ID:** `ee-juas`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-juas` with `bd update ee-juas --status in_progress --json`, update the dialogue prompt/contract so the canonical JSON structure is explicit, especially for `acoustic_descriptors`. Make it clear which object keys are required, forbid ambiguous alternates like `value` when `label` is required, tighten any recovery guidance so retries converge on the same shape, then close the bead with `bd close ee-juas --reason "Hardened dialogue prompt JSON contract for canonical shape" --json`.

**Folders Created/Deleted/Modified:**
- `server/`
- `docs/`
- `test/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md`
- `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Hardened the dialogue JSON contract to a single canonical `acoustic_descriptors` shape across prompt examples, speaker-profile rules, validator strictness, and validator-tool contract text. Whole/chunk prompts now require object entries with required `label`, explicitly reject plain string items and alternate keys (`value`, `descriptor`, `acousticDescriptors`), and include retry guidance that rewrites descriptors into the canonical object form. Tightened validator behavior to reject those alias keys instead of silently accepting them. Updated adjacent prompt draft docs to remove outdated string-array examples. Added prompt assertion coverage for the new canonical-shape instructions. Verified with `node --test test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js` (pass).

---

### Task 3: Add or update regression tests for the hardened dialogue JSON contract

**Bead ID:** `ee-6uc6`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-6uc6` with `bd update ee-6uc6 --status in_progress --json`, add focused tests that prove the hardened contract rejects ambiguous `acoustic_descriptors` shapes and accepts the intended canonical structure. Cover the exact failure family seen in the Gemini lane where practical, then close the bead with `bd close ee-6uc6 --reason "Added regression tests for dialogue JSON contract hardening" --json`.

**Folders Created/Deleted/Modified:**
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `test/lib/phase1-validator-tools.test.js`
- `.plans/2026-04-10-gemini-dialogue-json-contract-hardening.md`

**Status:** ✅ Complete

**Results:** Added focused validator regression coverage for the hardened descriptor contract:
- canonical `grounded.acoustic_descriptors` object entries with required `label` are accepted
- plain string descriptor entries are rejected with `invalid_type`
- disallowed alias keys are rejected (`value`, `descriptor`, `acousticDescriptors`)
- explicit Gemini failure-family oscillation is covered (attempt-style payloads moving from string descriptors to object entries with `value` but missing `label`)

Validation run:
- `node --test test/lib/phase1-validator-tools.test.js` (pass, 20/20)
- `node --test test/scripts/get-dialogue.test.js` (pass, 36/36)

---

### Task 4: Rerun Gemini dialogue-only compare lane under the hardened contract

**Bead ID:** `ee-p9kt`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-p9kt` with `bd update ee-p9kt --status in_progress --json`, run `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml` after the contract hardening. Capture whether `get-dialogue` completes, whether a valid `dialogue-data.json` artifact is produced, whether benchmark/report phases run, and what remaining failures (if any) occur, then close the bead with `bd close ee-p9kt --reason "Reran Gemini dialogue-only compare after contract hardening" --json` if successful.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `.tmp/`

**Files Created/Deleted/Modified:**
- rerun logs and output artifacts

**Status:** ❌ Failed (pipeline-level)

**Results:** Reran with the repo’s standard env-load wrapper (`unset DIGITAL_TWIN_* OPENROUTER_TIMEOUT_MS || true; set -a; [ -f .env ] && . ./.env; set +a; npm run pipeline -- --config ... --verbose`).

Observed behavior:
- `get-dialogue` **completed successfully** (`whole_asset`) and wrote `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json` with 32 segments.
- The produced `dialogue-data.json` is **valid under local schema validation** (`validateDialogueTranscriptionObject(..., { requireHandoff: false })` returned `ok: true`, `errorCount: 0`).
- Benchmark/report did **not** run to completion. Pipeline failed in benchmark stage with:
  - `Produced artifact missing for musicData: .../phase1-gather-context/music-data.json`
- Remaining blocker is **other/config contract mismatch** (benchmark fixture expects additional artifacts such as `musicData` that this dialogue-only lane does not produce), **not** a transport/provider failure and **not** the Phase-1 dialogue JSON schema/tool-loop failure family for this rerun.

Evidence:
- Log: `.logs/20260410-131056-cod-dialogue-compare-gemini-3.1-pro-preview-ee-p9kt.log`
- Archived prior output: `output/_archives/cod-dialogue-compare-gemini-3.1-pro-preview-pre-ee-p9kt-20260410-131056`

---

### Task 5: Compare the hardened Gemini rerun against prior MiMo and GPT Audio results

**Bead ID:** `ee-0lsh`  
**SubAgent:** `primary`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-0lsh` with `bd update ee-0lsh --status in_progress --json`, compare the hardened Gemini rerun with the existing MiMo and GPT Audio dialogue-only outputs against the human-verified truth. Determine whether Gemini is now rankable, whether it actually improved, and whether the prompt hardening solved the dominant failure mode, then close the bead with `bd close ee-0lsh --reason "Compared hardened Gemini rerun vs MiMo and GPT Audio" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- durable comparison/investigation summary as needed
- this plan file

**Status:** ✅ Complete

**Results:** Compared hardened Gemini output against MiMo and GPT Audio versus human truth and documented findings in `docs/research/2026-04-10-gemini-rerun-dialogue-vs-mimo-gpt-audio.md`.

Key determinations:
- Gemini is now rankable (valid dialogue artifact produced).
- Prompt hardening solved the dominant prior JSON/tool-loop failure mode.
- On dialogue-line closeness to truth, Gemini now lands ahead of MiMo and GPT Audio, with a major caveat: Gemini still has the worst lyric contamination injected into dialogue segments.

---

## Final Results

**Status:** ⏳ Draft

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-10*
