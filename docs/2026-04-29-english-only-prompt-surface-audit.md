# English-only AI prompt surface audit

Date: 2026-04-29
Owner bead: `ee-997h`
Repo: `peanut-gallery/emotion-engine`

## Goal

Identify every AI-backed prompt/runtime surface across phases 1, 2, and 3 where an English-only rule must be enforced so model thoughts, model responses, normalized artifacts, and raw captures stay readable and reviewable in English.

## References reviewed

- `.plans/2026-04-29-english-only-ai-prompts-across-phases.md`
- `.plans/2026-04-28-phase2-readiness-and-next-benchmark-slice.md`
- `configs/cod-test-phase2-chunk-benchmark.yaml`
- `output/cod-test/phase2-process/raw/ai/chunk-0003/split-00/attempt-01/capture.json`
- `output/cod-test/phase2-process/chunk-analysis.json`

## Executive summary

The English-only rule is not currently enforced in any meaningful cross-phase way. The prompts are strict about JSON shape, chronology, grounding, and lane boundaries, but they do not require English for model reasoning text, summaries, recommendations, or hidden/provider-exposed thought traces.

The mixed-language problem is already present in Phase 2 artifacts. The clearest example is `output/cod-test/phase2-process/raw/ai/chunk-0003/split-00/attempt-01/capture.json`, where the provider returned:

- Chinese `summary`
- Chinese `emotions.*.reasoning`
- Chinese provider-exposed thought text in `providerResponse.body.choices[0].message.reasoning`
- a Chinese `parsed.summary` that then feeds into later `previousState.summary` continuity context

Because Phase 2 prompts already feed prior model summaries back into later prompts, allowing any upstream lane to emit non-English text creates contamination pressure for downstream prompts even if later prompts are otherwise English-authored.

## Current evidence of the mixed-language problem

### Confirmed artifact leakage

1. `output/cod-test/phase2-process/raw/ai/chunk-0003/split-00/attempt-01/capture.json`
   - line 26: `rawResponse` contains Chinese summary/reasoning
   - line 28: `providerCompletion.content` contains the same Chinese JSON artifact
   - line 101: `providerResponse.body.choices[0].message.reasoning` contains provider-exposed Chinese thought text
   - line 136 onward: normalized `parsed.summary` / `parsed.emotions.*.reasoning` remain Chinese
   - line 49 onward: the stored prompt body shows `## Previous Summary` already contains Chinese, so the contamination is being carried forward into the next call

2. `output/cod-test/phase2-process/chunk-analysis.json`
   - line 77 onward and line 111 onward: chunk summaries and reasoning fields are already persisted in Chinese inside the normalized Phase 2 artifact, not just the raw capture

### Why this matters

The issue is not limited to hidden provider thinking. The user-visible normalized artifact set is already mixed-language, and Phase 2 continuity wiring re-injects those non-English summaries into subsequent prompts.

## Existing language-control wording already present

I did not find an existing general English-only output rule in the Phase 1/2/3 AI prompts or recovery addenda.

What exists today is adjacent but insufficient:

- JSON-only requirements
- literal-heard-words rules
- non-lexical lane separation rules
- grounding/continuity guardrails
- validator acceptance rules for schema shape
- repair prompts that say “Return JSON only with the same required schema”

Those rules constrain structure and evidence, but not output language.

One `English` hit exists in data examples/descriptors (`server/lib/phase1-validator-tools.cjs`) but it is not a model-output policy.

## Prompt/runtime surfaces that need English-only enforcement

Below, “prompt-builder surface” means text directly shown to the model. “Runtime surface” means the place that can emit raw captures, validator-loop turns, normalized artifacts, or provider thought traces.

### Phase 1 — get-context

#### 1. Dialogue transcription, whole asset
- File: `server/scripts/get-context/get-dialogue.cjs`
- Prompt-builder: `buildTranscriptionPrompt(...)`
- Runtime surfaces:
  - `executeDialogueTranscriptionToolLoop(...)`
  - raw capture directories under Phase 1 dialogue attempts
  - normalized dialogue artifact fields such as `summary`, segment text-adjacent explanation fields, speaker profile descriptors, and handoff/repair outputs if present
- Why English-only is needed:
  - summary and speculative descriptor fields can drift languages
  - local-validator loop history and provider raw responses can preserve non-English outputs

