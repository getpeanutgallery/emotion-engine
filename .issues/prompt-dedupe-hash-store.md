# Optional: prompt dedupe via hash store

## Problem
Prompts can be large and repeated across attempts; storing them repeatedly inflates disk.

## Goal
Store prompts by hash and reference them:
- `raw/ai/_prompts/<hash>.json`
- `attempt-XX/prompt.ref.json` with `{ promptHash, path }`

## Acceptance criteria
- Identical prompts across attempts do not duplicate storage.
- References remain stable within a run directory.
