# emotion-engine: propagate recommendation settings into cod-test and review open beads

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Propagate the proven recommendation settings into `configs/cod-test.yaml`, then review the remaining open emotion-engine beads and recommend what should happen before any new full `cod-test` run.

---

## Overview

The real Phase 3 production-path rerun demonstrated that recommendation succeeds with normalized YAML params `max_tokens: 25000` and `thinking.level: low`. That made the immediate follow-up straightforward: propagate the same settings into `configs/cod-test.yaml` so the full test config no longer lags the proven Phase 3-only lane.

Derrick explicitly did **not** want a new full run in this lane, so the second half of the work was a repo-state review: inspect the currently open emotion-engine beads after the successful recommendation rerun, separate the now-stale recommendation blocker from still-valuable follow-up work, and recommend what should be tackled before any fresh full `cod-test` run.

---

## Tasks

### Task 1: Propagate proven recommendation settings into `configs/cod-test.yaml`

**Bead ID:** `ee-83x`  
**SubAgent:** `main`  
**Prompt:** `You are executing bead ee-83x in /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine. Claim it immediately with \
`bd update ee-83x --status in_progress --json\`. Update configs/cod-test.yaml so the recommendation target uses the same normalized YAML params proven in the successful Phase 3 lane: \`max_tokens: 25000\` and \`thinking.level: low\`. Record the exact config change in this active plan file.`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `.plans/2026-03-13-propagate-cod-test-settings-and-review-open-beads.md`

**Status:** ✅ Complete

**Results:** Added normalized params to the `google/gemini-3.1-pro-preview` recommendation entry in `configs/cod-test.yaml`:

```yaml
  recommendation:
    targets:
      ...
      - adapter:
          name: openrouter
          model: google/gemini-3.1-pro-preview
          params:
            max_tokens: 25000
            thinking:
              level: low
```

This mirrors the successful `configs/cod-test-phase3.yaml` recommendation lane settings without running a new full pipeline.

---

### Task 2: Review open emotion-engine beads in light of the recommendation fix

**Bead ID:** `ee-83x`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-83x, review the currently open emotion-engine beads after the successful Phase 3 recommendation fix. Identify which beads are now effectively resolved, which remain independently valuable, and which should be prioritized before any new full cod-test run. Update the active plan with a concise recommendation order and rationale.`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-propagate-cod-test-settings-and-review-open-beads.md`

**Status:** ✅ Complete

**Results:** Current open beads reviewed: `ee-5dv`, `ee-2fs`, `ee-9or`, `ee-1er`, `ee-0gv`, `ee-03m`.

#### Effectively resolved / stale after the successful Phase 3 fix

- `ee-5dv` — **effectively resolved pending a fresh full `cod-test` confirmation run**.
  - Its blocker stack is already closed: `ee-9gp`, `ee-byv`, `ee-dlr`, `ee-i7b`, and `ee-jmi` are all closed.
  - The decisive evidence lives in the completed Phase 3 rerun plan: the recommendation lane succeeded on attempt 1 with `finish_reason: "stop"`, valid JSON output, and the exact normalized params now propagated into config.
  - What remains is confirmation that the full `configs/cod-test.yaml` path now behaves the same once rerun, not more diagnosis of the old recommendation failure mode.

#### Still independently valuable

- `ee-2fs` — **still valuable and now more actionable**.
  - The recommendation lane now succeeds, which means output quality / grounding is the next useful question.
  - This is the best follow-up if Derrick wants confidence in recommendation correctness rather than just pipeline completion.

- `ee-9or` — **still valuable, but diagnostic rather than blocking**.
  - Useful for building an error taxonomy/report across recent runs.
  - Less urgent now that the main recommendation truncation issue appears cleared.

- `ee-1er` — **still valuable, but not required before the next full rerun**.
  - Better structured provider/debug capture would improve future triage.
  - It is observability hardening, not the immediate blocker anymore.

- `ee-0gv` — **still valuable, but unrelated to the recommendation fix**.
  - Output layout / raw folder namespace cleanup remains a legitimate design task.
  - No reason to do it before validating the now-fixed full cod-test path.

- `ee-03m` — **still valuable, but unrelated to the recommendation fix**.
  - FFmpeg settings via YAML is useful config hygiene.
  - Not a prerequisite for confirming the recommendation fix.

#### Priority before any new full `cod-test` run

Recommended order:
1. **No additional code changes required just to test the recommendation fix.** The minimum next step is a fresh full `cod-test` rerun using the now-updated config.
2. If Derrick wants one more prep lane before that rerun, do **`ee-2fs`** next so the newly successful recommendation output can be audited for grounding and provenance.
3. After that, prioritize **`ee-9or`** and/or **`ee-1er`** only if another rerun exposes fresh failures or if better debug artifacts are needed.
4. Defer **`ee-0gv`** and **`ee-03m`** until after the rerun because they are architecture/config cleanup, not recommendation-unblock work.

---

### Task 3: Summarize next-step recommendation without running full cod-test

**Bead ID:** `ee-83x`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-83x, summarize the resulting recommendation for Derrick: what changed in cod-test.yaml, whether ee-5dv should now be considered effectively solved pending a full rerun, and what open beads should be tackled next before a new full cod-test. Do not run full cod-test. Update the plan with the final recommendation and close the bead with \`bd close ee-83x --reason "Propagated recommendation settings into cod-test and reviewed open beads" --json\`.`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-propagate-cod-test-settings-and-review-open-beads.md`

**Status:** ✅ Complete

**Results:** Concise recommendation for Derrick:
- `configs/cod-test.yaml` now carries the same proven recommendation budget controls on the Gemini recommendation entry: `max_tokens: 25000` and `thinking.level: low`.
- `ee-5dv` should be treated as **effectively solved but not yet formally closed**, because the previously failing Phase 3 production path now passes; what remains is a confirmatory full `cod-test` rerun on the propagated config.
- Before any new full rerun, the only open bead worth prioritizing on product quality grounds is `ee-2fs`. Everything else can wait unless the rerun exposes new failures.

---

## Success Criteria

- `configs/cod-test.yaml` uses the same recommendation settings as the successful Phase 3-only lane.
- We review the remaining open emotion-engine beads instead of running full cod-test immediately.
- We leave a clear recommendation for what to do next and which beads matter most.

---

## Constraints

- Did not run full `cod-test` in this lane.
- Kept the change limited to config propagation + bead review.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Propagated the successful Phase 3 recommendation budget/settings into `configs/cod-test.yaml` by adding `max_tokens: 25000` and `thinking.level: low` to the Gemini recommendation target, then reviewed all remaining open emotion-engine beads and separated the now-stale recommendation blocker from still-useful follow-up work.

**Commits:**
- Pending.

**Lessons Learned:** Once the recommendation lane succeeded with the larger token budget and low thinking effort, the main unresolved question stopped being “why is Phase 3 recommendation failing?” and became “do we want to validate full-run behavior immediately, or first audit output grounding?” That means `ee-5dv` is now mostly a confirmation bead, while `ee-2fs` is the highest-value follow-up if quality matters before the next full rerun.

---

*Completed on 2026-03-13.*
