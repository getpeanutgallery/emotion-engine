# emotion-engine: cross-repo AI prompt-contract consistency sweep

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Audit and, where needed, remediate prompt-contract drift across the full emotion-engine system so every meaningful AI JSON/validator lane follows the same prompt standard and does not quietly diverge across repos.

---

## Overview

Derrick wants the whole emotion-engine system checked against the same prompt-contract standard, not just the local `emotion-engine` repo. That’s the right instinct. Even when the validator architecture is aligned, prompt wording can still drift across repos and create inconsistent behavior, weaker guidance, or misleading examples.

This plan treats `emotion-engine` as the coordination owner because it is still the canonical runtime and contract owner, but the sweep explicitly includes all repos in the current emotion-engine system where prompt/validator contract surfaces might live. The purpose is not to reopen architecture decisions; it is to make sure the actual prompt standard is applied consistently everywhere and to eliminate drift before it compounds.

The standard we are enforcing is the one just agreed for enum-like JSON fields: **Option B throughout**. That means JSON examples stay concrete, while every closed-string field with multiple valid values gets an explicit nearby allowed-values note. The sweep also checks for consistency around validator-tool usage, canonical tool envelopes, wrapper-key prohibitions, and “final acceptance only after validator success” wording.

---

## Target repos / system scope

Primary repo:
- `projects/peanut-gallery/emotion-engine`

Sibling repos to inspect for prompt/validator contract surfaces:
- `projects/peanut-gallery/tools`
- `projects/peanut-gallery/ai-providers`
- `projects/peanut-gallery/digital-twin-router`
- `projects/peanut-gallery/digital-twin-core`
- `projects/peanut-gallery/digital-twin-openrouter-emotion-engine`
- `projects/peanut-gallery/digital-twin-emotion-engine-providers`
- plus any other sibling repo proven to contain prompt-contract or validator-facing AI prompt text during the audit

---

## Tasks

### Task 1: Audit prompt-contract surfaces across the full system

**Bead ID:** `ee-yy2`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Audit the full emotion-engine system for meaningful AI prompt-contract surfaces, including emotion-engine and the listed sibling repos. Find every prompt, validator-tool prompt wrapper, contract doc, and related AI JSON example that should follow the shared standard. Produce an inventory of locations, identify inconsistency patterns, and mark which repos/files are actually in scope versus no-op. Update this plan with exact findings and file paths, then close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- repo docs/files only if a tiny inventory artifact is needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`
- optional inventory doc if useful

**Status:** ✅ Complete

**Results:** Claimed `ee-yy2`, audited the listed repos plus nearby evidence, and confirmed the real prompt-contract surface is concentrated in `emotion-engine` with one maintained sibling prompt surface in `../tools`.

#### In-scope repos and files

**1. `emotion-engine` — in scope (primary owner; multiple live prompt-contract surfaces)**

Prompt builders / validator wrappers / contract docs that should follow the shared standard:
- `server/scripts/get-context/get-dialogue.cjs`
  - `buildTranscriptionPrompt(...)`
  - `buildChunkTranscriptionPrompt(...)`
  - `buildDialogueStitcherPrompt(...)`
  - uses shared validator wrapper `executeLocalValidatorToolLoop(...)`
- `server/scripts/get-context/get-music.cjs`
  - `buildAnalysisPrompt(...)`
  - `buildRollingAnalysisPrompt(...)`
  - uses shared validator wrapper `executeLocalValidatorToolLoop(...)`
- `server/scripts/report/recommendation.cjs`
  - `buildPrompt(...)`
  - lane-local validator wrapper `buildToolLoopPrompt(...)`
- `server/lib/local-validator-tool-loop.cjs`
  - shared canonical validator-tool wrapper wording used by dialogue/music/phase2/recovery
- `server/lib/recommendation-validator-tool.cjs`
  - recommendation lane tool-envelope contract surface
- `server/lib/phase1-validator-tools.cjs`
  - lane-specific validator-tool contract surfaces for dialogue / stitch / music
- `server/lib/ai-recovery-lane.cjs`
  - recovery-lane base prompt and validator-tool instructions
- `server/lib/ai-recovery-runtime.cjs`
  - same-script re-entry prompt addendum
- `server/lib/ai-recovery-validator-tool.cjs`
  - recovery tool-envelope / enum-bound contract surface
- `server/lib/persona-loader.cjs`
  - legacy/adjacent prompt-builder surface; not part of the current canonical meaningful AI lanes, but it does contain JSON-example contract wording and pipe-placeholder enums
- durable contract / example docs:
  - `docs/AI-LANE-CONTRACT.md`
  - `docs/AI-RECOVERY-LANE-CONTRACT.md`
  - `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
  - `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
  - `docs/CONFIG-GUIDE.md` (only where it restates AI-lane/recovery contract examples)
- prompt-contract evidence tests worth keeping aligned with wording changes:
  - `test/scripts/get-dialogue.test.js`
  - `test/scripts/get-music.test.js`
  - `test/scripts/recommendation.test.js`
  - `test/scripts/video-chunks.test.js`
  - `test/lib/ai-recovery-validator-tool.test.js`
  - `test/lib/phase1-validator-tools.test.js`
  - `test/lib/recommendation-validator.test.js`
  - `test/lib/script-contract.test.js`

**2. `../tools` — in scope (one real sibling prompt-contract surface)**

Real maintained sibling prompt/validator surface:
- `../tools/emotion-lenses-tool.cjs`
  - `buildPrompt(...)`
  - `buildBasePromptFromInput(...)`
  - `buildEmotionAnalysisValidatorToolContract(...)`
  - validator loop entry via `executeEmotionAnalysisToolLoop(...)`
- sibling contract docs/tests:
  - `../tools/README.md`
  - `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
  - `../tools/test/emotion-lenses-tool.test.js`