#### 2. Dialogue transcription, chunked refinement
- File: `server/scripts/get-context/get-dialogue.cjs`
- Prompt-builder: `buildChunkTranscriptionPrompt(...)`
- Runtime surfaces:
  - `executeDialogueTranscriptionToolLoop(...)`
  - raw chunk attempt captures
  - normalized `summary` and `handoffContext`
- Why it matters:
  - `handoffContext` is explicitly reused across chunks, so non-English output propagates within Phase 1

#### 3. Dialogue stitcher
- File: `server/scripts/get-context/get-dialogue.cjs`
- Prompt-builder: `buildDialogueStitcherPrompt(...)`
- Runtime surfaces:
  - `executeDialogueStitchToolLoop(...)`
  - stitch raw captures / normalized `cleanedTranscript`, `auditTrail`, `debug.notes`
- Why it matters:
  - stitch output is a downstream textual artifact that may be reused/reviewed directly

#### 4. Music analysis, whole asset
- File: `server/scripts/get-context/get-music.cjs`
- Prompt-builder: `buildWholeAssetMusicPrompt(...)`
- Runtime surfaces:
  - direct provider completion in `executeWholeAssetMusicAnalysis(...)`
  - whole-asset raw capture files
  - normalized `summary`, `globalArc`, `segments[*].description`, `recognitionNotes`, `qualityNotes`, `recognizedSong.*`
- Why it matters:
  - this lane emits prose summaries and note fields that can drift even when schema validates

#### 5. Music analysis, chunked/rolling
- File: `server/scripts/get-context/get-music.cjs`
- Prompt-builder: `buildRollingAnalysisPrompt(...)`
- Runtime surfaces:
  - `executeMusicAnalysisToolLoop(...)`
  - raw chunk captures
  - normalized `chunkSummary`, `rollingSummary`, descriptive fields, recognition notes
- Why it matters:
  - `rollingSummary` is reused across chunks and can contaminate later prompts

#### 6. Music-vocals analysis, whole asset
- File: `server/scripts/get-context/get-music-vocals.cjs`
- Prompt-builder: `buildWholeAssetMusicVocalsPrompt(...)`
- Runtime surfaces:
  - whole-asset provider pass
  - raw captures
  - normalized `vocalSummary`, `recognitionNotes`, `qualityNotes`, `recognizedSong.*`
- Why it matters:
  - lyric lane adds more free-text explanation fields than plain music lane

#### 7. Music-vocals analysis, chunked/rolling
- File: `server/scripts/get-context/get-music-vocals.cjs`
- Prompt-builder: `buildRollingVocalsAnalysisPrompt(...)`
- Runtime surfaces:
  - chunk validator loop and raw captures
  - normalized `rollingSummary`, `vocalSummary`, note fields, recognized-song evidence text
- Why it matters:
  - `rollingSummary` and recognition/evidence prose are continuity-bearing text fields

#### 8. Visual identity analysis
- File: `server/scripts/get-context/get-visual-identity.cjs`
- Prompt-builder: whole-asset visual identity prompt in this file
- Runtime surfaces:
  - provider completion / validator loop path for visual identity
  - raw visual identity captures
  - normalized `summary`, `timeline[*].visualSummary`, beat labels/summaries, editorial signals
- Why it matters:
  - this lane is almost entirely prose and summary text, so it is highly exposed to language drift

### Phase 2 — process

#### 9. Chunk emotion analysis prompt construction
- Files:
  - `server/scripts/process/video-chunks.cjs`
  - canonical sibling prompt owner: `../tools/emotion-lenses-tool.cjs`
- Prompt-builder surface:
  - `video-chunks.cjs` assembles context and previous-state text
  - `../tools/emotion-lenses-tool.cjs` builds the base prompt used for each provider-facing chunk
- Runtime surfaces:
  - `executeEmotionAnalysisToolLoop(...)`
  - prompt store entries under `_meta/ai/_prompts/`
  - raw captures under `output/.../raw/ai/chunk-*/split-*/attempt-*/capture.json`
  - normalized Phase 2 artifact `output/.../chunk-analysis.json`
- Why it matters:
  - this is the confirmed failure surface in current evidence
  - `previousState.summary` feeds prior generated prose into subsequent prompts
  - provider-exposed `reasoning` can leak into raw captures even if final JSON is valid

