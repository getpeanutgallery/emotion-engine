# English-only rule rollout contract

Date: 2026-04-29  
Owner bead: `ee-hmtu`  
Scope: Emotion Engine AI-backed phases 1-3 only

## Decision

Adopt one explicit **English-only output contract** for every AI-backed prompt and every AI recovery/repair re-entry used by Emotion Engine phases 1-3.

This rollout is intentionally narrow:
- it standardizes **prompted output language only**
- it applies to **model-authored free-text fields and provider-exposed thought/reasoning traces when the provider emits them**
- it does **not** change scoring logic, schema shape, benchmark truth, persona definitions, or overall content-quality goals

The confirmed failure in current evidence is Phase 2 mixed-language output, but the propagation path is cross-phase: Phase 1 emits carry-forward text, Phase 2 reuses prior summaries and emits new summaries/reasoning, and Phase 3 consumes those outputs for recommendation prose. A bounded fix therefore has to be cross-phase, not Phase-2-only.

## Exact rule wording pattern to enforce

Every AI prompt-builder surface listed below must include this policy block verbatim or with only surface-local noun substitutions that do not change meaning:

> **ENGLISH-ONLY OUTPUT RULE**  
> - Think in English.  
> - Write every model-authored output field in English only.  
> - Keep summaries, reasoning, notes, labels, findings, suggestions, and any other explanatory text in English only.  
> - If the source media contains non-English spoken words, lyrics, or on-screen text, preserve those only when the schema requires a literal quote/transcription/extracted source string.  
> - Any surrounding explanation, summary, reasoning, translation, label, or note must still be in English.  
> - Do not switch languages, mix languages, or translate the final artifact into another language.  
> - If you are unsure, default to English for all non-literal text.

Why this exact pattern:
- `Think in English` is the only honest way to address provider-exposed reasoning traces like `providerResponse.body.choices[0].message.reasoning` that are already leaking Chinese in raw captures.
- `Write every model-authored output field in English only` covers normalized JSON fields, not just hidden/provider reasoning.
- The literal-source carve-out preserves valid transcription/extraction behavior without allowing the rest of the artifact to drift.
- `If you are unsure, default to English` makes repair turns deterministic instead of permissive.

## Where the rule must appear

The rule must appear at every model-facing prompt surface that can create, repair, or restate AI-authored text.

### Phase 1 — get-context

Add the rule to the base prompt text for:
- `server/scripts/get-context/get-dialogue.cjs`
  - `buildTranscriptionPrompt(...)`
  - `buildChunkTranscriptionPrompt(...)`
  - `buildDialogueStitcherPrompt(...)`
- `server/scripts/get-context/get-music.cjs`
  - `buildWholeAssetMusicPrompt(...)`
  - `buildRollingAnalysisPrompt(...)`
- `server/scripts/get-context/get-music-vocals.cjs`
  - `buildWholeAssetMusicVocalsPrompt(...)`
  - `buildRollingVocalsAnalysisPrompt(...)`
- `server/scripts/get-context/get-visual-identity.cjs`
  - whole-asset visual-identity prompt builder in this file

### Phase 2 — process

Add the rule to the base prompt text for:
- `server/scripts/process/video-chunks.cjs`
  - the provider-facing chunk analysis prompt assembled through `../tools/emotion-lenses-tool.cjs`
- `../tools/emotion-lenses-tool.cjs`
  - canonical chunk base prompt builder used by Phase 2 chunk analysis
- `server/scripts/process/whole-video-mimo.cjs`
  - whole-video analysis prompt builder

### Phase 3 — report

Add the rule to the base prompt text for:
- `server/scripts/report/recommendation.cjs`
  - recommendation prompt builder

### Cross-cutting recovery / repair surfaces

Add the same contract to:
- `server/lib/ai-recovery-runtime.cjs`
  - `buildRecoveryPromptAddendum(...)`
  - `buildLocalValidationRepairPromptAddendum(...)`

This is mandatory because recovery turns currently preserve schema/task but do not preserve output language. Without this, a structurally valid repair can remain non-English.

## Placement pattern inside each prompt

The implementation should place the English-only block in the **rules / instructions section immediately before the existing JSON-only / schema-only return instructions**.

Required placement pattern:
1. task/context
2. evidence / guardrail rules
3. **English-only output rule**
4. JSON-only / exact-schema return instructions
5. tool-loop or validator instructions
6. recovery addendum when present

Reason: the language contract needs to be read as a primary output constraint, not buried after the schema or left only to repair prompts.

## What counts as compliance

A surface is compliant only if **both** of these are true.

### A. Prompt-level compliance

The model-facing prompt or repair addendum explicitly states all of the following:
- think in English
- all model-authored free-text output must be English only
- literal quoted/transcribed non-English source content is the only carve-out
- surrounding explanation must still be English
- do not mix languages

A weaker prompt is **not** compliant if it says only things like:
- `Use English`
- `Respond in English if possible`
- `Return JSON in English`
- `Prefer English`

Those are too weak because they do not cover provider reasoning leakage, mixed-language artifacts, or literal-source carve-outs.

### B. Runtime/artifact compliance

For verification reruns, all model-authored free-text fields emitted by the exercised surfaces are English-only.

