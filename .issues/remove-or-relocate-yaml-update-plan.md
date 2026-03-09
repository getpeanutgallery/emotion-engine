# Remove or relocate outdated `yaml-update-plan.md` from repo root

## Context
The repo root currently contains a tracked file:
- `yaml-update-plan.md`

It appears to be an older planning doc (dated 2026-03-07) that is now outdated and/or conflicts with current reality (we already moved provider/model selection to YAML and added `.env.example`, etc.). It also doesn’t belong at the repo root long-term.

## Symptoms
- `yaml-update-plan.md` is present in repo root alongside README/code.
- Content includes statements like "AI config not used (code uses env vars)" which is no longer true.

## Proposed fix
Choose one:
1) **Delete** the file (preferred if fully obsolete).
2) **Move** it to a historical location:
   - `docs/history/yaml-update-plan-2026-03-07.md`
   and add a top banner: "Historical / superseded".
3) **Convert** it into a current doc and relocate to `docs/CONFIG-GUIDE.md` or `plans/…` (less preferred; likely duplicates other docs).

## Acceptance criteria
- Repo root no longer contains `yaml-update-plan.md`.
- Any preserved content is clearly marked as historical and does not mislead contributors.
