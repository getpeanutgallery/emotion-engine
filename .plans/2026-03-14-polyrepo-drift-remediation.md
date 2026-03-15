# peanut-gallery: polyrepo drift remediation

**Date:** 2026-03-14  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Restore the intended peanut-gallery polyrepo ownership model by moving accidental ownership back to the correct sibling repos, specifically for `tools/emotion-lenses-tool` and the provider twin-pack repo, while preserving runtime behavior and test reliability.

---

## Overview

The audit phase confirmed two real ownership violations rather than a general monorepo collapse. First, `emotion-engine` became the hidden runtime owner of `emotion-lenses-tool` through an in-repo shim and a more advanced local implementation, even though the sibling `tools` repo is supposed to own shared tool code. Second, `emotion-engine/test/fixtures/digital-twin-emotion-engine-providers` became the de facto provider cassette source even though `digital-twin-emotion-engine-providers` is supposed to be canonical.

Derrick clarified the intended architecture: the sibling polyrepos are the source of truth, and the local `emotion-engine` copies are accidental drift. This remediation plan therefore restores canonical ownership to the sibling repos instead of doubling down on the engine-local copies. Derrick explicitly decided that `emotion-engine` should directly consume the sibling polyrepos as dependencies — not generated mirrors, fixture copies, or shadow ownership surfaces inside the engine repo. The safest path is staged: first repair the canonical sibling implementations, then switch `emotion-engine` back to consuming them cleanly, then remove the accidental local ownership surfaces, and finally run a full sanity sweep.

This plan treats `emotion-engine` as the coordination repo, but the actual fixes belong in the owning sibling repos where appropriate. Each implementation task should preserve behavior with tests before cutting over, so we do not replace one architectural problem with a broken runtime.

---

## Tasks

### Task 1: Restore canonical `emotion-lenses-tool` implementation in `tools`

**Bead ID:** `ee-cwi.4`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/tools, restore canonical ownership of emotion-lenses-tool in the tools repo. Port the behavior currently relied on from emotion-engine/server/lib/emotion-lenses-tool.cjs into tools/emotion-lenses-tool.cjs (or the appropriate repo-local structure), including validator-tool-loop behavior, strict structured-output contract behavior, and current metadata/exports needed by emotion-engine. Keep tools as the canonical owner, not a downstream mirror. Update tests/docs, verify behavior, commit to main, and report exact files changed plus validation run.`

**Folders Created/Deleted/Modified:**
- `../tools/`
- `../tools/lib/`
- `../tools/test/`
- `../tools/docs/`

**Files Created/Deleted/Modified:**
- `../tools/emotion-lenses-tool.cjs`
- `../tools/lib/ai-targets.cjs`
- `../tools/lib/json-validator.cjs`
- `../tools/lib/local-validator-tool-loop.cjs`
- `../tools/lib/structured-output.cjs`
- `../tools/test/emotion-lenses-tool.test.js`
- `../tools/README.md`
- `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
- `../tools/package.json`

**Status:** ✅ Complete

**Results:** Restored canonical ownership to `../tools` by porting the strict structured-output + validator-tool-loop implementation into the tools repo, including `EMOTION_ANALYSIS_TOOL_NAME`, `buildBasePromptFromInput`, validator contract helpers, structured invalid-output failures, and `executeEmotionAnalysisToolLoop`. Added local helper modules under `../tools/lib/` so the package no longer depends on the hidden engine-local implementation. Updated README/docs to declare tools as canonical owner and expanded tests to cover strict parsing, validator helpers, analyze behavior, and tool-loop behavior. Validation: `npm test` in `../tools` passed (25 tests). Commit: `76eb2bf` (`Restore canonical emotion lenses tool contract`).

---

### Task 2: Switch `emotion-engine` back to consuming `tools` as the true owner

**Bead ID:** `ee-4t2`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, remove the accidental local ownership of emotion-lenses-tool after Task 1 lands. Eliminate the local installed-package shim pattern, stop treating server/lib/emotion-lenses-tool.cjs as the hidden canonical implementation, and ensure runtime/tests/configs resolve cleanly to the sibling tools package again. Preserve behavior with tests, update docs/plan, commit to main, and report exact files changed and validation performed.`

**Folders Created/Deleted/Modified:**
- `configs/`
- `server/lib/`
- `server/scripts/process/`
- `test/scripts/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `configs/full-analysis.yaml`
- `configs/multi-analysis.yaml`
- `configs/multi-persona-swarm.yaml`
- `configs/quick-test.yaml`
- `configs/raw-analysis.yaml`
- `configs/single-chunk-test-debug.yaml`
- `configs/single-chunk-test-per-second.yaml`
- `configs/single-chunk-test.yaml`
- `configs/video-analysis.yaml`
- `configs/video-analysis-parallel.yaml`
- `server/lib/emotion-lenses-tool.cjs`
- `server/scripts/process/video-chunks.cjs`
- `test/scripts/emotion-lenses-tool.test.js`
- `test/scripts/video-chunks.test.js`
- `.plans/2026-03-14-polyrepo-drift-remediation.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-4t2` and cut `emotion-engine` back over to the sibling `../tools` implementation by removing the engine-local canonical file (`server/lib/emotion-lenses-tool.cjs`), switching `video-chunks.cjs` to import `../../../../tools/emotion-lenses-tool.cjs`, and updating engine tests to target the sibling repo directly. Updated the affected YAML configs to declare sibling-relative `toolPath`, `soulPath`, and `goalPath` values (`../tools`, `../cast`, `../goals`) so declared ownership matches the real polyrepo layout again. Added a small normalization seam in `video-chunks.cjs` so legacy engine-relative `cast/...` and `goals/...` inputs are rewritten for the sibling tools repo, preserving behavior for older callers while keeping ownership in `../tools`. Validation passed with `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js` (40 tests) and `node validate-configs.cjs` (19 YAML files OK). Commit hash recorded after local commit/close.