This includes, when present:
- summaries
- reasoning fields
- rolling summaries / handoff summaries / previous summaries generated by the model
- note arrays such as `recognitionNotes`, `qualityNotes`, `debug.notes`, and similar prose fields
- whole-video `overallSummary`, `retentionVerdict.reasoning`, `evidenceMoments[*].summary`, `strongestMoments`, `biggestRisks`, `recommendationSeeds`
- Phase 3 recommendation `text`, `reasoning`, `keyFindings`, `suggestions`
- provider-exposed reasoning/thought text captured in raw artifacts

## What counts as failure

Any one of the following is a rollout failure.

### Prompt failure
- any required surface lacks the English-only rule
- the rule is added only to some phases and not others
- the rule appears only in main prompts but not recovery/repair addenda
- the rule allows ambiguous wording like `prefer English` or `use English when convenient`

### Artifact failure
- any exercised model-authored summary/reasoning/note/recommendation field contains non-English prose
- a carry-forward field such as `previous summary`, `rollingSummary`, `handoffContext`, or recommendation prose remains non-English after rerun
- provider-exposed raw reasoning/thought text is still emitted in non-English on the verification rerun
- a repair attempt returns structurally valid JSON but with non-English prose
- mixed-language artifacts appear, even if English is dominant

### Non-failures under this contract
These do **not** fail the rollout by themselves:
- benchmark accuracy remains red
- scores change modestly after prompt edits
- artifact wording changes while staying English and schema-valid
- literal quoted non-English source dialogue/lyrics remain non-English inside explicitly source-authentic fields

## Carve-outs

There is only one substantive carve-out.

### Allowed carve-out: literal source-authentic text

Non-English text may remain non-English only when it is the literal source content that the schema is asking to preserve, for example:
- dialogue transcription text
- lyric transcription text
- directly quoted on-screen text when a field is explicitly for quoted source text

Even in those cases:
- summaries must be English
- reasoning must be English
- labels/descriptors must be English
- notes must be English
- recommendation prose must be English
- any translation or explanation must be English

### Not allowed as carve-outs
These are **not** valid reasons to emit non-English text:
- the model inferred the source language from context
- the provider prefers another language for chain-of-thought/reasoning
- prior summaries were already non-English
- persona voice or style feels more natural in another language
- benchmark fixtures happen to contain non-English text elsewhere

## Smallest honest rerun scope for verification

The smallest honest verification scope is **two dynamic reruns plus one static prompt audit**.

### 1. Static audit of touched prompt/recovery surfaces

Before runtime verification, confirm that every required file above actually contains the new English-only block. This is necessary because no single rerun can exercise every prompt-builder branch.

### 2. One bounded full-pipeline rerun that exercises phases 1 → 2 → 3

Run one representative asset through:
- Phase 1 get-context
- Phase 2 chunk analysis
- Phase 3 recommendation/report

This rerun must exercise carry-forward text behavior, not just isolated one-shot prompts. The goal is to prove that:
- Phase 1 emits English summaries/notes
- Phase 2 ingests English prior context and keeps emitting English chunk summaries/reasoning
- Phase 3 consumes those artifacts and emits English recommendation prose

### 3. One targeted Phase 2 chunk rerun on the current `cod-test` benchmark lane

Rerun the existing dedicated chunk lane using:
- `configs/cod-test-phase2-chunk-benchmark.yaml`

Why this second rerun is still required:
- it is the current confirmed failure surface
- it exercises chunk-to-chunk continuity via `previousState.summary`
- it is the most direct regression check against the known mixed-language raw capture and normalized `chunk-analysis.json`

### Why not fewer?

One rerun alone is not honest enough:
- a full pipeline rerun may not cover the exact current failing chunk lane
- the dedicated Phase 2 chunk rerun does not exercise fresh Phase 1 prompt generation
- static prompt review alone cannot prove runtime outputs actually changed

### What to inspect in verification artifacts

At minimum inspect:
- raw capture(s) under the exercised AI attempt folders for provider-exposed reasoning language
- normalized Phase 1 textual artifacts touched by the full run
- `output/.../phase2-process/chunk-analysis.json`
- Phase 3 recommendation artifact(s)

The verification question is only: **did all model-authored non-literal text stay English?**

## Explicit non-goals / scope boundaries

This rollout does **not** do any of the following:
- redesign persona prompts
- change scoring scales or emotion logic
- fix benchmark-quality mismatches
- make whole-video output chunk-equivalent
- revisit timing/evidence issues unrelated to language
- normalize or translate benchmark truth fixtures
- suppress legitimate source-authentic non-English transcription text
- add broader quality heuristics beyond English-only prompt/output behavior
- guarantee hidden provider-internal reasoning that is not surfaced anywhere; the contract only governs surfaced raw/provider reasoning text when the runtime captures it

## Implementation handoff summary

A coder implementing this contract should treat it as three required layers:
1. add the exact English-only block to every listed base prompt surface
2. add the same constraint to recovery and local-validation repair addenda
3. verify via static prompt audit + one full 1→2→3 rerun + one targeted `cod-test` chunk rerun

If those three layers are done and the inspected artifacts are English-only outside the literal-source carve-out, the rollout is complete for this bounded slice.