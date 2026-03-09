# Missing provider cassette / cassette pack expectations for integration tests

## Context / why it matters
Provider and integration tests currently depend on digital-twin cassette replay, but repository setup does not enforce or provision a valid cassette pack/cassette pair. This causes test instability across machines and CI and makes green test runs non-reproducible.

## Current symptoms (exact errors if known)
When running provider/integration tests without a valid cassette pair:

```text
Error: Cassette not found: providers at /home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-emotion-engine-providers
Ensure the cassette exists or switch to 'record' mode to create it.
```

Observed in `test/integration/ai-provider-flow.test.js` (fails text completion flow tests when cassette is missing).

## Proposed fix approach
1. Define a clear cassette contract in docs and test bootstrap:
   - required env vars (`DIGITAL_TWIN_PACK`, `DIGITAL_TWIN_CASSETTE`, `DIGITAL_TWIN_MODE`)
   - expected default pack/cassette names
2. Add preflight validation helper for cassette path existence before test execution, with a targeted actionable message.
3. Optionally add a setup script (`npm run test:providers:check`) that validates pack + cassette before running provider/integration suites.
4. Update README/testing docs to show both replay and record workflows.

## Acceptance criteria
- Running provider/integration test command with missing cassette yields a single clear preflight failure explaining how to fix.
- Running with a valid cassette pack/cassette succeeds past cassette bootstrap.
- README and test docs describe cassette expectations and required env vars.
- CI path either provisions cassette artifacts or skips cassette-dependent suites with explicit reason.