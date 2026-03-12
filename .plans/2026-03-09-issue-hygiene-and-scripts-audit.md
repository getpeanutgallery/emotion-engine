# emotion-engine: issue hygiene + scripts audit kickoff

**Date:** 2026-03-09  
**Status:** Superseded
**Agent:** Cookie 🍪

---

## Goal

1) Remove `.issues/` entries that are already completed/mitigated and commit+push.
2) Kick off `scripts-audit-across-phases` (make scripts match repo reality so cod-test/record/replay don’t break).

---

## Tasks

### Task 1: Delete resolved/mitigated `.issues/*` + commit + push

**SubAgent:** `coder`
**Prompt:** In `~/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, delete these issue files (they are completed/mitigated):
- `.issues/captureRaw-events-jsonl-timeline.md`
- `.issues/prompt-dedupe-hash-store.md`
- `.issues/provider-debug-capture-consistency.md`
- `.issues/plans-scan-and-prune-pre-golden.md`
- `.issues/openrouter-qwen-video-no-content-response.md` (mitigated via `ai.video.targets` failover chain)

Then `git status`, commit with message `chore(issues): prune resolved captureRaw/meta + mitigations`, and push to `origin/main`.
Return commit hash + remaining `.issues/` list.

**Status:** ✅ Complete

**Results:**
- Commit: `5376ec8` — `chore(issues): prune resolved captureRaw/meta + mitigations`
- Pushed to `origin/main`
- Remaining issues:
  - `audio-too-large-chunking-strategy.md`
  - `readme-and-docs-polyrepo-reality.md`
  - `scripts-audit-across-phases.md`
  - `upgrade-audio-model-dialogue-music-context.md`


---

### Task 2: Scripts audit across phases (kickoff)

**SubAgent:** `coder`
**Prompt:** In emotion-engine, audit Phase1/Phase2/Phase3 scripts + helpers against current repo reality.

Deliverables:
- Update `.issues/scripts-audit-across-phases.md` with:
  - a checklist of scripts/entrypoints audited
  - current canonical commands for: cod-test, record, replay, dry-run, validate-configs
  - any mismatches found (paths, flags, outdated docs, broken assumptions)
- If any fixes are small/obvious (broken imports, wrong path, stale flag), implement them.
- Commit fixes (and issue doc update) with message `chore(scripts): audit + align phase scripts` and push.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress

*Completed on 2026-03-09*
