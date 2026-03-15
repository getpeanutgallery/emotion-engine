# Polyrepo Drift Findings Audit — 2026-03-14

## Scope

This audit checked **actual runtime/import ownership**, not the intended ownership model already documented in `docs/POLYREPO-OWNERSHIP-MODEL-AUDIT-2026-03-14.md`.

Repos inspected:

- `emotion-engine`
- `tools`
- `ai-providers`
- `retry-strategy`
- `goals`
- `cast`
- `digital-twin-router`
- `digital-twin-core`
- `digital-twin-openrouter-emotion-engine`
- `digital-twin-emotion-engine-providers`

Audit questions:

1. What code paths does `emotion-engine` actually execute today?
2. Which sibling packages are true owners versus thin wrappers/shims?
3. Where do we have duplicated implementations or duplicated fixture packs?
4. Do the digital-twin pack repos still match current runtime assumptions?

---

## Executive Summary

The main drift is real and concentrated in two places:

1. **`tools` is no longer the effective owner of `emotion-lenses-tool` at runtime.**
   `emotion-engine` now owns the canonical implementation, while the installed `node_modules/tools/emotion-lenses-tool.cjs` entrypoint inside `emotion-engine` is a local shim that re-exports `../../server/lib/emotion-lenses-tool.cjs`.

2. **The provider twin-pack boundary has drifted.**
   `emotion-engine` tests default to an in-repo fixture pack at `test/fixtures/digital-twin-emotion-engine-providers`, while the sibling repo `../digital-twin-emotion-engine-providers` exists as the nominal pack owner and its cassette contents have already diverged from the fixture copy.

Outside those two areas, the other sibling boundaries are mostly coherent:

- `ai-providers` still owns provider adapters and transport/debug capture.
- `digital-twin-router` and `digital-twin-core` still own replay/router/schema logic.
- `retry-strategy`, `goals`, and `cast` do **not** appear to have been absorbed back into `emotion-engine`.

---

## Concrete Drift Cases

### 1) `tools` package entrypoint inside `emotion-engine` is a shim back into `emotion-engine`

**Evidence**

- `emotion-engine/node_modules/tools/emotion-lenses-tool.cjs`

```js
module.exports = require('../../server/lib/emotion-lenses-tool.cjs');
```

- The canonical implementation being re-exported is:
  - `emotion-engine/server/lib/emotion-lenses-tool.cjs`

- `emotion-engine` still depends on `tools` as a package dependency in `package.json` / `package-lock.json`, so package resolution suggests sibling ownership while runtime execution actually resolves back into engine-local code.

**Why this is drift**

This is not merely a convenience wrapper in the sibling repo. It is a **runtime indirection inside the consuming repo’s installed dependency tree** that makes the package surface appear external while the executed code is local to `emotion-engine`.

That obscures true ownership in three ways:

1. reading config/imports suggests `tools` owns the tool
2. reading runtime behavior shows `emotion-engine` owns it
3. reading `../tools` shows a different standalone implementation

**Assessment**

- **Severity:** High
- **Type:** Real ownership drift / hidden runtime owner
- **Current true owner in practice:** `emotion-engine`
- **Intended owner per polyrepo design concern:** likely `tools`, unless architecture is deliberately being collapsed

---

### 2) `tools/emotion-lenses-tool.cjs` has materially drifted behind the in-engine implementation

**Evidence**

Compared files:

- `tools/emotion-lenses-tool.cjs`
- `emotion-engine/server/lib/emotion-lenses-tool.cjs`

The engine-local copy now includes behavior that the sibling `tools` repo does not:

- structured-output validation via `parseAndValidateJsonObject(...)`
- local validator-tool-loop support via `executeLocalValidatorToolLoop(...)`
- provider option shaping via `buildProviderOptions(...)`
- canonical exports such as:
  - `EMOTION_ANALYSIS_TOOL_NAME`
  - `buildBasePromptFromInput`
  - `buildEmotionAnalysisValidatorToolContract`
  - `executeEmotionAnalysisValidatorTool`
  - `executeEmotionAnalysisToolLoop`
- stricter JSON-only response contract and lens validation
- richer returned completion metadata (`rawResponse`, `completion`)

By contrast, `tools/emotion-lenses-tool.cjs` is still a more standalone implementation that:

- directly calls the provider once
- parses JSON with a fallback regex for fenced blocks
- lacks the validator-tool-loop contract and structured-output helpers
- exports only `validateVariables`, `buildPrompt`, `parseResponse`, and `analyze`

**Why this is drift**

This is not just wrapper behavior. It is **duplicate implementation divergence** between the sibling repo and the engine-local copy, with the engine-local copy clearly ahead.

That means the sibling repo is no longer a trustworthy canonical owner for this tool behavior.

**Assessment**