**3. Explicit no-op repos for this sweep**

These repos were inspected and did **not** show meaningful AI prompt/validator-contract text that should be updated to the shared standard in this pass:
- `../ai-providers`
  - transport/interface repo only; contains `prompt` plumbing plus debug/redaction docs/tests, but no lane prompt text, validator-tool wrapper, or shared-standard JSON examples to normalize
  - representative files inspected: `ai-provider-interface.js`, `providers/*.cjs`, `README.md`, `utils/provider-debug.cjs`
- `../digital-twin-router`
  - no meaningful AI prompt-contract surfaces found; router/persistence concern only
- `../digital-twin-core`
  - no meaningful AI prompt-contract surfaces found; cassette/schema/core concern only
- `../digital-twin-openrouter-emotion-engine`
  - pack/cassette repo only; only relevant hits were pack validation tests, not AI prompt surfaces
- `../digital-twin-emotion-engine-providers`
  - cassette-pack repo only; no prompt-contract surfaces found

No additional sibling repo beyond the listed set was proven relevant during the audit.

#### Main inconsistency patterns found

1. **Option B drift still exists in live prompt JSON examples.**
   - `server/scripts/get-context/get-music.cjs` still uses pipe-placeholder enum strings inside JSON examples:
     - `"type": "music|speech|silence|ambient|sfx"`
     - `"mood": "upbeat|calm|tense|sad|energetic|neutral"`
   - `server/lib/persona-loader.cjs` still uses a pipe-placeholder enum in the JSON example:
     - `"scroll_risk": "low|medium|high|SCROLLING"`
   - By contrast, `server/scripts/report/recommendation.cjs`, `../tools/emotion-lenses-tool.cjs`, and the AI recovery docs mostly already follow the newer style of concrete JSON plus nearby constraint wording.

