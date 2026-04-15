# Emotion Engine

**Date:** 2026-04-15  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Define the deterministic YAML heuristics contract that will decide whether dialogue lines with v2 traits belong to an existing speaker group or constitute a new speaker, so implementation can proceed against a review-approved grouping policy instead of vague heuristic prose.

---

## Overview

This plan intentionally comes **before** Phase 1 implementation of the new dialogue traits contract. Derrick wants the grouping heuristics contract defined first so we do not land the richer traits system in code without also deciding how those traits are meant to support speaker continuity and grouping.

This is design work, not runtime implementation. The lane should translate the current v2 dialogue traits contract and all recent review/audit work into an explicit YAML contract for deterministic grouping. That includes field bucket mapping, compatibility/versioning, positive and negative evidence rules, blocker rules, reliability/gating use, ambiguity handling, and any guardrails needed to keep grouping logic faithful to the closed source-truth philosophy.

The resulting package should be durable, reviewable, and implementation-guiding. It should point back to the current trait-contract docs and the recent discussion/audit trail rather than inventing a fresh architecture from scratch.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Revised maximalist dialogue traits contract v2 | `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md` |
| `REF-02` | Revised dialogue traits architecture note v2 | `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md` |
| `REF-03` | Revised full enum audit v2 | `docs/2026-04-15-dialogue-traits-full-enum-audit-v2.md` |
| `REF-04` | Calibration artifact | `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` |
| `REF-05` | Current v2 package audit | `docs/2026-04-15-dialogue-traits-vnext-v2-package-audit.md` |
| `REF-06` | Earlier artifact-shape / YAML boundary doc | `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` |
| `REF-07` | Prior YAML-contract motivation + recent session discussion | current session |
| `REF-08` | High-level bead for this lane | `ee-0ski` |

---

## Tasks

### Task 1: Draft the deterministic grouping heuristics YAML contract for dialogue traits v2

**Bead ID:** `ee-0ski`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-07`  
**Prompt:** Draft a review-ready deterministic YAML heuristics contract for grouping dialogue lines with the v2 traits contract into speaker groups. Define compatibility/versioning, bucket mappings, positive/negative evidence rules, blocker rules, ambiguity handling, reliability/gating usage, and tie-break/threshold structure. Keep it faithful to the closed-contract/source-truth philosophy and make it directly usable for later implementation.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Audit the heuristics contract for coherence with the v2 traits contract and recent design decisions

**Bead ID:** `Pending`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the drafted YAML heuristics contract. Verify that it uses the v2 traits contract coherently, preserves the source-truth/grouping boundary, handles ambiguity and abstention honestly, and does not smuggle in role/lore identity logic.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Update the living plan with final heuristics-contract decisions and next implementation seam

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** Update this plan after the heuristics contract and audit are complete. Record what was decided, what remains conditional, and what exact implementation seam should be tackled next.

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-04-15*