- **Severity:** High
- **Type:** Duplicate implementation drift
- **Current true owner in practice:** `emotion-engine`
- **Risk:** future bug fixes or contract changes can land in one copy and silently miss the other

---

### 3) Dependency pinning + locally mutated `node_modules` obscures true package owners

**Evidence**

`emotion-engine/package-lock.json` currently pins sibling packages to older git SHAs than the sibling workspace heads inspected during this audit:

- `tools` locked to `780b60390e866a9904ff522eeb1f693b7e84965b`
- `ai-providers` locked to `1a6dc181d646fe350ac2acc248f7036ef9a71bae`
- `retry-strategy` locked to `69ec69635d5539747975dc360d1eb3a1746e635e`

Current workspace heads during the audit were different:

- `../tools` → `20ab1dd`
- `../ai-providers` → `79db2dc`
- `../retry-strategy` → `e1122d6`

Additionally, `emotion-engine/node_modules/tools/emotion-lenses-tool.cjs` has a local shim back into `emotion-engine`, which is not representative of the sibling repo’s current source tree.

**Why this is drift**

Pinned git dependencies are fine on their own. The drift problem is the combination of:

- pinned historical SHAs,
- sibling repos continuing to evolve independently,
- and an installed dependency being locally rewritten to point back into `emotion-engine`.

That makes it hard to answer basic questions like “which repo actually owns this behavior?” or “did this runtime come from the sibling package or from local engine code?”

**Assessment**

- **Severity:** Medium-high
- **Type:** Resolution/packaging drift that obscures ownership
- **Notes:** this is especially problematic for `tools`; it is less concerning for the other packages unless similar local rewrites exist

---

### 4) `emotion-engine` ships and uses a duplicated provider twin-pack instead of the sibling pack repo

**Evidence**

`emotion-engine` tests default to the in-repo fixture pack:

- `emotion-engine/test/ai-providers/openai.test.js`
- `emotion-engine/test/ai-providers/gemini.test.js`
- `emotion-engine/test/ai-providers/anthropic.test.js`
- `emotion-engine/test/ai-providers/openrouter.test.js`
- `emotion-engine/test/integration/ai-provider-flow.test.js`

All set:

```js
process.env.DIGITAL_TWIN_PACK = process.env.DIGITAL_TWIN_PACK || path.resolve(__dirname, '..', 'fixtures', 'digital-twin-emotion-engine-providers');
```

That fixture exists at:

- `emotion-engine/test/fixtures/digital-twin-emotion-engine-providers/cassettes/providers.json`

But the sibling pack repo also exists:

- `../digital-twin-emotion-engine-providers`

And the two cassette copies have already diverged.

Observed divergence between:

- `emotion-engine/test/fixtures/digital-twin-emotion-engine-providers/cassettes/providers.json`
- `digital-twin-emotion-engine-providers` repo `HEAD:cassettes/providers.json`

Differences include:

- different `meta.description`
- different timestamps and tags
- different response text payloads (`"Hello from ... (cassette)."` vs older sibling-pack wording)
- different `durationMs` values (`null` vs `0`)
- the fixture copy contains an extra duplicated OpenRouter interaction (`entry_..._dup2`)

**Why this is drift**

This means the sibling pack repo is **not** the actual default source of truth for provider replay fixtures used by `emotion-engine` tests. The engine-local fixture pack is.

That is exactly the kind of pack/runtime drift this audit was asked to detect: the code repo and pack repo both exist, but day-to-day test behavior follows the duplicated in-engine fixture rather than the sibling pack.

**Assessment**

- **Severity:** High
- **Type:** Pack ownership drift / duplicated fixture drift
- **Current true owner in practice:** `emotion-engine/test/fixtures/...`
- **Nominal owner by repo boundary:** `digital-twin-emotion-engine-providers`

---

### 5) `digital-twin-openrouter-emotion-engine` docs have drifted from the current manifest/runtime shape

**Evidence**

Current manifest in `../digital-twin-openrouter-emotion-engine/manifest.json`:

- `defaultCassetteId: "cod-test-golden-20260309-082851"`
- `cassettes: ["cassettes/cod-test-golden-20260309-082851.json"]`

But `../digital-twin-openrouter-emotion-engine/README.md` still documents the older shape:

- default cassette id `openrouter-emotion-engine`
- cassette list `openrouter-emotion-engine.json`
- structure example showing `cassettes/openrouter-emotion-engine.json`

**Why this is drift**

This is documentation/runtime drift inside the pack repo. The router currently only depends on `manifest.defaultCassetteId` plus the pack directory layout, so this is not a logic-owner violation, but it does mean the durable docs no longer describe the actual shipped pack.

**Assessment**

- **Severity:** Medium
- **Type:** Pack documentation drift
- **Impact:** likely to mislead manual test setup and replay usage

---

## Notable Non-Drift Cases

