# Add `.env.example` with required and supported environment variables

## Context / why it matters
The repo currently uses environment variables in runtime and tests but does not include a committed `.env.example`. This slows onboarding, causes setup guesswork, and leads to avoidable runtime/test failures.

## Current symptoms (exact errors if known)
- README explicitly notes no `.env.example` is committed.
- Common runtime failure when key is missing:

```text
AI_API_KEY ... is required
```

- Provider/integration tests also rely on digital-twin env vars and can fail with cassette errors if not configured.

## Proposed fix approach
1. Add `.env.example` at repo root.
2. Include at least:
   - `AI_API_KEY=` (required placeholder)
3. Include other env vars actually used by this repo (commented as optional/advanced where applicable), e.g.:
   - Provider/test: `AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
   - Digital twin: `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, `DIGITAL_TWIN_CASSETTE`
   - Storage: `STORAGE_PROVIDER`, `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_WEB_IDENTITY_TOKEN_FILE`
   - Config/logging: `MODELS_CONFIG_PATH`, `LOG_LEVEL`, `LOG_FILE`, `SESSION_ID`
4. Add short comments grouping vars by use-case (runtime vs tests vs optional cloud).
5. Update README setup instructions to copy `.env.example` to `.env`.

## Acceptance criteria
- `.env.example` exists at repo root and includes `AI_API_KEY=` placeholder.
- `.env.example` documents all env vars read by runtime/test code paths (or clearly marks test-only vars).
- README setup flow references `.env.example`.
- New contributor can run local dry-run and understand which env vars are required vs optional.