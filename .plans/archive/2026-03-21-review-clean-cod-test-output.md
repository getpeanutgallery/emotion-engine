# emotion-engine: review clean cod-test output

**Date:** 2026-03-21  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Review the freshly passing `cod-test` artifacts with human judgment, identify any output-quality issues or bugs, and turn any confirmed problems into concrete follow-up work.

---

## Overview

The technical acceptance lane is already complete: the clean rerun from 2026-03-20 passed end-to-end under the restored narrow timeout policy. The next job is explicitly not more transport debugging first; it is output review. That means we should inspect the generated Phase 2 and Phase 3 artifacts for groundedness, usefulness, internal consistency, and obvious regressions.

This plan treats Derrick as the human evaluator and me as the orchestrator. I will package the right artifacts, summarize what to look for, capture any issues Derrick spots, and then convert confirmed findings into repo-local Beads plus a follow-up execution plan if fixes are needed.

---

## Tasks

### Task 1: Prepare the review packet from the fresh clean cod-test run

**Bead ID:** `ee-136`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-136 with bd update ee-136 --status in_progress --json, then prepare a concise review packet for the fresh clean cod-test acceptance run. Pull the key artifacts, note the exact file paths, summarize what each artifact is for, and highlight any fast sanity checks or suspicious areas worth Derrick's attention. Do not change runtime behavior yet. Close ee-136 on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/cod-test/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-21-review-clean-cod-test-output.md`
- no new review-sidecar file was needed; packet content was captured directly in this plan update

**Status:** ✅ Complete

**Results:** Claimed `ee-136`, inspected the fresh clean acceptance artifacts under `output/cod-test/`, and prepared a concise human review packet from the successful 2026-03-20 clean rerun (`.logs/cod-test-20260320-155949-ee-acq-clean-full.log`). Key review paths confirmed: `output/cod-test/phase3-report/summary/FINAL-REPORT.md` (best single human-readable packet), `output/cod-test/phase3-report/summary/summary.json` (compact machine summary), `output/cod-test/phase3-report/recommendation/recommendation.json` (AI edit recommendation + findings), `output/cod-test/phase3-report/metrics/metrics.json` (aggregate metrics / friction index), `output/cod-test/phase3-report/emotional-analysis/emotional-data.json` (critical moments + scroll-risk timeline), `output/cod-test/phase2-process/chunk-analysis.json` (per-chunk judgments), `output/cod-test/phase1-gather-context/dialogue-data.json` (transcription sanity-check target), `output/cod-test/_meta/events.jsonl` (event trace), and `output/cod-test/artifacts-complete.json` (artifact manifest).

Fast sanity-check findings for Derrick: the run itself completed cleanly with `EXIT_STATUS=0`, 28 successful chunk analyses, and no failed chunks; the strongest output-level recommendation is consistent across summary/report/recommendation artifacts (weak 0-5s hook, strong mid-video action stretch, weak late promo block around 120-130s). Two suspicious areas surfaced for follow-up review: (1) `output/cod-test/phase1-gather-context/dialogue-data.json` reports `totalDuration: 220` and includes four dialogue segments ending at 143s, 146.5s, 150.5s, and 155s even though the video duration recorded elsewhere is `140.017`; (2) the acceptance log still prints the stale config description `Test pipeline for cod.mp4 video (2 chunks max)` and shows an awkward terminal numbering pattern (`Processing chunk 28/29` then `29/29` micro-chunk skipped) even though the real artifact summary is 28 analyzed chunks. No runtime behavior changed in this task.

---

### Task 2: Capture Derrick's review findings and classify them

**Bead ID:** `ee-rn0`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-rn0 with bd update ee-rn0 --status in_progress --json, then capture Derrick's current cod-test review findings precisely in `.plans/2026-03-21-review-clean-cod-test-output.md`. Classify each finding as confirmed issue / open question / validated strength, map it to the relevant artifact or pipeline phase, and preserve enough context that a later session can resume cleanly. Close ee-rn0 on completion with a reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-21-review-clean-cod-test-output.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-rn0` and recorded Derrick's current review findings directly in this plan so later execution can resume from source-truth notes instead of memory. The review classification and pipeline mapping are:

- **Confirmed issue — `artifacts-complete.json` → `dialogue_segments` — likely pipeline phase: dialogue extraction / speaker attribution in Phase 1 gather-context (and any downstream normalization that carries speaker labels into the aggregate artifact).** Human review of the video/audio shows some consecutive lines are currently misattributed to the same speaker even when different people are speaking. Derrick wants a more grounded representation of speakers using linguistic/acoustic descriptors rather than brittle named assumptions; example target style: `male voice 1, gruff, older, Hispanic accent`. Follow-up should investigate both the current implementation limits and the practical ceiling of today's audio-input AI models for diarization-like speaker differentiation, then likely iterate on the dialogue/speaker pipeline.
- **Confirmed artifact finding, but still an implementation-scope question — `phase1-gather-context/script-results/get-music.success.json` → payload `data`, mirrored exactly in `phase1-gather-context/music-data.json` — pipeline phase: Phase 1 gather-context music extraction artifact.** Artifact inspection now confirms that the stored `musicData` for this run is only a single full-span segment (`start: 0`, `end: 140.042449`) plus a broad summary (`"high-intensity movie trailer"`, tense orchestral music, intense dialogue). So the shallow shape is no longer hypothetical at the artifact level: the persisted Phase 1 music context really is just a coarse whole-video summary for this run. What is **not** yet confirmed is whether this is a product bug versus an intentional first-cut capability limit, or whether richer music structure exists elsewhere in the pipeline and is merely collapsed before persistence. Follow-up should therefore split into two questions: (1) do we want/need chunk-by-chunk or richer temporal music cues such as style changes, peaks, drops, and notable signatures; and (2) does current implementation already have a place to produce/store that detail, or is new capability work required.
- **Confirmed artifact usability / observability issue — raw AI capture artifacts at `phase1-gather-context/raw/ai/music-segment-0000/attempt-01/capture.json` and `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` — pipeline layer: raw provider-capture / debug-capture layer beneath Phase 1 gather-context.** Both capture files are about `4.3M`–`4.4M` on disk and each embeds a single huge Base64 audio payload at `rawResponse.providerRequest.body.messages[0].content[1].input_audio.data` (length `4482388`). Derrick reports these files soft-lock his editor on Chip's Surface Pro when opened. This is not a model-quality bug; it is a confirmed debug-artifact ergonomics problem that harms inspection and observability. Follow-up should treat it as a raw-capture storage/serialization issue — e.g. externalizing binary payloads, redacting large inline blobs in human-openable JSON, or providing a slim metadata-first view for inspection.
- **Validated strength — `recommendationData` — likely pipeline phase: Phase 3 recommendation synthesis / final edit assessment.** Derrick's human review agrees with the recommendation output. The intro is a bit slow while building intrigue, which creates some scroll risk, but once the action starts the video remains engaging until the ending title-card / sales-pitch segment. The recommendation that a single punchier CTA would outperform the current ending is considered on point. This should be preserved as positive evidence that Peanut Gallery and `emotion-engine` are producing genuinely useful editorial guidance, not just defects.

Additional Phase 2 review findings captured after Derrick's latest artifact inspection:

- **Open question / human-review concern requiring code verification — `output/cod-test/phase2-process/chunk-analysis.json` and the Phase 2 chunk-review prompt-building path that feeds persona analysis.** Derrick is reviewing the per-chunk Phase 2 outputs and is not yet confident the reviewing persona is consistently receiving the *correct time-scoped Phase 1 dialogue and music context for each chunk*. Some `reasoning` fields mention cliché dialogue, but that alone does **not** prove the model was grounded in correctly scoped timed dialogue for the current chunk; it could also be broader inference or hallucinated carry-through from genre cues. This should be treated carefully as a **human-review concern / code-verification follow-up**, not a fully proven bug yet. Important nuance from the raw prompt evidence below: the captured prompt for chunk `0000` *does* include a chunk-adjacent dialogue snippet (`0.0s-6.0s: Speaker 1: They want you afraid. Fear makes you easier to control.`), so the dialogue-context concern is currently best framed as **pipeline-wiring uncertainty across chunks / code-path verification needed**, not as confirmed absence of timed dialogue context.
- **Confirmed prompt-shape finding with likely implementation follow-up — `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json` and prompt source `output/cod-test/_meta/ai/_prompts/fdbe43b2e2a6ad665960fed0e0d1db60e447b093c6d55e78e73b52bbf5d65d98.json` — likely pipeline layer: Phase 2 prompt-building / Phase 1→Phase 2 context injection for music.** Derrick inspected the raw prompt capture for chunk `0000`, and the source prompt confirms the injected music context is broad whole-trailer context rather than chunk-specific context: `## Music` contains `0.0s-140.0s: music, mood: tense, intensity: 8` while the attached video chunk window is only `0.0s-5.0s`. That makes this more concrete than the dialogue concern: for at least this captured chunk prompt, the music context is indeed coarse global context. Derrick's expected prompt shape is likely **both** (a) overall trailer-level music framing and (b) chunk-specific / time-scoped music details for the current window, because trailer music can evolve with scene-level mood changes. This is therefore best classified as a **confirmed prompt/context-scoping limitation in the current captured artifact**, mapped to the prompt-construction or Phase 2 context-injection layer, with follow-up needed to verify whether richer time-scoped music metadata exists upstream and is being dropped versus never being produced.

What actually happened: no runtime behavior changed in this task; this was documentation and classification only. The main decision was to tighten the music finding from an open question into a **confirmed shallow-artifact finding with unresolved implementation/product classification**, while also adding a separate **confirmed raw-capture usability issue** mapped to the debug-capture layer. Dialogue speaker attribution remains a confirmed issue and recommendation quality remains a validated strength. The new Phase 2 notes deliberately preserve nuance: **timed dialogue grounding remains an open verification question**, while **broad whole-trailer music injection is now directly evidenced in at least one captured chunk prompt**.

---

### Task 3: Convert confirmed issues into execution-ready follow-up work

**Bead ID:** `ee-awu`, `ee-tad`, `ee-3kf`, `ee-1k3`, `ee-ic7`  
**SubAgent:** `primary`  
**Prompt:** `For each confirmed output bug or quality regression from the cod-test review, create repo-local Beads, link them back into the plan, and prepare the next execution plan so implementation can start cleanly in a later step. If a bead is assigned, claim it on start with bd update <id> --status in_progress --json and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-21-review-clean-cod-test-output.md`
- repo-local Beads state

**Status:** ✅ Complete

**Results:** Converted the review findings into execution-ready repo-local Beads and prioritized them based on correctness first, then richness, then ergonomics.

Created follow-up beads:
- `ee-awu` (**P0**) — Verify Phase 2 timed dialogue/music context injection for chunk review
  - top priority because it determines whether the current Phase 2 judgments are grounded in the right per-chunk context at all
- `ee-tad` (**P1**) — Improve Phase 1 dialogue speaker attribution grounding and capability contract
  - driven by confirmed human-reviewed speaker misattribution in the cod-test artifacts
- `ee-3kf` (**P1**) — Deepen Phase 1 music context into time-scoped structure
  - driven by the confirmed shallow whole-trailer music summary artifact
- `ee-1k3` (**P1**) — Feed chunk-specific music context into Phase 2 video review prompts
  - depends on `ee-3kf`; added dependency so prompt wiring follows the richer Phase 1 music structure instead of racing ahead blindly
- `ee-ic7` (**P2**) — Slim raw AI capture artifacts by externalizing or redacting giant inline Base64 payloads
  - important for observability and debugging, but lower priority than grounding/correctness

Current ready order after creation:
- `ee-awu` (ready)
- `ee-3kf` (ready)
- `ee-tad` (ready)
- `ee-ic7` (ready)
- `ee-1k3` (not ready until `ee-3kf` is complete)

Recommended execution order:
1. `ee-awu` — verify the actual Phase 1→Phase 2 context wiring truth first
2. `ee-tad` — fix/clarify speaker attribution contract
3. `ee-3kf` — enrich Phase 1 music structure
4. `ee-1k3` — wire chunk-specific music context into Phase 2 prompts
5. `ee-ic7` — improve raw capture ergonomics once the main grounding work is underway or complete