#### 10. Whole-video Phase 2 analysis
- File: `server/scripts/process/whole-video-mimo.cjs`
- Prompt-builder: whole-video prompt construction in this file
- Runtime surfaces:
  - local-validator loop around whole-video analysis
  - raw prompt capture / provider completion capture
  - normalized whole-video analysis core JSON
- Why it matters:
  - whole-video scores may validate numerically while the explanatory prose drifts languages

### Phase 3 — report

#### 11. Recommendation generation
- File: `server/scripts/report/recommendation.cjs`
- Prompt-builder: recommendation prompt construction in this file
- Runtime surfaces:
  - recommendation validator loop
  - raw captures if enabled
  - normalized recommendation artifact fields: `text`, `reasoning`, `keyFindings`, `suggestions`
- Why it matters:
  - this phase is almost entirely natural-language output and consumes Phase 2 summaries/metrics

## Cross-cutting runtime surface that also needs the rule carried through

### 12. Recovery / repair prompt addenda
- File: `server/lib/ai-recovery-runtime.cjs`
- Surface: `buildRecoveryPromptAddendum(...)` and local validation repair wording
- Why it matters:
  - every recovery attempt inherits this addendum
  - today it preserves task/schema but says nothing about preserving English-only output
  - a recovery turn can still “successfully” repair structure while remaining non-English

## What current wording exists at the audited surfaces

Across the audited files, the consistent wording pattern is:

- “Return JSON only”
- “No markdown / no explanation / no wrapper text”
- lane-specific evidence and chronology rules
- validator acceptance rules requiring exact schema and minimal tool envelopes
- recovery wording saying to preserve the original schema/task

What is missing everywhere audited:

- “Think in English” or equivalent for provider-exposed reasoning traces
- “Write all summaries/reasoning/notes/labels in English only”
- “If quoted source media is non-English, keep the quote literal but keep analysis/explanation fields in English”
- validation failure criteria for non-English free-text fields

## Smallest likely implementation set

If the goal is a bounded but real fix, the smallest likely implementation set is:

1. Prompt builders for every AI-backed surface listed above
   - `server/scripts/get-context/get-dialogue.cjs`
   - `server/scripts/get-context/get-music.cjs`
   - `server/scripts/get-context/get-music-vocals.cjs`
   - `server/scripts/get-context/get-visual-identity.cjs`
   - `server/scripts/process/video-chunks.cjs` plus canonical sibling prompt builder `../tools/emotion-lenses-tool.cjs`
   - `server/scripts/process/whole-video-mimo.cjs`
   - `server/scripts/report/recommendation.cjs`
   - `server/lib/ai-recovery-runtime.cjs`

2. Validator/acceptance points for free-text artifacts on the same surfaces
   - enough to reject non-English free-text fields, not just malformed JSON
   - especially important for Phase 2 chunk emotion analysis and Phase 3 recommendations, where the schema alone does not prevent mixed-language output

3. Bounded rerun scope after rollout
   - at minimum: rerun the smallest representative Phase 1 → Phase 2 → Phase 3 path that exercises carry-forward text fields
   - do not validate only prompt text; validate raw captures and normalized artifacts

## Suggested enforcement scope by artifact type

English-only should apply to:

- summaries
- reasoning fields
- rolling summaries / handoff summaries
- note arrays (`recognitionNotes`, `qualityNotes`, `debug.notes`, etc.)
- recommendation prose and bullet lists
- provider-visible recovery/repair responses
- provider-exposed thought traces when the provider surfaces them in raw captures

Possible carve-out:

- literal quoted source dialogue/lyrics may remain source-authentic when the lane’s job is transcription/extraction, but surrounding explanatory text must still be English

## Recommended audit conclusion

The repo should not treat this as a Phase 2-only prompt tweak. The confirmed failure is in Phase 2, but the real propagation path is cross-phase:

- Phase 1 emits continuity text
- Phase 2 reuses prior summaries and emits new summaries/reasoning
- Phase 3 consumes those outputs to generate recommendation prose

So the English-only rule must be added consistently at every AI prompt-builder surface above and reinforced at the validator/recovery layer, or the pipeline will keep re-infecting itself with mixed-language text even after isolated prompt edits.