### A) `ai-providers` still owns provider/transport logic

**Evidence**

- provider implementations remain in:
  - `ai-providers/providers/openrouter.cjs`
  - `ai-providers/providers/openai.cjs`
  - `ai-providers/providers/anthropic.cjs`
  - `ai-providers/providers/gemini.cjs`
- provider debug/failure metadata lives in:
  - `ai-providers/utils/provider-debug.cjs`
- provider loading contract lives in:
  - `ai-providers/ai-provider-interface.js`

`emotion-engine` consumes provider metadata and classifications, but this audit did **not** find engine-local copies of the provider adapters themselves.

**Assessment:** acceptable boundary; not drift.

---

### B) `digital-twin-router` and `digital-twin-core` still own replay/router/schema behavior

**Evidence**

- router logic remains in `digital-twin-router/index.js`
- cassette/schema/engine/store logic remains in `digital-twin-core/lib/*.js`
- `ai-providers` imports `createTwinTransport` from `digital-twin-router`
- `digital-twin-router` imports `TwinStore`, `TwinEngine`, normalizer, cassette helpers, and redaction helpers from `digital-twin-core`

`emotion-engine` contains usage and repro scripts for those packages, but not parallel copies of their implementation internals.

**Assessment:** acceptable boundary; not drift.

---

### C) `retry-strategy`, `goals`, and `cast` are not currently being reabsorbed into `emotion-engine`

**Evidence**

- `emotion-engine` config docs mention retry settings, but this audit did not find imported copies of `retry-strategy` implementation files inside `emotion-engine`
- `retry-strategy` remains a standalone generic retry primitive package
- `goals` and `cast` remain content/package surfaces rather than logic that has been duplicated into `emotion-engine`

There is package pinning drift at the dependency-resolution level, but not evidence that these repos’ domain logic has been copied back into engine-owned source files.

**Assessment:** no current ownership drift found.

---

### D) `digital-twin-emotion-engine-providers` package structure is odd, but not itself a runtime violation

**Evidence**

- `digital-twin-router` resolves a twin pack from a directory path and reads `manifest.json` for `defaultCassetteId`
- `emotion-engine/test/helpers/digital-twin-preflight.cjs` only requires a pack directory with `cassettes/<cassette>.json`
- therefore the sibling pack repo lacking an `index.js` and using `main: "manifest.json"` is unusual, but not the source of the observed runtime drift

**Assessment:** structure may be sparse, but the actual drift is the duplicated fixture pack inside `emotion-engine`, not this package’s basic layout.

---

## Practical Conclusions

1. **`tools` is the clearest real ownership drift.**
   It currently presents as a sibling package while `emotion-engine` is the real runtime owner.

2. **The provider twin-pack boundary has also drifted materially.**
   The effective test fixture owner is `emotion-engine/test/fixtures/...`, not the sibling pack repo.

3. **Most other sibling boundaries remain intact.**
   `ai-providers`, `digital-twin-router`, and `digital-twin-core` still look like real logic owners rather than empty shells.

4. **The next remediation pass should separate two very different correction types:**
   - code ownership correction (`tools` vs `emotion-engine`)
   - fixture/pack ownership correction (`emotion-engine/test/fixtures/...` vs `digital-twin-emotion-engine-providers`)

---

## Files inspected most directly

- `emotion-engine/server/lib/emotion-lenses-tool.cjs`
- `emotion-engine/node_modules/tools/emotion-lenses-tool.cjs`
- `tools/emotion-lenses-tool.cjs`
- `emotion-engine/package.json`
- `emotion-engine/package-lock.json`
- `ai-providers/ai-provider-interface.js`
- `ai-providers/providers/openrouter.cjs`
- `digital-twin-router/index.js`
- `digital-twin-core/lib/cassette.js`
- `emotion-engine/test/ai-providers/*.js`
- `emotion-engine/test/integration/ai-provider-flow.test.js`
- `emotion-engine/test/fixtures/digital-twin-emotion-engine-providers/cassettes/providers.json`
- `digital-twin-emotion-engine-providers/manifest.json`
- `digital-twin-emotion-engine-providers/package.json`
- `digital-twin-openrouter-emotion-engine/manifest.json`
- `digital-twin-openrouter-emotion-engine/README.md`

---

## Recommended follow-up framing

If Derrick wants remediation, the follow-up should explicitly decide:

1. whether `tools` should again become the canonical owner of `emotion-lenses-tool`, or whether the architecture has intentionally changed and docs/package surfaces should admit `emotion-engine` is canonical
2. whether provider cassette ownership should move fully back to `digital-twin-emotion-engine-providers`, or whether `emotion-engine` should officially own its test fixtures and stop pretending the sibling pack is canonical
3. whether dependency pins should be refreshed and/or local dependency rewrites eliminated so runtime ownership is visible from source and lockfiles
