# Scan ~/.openclaw/workspace/plans for emotion-engine + siblings; prune obsolete plans (ignore ArtCraft)

## Context
We have a growing set of plan markdowns under `~/.openclaw/workspace/plans/` for emotion-engine and related repos (ai-providers, digital-twin-router, twin packs, polyrepo hygiene). Many were created during rapid iteration and may now be:
- superseded by implemented code
- duplicated by a newer “canonical” plan
- better represented as repo-local docs (`README.md`, `docs/*`) or `.issues/*`

Keeping obsolete plans around increases confusion and leads to running the wrong commands (especially around record/replay semantics and where cassettes live).

## Scope
1) Inventory relevant plans (ignore ArtCraft):
   - `~/.openclaw/workspace/plans/peanut-gallery/emotion-engine/*.md`
   - `~/.openclaw/workspace/plans/peanut-gallery/ai-providers/*.md`
   - `~/.openclaw/workspace/plans/peanut-gallery/debug-and-replay-fixes/*.md`
   - `~/.openclaw/workspace/plans/peanut-gallery/polyrepo/*.md`
   - `~/.openclaw/workspace/plans/digital-twin-repos/*.md`
   - (optionally) `~/.openclaw/workspace/plans/emotion-engine/*.md` (top-level, if present)

2) For each plan doc, classify:
   - **Keep (canonical):** still correct + referenced
   - **Convert:** distill into a repo `.issue` and/or move key parts into `README/docs`
   - **Delete:** obsolete/duplicative after conversion or after verifying code reality

3) Produce an “approved deletion list” (explicit filenames) and then delete those plan files in a single commit.

## Acceptance Criteria
- A written inventory exists (table/list is fine) with classification and rationale for each plan file in scope.
- A proposed deletion list is reviewed/approved (even if “approved” just means a human OK in the PR/commit message).
- Obsolete plan files are deleted and the deletions are committed (no accidental removal of canonical references).
- Any surviving canonical plan(s) clearly point to the repo-local sources of truth (README/docs) and avoid duplicating run commands.

## Notes/Links
Starting inventory (captured 2026-03-09):

### emotion-engine plans
Directory: `~/.openclaw/workspace/plans/peanut-gallery/emotion-engine/`
- `CANONICAL-PIPELINE-PLAYBOOK.md` (likely canonical; verify it matches repo reality)
- Many dated plans (2026-03-08/09) covering: YAML wiring, digital-twin integration, cod-test, raw capture, ffmpeg fixes, report QA, etc.

### sibling plans
- `~/.openclaw/workspace/plans/peanut-gallery/ai-providers/2026-03-08-sync-ai-providers-repo.md`
- `~/.openclaw/workspace/plans/peanut-gallery/debug-and-replay-fixes/`:
  - `2026-03-09-openrouter-debug-capture-and-digital-twin-consumption.md`
  - `2026-03-09-record-failures-and-rerun-cod-test.md`
- `~/.openclaw/workspace/plans/peanut-gallery/polyrepo/`:
  - `2026-03-08-docs-cleanup-and-git-ssh-deps.md`
  - `2026-03-08-publish-ai-providers-and-fix-goals-branch.md`
- `~/.openclaw/workspace/plans/digital-twin-repos/2026-03-08-digital-twin-repo-names.md`

Top-level emotion-engine plans (outside `peanut-gallery/`):
- `~/.openclaw/workspace/plans/emotion-engine/2026-03-09-issues-triage-and-priority-alignment.md`
- `~/.openclaw/workspace/plans/emotion-engine/2026-03-09-pre-golden-run-hygiene-issues-and-plans-scan.md`

Related repo-local trackers:
- `projects/peanut-gallery/emotion-engine/.issues/` (canonical task tracker for repo work)
- `projects/peanut-gallery/emotion-engine/README.md` + `docs/*`
