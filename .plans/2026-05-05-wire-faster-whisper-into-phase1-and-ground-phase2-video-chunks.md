# Peanut Gallery Emotion Engine

**Date:** 2026-05-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Replace the current non-deterministic Phase 1 dialogue timestamp birth surface with faster-whisper, then use those grounded Phase 1 timestamps to feed only chunk-relevant dialogue/music-vocals context into the Phase 2 `video-chunks` lane, and finally re-measure benchmark behavior against truth.

---

## Overview

We now have enough evidence to stop treating timestamp drift as a scoring problem. The current `get-dialogue-timestamps` and `get-music-vocals-timestamps` architecture deterministically reattaches timestamps, but those timestamps are currently born from a fresh model rerun with `preserveSegmentTiming: true`. That means the source clock itself is non-deterministic and can compress onto a pseudo-dialogue chronology instead of the real trailer clock. The recent root-cause trace and the bounded faster-whisper QA pass changed the decision surface: for dialogue, faster-whisper already looks good enough to continue without immediate WhisperX escalation.

This next lane should therefore keep scope tight and ordered. First, replace the **dialogue timestamp source** in Phase 1 with faster-whisper while preserving the selected dialogue text artifact semantics. Second, rerun the Phase 1 timestamp benchmark lane and compare the new percentage surfaces against the existing benchmark truth so we can see whether grounded timestamps actually improve the benchmark story. Third, use those Phase 1 timestamps for the real product goal: grounding `video-chunks` so each Phase 2 chunk receives only the dialogue and music-vocals that overlap its own time window instead of the entire transcript/vocal history. That should reduce irrelevant context, improve chunk artifact grounding, and give the persona/recommendation layers cleaner evidence.

This plan intentionally keeps music-vocals more conservative than dialogue. Faster-whisper QA was strong enough to proceed for dialogue, but music-vocals remains provisional. Unless implementation evidence says otherwise, Phase 2 chunk grounding should treat dialogue timestamp grounding as the primary improvement and keep music-vocals on the current timestamp artifact path or a bounded fallback. The benchmark and Phase 2 validation steps should tell us whether that is already sufficient before we broaden into WhisperX or a specialized lyrics aligner.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Root-cause and recommendation plan for current timestamp mismatch | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-05-review-timestamp-strictness-and-next-lane.md` |
| `REF-02` | faster-whisper install/validation plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-05-install-whisper-and-validate-server-viability.md` |
| `REF-03` | Current timestamp-validation config | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test-phase1-timestamp-validation.yaml` |
| `REF-04` | Current dialogue timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue-timestamps.cjs` |
| `REF-05` | Current music-vocals timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-06` | Current deterministic attachment layer | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/phase1-timestamp-derivation.cjs` |
| `REF-07` | Current Phase 2 video-chunks script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-08` | COD benchmark truth for dialogue timestamps | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json` |
| `REF-09` | COD source video | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/examples/videos/emotion-tests/cod.mp4` |
| `REF-10` | faster-whisper local venv installed for this repo | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.venv-faster-whisper/` |

---

## Tasks

### Task 1: Design the faster-whisper Phase 1 dialogue timestamp integration contract

