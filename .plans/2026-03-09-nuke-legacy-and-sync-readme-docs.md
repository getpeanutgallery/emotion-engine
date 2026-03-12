# emotion-engine: nuke legacy + sync README/docs to polyrepo reality

**Date:** 2026-03-09  
**Status:** Superseded
**Agent:** Cookie 🍪

---

## Goal

1) Remove deprecated/legacy entrypoints/docs (e.g. `bin/run-analysis.js`) so the repo only supports the canonical pipeline flow.
2) Tackle `.issues/readme-and-docs-polyrepo-reality.md`: update README + key docs to reflect current repo + polyrepo siblings and the canonical commands.

---

## Overview

We’ll treat `npm run pipeline -- --config configs/cod-test.yaml` (and `npm exec emotion-engine -- ...`) as the only supported interface.

Work includes:
- delete legacy scripts and their references
- update README/docs with:
  - install/setup
  - validate configs
  - dry-run
  - record/replay (digital-twin env vars)
  - where outputs/cassettes/live artifacts go
  - pointers to sibling repos (ai-providers, tools, digital-twin-router / twin packs)

After updates, we’ll remove/close the issue file and commit + push.

---

## Tasks

### Task 1: Delete legacy/deprecated files + remove references

**SubAgent:** `coder`
**Prompt:** In `~/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, delete any legacy/deprecated entrypoints that are not part of the canonical pipeline (at minimum: `bin/run-analysis.js`). Remove references from README/docs/package scripts if any. Ensure `npm run pipeline` and `npm exec emotion-engine` remain the only entrypoints.

**Status:** ⏳ Pending

---

### Task 2: Update README + key docs to polyrepo reality

**SubAgent:** `coder`
**Prompt:** Update README.md and the minimal necessary docs under `docs/` to reflect current reality:
- canonical commands: validate-configs, dry-run, record, replay, tests
- digital twin env vars and how packs/cassettes are referenced
- where to find outputs and captureRaw artifacts (`raw/_meta/events.jsonl`, promptRefs)
- mention polyrepo siblings and where they live / what they provide (ai-providers, tools, digital-twin-router, twin packs)
- remove or rewrite stale docs (e.g. `docs/CONFIG-GUIDE.md` if it’s misleading)

Then update `.issues/readme-and-docs-polyrepo-reality.md` to reflect completion and delete it.

**Status:** ⏳ Pending

---

### Task 3: Verify + commit + push

**SubAgent:** `coder`
**Prompt:** Run `npm test` and `npm run pipeline -- --config configs/cod-test.yaml --dry-run` (and `npm run validate-configs` if present). Then commit with message `docs: sync README + docs to current pipeline` (or split into two commits if cleaner) and push to `origin/main`.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft

*Completed on 2026-03-09*
