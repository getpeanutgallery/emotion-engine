# Emotion Engine

**Date:** 2026-04-13  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Record the high-level architectural pivot away from model-assigned speaker identities and toward a generic, closed-schema dialogue traits contract plus a deterministic speaker-grouping pass.

---

## Overview

After reviewing the recent Gemini continuity iteration work, Derrick decided the next major direction should not be another narrow prompt-only attempt to make the dialogue model manage persistent speaker identities directly. The core issue is architectural: the dialogue model is producing strong dialogue text, but it is being asked to do several jobs that are better split apart.

The new direction is to keep the dialogue model generic and asset-agnostic. Instead of asking it to emit `speaker_id` assignments, the dialogue model should emit a per-line `traits` object inside `dialogue-data.json`. That `traits` object will use a strict, closed JSON contract with explicitly allowed values so the model is never guessing the vocabulary. Invalid key/value combinations should be rejected loudly by validation and retried, similar to malformed JSON handling today.

A new deterministic Phase 1 script will later consume `dialogue-data.json`, use the per-line `traits` data plus a separately versioned YAML heuristics/rules file, and produce speaker grouping / `speaker_id` results. The weighting logic belongs entirely to the deterministic layer, not to the dialogue prompt. This preserves genericity, supports benchmark-driven tuning, and lets future iteration happen through versioned heuristics experiments rather than fragile identity-prompt wording.

This plan intentionally stops at the pivot decision and high-level architecture. Detailed contract design, implementation planning, and test-loop planning are deferred to a later session.

---

## Key Decisions Captured

- Pivot away from model-authored speaker identity assignment.
- Keep the dialogue model focused on line extraction plus per-line speaker `traits` description.
- Remove the concept of speaker identities from the dialogue AI model script.
- `dialogue-data.json` should move toward a shape like:

```json
{
  "index": 0,
  "text": "They want you afraid.",
  "traits": {}
}
```

- The exact `traits` JSON shape is the next design problem.
- The schema must be closed and explicit: allowed variables and values should be obvious to the model.
- Do not ask the model to weight traits or signal importance between fields.
- Do not include a model confidence value in this version.
- Invalid schema values should fail loudly and trigger retry/recovery.
- A new deterministic Phase 1 `get-speakers`-style script should own speaker grouping.
- Heuristic weights/rules should live outside the script in a versioned YAML file so they can be cloned, tuned, benchmarked, archived, and rerun cleanly.
- Benchmark-driven iteration over heuristics is the intended long-term improvement path.
- Reconciliation remains responsible for combining Phase 1 outputs before Phase 2; `get-speakers` does not need to solve music-vocals concerns directly.
- The important takeaway right now is the architectural pivot, not implementation details.

---

## Tasks

### Task 1: Capture the pivot and defer implementation planning

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** Pending next-session approval.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

**Status:** ✅ Complete

**Results:** Captured the high-level pivot: dialogue model emits per-line `traits`; deterministic heuristics/YAML later assign speaker identities; implementation planning explicitly deferred.

---

### Task 2: Design the closed `traits` contract for `dialogue-data.json`

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** In the next session, define the exact `traits` object shape, allowed fields, allowed values, abstention/unknown handling, and validation contract for `dialogue-data.json` without introducing weighting semantics into the model prompt.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- future contract docs to be determined

**Status:** ⏳ Pending

**Results:** Deferred to next session.

---

### Task 3: Design deterministic speaker-grouping architecture

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** In the next session, design the new deterministic speaker-grouping script, the `speaker-data.json` ownership boundary, and the external YAML heuristics/rules format for replayable benchmark tuning.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`
- future Phase 1 script/config paths

**Files Created/Deleted/Modified:**
- future architecture docs to be determined

**Status:** ⏳ Pending

**Results:** Deferred to next session.

---

## Final Results

**Status:** ⚠️ Pivot recorded; implementation planning deferred

**What We Built:** A durable plan record of the architecture pivot away from model-authored speaker IDs and toward per-line traits plus deterministic speaker grouping.

**Commits:**
- Pending.

**Lessons Learned:**
- Prompt iteration alone is the wrong long-term seam for speaker identity assignment.
- The immediate next value is in clarifying ownership boundaries and schema design, not rushing implementation.

---

*Started on 2026-04-13*