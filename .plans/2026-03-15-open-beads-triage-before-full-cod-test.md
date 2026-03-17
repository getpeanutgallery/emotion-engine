---
plan_id: plan-2026-03-15-open-beads-triage-before-full-cod-test
bead_ids:
  - ee-83q
  - ee-o96
---
# emotion-engine: open Beads triage before full cod-test

**Date:** 2026-03-15  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Evaluate the remaining open Beads in `emotion-engine` and decide which ones, if any, are worth doing before the next full `cod-test`.

---

## Overview

We have already cleared a substantial amount of pre-run debt today: recovery activation, AI recovery validator-tool enforcement, prompt-contract normalization, rerun artifact hygiene, run-root `_meta/` layout cleanup, and legacy path removal. Before spending on the full `cod-test`, Derrick wants a fresh reality-based triage of what is still open.

This is not an implementation lane. It is a decision lane. The purpose is to inspect the remaining open Beads, compare them against the current known-good state, and classify each one as either: a blocker before full run, worth doing before full run but not a blocker, or safe to defer until after the full run.

The owning repo is `emotion-engine`, because the open Beads, recent plans, and next full validation lane all live here.

---

## Tasks

### Task 1: Inventory and classify remaining open Beads

**Bead ID:** `ee-83q`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the remaining open Beads and recent validation/cleanup plans. For each open bead, classify it as one of: blocker before full cod-test, worth doing before full cod-test, or safe to defer until after full cod-test. Include exact reasons tied to the current state of the repo and the recent successful Phase3 run. Update this plan with exact bead IDs, titles, and classifications.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/` (read only)

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-open-beads-triage-before-full-cod-test.md`

**Status:** ✅ Complete

**Results:** Inspected the live open bead set with `bd list --json` on 2026-03-15 and classified each currently open bead against the repo’s actual post-cleanup state rather than stale failure history. The key state anchor is that today’s upgraded live Phase3-only validation succeeded end-to-end (`.plans/2026-03-15-live-phase3-validation-under-upgraded-recovery.md`), including validator-tool mediation in recommendation, while same-run AI recovery remained armed but unused; since then, the stale-artifact rerun-hygiene fix landed (`49e63ab`), the run-root metadata `_meta/` cutover landed (`b49a194`), and legacy run-root `raw/...` compatibility removal landed (`1763aa4`). That means the main previously suspicious areas were either validated live or cleaned up today, so the remaining open set contains no honest blocker that must be completed before spending on the next full `cod-test`.

### Live open bead inventory and classification

- `ee-o96` — **Recommend next lane before spending on full cod-test**
  - **Classification:** worth doing before full cod-test
  - **Reason:** This is the immediate decision bead that depends on this triage. It is not a runtime/code blocker, but it is the right final synthesis step before spending on the full run. The repo state already points strongly toward “run full cod-test now,” so this bead should close next as the documentation/decision handoff.

- `ee-5dv` — **cod-test fails in report/recommendation: invalid_output (non-JSON response)**
  - **Classification:** safe to defer until after full cod-test
  - **Reason:** This bead used to be the main blocker, but today’s live upgraded Phase3-only run cleared the recommendation/report lane with real paid execution and successful validator-tool mediation. Cleanup work also removed stale rerun artifacts that had been muddying diagnosis. The old failure signature is no longer a truthful pre-run blocker; the honest move is to rerun the full pipeline and only revive this as an active fix lane if fresh full-run evidence reproduces it.

- `ee-2fs` — **Audit Phase 3 recommendation input payload (hallucination-heavy output)**
  - **Classification:** safe to defer until after full cod-test
  - **Reason:** This is still a useful quality/provenance audit, but today’s repo state does not make it a prerequisite. The system now has a successful upgraded Phase3 run plus cleaner run artifacts, so the next missing truth signal is whether full `cod-test` passes end-to-end. If that run passes but the recommendation quality still looks suspect, this bead becomes a good follow-up.