2. **Prompt formatting style is inconsistent across live lanes.**
   - `get-dialogue.cjs` and the non-rolling `get-music.cjs` prompt still present fenced ` ```json ` examples and then separately say “Respond ONLY with valid JSON,” while newer surfaces more directly say “Return JSON only” with unfenced examples and explicit no-wrapper language.
   - `recommendation.cjs`, `server/lib/local-validator-tool-loop.cjs`, and `../tools/emotion-lenses-tool.cjs` are the clearest current reference style.

3. **Validator-tool wrapper wording is mostly aligned, but not fully centralized.**
   - Shared generic wrapper lives in `server/lib/local-validator-tool-loop.cjs`.
   - `server/scripts/report/recommendation.cjs` still carries a lane-local `buildToolLoopPrompt(...)` with nearly the same canonical-envelope / wrapper-ban / validator-success wording instead of reusing the shared prompt wrapper text directly.
   - This is not necessarily wrong, but it is a drift seam and should be treated as in scope for wording normalization.

4. **Durable contract docs are partly aligned but still contain example-level Option B drift outside the lane docs.**
   - `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md` still includes pipe-placeholder example enums such as:
     - `"category": "provider_transport | invalid_output | validation | config | dependency | tool | io | timeout | internal"`
     - `"unitType": "script | chunk | split | artifact | provider_attempt | tool_call"`
     - `"policy": "fail | deterministic_recovery | ai_recovery | human_review"`
   - These are contract examples rather than live model prompts, but they are still part of the documented shared standard and should be treated as in scope for wording cleanup in later tasks.

5. **The sibling sweep is much narrower than the repo list implied.**
   - Real sibling prompt-contract remediation scope is currently `../tools` only.
   - `../ai-providers` and the digital-twin repos are important architecture neighbors, but they are no-op for this specific prompt-contract wording sweep.

#### Audit conclusion for follow-up task scoping

- **Primary remediation scope:** `emotion-engine`
- **Secondary sibling remediation scope:** `../tools`
- **No-op / document-only untouched repos:** `../ai-providers`, `../digital-twin-router`, `../digital-twin-core`, `../digital-twin-openrouter-emotion-engine`, `../digital-twin-emotion-engine-providers`
- **Highest-value wording targets for Task 2/3:**
  - remove pipe-placeholder enums from live prompt JSON examples
  - standardize on concrete JSON examples + explicit nearby allowed-values notes
  - normalize “Return JSON only / no markdown / no wrapper” wording where it still differs
  - keep validator-tool envelope / wrapper-ban / validator-success wording consistent between the shared loop and the recommendation lane-local wrapper

---

### Task 2: Define the prompt-contract wording standard precisely

**Bead ID:** `ee-5a5`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Based on the audit, write the concrete prompt-contract wording standard to apply across the system. It must encode Option B for enum-like JSON fields, plus consistent wording around validator-tool usage, canonical tool envelopes, wrapper-key prohibition, and final acceptance after validator success. Update the relevant docs and this plan with the exact standard, then close the bead.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/AI-LANE-CONTRACT.md`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `.plans/2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`

**Status:** ✅ Complete

**Results:** Defined the canonical cross-repo wording standard in `docs/AI-LANE-CONTRACT.md` and linked it from `docs/AI-RECOVERY-LANE-CONTRACT.md`. The standard is concrete enough for mechanical remediation: Option B means concrete JSON examples plus a required nearby `Allowed values for <jsonPath>: ...` note for each closed string field; validator-tool prompts must use the exact canonical acceptance pair (`The final <artifactLabel> JSON is accepted only after <toolName> returns {"valid": true}.` + `After the validator returns valid=true, return ONLY the final <artifactLabel> JSON object with no wrapper.`); canonical tool usage must be described as the **minimal envelope** with the exact JSON object shown; the shared wrapper prohibition sentence is `Do not add type/toolName/arguments/args/input wrappers around the tool call.`; and explicit-tool-call lanes add `You must call <toolName> at least once before any final <artifactLabel> JSON can be accepted.`.

---

### Task 3: Remediate prompt drift in emotion-engine

**Bead ID:** `ee-mlp`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Update all in-scope emotion-engine prompt-contract surfaces to the agreed wording standard. Keep behavior changes minimal unless required to keep prompt instructions truthful. Update tests/docs if needed, update this plan with exact files changed and validation evidence, commit to main, and close the bead.`

**Folders Created/Deleted/Modified:**
- `server/`
- `docs/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/ai-recovery-validator-tool.cjs`
- `server/lib/ai-recovery-lane.cjs`
- `server/lib/persona-loader.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `.plans/2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-mlp` and normalized the live `emotion-engine` prompt-contract surfaces called out by the audit without changing lane behavior beyond keeping the prompt text truthful.

Applied changes:
- standardized shared validator-loop wording in `server/lib/local-validator-tool-loop.cjs` and the recommendation lane-local wrapper in `server/scripts/report/recommendation.cjs` to use **canonical minimal tool call envelope** language, explicitly forbid wrapper aliases, and keep final acceptance tied to validator success
- updated `server/lib/ai-recovery-lane.cjs` and `server/lib/ai-recovery-validator-tool.cjs` so the recovery lane now states validator-tool usage as mandatory, shows the canonical minimal envelope, forbids wrapper aliases, and only accepts the final artifact after validator success
- updated `server/lib/phase1-validator-tools.cjs` success messaging so validator success explicitly means `valid=true` and the final artifact must be returned bare with no wrapper
- converted remaining live Option B drift in prompt examples:
  - `server/scripts/get-context/get-music.cjs` now uses concrete JSON examples plus nearby `Allowed values for ...` notes for `type` / `mood`
  - `server/lib/persona-loader.cjs` now uses a concrete `scroll_risk` example plus an explicit allowed-values note
  - `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md` now uses concrete enum examples plus nearby allowed-values notes for `failure.category`, `failure.failedUnit.unitType`, and `recoveryPolicy.nextAction.policy`
