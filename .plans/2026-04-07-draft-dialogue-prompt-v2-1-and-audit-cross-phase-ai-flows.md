# emotion-engine: draft dialogue prompt v2.1 for lean runtime and audit cross-phase AI flows

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Draft a lean dialogue prompt v2.1 that assumes local validation stays on our side, update memory to point at that draft as the preferred direction, then audit AI-backed scripts across phases 1/2/3 for the same prompt-noise and tool-loop pollution pattern.

---

## Overview

Derrick approved the direction change conceptually: the dialogue prompt should get cleaner, and the runtime should stop exposing unnecessary validator/tool-loop mechanics to the model. The current approved-next draft should therefore be revised into a v2.1 variant that assumes a leaner runtime: model-facing prompt focuses on task behavior + required JSON shape, local validation remains on our side, first valid JSON should be accepted immediately, and retries should only happen when the response is invalid.

Before we implement anything, memory should point at that updated draft so the session handoff reflects the newest preferred prompt direction. After that, we should inspect the rest of the AI-backed flows across phase 1, phase 2, and phase 3 to see whether the same core design smell exists elsewhere: prompt noise, exposed tool contracts, turn-budget clutter, replayed conversation state, and redundant validate-then-resend behavior.

This lane leaves production code unchanged. It produces an updated draft prompt, updates memory/handoff toward that draft, and launches the cross-phase audit in a way that can guide a broader runtime cleanup strategy.

---

## Tasks

### Task 1: Draft dialogue prompt v2.1 for lean runtime approval

**Bead ID:** `ee-ctk8`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft a dialogue transcription prompt v2.1 for approval only. It should build on the v2 draft, but now explicitly assume a lean runtime: local validation hidden on our side, first valid JSON auto-accepted, invalid JSON corrected via a retry message rather than model-visible tool-loop mechanics. Remove any remaining dependence on model-visible validator concepts. Write the updated draft in docs/, update this plan truthfully with the doc path and key changes, and do not implement code. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt v2.1 draft written" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-draft-dialogue-prompt-v2-1-and-audit-cross-phase-ai-flows.md`
- `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`

**Status:** ✅ Complete

**Results:** Wrote the approval-only v2.1 draft at `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`.

Key changes vs v2:
- explicitly reframed the draft around a lean runtime where validation stays local, first valid JSON is auto-accepted, and invalid JSON is handled by retry message only
- removed any remaining dependence on model-visible validator/tool-contract/turn-budget/conversation-state concepts
- kept the prompt itself focused on task behavior plus the required JSON shape
- preserved the important v2 behavior guidance: anti-fusion segmentation, literal-fragment handling for damaged speech, acoustic-first speaker continuity, conservative confidence calibration, and cautious attribution

---

### Task 2: Update memory / session handoff to point at the v2.1 draft as the preferred prompt direction

**Bead ID:** `ee-3ss3`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace, update today’s memory handoff so it points at the new dialogue prompt v2.1 draft as the current preferred prompt direction for dialogue quality improvement. Keep the note concise but explicit about the lean-runtime assumptions. Update this plan truthfully with the memory path and what changed. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Memory updated to point at dialogue prompt v2.1" --json.`

**Folders Created/Deleted/Modified:**
- `memory/`
- `projects/peanut-gallery/emotion-engine/.plans/`

**Files Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/memory/2026-04-07.md`
- `.plans/2026-04-07-draft-dialogue-prompt-v2-1-and-audit-cross-phase-ai-flows.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Audit phase 1/2/3 AI-backed scripts for the same prompt-noise / tool-loop design problems

**Bead ID:** `ee-qyn0`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit AI-backed scripts across phase 1, phase 2, and phase 3 for the same core issues found in the current dialogue flow: model-visible tool-loop mechanics, prompt noise, turn-budget clutter, replayed conversation state, weak invalid-JSON retry behavior, and redundant validate-then-resend success flow. Use high-effort reasoning, leave behind a durable audit doc in docs/, and update this plan truthfully with findings and doc path. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Cross-phase AI flow audit completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/`
- `configs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-draft-dialogue-prompt-v2-1-and-audit-cross-phase-ai-flows.md`
- `docs/cross-phase-ai-flow-audit-2026-04-07.md`

**Status:** ✅ Complete

**Results:** Wrote the audit doc at `docs/cross-phase-ai-flow-audit-2026-04-07.md`.

Key findings:
- the main cross-phase problem pattern is real across loop-based AI flows: model-visible local-validator mechanics, prompt noise, turn-budget clutter, replayed tool-loop conversation state, and weak full-prompt retry behavior for invalid JSON
- the shared emotion-engine loop family (`get-dialogue`, chunked `get-music`, chunked `get-music-vocals`, `get-visual-identity`, `whole-video-mimo`) still exposes too much runtime machinery to the model, even though the newer shared loop already accepts first-valid JSON in runtime behavior
- `video-chunks` differs materially because it still uses the older sibling `tools` loop that truly retains the redundant validate-then-resend success path
- `recommendation` also differs materially because it reimplements the same older pattern in a custom local loop and still requires success-path resend behavior
- whole-asset `get-music` and whole-asset `get-music-vocals` do not share the tool-loop pollution pattern, but they do share weaker invalid-JSON retry behavior and should follow a smaller lean-repair cleanup later
- recommended direction: use the dialogue v2.1 lean-runtime approach as the common template for loop-based flows, while preserving useful semantic continuity context such as chunk handoff, rolling summaries, lyric recall scaffolding, and additive phase-1 evidence

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-04-07*