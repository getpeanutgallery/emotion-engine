# emotion-engine: review remaining issues + polyrepo siblings

**Date:** 2026-03-10  
**Status:** Superseded
**Agent:** Cookie 🍪

---

## Goal

Pull up the current canonical plan for emotion-engine work, enumerate remaining tracked issues across the emotion-engine polyrepo siblings, and propose an execution order.

---

## Canonical plan (current)

- `plans/emotion-engine/2026-03-09-audio-too-large-chunking-strategy.md`
- Execution wrapper: `plans/emotion-engine/2026-03-09-execute-audio-chunking-strategy.md`

Note: implementation appears to have landed in `emotion-engine` commit `ea27c67` (Phase1 audio base64-budget chunking + dialogue stitcher).

---

## Tasks

### Task 1: Enumerate remaining `.issues` across repos

**SubAgent:** `primary`
**Prompt:** List remaining `.issues/*.md` in:
- `projects/peanut-gallery/emotion-engine`
- `projects/peanut-gallery/ai-providers`
- `projects/peanut-gallery/digital-twin-router`
Summarize each issue (title + 1-2 line summary) and call out which appear already resolved by recent commits.

**Status:** ✅ Complete

**Results:**
- emotion-engine: `upgrade-audio-model-dialogue-music-context.md`
- ai-providers: 8 issues (3 smoketests, 4 OAuth, 1 OpenRouter no-content debug)
- digital-twin-router: 1 issue (duplicate-request replay consumption) appears resolved by commit `395600a`.

---

### Task 2: Propose priority / next execution plan

**SubAgent:** `primary`
**Prompt:** Recommend the next 1-3 concrete tasks to execute (with repo + acceptance criteria) based on impact on cod-test golden stability and developer velocity.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
