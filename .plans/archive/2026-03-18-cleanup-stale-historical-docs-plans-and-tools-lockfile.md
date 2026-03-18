---
plan_id: plan-2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile
bead_ids:
  - ee-zgq
  - ee-biy
  - ee-6qt
  - ee-nv3
  - ee-zw4
---
# emotion-engine: cleanup stale historical docs, archive completed plans, and fix tools lockfile provenance

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Clean up stale historical signaling after the AI-recovery investigation by making docs and plan placement reflect current truth, and remove local polyrepo `file:` lockfile residue from `../tools` so the repo aligns with the SSH-based dependency policy.

---

## Overview

The investigation we just completed established that the old AI-recovery rollout handoff is no longer active work: the rollout beads are closed, the live runtime still behaves as intended, and the remaining stale signals are mostly historical plan/doc residue. That means the right next move is hygiene, not more architecture work.

This cleanup spans two repos but one coordination story. `emotion-engine` remains the owning repo because the stale planning/doc-state problem lives primarily in `emotion-engine/.plans/` and its associated historical docs. The `tools` repo is only in scope for a bounded dependency/lockfile cleanup so it follows the documented polyrepo rule of using Git SSH references rather than local `file:` links.

The cleanup must be careful rather than aggressive. Some old plans are still valuable historical records and should be archived, not deleted or rewritten beyond a small truth-preserving closure note if needed. Likewise, the lockfile cleanup should remove local-system residue without accidentally changing intended package ownership or runtime behavior.

---

## Tasks

### Task 1: Identify and archive stale completed/superseded top-level plans