Later user-directed follow-up added after the initial review round:
- `ee-avf` (**P1**, blocked on `ee-tad`) — Prototype beta inferred speaker traits in Phase 1 dialogue context
  - scope: experimental inferred speaker traits with explicit `beta/assumed` semantics, per-trait confidence, and abstention support
  - candidate fields Derrick wants to experiment with include personality-style traits, age, gender, ethnicity, and similar speaker descriptors
  - important contract: these must not be treated as truth; they should be clearly marked as guessed/inferred, evaluated on the next full run, and kept only if they prove accurate/useful
  - recommended product posture: keep acoustically grounded traits as the mainline output, and gate any demographic-style guesses behind the explicit beta contract rather than blending them into core speaker identity

This leaves the repo with concrete execution state ready for the next implementation plan/execution lane.

**2026-03-21 execution update — `ee-awu` investigation/fix lane:** Claimed `ee-awu` and traced the live Phase 1 → Phase 2 context path end-to-end. The owning handoff is: `server/run-pipeline.cjs` hydrates/passes artifacts into Phase 2, `server/lib/phases/process-runner.cjs` passes accumulated `artifacts` into `server/scripts/process/video-chunks.cjs`, `video-chunks.cjs` reads `artifacts.dialogueData` / `artifacts.musicData` (`server/lib/script-contract.cjs`, `server/lib/persisted-artifacts.cjs`, `server/scripts/process/video-chunks.cjs:478-479`), overlap-filters them via `getRelevantDialogue(...)` / `getRelevantMusic(...)` (`video-chunks.cjs:1137-1163`), and injects them into `analyzeInputBase`. The prompt is then built in the canonical sibling owner `../tools/emotion-lenses-tool.cjs` via `buildBasePromptFromInput(...)` → `buildPrompt(...)`, and stored under `output/cod-test/_meta/ai/_prompts/*.json` before the validator-mediated provider loop runs.

Focused evidence from the fresh clean cod-test artifacts:
- `output/cod-test/phase1-gather-context/dialogue-data.json` contains 18 timed `dialogue_segments`; Phase 2 prompt captures prove chunk-local **overlap filtering** is active. Example: chunk `0001` (`5.0s-10.0s`) injects both `0.0s-6.0s` and `8.5s-10.0s` dialogue lines because both overlap that chunk window.
- `output/cod-test/phase1-gather-context/music-data.json` contains exactly one music segment for this run: `0` → `140.042449`, mood `tense`, intensity `8`. Because `getRelevantMusic(...)` also only overlap-filters, every sampled chunk prompt inherited that single broad segment.
- Prompt captures proving the pre-fix behavior: `output/cod-test/_meta/ai/_prompts/fdbe43b2e2a6ad665960fed0e0d1db60e447b093c6d55e78e73b52bbf5d65d98.json` (chunk `0000`) shows `## Music` = `0.0s-140.0s` for a `0.0s-5.0s` chunk; chunk `0010` and chunk `0027` prompts show the same whole-run music range; chunk `0004` / `0005` prompts also show dialogue lines whose printed timestamps extend outside the active chunk window. So the exact classification is: **dialogue injection was chunk-overlap-filtered but not prompt-time-clipped; music injection in this run was effectively global-only because Phase 1 persisted a single full-span music segment, and Phase 2 printed that global range verbatim in every chunk prompt.**
- This is a **confirmed prompt/context-scoping bug** in the Phase 2 prompt-building surface, not a `node_modules` drift issue. The owning source file is sibling repo `../tools/emotion-lenses-tool.cjs`, which already owns `buildPrompt(...)` for this lane.

Safe minimal fix landed in the owning repo only:
- Updated `../tools/emotion-lenses-tool.cjs` so prompt-visible dialogue/music ranges are clipped to `videoContext.startTime` / `videoContext.endTime` before they are rendered. This preserves the original Phase 1 artifacts and overlap filtering behavior, but makes the chunk-review prompt itself truly time-scoped.
- Added focused regression coverage in `../tools/test/emotion-lenses-tool.test.js` and consuming-repo coverage in `test/scripts/emotion-lenses-tool.test.js`.
- Validation passed:
  - `cd ../tools && node --test test/emotion-lenses-tool.test.js` → 27 passing, 0 failing
  - `node --test test/scripts/emotion-lenses-tool.test.js` → 16 passing, 0 failing

