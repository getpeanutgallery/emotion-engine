# Gemini dialogue JSON contract audit (prompt/schema/validator)

**Date:** 2026-04-10  
**Scope:** `get-dialogue` transcription prompt + validator contract + local repair loop guidance  
**Focus:** JSON-shape ambiguity causing Gemini failures, especially `acoustic_descriptors`

## Contract reality today (as implemented)

- Runtime validator requires `speaker_profiles[*].grounded.acoustic_descriptors` to be an **array of objects** (not strings), where each entry must have `label` (string) and may include `confidence` (0..1).  
  - `server/lib/structured-output.cjs:100-119`
- Runtime prompt examples (whole + chunked) show `acoustic_descriptors` as an **array of strings**.  
  - `server/scripts/get-context/get-dialogue.cjs:2239`  
  - `server/scripts/get-context/get-dialogue.cjs:2488`

This is the primary schema contradiction.

## Findings

### 1) **Hard contradiction:** prompt example uses string array, validator requires object array

- Prompt shape says:
  - `"acoustic_descriptors": ["low raspy voice", "close-mic delivery"]`
  - (`get-dialogue.cjs:2239`, `2488`)
- Validator rejects those entries with:
  - `acoustic_descriptors entries must be objects.`
  - (`structured-output.cjs:110-112`)

**Impact:** High. This directly explains Gemini emitting the wrong shape and getting rejected.

---

### 2) Prompt rules mention *what* descriptors should contain, but not canonical entry schema

- Rules say to include practical `acoustic_descriptors`, but do not explicitly state:
  - each entry must be an object,
  - required key is `label`,
  - strings are invalid.
- Relevant lines:
  - `get-dialogue.cjs:2301-2303`
  - `get-dialogue.cjs:2540-2542`

**Impact:** High. Even after retries, model may continue producing strings or alternate keys.

---

### 3) Validator currently accepts alias keys (`descriptor`, `acousticDescriptors`) that are not documented as canonical

- `validateAcousticDescriptors` accepts `entry.label ?? entry.descriptor`.
- Grounded object accepts `input.acoustic_descriptors ?? input.acousticDescriptors`.
- Relevant lines:
  - `structured-output.cjs:116`
  - `structured-output.cjs:191-193`

**Impact:** Medium. This weakens a single-source canonical contract and can encourage inconsistent model outputs over time.

---

### 4) Lean runtime path does not expose tool contract schema up front

- Dialogue transcription tool loop is run with `runtimeStyle: 'lean'` (`get-dialogue.cjs:2402`).
- Lean mode sends base prompt first; tool contract JSON (with canonical example object descriptors) is not provided on turn 1.
- Tool/repair guidance only becomes specific *after* a validation failure.

**Impact:** Medium. Increases first-pass schema misses and burn of retry budget.

---

### 5) Non-runtime prompt drafts in `docs/` repeat the same string-array shape

- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md:43`
- `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md:43`

**Impact:** Low/Medium (docs-only), but this reinforces the wrong mental model for future edits.

---

### 6) Prompt regression test coverage does not assert canonical `acoustic_descriptors[*].label` contract text

- Current prompt assertions check inferred-traits detail and descriptor intent language, but not the concrete object-shape requirement for descriptors.
- `test/scripts/get-dialogue.test.js:1671-1695`

**Impact:** Medium. Contract drift can re-enter unnoticed.

## Recommended contract wording changes (exact)

Apply to both whole-asset and chunk prompts.

1) Replace descriptor example with canonical object form:

```json
"acoustic_descriptors": [
  { "label": "low raspy voice", "confidence": 0.62 },
  { "label": "close-mic delivery", "confidence": 0.58 }
]
```

2) Add explicit schema bullets under Speaker profile rules:

- `acoustic_descriptors` must be an array of objects.
- Every `acoustic_descriptors[*]` entry must include a non-empty string `label`.
- `acoustic_descriptors[*].confidence` is optional; when present it must be a number from 0.0 to 1.0.
- Do not return string items in `acoustic_descriptors`.
- Do not use alternate keys such as `value`, `descriptor`, or camelCase variants; use `label` and `acoustic_descriptors` only.
- If no grounded descriptor is supportable, return `"acoustic_descriptors": []`.

3) Add one repair-line in recovery addendum for this failure family (dialogue lane only):

- `If validation mentions acoustic_descriptors shape, rewrite them as objects: [{"label":"...","confidence":0.x}] (or [] when unsupported).`

4) Decide strictness for alias keys in validator (recommended for hardening):

- Preferred: remove alias acceptance (`descriptor`, `acousticDescriptors`) so canonical shape is enforced end-to-end.
- Transitional alternative: keep aliases temporarily, but make prompt/recovery/tests canonical and add TODO + deprecation date.

5) Add regression assertions that prompt text includes explicit object-schema bullets above.

## Bottom line

The biggest blocker is a direct contradiction between prompt examples and validator schema for `acoustic_descriptors`. Fixing that contradiction (and making canonical key rules explicit) should materially reduce Gemini JSON-shape failures before any provider-level instability is considered.