---

### Task 3: Restore canonical provider cassette-pack ownership to `digital-twin-emotion-engine-providers`

**Bead ID:** `ee-7hv`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-emotion-engine-providers, make this sibling repo the canonical owner of the provider test cassette pack again. Reconcile any divergence with emotion-engine/test/fixtures/digital-twin-emotion-engine-providers, choose the canonical cassette/manifest state from the sibling repo perspective, update pack contents/docs as needed, verify pack integrity, commit to main, and report what should now be consumed by emotion-engine tests.`

**Folders Created/Deleted/Modified:**
- `../digital-twin-emotion-engine-providers/`
- `../digital-twin-emotion-engine-providers/cassettes/`
- `../digital-twin-emotion-engine-providers/test/`

**Files Created/Deleted/Modified:**
- `../digital-twin-emotion-engine-providers/manifest.json`
- `../digital-twin-emotion-engine-providers/cassettes/providers.json`
- `../digital-twin-emotion-engine-providers/README.md`
- `../digital-twin-emotion-engine-providers/package.json`
- `../digital-twin-emotion-engine-providers/test/manifest.test.js`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-7hv` and restored the sibling pack as the canonical provider-cassette owner by reintroducing `cassettes/providers.json` into the repo with the newer fixture-aligned payload from `emotion-engine/test/fixtures/...`, then documenting that this sibling repo is the source of truth. Chose the sibling repo’s canonical state to be: `manifest.json` continues to expose `defaultCassetteId: "providers"`, while `cassettes/providers.json` now carries the current offline replay payload including the duplicate OpenRouter interaction needed for sequential replay consumption in a single test process. Expanded `README.md` with ownership/consumption guidance for `DIGITAL_TWIN_PACK=../digital-twin-emotion-engine-providers`, tightened `test/manifest.test.js` to verify manifest-declared cassette presence, provider coverage, duplicate OpenRouter coverage, and `npm pack --dry-run` contents, and removed the dead `generate` script from `package.json` so the pack metadata no longer advertises a missing generator. Validation: `npm test` passed (6 assertions in `test/manifest.test.js`) and `npm pack --dry-run` confirmed the tarball now includes `cassettes/providers.json`. Commit: `50c2062` (`Restore canonical provider cassette pack`). Next consumer step for Task 4: point `emotion-engine` provider tests/helpers at `../digital-twin-emotion-engine-providers` and retire the in-repo fixture copy instead of syncing a second authority.

---

### Task 4: Remove/reduce the accidental local provider fixture copy in `emotion-engine`

**Bead ID:** `Pending`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, stop treating test/fixtures/digital-twin-emotion-engine-providers as the canonical provider cassette owner after Task 3 lands. Switch tests to use the sibling pack repo directly as the dependency-owned source of truth; do not introduce or preserve a local mirror. Remove the current silent-drift state, update tests/helpers/docs accordingly, verify test ergonomics, commit to main, and report the final ownership/consumption pattern.`

**Folders Created/Deleted/Modified:**
- `test/fixtures/`
- `test/helpers/`
- `test/ai-providers/`
- `test/integration/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `test/fixtures/digital-twin-emotion-engine-providers/`
- `test/helpers/digital-twin-preflight.cjs`
- `test/ai-providers/*.js`
- `test/integration/ai-provider-flow.test.js`
- `.plans/2026-03-14-polyrepo-drift-remediation.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Clean up dependency/runtime clarity and pack docs

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `Across the affected repos, clean up the remaining non-blocking drift after the ownership fixes land: refresh dependency clarity where needed, remove misleading runtime indirections, and sync pack/docs mismatches such as digital-twin-openrouter-emotion-engine README vs manifest. Keep this bounded to clarity/documentation/packaging cleanup after the primary ownership corrections are done. Commit to main in each touched repo and report the final cleanup set.`

**Folders Created/Deleted/Modified:**
- affected repos as needed

**Files Created/Deleted/Modified:**
- package/lock/docs files as needed

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 6: Run final polyrepo sanity sweep

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `After all ownership corrections land, run a final sanity sweep across emotion-engine, tools, ai-providers, digital-twin-router, digital-twin-core, digital-twin-emotion-engine-providers, and digital-twin-openrouter-emotion-engine. Verify that runtime ownership is visible from source, tests point at the correct canonical repos, and no silent local shims or duplicate fixture truths remain. Update the remediation plan with final results, commit any final doc notes, and report blockers if any remain.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-polyrepo-drift-remediation.md`
- `docs/` if needed

**Status:** ⏳ Pending

**Results:** Pending.

---

## Proposed execution order

1. Fix canonical tool ownership in `tools`
2. Switch `emotion-engine` back to consuming `tools`
3. Reconcile canonical provider cassette ownership in `digital-twin-emotion-engine-providers`
4. Remove/reduce local provider fixture drift in `emotion-engine`
5. Clean up lockfile/runtime/doc clarity
6. Run final sanity sweep

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Confirmed by Derrick on 2026-03-14: emotion-engine should directly consume the sibling polyrepos as dependencies; do not create or rely on local mirrors for canonical tool or provider-pack ownership.*