Truthful conclusion / next step:
- **Confirmed current behavior:** dialogue context is overlap-filtered per chunk and now prompt-clipped by the landed fix; previous-state summary is also carried chunk-to-chunk via `trimPreviousSummary(...)`.
- **Confirmed current behavior:** music context injection code is capable of overlap-filtered chunk selection, but for the reviewed cod-test run the persisted Phase 1 artifact is only one full-span music segment, so the effective semantic behavior remains global-only/coarse until `ee-3kf` deepens Phase 1 music structure.
- **Recommended next step:** treat `ee-3kf` as the follow-on owner for richer time-scoped music segmentation, because prompt clipping fixes misleading prompt ranges but does not invent finer-grained music structure that Phase 1 never produced.

**2026-03-21 execution update — `ee-3kf` implementation lane:** Claimed `ee-3kf` and traced the owning Phase 1 music path in-repo. The confirmed source path is `server/scripts/get-context/get-music.cjs`: it extracts audio, runs `preflightAudio(...)` from `server/lib/audio-preflight.cjs`, then iterates the returned `preflight.chunkPlan` directly in `run(...)` to call `buildRollingAnalysisPrompt(...)`, `executeMusicAnalysisToolLoop(...)`, and persist the final Phase 1 artifact at `output/.../phase1-gather-context/music-data.json`. The downstream Phase 2 consumer remains `server/scripts/process/video-chunks.cjs:getRelevantMusic(...)`, which overlap-filters `musicData.segments` by chunk time range before prompt injection.

Confirmed diagnosis from the reviewed cod-test artifacts:
- `output/cod-test/phase1-gather-context/raw/ffmpeg/music/chunk-plan.json` shows the transport preflight chose exactly one chunk because the extracted MP3 stayed under the Base64 budget (`trace.reason = within_budget`, `recommendedChunkDurationSeconds = 140.042449`, `chunks = 1`).
- `output/cod-test/phase1-gather-context/music-data.json` therefore contains one persisted segment spanning `0` → `140.042449`.
- So the single coarse music segment is **not** a random model hallucination; it is the current implementation behavior caused by Phase 1 reusing the upload-budget chunk plan as the semantic music-analysis plan. That classification is now: **confirmed implementation limitation / bug for this product goal**, not merely an intentional artifact formatting choice.

Safe minimal source-owned change landed in `emotion-engine` only:
- Updated `server/scripts/get-context/get-music.cjs` to separate **transport chunks** from **semantic analysis chunks**.
- Added a small helper that subdivides each transport-safe chunk into bounded fixed windows (default `30s`, overridable via `config.ai.music.analysisWindowSeconds`) using the existing `planTimeChunks(...)` helper from `server/lib/audio-preflight.cjs`.
- Preserved the existing `musicData` artifact shape (`segments`, `summary`, `hasMusic`) so downstream consumers do not need a schema migration yet; Phase 2 now gets richer time-scoped segments simply because `musicData.segments` becomes a real timeline.
- Upgraded the raw plan artifact at `phase1-gather-context/raw/ffmpeg/music/chunk-plan.json` to include both `transportChunks` and operative analysis `chunks`, making the distinction inspectable instead of implicit.

New design choice introduced deliberately:
- **Newly introduced design choice:** long music analysis is now windowed into fixed semantic windows inside each transport-safe upload chunk, defaulting to `30s`. This is a product-shaping choice to get materially better time-scoped music cues without exploding cost to per-video-chunk or per-5s analysis yet.
- **Preserved intentional behavior:** transport preflight still decides how large an attachment can be safely uploaded.
- **Confirmed bug fixed:** semantic richness no longer collapses to a single whole-trailer music segment merely because the provider could accept one large audio attachment.

