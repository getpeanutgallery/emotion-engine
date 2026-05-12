# emotion-engine: draft dialogue prompt v2 for approval

**Date:** 2026-04-07  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Draft a cleaner dialogue transcription prompt v2 that reduces prompt noise and adds explicit anti-fusion, literal-fragment, and cautious speaker-attribution guidance, then send that draft to Derrick for approval before any implementation.

---

## Overview

The current persisted runtime prompt is under-specified on the behavior we actually care about and over-specified on tool/validator mechanics. Derrick reviewed the raw prompt and correctly identified the likely noise after `Final artifact reminders:` — especially `Tool contract:`, `Current turn budget:`, and `Conversation state:` — as distracting prompt baggage rather than useful task guidance.

This lane should not edit production code yet. First, produce a candidate prompt v2 that keeps only the minimum necessary output contract while making the actual task behavior explicit: preserve utterance boundaries, avoid bridging across pauses, prefer literal fragments over polished reconstruction, keep speaker attribution conservative in overlap-heavy material, and calibrate confidence honestly. Then present that draft to Derrick for approval.

The output should be a durable draft doc plus a compact rationale explaining what changed and why. After approval, a separate implementation lane can wire the draft into the real prompt path and rerun cod-test.

---

## Tasks

### Task 1: Draft a cleaner dialogue prompt v2 and rationale for approval

**Bead ID:** `ee-fgi9`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft a new dialogue transcription prompt v2 for approval only (do not implement it). Base it on the reviewed runtime prompt and the observed dialogue failure modes: fused adjacent beats, over-smoothed damaged lines, overconfident speaker attribution, and collapsed speaker buckets. The new draft should remove or minimize prompt noise, keep only the essential output contract, and add explicit anti-fusion / literal-fragment / cautious-attribution guidance. Write the draft prompt plus a short rationale in a durable doc under docs/, and update this plan truthfully with the doc path and what changed. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt v2 draft written for approval" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-draft-dialogue-prompt-v2-for-approval.md`
- `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`

**Status:** ✅ Complete

**Results:** Reviewed the active plan, the prompt-review doc at `docs/dialogue-prompt-review-2026-04-07.md`, and the current whole-file / chunked prompt text in `server/scripts/get-context/get-dialogue.cjs`. Wrote the approval-only draft prompt and rationale to `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`. The draft intentionally removes wrapper/tool-loop noise, keeps only the essential JSON contract, and adds explicit rules for beat-boundary preservation, literal damaged-speech fragments, acoustic-first speaker separation, and conservative confidence calibration. No production code was changed and no implementation was attempted in this lane.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** An approval-only durable draft of a cleaner dialogue transcription prompt v2 at `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`. The proposed prompt trims prompt noise, preserves the minimum output contract, and adds explicit behavior rules for anti-fusion, damaged-line literal fragments, cautious acoustic speaker attribution, and honest confidence calibration.

**Commits:**
- None in this lane.

**Lessons Learned:** The highest-value prompt improvements are behavioral, not structural: the current lane mostly needs clearer instructions about segment boundaries, damaged audio, acoustic speaker continuity, and uncertainty. The reviewed runtime wrapper likely carries extra noise after `Final artifact reminders:` that should stay minimized when this draft is implemented.

---

*Drafted on 2026-04-07*