**Bead ID:** `ee-sc1u`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-10`  
**Prompt:** `Claim bead ee-sc1u on start with bd update ee-sc1u --status in_progress --json. Define the narrowest implementation contract for replacing model-born dialogue timestamp sourcing with faster-whisper while preserving current artifact semantics as much as possible. Be explicit about venv invocation, model choice, VAD posture, CPU/GPU fallback, text-preserving attachment rules, and what stays unchanged in the artifact contract. Update the active plan with exact findings and close bead ee-sc1u with bd close ee-sc1u --reason "faster-whisper Phase 1 contract documented" --json only when the coder lane can proceed without ambiguity.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- code/doc inspection paths only

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`

**Status:** ✅ Complete

**Results:**
- **Current-code finding:** the repo already has the bounded Phase 1 timestamp artifact family and the text-preserving attachment helper we want to keep. `server/scripts/get-context/get-dialogue-timestamps.cjs` currently resolves the canonical `dialogueData` source artifact, then calls `deriveAlignmentDialogue()` which reruns `get-dialogue.cjs` with `preserveSegmentTiming: true`, and finally feeds that timed rerun into `buildDialogueTimestampArtifact()` in `server/lib/phase1-timestamp-derivation.cjs`. So the narrow implementation is **not** a schema redesign; it is a **timestamp-birth swap** inside the dialogue alignment source path. (`REF-04`, `REF-06`)
- **Artifact-contract finding:** `buildDialogueTimestampArtifact()` already preserves the important semantics the next coder should keep: selected source `text` is emitted verbatim; `index`, `speaker`, and `speaker_id` are preserved; `summary`, `totalDuration`, `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and the raw/reconciled provenance structure already exist; unresolved lines omit `start`/`end` and carry `timing.status`. The first implementation should keep that output contract intact and only change the alignment engine/provenance values needed to describe faster-whisper honestly. (`REF-06`)
- **Narrowest implementation contract:** replace only the current `deriveAlignmentDialogue()` timing-source step in `get-dialogue-timestamps.cjs`. Do **not** replace the outer script contract, canonical source-artifact resolution, persisted output path selection, or `buildDialogueTimestampArtifact()` matching/attachment logic in the first slice. The Node script should still:
  1. resolve the canonical/raw/reconciled `dialogueData` source exactly as today;
  2. obtain a full-timeline timed ASR segment/word surface from faster-whisper instead of `get-dialogue.cjs`;
  3. pass that ASR timing surface into the existing attachment helper;
  4. write the same `dialogueTimestampsData` / `dialogueTimestampsDataReconciled` artifact family as today. (`REF-04`, `REF-06`)