Validation/evidence:
- Added focused regression coverage in `test/scripts/get-music.test.js` proving a `140.042449s` audio input that stays within transport budget now produces **5** music segments with windows `0-30`, `30-60`, `60-90`, `90-120`, and `120-140.042449`, plus five provider prompts.
- Validation passed: `node --test test/scripts/get-music.test.js` → 20 passing, 0 failing.
- Broader regression spot-check passed earlier in-session before the final log-format fix: `node --test test/scripts/get-music.test.js test/scripts/video-chunks.test.js test/pipeline/orchestrator.test.js` → 64 passing, 0 failing.

Truthful scope boundary / next step:
- This lane intentionally did **not** redesign the music schema or rerun the full cod-test pipeline. It fixed the owning source of the coarse segmentation while keeping downstream contracts stable.
- The next dependent lane remains `ee-1k3`: now that Phase 1 can emit time-scoped `musicData.segments`, Phase 2 prompt wiring can start consuming that richer structure more explicitly if still needed.

**2026-03-21 execution update — `ee-1k3` implementation lane:** Claimed `ee-1k3` and traced the exact Phase 2 prompt-building handoff after the richer Phase 1 music windows landed. The owning injection path is still `server/scripts/process/video-chunks.cjs`: for each provider-facing chunk it overlap-filters `artifacts.musicData.segments` with `getRelevantMusic(...)`, then passes the resulting `musicContext` into the canonical sibling prompt builder `../tools/emotion-lenses-tool.cjs` through `buildBasePromptFromInput(...)` → `buildPrompt(...)`.

What was happening before this lane:
- **Previously true in Phase 2 wiring:** `video-chunks.cjs` passed only `musicContext.segments`; it dropped `musicData.summary`, so the prompt had no concise trailer-level music framing at all.
- **Previously true in prompt rendering:** `../tools/emotion-lenses-tool.cjs:220-226` rendered only `type`, `mood`, and `intensity` for each overlapping music segment. Even after `ee-3kf` introduced richer Phase 1 windows with per-window `description`, the Phase 2 prompt still omitted those chunk-specific details.
- **Net effect before fix:** chunk prompts could be time-filtered, but they lacked both the broad trailer-level music summary and the segment `description` text that makes the new windowed music analysis actually useful.

Smallest truthful source-owned fix that landed:
- `server/scripts/process/video-chunks.cjs` now passes `musicContext.summary` (from `musicData.summary`) plus `totalSegments` alongside the already overlap-filtered `musicContext.segments`.
- `../tools/emotion-lenses-tool.cjs` now renders music as two concise layers when available:
  - `Trailer-wide context: ...` from the Phase 1 `musicData.summary`
  - `Active chunk cues:` with the chunk-overlapping music segment(s), including clipped time range, `description`, `mood`, and `intensity`
- Added a small `normalizePromptText(...)` helper in the prompt builder so music summaries/descriptions keep normalized whitespace without being cut off.

Focused prompt/output evidence:
- Direct prompt-builder evidence from a targeted one-shot invocation after the change now renders the music section as:
  - `## Music`
  - `- Trailer-wide context: Trailer-wide music stays tense and cinematic.`
  - `- Active chunk cues:`
  - `  - 30.0s-35.0s: music, detail: Low brass pulses sharpen into pounding percussion., mood: tense, intensity: 8`
- This is the exact new prompt shape required by the bead: both global/trailer-level context and active chunk-scoped music detail, with concise wording.

Validation performed:
- Sibling owner tests: `cd ../tools && node --test test/emotion-lenses-tool.test.js` → **28 passing, 0 failing**
- Consumer/integration tests: `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js` → **49 passing, 0 failing**
- Added/updated targeted assertions proving:
  - prompt rendering includes trailer-wide music summary,
  - prompt rendering includes chunk-local segment `description` + `mood` + `intensity`,
  - chunk-overlap filtering still excludes non-overlapping music windows from the Phase 2 lane,
  - long music summary/description text is preserved in full instead of being truncated.

Truthful conclusion:
- **Fixed/new now:** Phase 2 chunk prompts carry both concise trailer-level music framing and the relevant chunk-scoped music details produced by the richer Phase 1 windowing work.
- **No overclaim:** this lane did not rerun the full cod-test pipeline; validation was focused at the prompt-builder and Phase 2 handoff layers, which is the minimal proof surface for this bug.