**Bead ID:** `ee-biy`  
**SubAgent:** `primary`  
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, audit the top-level `.plans/` files and move clearly completed or superseded plans into `.plans/archive/` so the top-level folder reflects current active work. Preserve history; do not delete plan content. Update this plan with exactly which files were moved and why.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md`
- moved plan files under `.plans/archive/`

**Status:** ✅ Complete

**Results:** Archived every non-`2026-03-18` top-level plan into `.plans/archive/` so the top level now shows only today’s two active coordination plans: `2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md` and `2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`.

Moved files (exactly):
- Explicitly **Complete** historical plans: `2026-03-09-audio-too-large-chunking-strategy.md`, `2026-03-09-execute-audio-chunking-strategy.md`, `2026-03-09-list-current-issues.md`, `2026-03-09-video-yaml-add-failover-targets.md`, `2026-03-10-delete-fixed-issues-and-run-cod-test.md`, `2026-03-10-issue-categorize-error-responses.md`, `2026-03-10-issue-expose-ffmpeg-compression-variables.md`, `2026-03-10-issue-openrouter-errors-debugging-alignment.md`, `2026-03-10-issue-phase3-only-config.md`, `2026-03-10-issue-recommendation-inputs-audit.md`, `2026-03-10-issue-run-root-raw-folder-location.md`, `2026-03-10-openrouter-video-request-shape-audit.md`, `2026-03-10-rerun-cod-test-after-config-sync.md`, `2026-03-12-canonicalize-plans-and-beads-before-next-run.md`, `2026-03-12-convert-legacy-issues-to-beads.md`, `2026-03-12-harden-tool-call-envelope-and-rerun-phase3.md`, `2026-03-12-option-a-validator-tool-calling-architecture.md`, `2026-03-12-subagent-surrogate-tool-loop-debug.md`, `2026-03-13-cod-test-explicit-ai-settings.md`, `2026-03-13-deterministic-recovery-framework.md`, `2026-03-13-generalize-ai-defaults-overrides-and-json-validation.md`, `2026-03-13-phase1-validator-tool-rollout.md`, `2026-03-13-phase2-validator-tool-rollout.md`, `2026-03-13-phase3-validator-tool-rollout-and-doc-cleanup.md`, `2026-03-13-production-path-request-response-capture.md`, `2026-03-13-propagate-cod-test-settings-and-review-open-beads.md`, `2026-03-13-raise-recommendation-max-tokens-and-rerun-phase3.md`, `2026-03-13-sibling-repo-debug-failure-capture-sweep.md`, `2026-03-13-universal-schema-validator-contract.md`, `2026-03-13-universal-success-failure-contracts.md`, `2026-03-13-yaml-configurable-thinking-and-token-budgets.md`, `2026-03-14-polyrepo-drift-audit.md`, `2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`, `2026-03-15-live-phase3-validation-under-upgraded-recovery.md`, `2026-03-15-local-dependency-refresh-hygiene.md`, `2026-03-15-open-beads-triage-before-full-cod-test.md`, `2026-03-15-run-artifact-hygiene-before-full-cod-test.md`.
- Explicitly **Superseded** historical plans: `2026-03-09-add-adapter-smoketest-and-oauth-issues.md`, `2026-03-09-captureRaw-meta-triple-implementation.md`, `2026-03-09-closeout-scripts-audit-and-session-handoff.md`, `2026-03-09-inspect-and-drop-emotion-engine-stash.md`, `2026-03-09-issue-hygiene-and-scripts-audit.md`, `2026-03-09-nuke-legacy-and-sync-readme-docs.md`, `2026-03-10-issue-triage-and-parallel-plan.md`, `2026-03-10-next-issues-parallel-execution.md`, `2026-03-10-remove-recommendation-video-target-fallback.md`, `2026-03-10-review-remaining-issues-and-polyrepo.md`, `2026-03-10-run-phase3-only-and-report-recommendation.md`, `2026-03-10-stream-b-phase3-only-and-recommendation-audit.md`.
- Older **Draft / Current / In Progress** coordination snapshots preserved as archive because they are no longer the active top-level execution truth: `2026-03-12-make-recommendation-prompt-validator-aware-and-rerun-phase3.md`, `2026-03-12-prioritize-phase3-json-validation-and-grounding.md`, `2026-03-12-reconstruct-cod-test-state-and-next-step.md`, `2026-03-13-generalize-ai-config-validation-and-grounding-followups.md`, `2026-03-13-pre-golden-run-bead-sequence.md`, `2026-03-13-schema-validator-rollout-across-ai-lanes.md`, `2026-03-13-unified-output-failure-and-ai-recovery-architecture.md`, `2026-03-14-ai-recovery-contract-and-sibling-rollout.md`, `2026-03-14-polyrepo-drift-remediation.md`, `2026-03-15-activate-recovery-config-and-truth-fix-docs.md`, `2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`, `2026-03-15-full-cod-test-acceptance-rerun.md`, `2026-03-15-remove-legacy-run-root-raw-compat.md`, `2026-03-15-run-root-raw-layout-decision.md`, `2026-03-15-validator-tool-loop-for-ai-recovery.md`, `2026-03-15-verify-recovery-rollout-and-polyrepo-drift.md`. These remain important historical records, but today’s investigation established they are stale coordination artifacts rather than the current active plan surface: the old AI-recovery rollout chain (`ee-32e`, `ee-d4x*`, `ee-cwi*`, `ee-vaa`) is already closed, and the remaining live work is tracked in newer Beads plus today’s two 2026-03-18 coordination plans.

Verification: `find .plans -maxdepth 1 -type f` now returns only the two 2026-03-18 plan files, and all moved files are preserved under `.plans/archive/`. No plan content was deleted.

---

### Task 2: Apply bounded historical truth-fixes to stale doc/plan surfaces

**Bead ID:** `ee-6qt`  
**SubAgent:** `coder`  
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, update the small set of stale historical docs/plans that still risk misleading future work about the AI-recovery rollout status. Preserve them as historical records, but add concise closure/superseded notes where needed so they stop reading like current execution truth. Update this plan with exact files and changes.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`
- `.plans/2026-03-13-pre-golden-run-bead-sequence.md`
- `.plans/2026-03-13-schema-validator-rollout-across-ai-lanes.md`
- `.plans/2026-03-13-unified-output-failure-and-ai-recovery-architecture.md`
- `.plans/2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md`

**Status:** ✅ Complete

**Results:** Added bounded historical-status notes to the four stale rollout-era plans so they stop reading like active execution truth while preserving the original plan bodies. Exact changes: (1) `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md` now opens with a note that it is a preserved 2026-03-14 execution snapshot and that `ee-d4x.1`-`ee-d4x.4`, `ee-cwi.1`-`ee-cwi.4`, and `ee-vaa` are now closed; (2) `.plans/2026-03-13-pre-golden-run-bead-sequence.md` now notes that its ordered pre-golden sequence was superseded by the broader recovery/output-contract rollout before completion and should not be read as the live next-step list; (3) `.plans/2026-03-13-schema-validator-rollout-across-ai-lanes.md` now marks itself as an earlier proposal overtaken by the unified recovery architecture/2026-03-14 continuation plan and records that `ee-cwi` / `ee-vaa` are closed; (4) `.plans/2026-03-13-unified-output-failure-and-ai-recovery-architecture.md` now marks itself as the pre-execution architecture snapshot whose implementation later moved into the 2026-03-14 continuation plan and closed rollout beads. No extra docs were changed in this bounded pass.

---

### Task 3: Remove local `file:` lockfile residue from `../tools` and align dependency provenance