- **Repo-local venv invocation contract:** do **not** rely on `source .venv-faster-whisper/bin/activate` from the pipeline runtime. The Node lane should invoke the repo-local interpreter directly by absolute path: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.venv-faster-whisper/bin/python`. Treat that path as the default implementation contract, with a hard failure if it is missing. The spawned process should set repo-local cache env explicitly, at minimum `HF_HOME=/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.cache/huggingface`, and should pass `download_root=/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.cache/faster-whisper` into `WhisperModel(...)`. This keeps the Python dependency local to the repo and mirrors the install/QA lane exactly. (`REF-02`, `REF-10`)
- **Python bridge shape:** keep it small. The first coder lane should add a tiny repo-owned Python entrypoint whose only job is to run faster-whisper on the asset and print/write JSON containing full-timeline segments with `start`, `end`, `text`, and optional word timing. The Node script should treat that JSON as the replacement for the current model-born alignment dialogue surface. Do **not** broaden this into a generalized Python package, daemon, or cross-lane transcription service in Phase 1.
- **Model choice for first implementation:** use `small.en` as the default first real model. Reason: `tiny.en` was only an install proof, while `medium.en` carried a far heavier cold-start/load cost and did not materially rescue the hardest processed/comms slice during bounded QA. `small.en` is the best narrow first balance of usable dialogue timing, warm-run speed, and server viability for this lane. Keep `word_timestamps=True` enabled so later attachment tuning has the richer timing surface available even if v1 still primarily consumes segment windows. (`REF-02`)
- **VAD posture:** default to **no VAD** for the first implementation (`vad_filter=False`). The COD validation pass showed the hard 44s–66s processed/comms slice could collapse to zero usable dialogue under VAD, and the full-asset VAD run also smeared a long span into a hallucinated single segment. Because this lane is about preserving real dialogue timestamps rather than aggressively trimming silence, the Phase 1 default should be no-VAD unless a later QA pass proves a carefully tuned VAD config is both necessary and safe. Do not add broad VAD tuning/config architecture in this bead; if the coder wants a bounded escape hatch, keep it tiny and off by default.
- **CPU/GPU fallback contract:** prefer CUDA when available, but keep CPU honest and automatic. First attempt: `device='cuda'`, `compute_type='float16'`. If model init or transcription throws due to unavailable/incompatible GPU runtime, retry once with `device='cpu'`, `compute_type='int8'` using the same model and transcript settings. The script should not silently skip failure details; it should log/record which runtime path was actually used so QA can distinguish GPU success from CPU fallback. Do **not** introduce multi-tier model fallback or provider fallback in this slice.
- **Text-preserving attachment rules:** keep the existing `phase1-timestamp-derivation.cjs` truth posture. Faster-whisper timing is an attachment surface only; it does **not** get to author the emitted transcript text. The first implementation must preserve the selected source artifact `text` verbatim, preserve segment order and `index`, preserve `speaker` / `speaker_id`, and continue to allow `aligned` / `partial` / `unresolved` timing outcomes. It must **not** merge/split persisted dialogue lines, rewrite words toward ASR output, or silently fall back from reconciled source text to raw source text in canonical mode just because ASR matched raw more easily. (`REF-06`)
- **What stays unchanged in the artifact contract:**
  - same script entrypoint: `server/scripts/get-context/get-dialogue-timestamps.cjs`;
  - same artifact keys and persisted file family: `dialogueTimestampsData` and `dialogueTimestampsDataReconciled`;
  - same canonical raw/reconciled source selection rules;
  - same downstream artifact semantics for `dialogue_segments`, `summary`, `totalDuration`, `coverage`, and top-level provenance/quality-notes shape;
  - same benchmark config surface in `configs/cod-test-phase1-timestamp-validation.yaml`, except that the dialogue timestamp script will now source timing from faster-whisper instead of a model rerun. (`REF-03`, `REF-04`, `REF-06`)
- **What should not broaden yet:**
  - no WhisperX, wav2vec forced alignment, diarization, or second-stage alignment stack in this bead;
  - no music-vocals redesign or promise that music-vocals inherits the same faster-whisper posture yet;
  - no large architecture drift into a shared Python service, queue worker, or generalized ASR subsystem;
  - no full rewrite of `buildDialogueTimestampArtifact()` unless coder finds a minimal bug that blocks verbatim attachment;
  - no Phase 2 `video-chunks` grounding work in this bead; that remains later-plan scope;
  - no new timed `dialogue-v3-source-truth` family.
- **Implementation-ready coder handoff:** the coder can proceed by adding a tiny faster-whisper Python bridge plus a narrow Node spawn/integration in `get-dialogue-timestamps.cjs`, keeping the current attachment/output helper intact, defaulting to `small.en` + `word_timestamps=True` + `vad_filter=False`, and implementing one honest runtime fallback path (`cuda/float16` → `cpu/int8`). That is the smallest change that replaces model-born dialogue timestamp sourcing with a deterministic local source clock without broadening Phase 1 architecture.

---

### Task 2: Implement faster-whisper-backed dialogue timestamp sourcing in Phase 1

**Bead ID:** `ee-94py`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-06`, `REF-09`, `REF-10`  
**Prompt:** `Pending after Task 1. Implement the approved faster-whisper-backed dialogue timestamp path in Phase 1 with the narrowest durable code change. Preserve existing artifact semantics where possible, keep CPU/GPU fallback honest, and do not broaden into WhisperX or full music-vocals redesign in this lane. Add targeted regression coverage and document exact commands used. Commit/push by default before QA unless explicitly blocked.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- possible helper/runtime paths only if truly needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`
- `server/lib/faster-whisper-dialogue-timing.cjs`
- `server/lib/phase1-timestamp-derivation.cjs`
- `server/scripts/get-context/faster-whisper-transcribe.py`
- `server/scripts/get-context/get-dialogue-timestamps.cjs`
- `test/lib/faster-whisper-dialogue-timing.test.js`
- `test/scripts/get-dialogue-timestamps.test.js`

**Status:** ✅ Complete