- tightened older dialogue/stitch prompt wording in `server/scripts/get-context/get-dialogue.cjs` so it consistently says `Return JSON only` and adds the nearby fixed-value note for `debug.inputKind`

Validation evidence:
- ran `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/recommendation.test.js test/lib/phase1-validator-tools.test.js test/lib/ai-recovery-validator-tool.test.js test/lib/script-contract.test.js`
- result: **70 tests passed, 0 failed**
- no test file changes were required because the prompt wording changes preserved the existing behavioral contract and test expectations

---

### Task 4: Remediate prompt drift in sibling repos

**Bead ID:** `ee-heh`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Update all in-scope sibling-repo prompt-contract surfaces to the agreed wording standard. Only change repos/files that the audit proved are real prompt/validator surfaces. Keep changes surgical, update this plan with exact repos/files touched and validation evidence, commit in the owning repos, and close the bead.`

**Folders Created/Deleted/Modified:**
- sibling repo prompt/docs surfaces as identified by audit
- `.plans/`

**Files Created/Deleted/Modified:**
- only in-scope sibling files
- `.plans/2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-heh`, applied the agreed wording standard to the only audited sibling repo that proved to own a live prompt-contract surface: `../tools`.

#### Repos/files touched

**Changed in `../tools`:**
- `../tools/emotion-lenses-tool.cjs`
  - kept the JSON example concrete for `dominant_emotion` (`"patience"` instead of a descriptive placeholder) and added the required Option B note:
    - `Allowed values for dominant_emotion: <lens1> | <lens2> | ...`
- `../tools/test/emotion-lenses-tool.test.js`
  - added an assertion that the prompt includes the explicit Option B allowed-values line
- `../tools/README.md`
  - documented that the tools-owned contract surface now follows Option B for closed string fields and uses the shared validator-tool wording standard
- `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
  - added a 2026-03-15 addendum recording the sibling-repo wording sweep, the exact prompt-surface change, and why the shared loop file stayed untouched

**Intentionally not changed in `../tools`:**
- `../tools/lib/local-validator-tool-loop.cjs`
  - rechecked and left unchanged because it already matched the agreed validator-tool wording standard:
    - `The final <artifact> JSON is accepted only after <toolName> returns {"valid": true}.`
    - `Do not add type/toolName/arguments/args/input wrappers around the tool call.`
    - `After the validator returns valid=true, return ONLY the final <artifact> JSON object with no wrapper.`

**Sibling repos intentionally untouched for this pass:**
- `../ai-providers`
- `../digital-twin-router`
- `../digital-twin-core`
- `../digital-twin-openrouter-emotion-engine`
- `../digital-twin-emotion-engine-providers`

The audit had already shown these do not own real prompt/validator contract text for this sweep, so no fake consistency edits were made.

#### Validation evidence

Checks run in `../tools`:
- `node --test test/emotion-lenses-tool.test.js`
- `git grep -n "accepted only after\|Do not add type/toolName/arguments/args/input wrappers\|valid=true" lib/local-validator-tool-loop.cjs`
- `git grep -n "Allowed values for dominant_emotion" emotion-lenses-tool.cjs README.md docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md test/emotion-lenses-tool.test.js`

Expected evidence after the change:
- the prompt builder emits the Option B allowed-values note for `dominant_emotion`
- the test suite asserts that note
- the shared loop wording remains exact and already compliant
- only `../tools` changed among sibling repos

---

### Task 5: Verify cross-repo consistency and restate the next live lane

