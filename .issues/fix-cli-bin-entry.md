# Fix stale CLI bin entry (`package.json#bin`)

## Context / why it matters
The package advertises an executable CLI (`emotion-engine`) via `package.json#bin`, but the configured file does not exist. This breaks package usability for global installs, `npm exec`, and any workflow expecting the published CLI entrypoint.

## Current symptoms (exact errors if known)
`package.json` currently points to:

```json
"bin": {
  "emotion-engine": "./bin/run-pipeline.js"
}
```

But only `bin/run-analysis.js` exists. Attempting to run the configured path fails with:

```text
Error: Cannot find module '/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/bin/run-pipeline.js'
code: 'MODULE_NOT_FOUND'
```

## Proposed fix approach
Choose one canonical CLI strategy and align package + docs:
1. **Preferred**: add `bin/run-pipeline.js` as a thin CLI wrapper around `server/run-pipeline.cjs`.
2. Or update `package.json#bin` to the actual maintained executable if `run-analysis.js` is intended.
3. Add executable permission + shebang (`#!/usr/bin/env node`) and smoke test in CI (`node <bin> --help` or dry-run).
4. Update README to reflect the official CLI entrypoint.

## Acceptance criteria
- `package.json#bin` points to a real committed executable file.
- `npm exec emotion-engine -- --config configs/example-pipeline.yaml --dry-run` resolves the CLI and starts orchestrator without `MODULE_NOT_FOUND`.
- README and scripts reference the same canonical entrypoint.
- A test/CI check guards against missing bin targets in future changes.