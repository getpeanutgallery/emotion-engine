# Add issues: adapter smoketests + OAuth architecture

**Date:** 2026-03-09  
**Status:** Superseded (draft never executed)
**Agent:** Cookie 🍪

---

## Goal

Add tracking issues to cover:
1) Direct adapter/API-key validation for non-OpenRouter adapters (OpenAI, Anthropic, Gemini) — one issue per adapter.
2) OAuth support design + implementation issues (either OAuth support in existing adapters, or new OAuth-specific adapters and rename current adapters to API-key-only).

---

## Context

Current constraint: we’re using **OpenRouter for everything** right now.

Before we can safely switch to direct adapters, we need explicit smoketests + docs for API key configuration.

Separately, OAuth support is likely a larger architectural choice and should be tracked as a series of issues.

---

## Proposed Issue Files (ai-providers `.issues/` tracker)

### Adapter smoketests (API keys)
Create under: `~/.openclaw/workspace/projects/peanut-gallery/ai-providers/.issues/`
- `adapter-openai-api-key-smoketest.md`
- `adapter-anthropic-api-key-smoketest.md`
- `adapter-gemini-api-key-smoketest.md`

Each should include:
- required env vars
- minimal `ai.<domain>.targets` example YAML
- a smallest “hello world” pipeline step (or unit/integration test) proving it works
- expected debug output shape

### OAuth series
I propose 4 issues (in `ai-providers/.issues/`):
- `oauth-architecture-decision.md` (choose strategy: extend adapters vs create oauth-* adapters; rename current adapters to api-*?)
- `oauth-openai-adapter.md`
- `oauth-anthropic-adapter.md`
- `oauth-gemini-adapter.md`

Each should include:
- auth flows supported (device code? refresh token? local callback?)
- token storage + rotation rules
- security considerations
- test plan

---

## Tasks

### Task 1: Create the new issue files

**SubAgent:** `coder`
**Prompt:** In `~/.openclaw/workspace/projects/peanut-gallery/ai-providers/.issues/`, create the 3 adapter smoketest issues + 4 OAuth issues listed above with clear acceptance criteria.

**Status:** ⏳ Pending

---

### Task 2: Commit + push

**SubAgent:** `coder`
**Prompt:** Commit the new issue files in ai-providers with message `chore(issues): add adapter smoketest + oauth tracking` and push to `origin/main`.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft

*Completed on 2026-03-09*
