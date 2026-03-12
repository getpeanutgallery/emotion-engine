# emotion-engine: add video YAML failover targets (mitigate OpenRouter qwen no-content)

**Date:** 2026-03-09  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Treat Phase2 OpenRouter qwen “No content in response” as *mitigated for now* by expanding the Phase2 **video processing target chain** in YAML (more adapter/provider/model combos).

This should improve reliability without deep-diving into OpenRouter stability.

---

## Overview

We’ll implement a failover chain in the emotion-engine YAML for the `ai.video` operation using the existing `targets[*].adapter.{name,model,params}` schema.

**Important:** Derrick clarified the config we were using for golden-run testing is **`cod-test`** (likely `configs/cod-test.yaml`), so the target-chain edits should land there.

Then we’ll update the issue to reflect the new strategy (and close or downgrade severity depending on results).

---

## Tasks

### Task 1: Inspect current Phase2 video YAML + schema expectations

**SubAgent:** `coder`
**Prompt:** In `~/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, locate the YAML config(s) used for Phase2 video processing (likely under `configs/` or similar). Identify:
- current `ai.video.targets` list
- retry/failover settings
- how adapters are named (openrouter/openai/gemini/etc)
Return the exact file paths + current target chain.

**Status:** ⏳ Pending

---

### Task 2: Add additional adapter/provider/model combos to `ai.video.targets`

**SubAgent:** `coder`
**Prompt:** Update the chosen YAML config(s) so Phase2 video processing has multiple targets for failover. Requirements:
- Add at least 2-3 targets with different adapter/model combos (per Derrick’s direction)
- Keep ordering intentional (best/cheapest first, etc.—state reasoning in commit notes)
- Ensure params are forwarded (video params already wired)
- Ensure retry/backoff is set sensibly per target chain
- Commit + push to `main`

**Status:** ⏳ Pending

---

### Task 3: Update `.issues/openrouter-qwen-video-no-content-response.md`

**SubAgent:** `coder`
**Prompt:** Update the issue to reflect the new mitigation strategy: “We’re not fixing OpenRouter stability now; we’re adding more video targets for failover.”
- Update context + acceptance criteria accordingly
- If we consider it ‘done for now’, mark as mitigated/deferred rather than fully resolved (unless Derrick wants it closed)
- Commit + push (can be in same commit as YAML change or separate)

**Status:** ⏳ Pending

---

### Task 4: Smoke check

**SubAgent:** `coder`
**Prompt:** Run minimal verification (whatever is fastest): lint/tests or a small replay. Confirm YAML parses and the targets chain is exercised without crashing.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft

*Completed on 2026-03-09*