**Bead ID:** `ee-nv3`  
**SubAgent:** `coder`  
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools`, inspect `package.json` and `package-lock.json` for local `file:` polyrepo references, especially `digital-twin-router`. Replace local-system residue with the intended Git SSH dependency provenance where appropriate, regenerate the lockfile cleanly, and verify there are no remaining local `file:` polyrepo links unless explicitly justified. Update this plan with the exact dependency/lockfile changes made.

**Folders Created/Deleted/Modified:**
- `../tools/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `../tools/package-lock.json`
- `.plans/2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-nv3`, inspected `../tools/package.json` and `../tools/package-lock.json`, and confirmed the committed manifest was already correct: `../tools/package.json` still depends only on `ai-providers` via `git+ssh://git@github.com/getpeanutgallery/ai-providers.git#main`, so no manifest edit was needed. The stale provenance lived only in `../tools/package-lock.json`, where `node_modules/ai-providers` was pinned to older commit `3843ad7d4801bc56ba206e35db93e5c69160e506` and still declared transitive `digital-twin-router` as `file:../digital-twin-router`. A plain `npm install --package-lock-only` preserved that old locked git commit, so the clean fix was to remove `../tools/package-lock.json` and regenerate it from the declared manifest with `npm install --package-lock-only`. The rebuilt lockfile now pins `ai-providers` to commit `79db2dcee324d10733d25a810325483ffb7f595f`, records its transitive `digital-twin-router` dependency as `git+ssh://git@github.com/getpeanutgallery/digital-twin-router.git#2760977`, and adds resolved Git SSH entries for both `digital-twin-router` (`27609779006f18094512a609b141491942c19b0f`) and its transitive `digital-twin-core` (`fd364fc6a1163fa233964f6d52400da055ade3ec`). Verification after regeneration: `grep -n 'digital-twin-router\|file:\.\./' ../tools/package-lock.json` now shows only Git SSH `digital-twin-router` lines and no remaining `file:../...` entries in the committed `tools` manifest/lockfile surface. No commit was made.

---

### Task 4: Verify cleanup, update plan, and prepare commit/push summary

**Bead ID:** `ee-zw4`  
**SubAgent:** `primary`  
**Prompt:** Verify that archived plans moved correctly, truth-fix notes preserve historical clarity, and `../tools/package-lock.json` no longer contains unintended local `file:` polyrepo links. Update this plan with final results, including exactly what changed in each repo and any residual optional cleanup left for later.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../tools/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md`

**Status:** ✅ Complete

**Results:** Verification passed across the intended cleanup surface. Evidence checked: (1) `find .plans -maxdepth 1 -type f | sort` now returns only the two intended active top-level plans, `2026-03-18-cleanup-stale-historical-docs-plans-and-tools-lockfile.md` and `2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`, while the prior historical plans are present under `.plans/archive/`; (2) the bounded historical truth-fix notes landed in the targeted archived files now located under `.plans/archive/`, with the expected 2026-03-18 historical-status notes visible at the top of `2026-03-14-ai-recovery-contract-and-sibling-rollout.md`, `2026-03-13-pre-golden-run-bead-sequence.md`, `2026-03-13-schema-validator-rollout-across-ai-lanes.md`, and `2026-03-13-unified-output-failure-and-ai-recovery-architecture.md`; (3) `../tools/package-lock.json` no longer contains any `file:` dependency provenance (`contains_file_colon=false`), and it now contains Git SSH references for `ai-providers`, `digital-twin-router`, and `digital-twin-core`; and (4) both repos are in a coherent pre-commit state. Repo-level git status at verification time: in `emotion-engine`, `git status --short --branch` shows the expected plan cleanup delta (top-level historical plans as deletions paired with their archived-path additions, plus the two active 2026-03-18 plans as untracked); in `tools`, `git status --short --branch` shows only `M package-lock.json`. No commit was made.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed the planned cleanup/hygiene pass without rewriting history or changing runtime behavior. In `emotion-engine`, stale historical top-level plans were archived so `.plans/` now reflects only current active coordination work, and the specific rollout-era archived plans now carry concise historical-status notes so they no longer read like live execution truth. In `tools`, the lockfile was regenerated so the committed dependency provenance no longer encodes local `file:` polyrepo links and instead points at the intended Git SSH sources.

**Commits:**
- None yet in this bead; repos were intentionally left uncommitted for the parent commit/push step.

**Lessons Learned:** This kind of cleanup is safest when verified as three separate truths: active-vs-archived plan placement, bounded historical notes on the few misleading archived records, and actual package-lock provenance rather than only package.json intent. Also, directory moves surface in git as delete/add pairs, so the right verification target is coherent repo state, not a misleading expectation of a single rename line.

---

*Drafted on 2026-03-18*