- `ee-58s` — **Investigate provider_no_content failures and whether they are budget-related**
  - **Classification:** safe to defer until after full cod-test
  - **Reason:** This is an older Phase 2/provider-debug investigation. Nothing in today’s successful upgraded Phase3 run or the landed cleanup work suggests it is the current gating risk. Since full `cod-test` is the next acceptance lane anyway, the more truthful move is to see whether a fresh end-to-end run reproduces any provider-empty behavior before paying the investigation cost.

- `ee-bao` — **Investigate stock-assets language: grounding bug vs persona-consistent judgment**
  - **Classification:** safe to defer until after full cod-test
  - **Reason:** This is output-quality interpretation work, not run-readiness work. Today’s efforts were about getting the pipeline truthfully runnable and its artifacts trustworthy. The upgraded Phase3 success and cleanup landings reduce runtime uncertainty, but they do not make wording/persona analysis a blocker to the next acceptance run.

- `ee-03m` — **Expose FFmpeg audio/video compression settings via YAML (canonical, hard error, clean break)**
  - **Classification:** safe to defer until after full cod-test
  - **Reason:** This is a useful configuration/architecture cleanup, but it is not tied to the current go/no-go question. The repo already validated the upgraded Phase3 lane today, and the artifact/layout cleanup work that already landed addressed the actual confusion points around reruns and run metadata. FFmpeg knob canonicalization can wait until after the next full validation pass.

Bottom line from the live open set: **no remaining open bead is an honest blocker before full `cod-test`**. The only bead worth doing before the run is the already-created decision/synthesis bead `ee-o96`, which should simply confirm the next lane.

---

### Task 2: Recommend the next lane before spending on full cod-test

**Bead ID:** `ee-o96`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the bead triage into a recommendation. Decide whether we should: (a) run full cod-test now, (b) complete one specific open bead first, or (c) do a narrow additional verification step first. Update this plan with the exact recommendation and next command/lane.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-open-beads-triage-before-full-cod-test.md`

**Status:** ✅ Complete

**Results:** Synthesized the open-bead triage into a single recommendation: **run full `cod-test` now**. We do **not** need to finish another open bead first, and we do **not** need one more narrow verification step first. The deciding evidence is already in hand: today’s live upgraded Phase3-only validation succeeded end-to-end under the real paid path (`.plans/2026-03-15-live-phase3-validation-under-upgraded-recovery.md`), the recommendation lane exercised validator-tool mediation successfully, the recovery/config/prompt-contract upgrades are already landed, and the stale-artifact/rerun-hygiene issue was fixed and verified afterward (`.plans/2026-03-15-run-artifact-hygiene-before-full-cod-test.md`). That means the main previously credible reasons to delay the full run have already been retired by fresh evidence rather than assumption.

Exact recommendation: **advance directly to the end-to-end acceptance lane** and treat the remaining open beads as post-run follow-ups unless the full run produces fresh contrary evidence. In particular, `ee-5dv` should only be revived as the immediate next fix lane if the full `configs/cod-test.yaml` run reproduces a report/recommendation invalid-output failure; `ee-2fs`, `ee-58s`, `ee-bao`, and `ee-03m` remain useful but non-blocking.

**Next command/lane:** `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

---

## Intended execution order

1. Task 1 — inventory and classify the remaining open Beads
2. Task 2 — recommend the next lane before the full run

---

## Constraints

- Base the triage on the current repo state, not stale historical assumptions.
- Do not reopen already-resolved concerns as blockers without fresh evidence.
- Keep this lane decision-focused; do not implement fixes here.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed the decision lane in two steps: (1) a live inventory/classification of the remaining open beads against the repo’s actual post-validation, post-cleanup state, and (2) a final synthesis showing there are no honest blockers left before the next full acceptance run. The truthful recommendation is to run the full `cod-test` now and treat the remaining open beads as follow-up/debug lanes only if fresh full-run evidence points back at them.

**Commits:**
- None in this task scope.

**Lessons Learned:** Recent live validation and cleanup landings materially changed the truth of the open-bead set. Older open beads that once looked like blockers now need to be judged against today’s successful upgraded Phase3 run and the verified rerun-hygiene fix, not against stale failure history.

---

*Completed on 2026-03-15*