**Results:**
- Replaced only the Phase 1 dialogue timestamp birth path in `server/scripts/get-context/get-dialogue-timestamps.cjs`. The script still resolves canonical raw/reconciled `dialogueData` exactly as before, still emits the same `dialogueTimestampsData` / `dialogueTimestampsDataReconciled` artifact family, and still delegates line attachment to `buildDialogueTimestampArtifact()`. The old `get-dialogue.cjs` rerun with `preserveSegmentTiming: true` is gone from this path.
- Added `server/lib/faster-whisper-dialogue-timing.cjs` as the narrow Node bridge that:
  - invokes the repo-local interpreter directly at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.venv-faster-whisper/bin/python`;
  - sets `HF_HOME=/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.cache/huggingface`;
  - passes `.cache/faster-whisper` as the download root;
  - defaults to model `small.en`;
  - requires the Python bridge to return timed segments before continuing.
- Added `server/scripts/get-context/faster-whisper-transcribe.py` as the tiny repo-owned Python entrypoint. It keeps the approved posture: `word_timestamps=True`, `vad_filter=False`, runtime fallback order `cuda/float16` then `cpu/int8`, and it returns timing JSON only. It does not rewrite transcript text or broaden into a service architecture.
- Updated `server/lib/phase1-timestamp-derivation.cjs` narrowly so the existing artifact builder can record honest faster-whisper provenance (`alignmentEngine`, `alignmentEngineVersion`, and `alignmentRuntime`) without changing the downstream segment/text attachment contract.
- Added targeted regression coverage in:
  - `test/scripts/get-dialogue-timestamps.test.js` for raw/reconciled source selection, verbatim text preservation, persisted artifact behavior, and faster-whisper provenance/runtime capture.
  - `test/lib/faster-whisper-dialogue-timing.test.js` for the Node bridge env/argument contract, non-zero bridge failure behavior, and the Python fallback order (`cuda/float16` → `cpu/int8`).
- **Commands run:**
  - `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/faster-whisper-dialogue-timing.test.js`
  - End-to-end smoke validation against the real COD asset with a temporary `dialogue-data.json` source artifact and `node` invoking `server/scripts/get-context/get-dialogue-timestamps.cjs` on `examples/videos/emotion-tests/cod.mp4`.
- **Validation performed:**
  - Focused node tests passed (`9/9`).
  - Real smoke run succeeded on `cod.mp4` with `alignmentRuntime.device="cuda"`, `computeType="float16"`, and aligned the opening lines `They want you afraid.` and `Fear makes you easier to control.` to real timeline windows while preserving source text verbatim in the emitted artifact.
- **Caveats:**
  - This bead intentionally does **not** improve the matching heuristic inside `buildDialogueTimestampArtifact()`; it only replaces the source timing clock.
  - The helper hard-fails if the repo-local faster-whisper Python or bridge script is missing, by design.
  - Phase 2 `video-chunks` grounding and music-vocals redesign remain out of scope for this change.

---

### Task 3: QA the new Phase 1 dialogue timestamp path against the COD truth benchmark

**Bead ID:** `ee-6jcj`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** `Pending after Task 2. Rerun the Phase 1 timestamp-validation lane with the faster-whisper dialogue timestamp source, inspect the resulting percentage surfaces and artifact outputs against the COD truth benchmark, and document whether the scores materially improve and where they still fail. Record exact commands, output paths, and whether the no-VAD/tuned-VAD posture looks necessary in practice.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/` validation paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`
- possible bounded QA note/artifact if useful

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Implement Phase 2 video-chunks grounding from Phase 1 timestamp windows

**Bead ID:** `ee-ksgg`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Pending after Task 3 confirms the dialogue timestamp path is worth carrying forward. Update the Phase 2 video-chunks lane so each chunk receives only the dialogue and music-vocals context overlapping that chunk's time window instead of the full transcript/vocal surfaces. Keep the grounding contract explicit, preserve honest fallbacks where timestamp coverage is weak, add targeted tests, and document exact chunk-context selection behavior. Commit/push by default before QA unless explicitly blocked.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`
- likely `server/scripts/process/video-chunks.cjs`
- possible shared helper(s)
- relevant tests

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: QA Phase 2 chunk grounding and bounded cod-test rerun readiness

**Bead ID:** `ee-tw0v`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-07`, `REF-09`  
**Prompt:** `Pending after Task 4. Verify that video-chunks is now receiving chunk-local dialogue/music-vocals context rather than whole-run transcript baggage, and assess whether the lane is ready for the bounded cod-test rerun with grounded chunk context. Record exact evidence showing what each chunk receives and whether the persona-facing context is cleaner and better grounded.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/` validation paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`
- possible QA artifact/note

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 6: Audit the full slice and decide cod-test rerun readiness

**Bead ID:** `ee-od2b`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-10`  
**Prompt:** `Pending after Tasks 2-5. Independently audit the faster-whisper Phase 1 timestamp integration plus Phase 2 chunk grounding work. Confirm whether the benchmark scores, artifact behavior, and chunk-local grounding are strong enough to justify the next full cod-test rerun with video-chunks in place. Close only when the rerun-readiness verdict is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Draft execution plan for wiring faster-whisper into Phase 1 dialogue timestamps and using Phase 1 timestamp windows to ground Phase 2 video-chunks.

**Reference Check:** Draft only.

**Commits:**
- None.

**Lessons Learned:** The real product win is not just better timestamp scores; it is chunk-local grounding for Phase 2 so the persona layers stop seeing irrelevant transcript baggage.

---

*Completed on 2026-05-05*