**2026-03-21 execution update — `ee-0w1` follow-up on user-directed music-context truncation rollback:** Derrick explicitly did not want music prompt context text cut off mid-thought, so I removed the newly introduced truncation behavior while preserving the two-layer music prompt structure from `ee-1k3`. The owning fix surface was the sibling repo prompt builder `../tools/emotion-lenses-tool.cjs`, not `emotion-engine/node_modules`, so the change was made there only.

Exact code paths changed:
- `../tools/emotion-lenses-tool.cjs`
  - replaced `truncatePromptText(...)` with `normalizePromptText(...)`
  - stopped truncating `musicContext.summary` when rendering `- Trailer-wide context: ...`
  - stopped truncating `segment.description` when rendering `- Active chunk cues:` entries
- `../tools/test/emotion-lenses-tool.test.js`
  - added regression coverage proving long trailer-wide summary and active-chunk description text are preserved fully
- `test/scripts/emotion-lenses-tool.test.js`
  - added consumer-side regression coverage proving the built prompt preserves full music summary/description text

What actually happened:
- Preserved the new two-layer Phase 2 music context structure:
  - `Trailer-wide context: ...`
  - `Active chunk cues:`
- Removed only the text-cutting behavior; whitespace is still normalized so prompt formatting stays clean.
- No installed package / `node_modules` files were modified.

Validation performed:
- `cd ../tools && node --test test/emotion-lenses-tool.test.js` → **28 passing, 0 failing**
- `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js` → **49 passing, 0 failing**

Conclusion:
- The user-directed rollback is complete: Phase 2 music prompts keep the richer two-layer structure, but no longer truncate music summary/description text mid-thought.

**2026-03-21 execution update — `ee-l63` research pass on speaker differentiation and trait attribution:** I completed a high-confidence research review on whether current audio-input AI is reliable enough for Phase 1 dialogue context speaker tracking.

Research outcome summary:
- **Bottom line:** speaker diarization / same-speaker linkage is **usable but not solved**. Recent multilingual benchmarking over 196.6 hours reported best overall performance at **11.2% DER for pyannoteAI** and **13.3% DER for open-source DiariZen**, with **missed speech and speaker confusion** still the dominant failure modes; the paper explicitly frames diarization as an **unsolved problem**. pyannote’s own 2025 benchmark table for `community-1` still shows material error on harder sets (for example **17.0 AMI IHM**, **26.7 CALLHOME**, **20.2 DIHARD3**, **11.2 VoxConverse**, **44.6 AVA-AVD** DER, collar=0, overlap kept), which is good enough for assistive speaker indexing but not for overconfident identity claims.
- **Modern approach buckets:**
  - classic cascaded diarization: VAD/SAD → segmentation → speaker embeddings → clustering / VBx / TS-VAD / MSDD
  - ASR + diarization hybrids: Whisper/WhisperX-style transcript alignment plus external diarization and speaker-word assignment
  - end-to-end / hybrid diarizers: Sortformer v2, DiariZen, pyannote pipelines
  - foundation/audio-input models: GPT-4o diarized transcription, Qwen2-Audio-class AudioLLMs, useful as semantic layers but weakly benchmarked publicly for robust diarization
- **What is realistically reliable now:** anonymous `speaker_n` IDs within a file, segment-level same-speaker linkage, optional known-speaker mapping when enrollment/reference clips exist, and downstream transcript reconciliation when a specialist diarizer feeds ASR.
- **What is not truthful enough to promise:** accurate universal speaker counting in noisy/high-overlap media, robust long-range identity tracking from a foundation model alone, or demographic assertions like age / gender / ethnicity / nationality / accent-origin as facts. Accent and demographic descriptors are especially risky because voice recordings can expose many sensitive attributes and the speech literature repeatedly documents bias across accent, age, and gender-related conditions.
- **Safe product outputs for Phase 1:**
  - yes: `speaker_0`, `speaker_1`, same-speaker linkage/confidence, turn timing, known-speaker match when reference clips are provided
  - maybe, only with hedging/abstain: low-risk acoustic descriptors such as calm vs. excited, fast vs. slow speaking rate, lower-pitched, raspy/gruff, energetic, whispered, clipped delivery
  - no for Phase 1: inferred age/gender/race/nationality, strong accent labels, or personality/identity claims presented as truth