**Bead ID:** `ee-4rf`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Verify that all audited prompt-contract surfaces across emotion-engine and sibling repos now match the agreed standard, summarize any intentionally untouched repos, and restate whether the next truthful paid move is still the live Phase3-only run. Update this plan with exact evidence and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optionally docs if a tiny final truth note is needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-cross-repo-ai-prompt-contract-consistency-sweep.md`

**Status:** ✅ Complete

**Results:** Verified the audited cross-repo prompt-contract surfaces now match the agreed standard and that the sweep is complete without forcing fake edits into repos that do not own prompt-contract text. Cross-repo evidence gathered in this final verification step:
- `grep -RIn "Allowed values for" server docs` in `emotion-engine` now shows the agreed Option B pattern on the remaining audited enum surfaces, including `server/lib/persona-loader.cjs`, `server/lib/ai-recovery-lane.cjs`, `server/scripts/get-context/get-dialogue.cjs`, `server/scripts/get-context/get-music.cjs`, and `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`.
- `grep -RIn "Allowed values for" ../tools` confirms the sibling prompt owner now also follows the same Option B wording in `../tools/emotion-lenses-tool.cjs`, `../tools/README.md`, and the updated test.
- Targeted prompt-contract regression coverage passes in `emotion-engine`: `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/recommendation.test.js test/lib/phase1-validator-tools.test.js test/lib/ai-recovery-validator-tool.test.js test/lib/script-contract.test.js` ✅ (70 passed, 0 failed).
- Config parsing and next-run readiness still pass after the wording sweep: `npm run validate-configs` ✅ and `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --dry-run` ✅.

Intentionally untouched repos remain correctly documented as no-op for this sweep because they do not own meaningful AI prompt/validator-contract text: `../ai-providers`, `../digital-twin-router`, `../digital-twin-core`, `../digital-twin-openrouter-emotion-engine`, and `../digital-twin-emotion-engine-providers`.

The next truthful paid lane is still the same: run the live Phase3-only validation first, now with (a) explicit recovery activation, (b) mandatory validator-tool mediation in the AI recovery lane, and (c) prompt-contract wording normalized across the real system surfaces. Exact next command from repo root:
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose`

If that succeeds, the next full-run lane remains:
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

---

## Intended execution order

1. Task 1 — audit all repos for in-scope prompt-contract surfaces
2. Task 2 — define the exact wording standard
3. Task 3 — remediate `emotion-engine`
4. Task 4 — remediate sibling repos
5. Task 5 — verify consistency and restate the next live lane

Task 5 depends on all prior tasks.

---

## Standard to enforce

### 1) Option B enum documentation
Use **Option B throughout**:
- keep example JSON concrete
- do **not** place pipe-placeholder enums such as `"foo|bar|baz"` inside example JSON
- for every closed enum-like string field, add an explicit nearby allowed-values note using this template:
  - `Allowed values for <jsonPath>: <value1> | <value2> | <value3>.`

### 2) Validator-tool usage wording
When a lane requires validator-tool mediation, use this exact wording family:
- `You have access to one local validation tool.`
- `You may respond with exactly one JSON object in one of these forms:`
- `If you call the tool, use exactly this minimal envelope: <canonicalEnvelope>.`
- `The final <artifactLabel> JSON is accepted only after <toolName> returns {"valid": true}.`
- `After the validator returns valid=true, return ONLY the final <artifactLabel> JSON object with no wrapper.`
- add this line for explicit-tool-call lanes only: `You must call <toolName> at least once before any final <artifactLabel> JSON can be accepted.`

### 3) Canonical tool-envelope wording
- describe the validator call shape as the **canonical minimal envelope**
- show the exact JSON object for the lane-specific envelope
- do not document alias envelope shapes as acceptable alternatives

### 4) Wrapper-key prohibition wording
Use this exact baseline sentence:
- `Do not add type/toolName/arguments/args/input wrappers around the tool call.`

If a lane rejects additional alias keys in parsing, add those as lane-local tightening without replacing the shared baseline sentence.

### 5) Final acceptance after validator success wording
Use the same acceptance sequence everywhere:
1. validator-tool usage is the only pre-acceptance validation path
2. validator success means the tool returned `{"valid": true}`
3. only after that success may the model return the bare final artifact JSON
4. the final accepted artifact is the bare artifact object, never the tool envelope

### Drift rule
If a repo does not actually own a prompt-contract surface, document that and leave it unchanged rather than forcing fake edits.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A full-system prompt-contract consistency sweep across the emotion-engine system. The work now records: (1) the actual audit scope across all listed repos, (2) the durable wording standard for Option B enum documentation and validator-tool prompt language, (3) remediation of the real prompt-contract owners in `emotion-engine` and `../tools`, and (4) final verification that the in-scope cross-repo surfaces now match the agreed standard while the non-owning sibling repos were correctly left unchanged.

**Commits:**
- `d032407` — `Define prompt contract wording standard`
- `b0bb55b` — `Normalize prompt contract wording surfaces`
- `cb13e6f` in `../tools` — `Align emotion-lenses prompt contract wording`
- `a455dcb` — `Document sibling prompt contract sweep`

**Lessons Learned:** The system-wide drift risk was real, but narrower than the repo list implied. The right move was to audit the whole system, prove ownership boundaries, then normalize the actual prompt-contract owners instead of making ceremonial edits in transport/cassette repos that do not own prompt text. That preserves consistency without muddying repo responsibility.

---

*Drafted on 2026-03-15*