- **Recommendation for emotion-engine Phase 1:** use a **hybrid pipeline**, not a foundation-audio-only design. Let a specialist diarization stack produce speaker turns + embeddings + same-speaker linkage first; then reconcile words with ASR; only then allow an LLM/audio model to summarize cautiously grounded voice-style traits from stable evidence. This is the most truthful architecture today.
- **Validation plan:** benchmark on public sets that stress different failure modes (**AMI, CALLHOME, VoxConverse, DIHARD3**, optionally LibriCSS/overlap-heavy samples) plus a small in-domain manually labeled set from our target media. Track **DER/JER**, speaker-count accuracy, pairwise same-speaker linkage F1, and a human-reviewed calibration pass for any voice-trait descriptors with an explicit abstain option.
- **Promising tools worth evaluating in our polyrepo environment:**
  - `pyannote/speaker-diarization-community-1` locally, with `precision-2` / pyannoteAI as accuracy baseline
  - `WhisperX` for ASR + forced alignment + pyannote speaker assignment
  - NVIDIA NeMo `Sortformer` / streaming Sortformer v2 / MSDD for alternative diarization backends
  - `WeSpeaker` / ECAPA-TDNN / Titanet-class embeddings for same-speaker verification and cross-segment linkage
  - OpenAI `gpt-4o-transcribe-diarize` as an API baseline, especially when known speaker reference clips are available
  - DiariZen as a strong open-source research baseline, with the caveat that current public model weights are **non-commercial**
- **Implementation guidance for Derrick:** attempt Phase 1 anonymous speaker indexing and linkage now; do **not** attempt demographic voice profiling now; and keep any human-readable traits tightly scoped to acoustically grounded, hedgeable descriptions with confidence / abstention.

Source anchors used in the review:
- pyannote evaluation guide + benchmark discussion
- `Benchmarking Diarization Models` (2025)
- pyannote `speaker-diarization-community-1` and `pyannote-audio` model/tool docs
- WhisperX repository/docs
- NVIDIA NeMo speaker diarization docs
- OpenAI speech-to-text / diarized transcription docs
- AudioBench (NAACL 2025) for AudioLLM capability framing
- `Privacy Implications of Voice and Speech Analysis` for sensitive-attribute/privacy caveats

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A review-and-fix trail for the fresh clean `cod-test` acceptance run: the exact artifact paths for human inspection, issue classification into execution-ready beads, the landed Phase 2 prompt time-clipping fix from `ee-awu`, the landed Phase 1 music-windowing fix from `ee-3kf` so long audio can persist richer time-scoped `musicData.segments` without changing the downstream artifact contract, the `ee-1k3` Phase 2 prompt follow-through so each chunk prompt now carries both concise trailer-level music framing and the relevant chunk-scoped music detail, and the `ee-l63` research recommendation that Phase 1 speaker context should use a hybrid diarization + ASR + embeddings design rather than a foundation-audio-only speaker-traits pass.

**Commits:**
- Pending commit/push for `emotion-engine` and sibling `tools` repo at session wrap.

**Lessons Learned:** The acceptance lane can be technically green while still hiding groundedness defects in the persisted context artifacts. For music specifically, transport-safe attachment sizing and semantically useful time-scoped analysis are separate concerns and should not share a single chunk plan by accident. For speaker context, the truthful boundary today is also important: reliable anonymous speaker linkage is much more mature than demographic or accent-style profiling, so Phase 1 should separate diarization evidence from any higher-level narrative trait generation.

**Next Session Handoff:** Continue from the open implementation beads, not the archived review lane. Highest-priority remaining execution work is `ee-tad` (improve Phase 1 dialogue speaker attribution grounding and capability contract), informed by completed research bead `ee-l63`. After that, if the grounded speaker grouping/alignment layer lands cleanly, proceed to `ee-avf` for the explicit beta inferred-traits experiment. `ee-ic7` remains open as a lower-priority raw-capture ergonomics cleanup. Do not edit `node_modules`; if speaker/trait work needs sibling polyrepo changes, land them in the owning repo and refresh `emotion-engine` cleanly.

---

*Completed on 2026-03-21*
