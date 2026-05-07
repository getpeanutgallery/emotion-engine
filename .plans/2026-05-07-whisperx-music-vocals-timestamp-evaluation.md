# Peanut Gallery Emotion Engine

**Date:** 2026-05-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Make the music-vocals timestamp backend configurable between faster-whisper and WhisperX, then evaluate whether WhisperX improves timestamp quality on COD-style trailer media enough to become the preferred option.

---

## Overview

We already proved the current Phase 1 timestamp-derivation path can consume an ordered music-vocals artifact and derive downstream timing, but the present timing bridge is still backed by faster-whisper. Derrick wants to resume from the prior handoff and test whether WhisperX produces better anchors for the music-vocals lane, especially on mixed trailer audio where lyric timing has been weak.

This slice stays intentionally narrow and honest. We are not redesigning the whole lane or promising WhisperX is the final answer for sung material. Instead of a one-way swap, we will refactor the music-vocals timestamp path so the high-level script contract stays stable while the low-level timing engine is configurable between faster-whisper and WhisperX. That gives us a safe rollback path if WhisperX underperforms, and it also makes the comparison cleaner because both engines will flow through the same downstream derivation logic.

Success here is not “WhisperX exists.” Success is having a configurable timing lane, preserving the reconciled-first artifact selection contract, rerunning against representative media, and comparing resulting timestamp usefulness against the current faster-whisper behavior. If WhisperX still fails on sung content, the outcome should say that clearly and leave us with evidence for whether to keep faster-whisper as default, expose both backends, or pivot again.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Prior WhisperX prototype plan and fallback rules | `.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md` |
| `REF-02` | Current music-vocals timestamp entrypoint | `server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-03` | Current faster-whisper music-vocals timing bridge | `server/lib/faster-whisper-music-vocals-timing.cjs` |
| `REF-04` | Existing timestamp derivation logic and artifact contract | `server/lib/phase1-timestamp-derivation.cjs` |
| `REF-05` | Current cod-test config and benchmark surfaces | `configs/cod-test.yaml` |
| `REF-06` | Current output artifact surfaces for music-vocals and reconciled variants | `output/cod-test/` |
| `REF-07` | Current dialogue timestamp path as a comparable backend wiring pattern | `server/scripts/get-context/get-dialogue-timestamps.cjs` |

---

## Tasks

### Task 1: Audit the current music-vocals timestamp path and define the configurable backend contract

**Bead ID:** `ee-8rub`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Audit the current Emotion Engine music-vocals timestamp path before implementation. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Trace the current `get-music-vocals-timestamps` entrypoint, the faster-whisper timing bridge, and the downstream timestamp-derivation contract. Define the exact bounded refactor needed so the high-level music-vocals timestamp flow can choose between faster-whisper and WhisperX via configuration while keeping the same downstream artifact contract. Identify the backend-selection surface, local dependency/runtime assumptions, required artifact/debug output, and how we will compare WhisperX results against the current faster-whisper baseline. Preserve this contract: prefer reconciled music-vocals artifacts when present; otherwise fall back to raw music-vocals artifacts; unresolved timings must remain unresolved rather than fabricated. Do not implement in this task.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md`

**Status:** ✅ Complete

**Results:** Audit complete. Concrete findings:
- **High-level entrypoint contract (`REF-02`):** `server/scripts/get-context/get-music-vocals-timestamps.cjs` is intentionally thin and already mirrors the dialogue timestamp path. It resolves the canonical source music-vocals artifact from either runtime artifacts or persisted output, prefers the reconciled surface when famous-song reconciliation is configured, optionally loads `dialogueTimestampsData` for exact-text timing assists, reruns a timing backend against the media asset, then writes a derived `musicVocalsTimestampsData` artifact whose runtime key/path depends on whether the selected source surface was raw vs reconciled.
- **Current backend seam (`REF-03`, `REF-07`):** the only music-vocals-specific engine call today is `deriveFasterWhisperMusicVocalsTiming({ assetPath })`. The bounded refactor should replace that hard-coded call with a small backend-dispatch layer rather than rewriting the high-level script.
- **Current faster-whisper runtime assumptions (`REF-03`):** the repo already depends on a repo-local `.venv-faster-whisper`, the Python bridge `server/scripts/get-context/faster-whisper-transcribe.py`, and cache roots under `.cache/huggingface` / `.cache/faster-whisper`. The JS wrapper remaps Python `dialogue_segments` into `musicVocalsData.vocal_segments` and returns `metadata.runtime`, `metadata.engine`, and `metadata.warnings`. It already fails honestly when the local runtime/script is missing, when the child process exits non-zero, or when no timed segments are returned.
- **Downstream artifact contract (`REF-04`):** `buildMusicVocalsTimestampArtifact(...)` is the compatibility boundary and should remain stable across backend choice. The artifact shape already expected downstream is: `vocal_segments`, `summary`, `hasVocals`, `totalDuration`, `analysisMode: 'timestamp_derivation'`, `timingMode: 'full_timeline'`, `sourceStrategy: 'derived_from_phase1_artifact'`, `coverage`, `provenance`, optional `recognizedSong` / `recognitionNotes`, and `qualityNotes`. Each emitted segment preserves the source lyric text verbatim and may add `start`, `end`, and `timing`. Weak or ambiguous matches stay unresolved instead of getting invented times.
- **Important derivation behavior (`REF-04`):** backend text is not treated as authoritative output text. The backend only provides timing candidates that are aligned back onto the already-selected Phase 1 music-vocals rows. Dialogue-assisted timing is narrow by design: only exact normalized text matches may supply timing support, and only for timing, never text rewrite or row reorder.
- **Reconciled-first contract (`REF-02`, `REF-04`, `REF-06`, `REF-07`):** raw/reconciled selection lives in `phase1-baseline-resolution.cjs` and `persisted-artifacts.cjs`, not in backend code. Those helpers already know about `musicVocalsData` and `musicVocalsTimestampsData`, so the backend refactor should reuse them unchanged. In the current COD output, both raw and reconciled music-vocals artifacts exist, and the reconciliation ledger explicitly says recognized-song metadata must not rewrite music-vocals transcript text.
- **Current output/config surface reality (`REF-05`, `REF-06`):** `configs/cod-test.yaml` does **not** currently invoke the timestamp scripts. Timestamp generation currently appears in dedicated configs like `configs/cod-test-phase1-timestamp-validation.yaml` and `configs/cod-test-phase2-only-retest-2026-05-06.yaml`. The existing `output/cod-test/` folder therefore contains the source/reconciled Phase 1 inputs and reconciliation evidence, but not final music-vocals timestamp artifacts for direct backend comparison.
- **Benchmark/QA surface already exists:** the benchmark runner already has a `music-vocals-timestamps-default` profile, and tests explicitly score unresolved timing separately from text drift. That is the right evaluation contract for backend comparison once both backends emit the same derived artifact shape.
- **No WhisperX runtime scaffold was found in the audited repo surfaces:** the repo currently has `.venv-faster-whisper` but no parallel WhisperX venv/bridge in the inspected paths. WhisperX support therefore requires explicit runtime/bootstrap work; it is not just a selector flip.
- **Exact bounded refactor recommended:** keep `get-music-vocals-timestamps.cjs` as the single entrypoint and keep `buildMusicVocalsTimestampArtifact(...)` unchanged; add a config surface of **`settings.phase1.music_vocals.timestamp_backend`** with default **`faster_whisper`**; support at least `faster_whisper` and `whisperx`; require both backend adapters to return the same intermediate contract now returned by the faster-whisper wrapper: `{ musicVocalsData: { vocal_segments, summary, totalDuration }, metadata: { runtime, engine, warnings } }`; then feed that unchanged intermediate contract into the existing derivation builder so downstream consumers stay untouched.
- **Required artifact/debug output:** preserve the canonical primary artifact file/path contract, but persist backend identity via existing provenance `alignmentEngine` / `alignmentRuntime` fields and, when `debug.captureRaw` is enabled, add backend-specific raw timing debug evidence so QA can inspect the direct aligner output without mutating the primary artifact contract.
- **QA comparison guidance:** run the same timestamp-enabled config twice against the same asset with only `settings.phase1.music_vocals.timestamp_backend` changed (`faster_whisper` vs `whisperx`) and separate output dirs. Compare resolved/partial/unresolved counts, repeated-hook ambiguity (`Master, master`-style rows), provenance/runtime metadata, and benchmark scoring fields such as `vocal_timing_resolved_pct`, `vocal_timing_window_pct`, and `vocal_timing_blocked_by_text_drift_pct` when truth-backed scoring is available.
- **Risks / missing work:** WhisperX may need a heavier local runtime (PyTorch/alignment models/ffmpeg/CUDA-or-CPU fallback behavior) than faster-whisper; music vocals remain a speech-aligner edge case; repeated lyric hooks may still stay unresolved even if some windows improve; and there is not yet an audited committed COD music-vocals timestamp truth artifact in `output/cod-test/`, so side-by-side artifact review may still be needed even with the scoring infrastructure.

---

### Task 2: Implement the configurable music-vocals timing backend with WhisperX support

**Bead ID:** `ee-9ki6`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Implement the bounded configurable backend refactor for the Emotion Engine music-vocals timestamp lane. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Keep the high-level `server/scripts/get-context/get-music-vocals-timestamps.cjs` flow stable, but replace the hard-coded faster-whisper call with a small backend-dispatch layer driven by `settings.phase1.music_vocals.timestamp_backend` (default `faster_whisper`, alternate `whisperx`). Preserve the existing timestamp-derivation artifact contract, the reconciled-first fallback rule, and the rule that unresolved timings stay unresolved. Keep `buildMusicVocalsTimestampArtifact(...)` as the downstream compatibility boundary. Require both backends to return the same intermediate alignment payload shape: `{ musicVocalsData: { vocal_segments, summary, totalDuration }, metadata: { runtime, engine, warnings } }`. Add the repo-local WhisperX runtime/bootstrap and honest failure behavior if it is unavailable, plus tests/docs/config wiring and raw debug evidence gated by `debug.captureRaw`. Persist backend identity through provenance/runtime metadata rather than changing the primary artifact contract. Commit and push by default before QA handoff unless blocked.

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/get-context/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/music-vocals-timestamp-backend.cjs`
- `server/lib/faster-whisper-music-vocals-timing.cjs`
- `server/lib/whisperx-music-vocals-timing.cjs`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
- `server/scripts/get-context/whisperx-transcribe.py`
- `test/lib/music-vocals-timestamp-backend.test.js`
- `test/lib/whisperx-music-vocals-timing.test.js`
- `test/scripts/get-music-vocals-timestamps.test.js`
- `configs/cod-test-phase1-timestamp-validation.yaml`
- `configs/cod-test-phase2-only-retest-2026-05-06.yaml`
- `.plans/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md`

**Status:** ✅ Complete

**Results:** Implemented the bounded backend swap without changing the downstream artifact contract. Concrete changes:
- Added `server/lib/music-vocals-timestamp-backend.cjs` as the narrow dispatch seam keyed off `settings.phase1.music_vocals.timestamp_backend`, with default `faster_whisper`, alternate `whisperx`, and explicit rejection for unknown backend values.
- Kept the high-level `get-music-vocals-timestamps.cjs` flow stable: source artifact resolution, dialogue-assist loading, reconciled-first fallback, timestamp derivation, and canonical artifact persistence are unchanged except that the timing pass now routes through the backend dispatcher.
- Preserved the existing compatibility boundary by still feeding `buildMusicVocalsTimestampArtifact(...)` the same intermediate alignment shape (`musicVocalsData` + `metadata`) regardless of backend.
- Extended the existing faster-whisper helper only enough to optionally emit raw bridge evidence to the caller; no change to its primary return contract.
- Added a new WhisperX music-vocals helper plus repo-local Python bridge scaffold (`.venv-whisperx` / `whisperx-transcribe.py`) with honest bootstrap and failure behavior: clear missing-runtime messaging, explicit repo-local cache roots, and surfaced stderr/attempt details on failure.
- Persisted backend identity through provenance/runtime metadata by letting each backend populate `metadata.engine` / `metadata.runtime`; no primary artifact schema change was required.
- Added backend-specific raw evidence capture only behind `debug.captureRaw`, written under `phase1-gather-context/raw/music-vocals-timestamps/<backend>-alignment.json`.
- Wired explicit `music_vocals.timestamp_backend: faster_whisper` defaults into the timestamp-enabled COD configs audited in Task 1 so QA can flip only that field for side-by-side runs.
- Added targeted tests for backend dispatch, WhisperX helper behavior, and raw debug evidence capture while preserving the existing no-fabricated-timestamps and reconciled-first derivation coverage.

**Validation Run:**
- `node --test test/lib/faster-whisper-music-vocals-timing.test.js test/lib/whisperx-music-vocals-timing.test.js test/lib/music-vocals-timestamp-backend.test.js test/scripts/get-music-vocals-timestamps.test.js`
- `npm run validate-configs`

**Risks / Blockers:**
- WhisperX support is intentionally honest but not yet proven on this host; the repo still lacks a committed/audited `.venv-whisperx` bootstrap, so selecting `whisperx` without installing that runtime will fail loudly by design.
- No real-media backend comparison was run in this coder slice; Task 3 still needs to measure whether WhisperX actually improves sung lyric anchoring enough to justify any default change.

---

### Task 2.5: Bootstrap repo-local WhisperX runtime for QA

**Bead ID:** `ee-5fq5`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-05`, `REF-07`  
**Prompt:** Bootstrap the repo-local WhisperX runtime needed for real-media QA on the configurable music-vocals timestamp backend. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Create or document the repo-local `.venv-whisperx` setup needed by `server/scripts/get-context/whisperx-transcribe.py`, verify that the runtime can import WhisperX and execute the bridge helpfully on this host, and keep any setup bounded to what the new configurable backend actually needs for QA. Record exact install/bootstrap commands, dependency assumptions, and smoke-test evidence. If bootstrap is not feasible, fail honestly with the exact blocker instead of papering over it.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- repo-local runtime/bootstrap surfaces as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md`
- `server/scripts/get-context/whisperx-transcribe.py`
- repo-local `.venv-whisperx/` runtime (untracked, host-local bootstrap state)

**Status:** ✅ Complete

**Results:** Repo-local WhisperX runtime bootstrapped on this host for QA and validated end-to-end against the real bridge path.
- **Python/runtime choice:** used host `/usr/bin/python3.12` instead of the repo-default Python 3.14 because current Torch/WhisperX wheels are available and imported cleanly on 3.12 here.
- **Exact bootstrap commands used:**
  - `uv venv --python /usr/bin/python3.12 .venv-whisperx`
  - `.venv-whisperx/bin/python -m ensurepip --upgrade`
  - `.venv-whisperx/bin/python -m pip install --upgrade pip setuptools wheel`
  - `.venv-whisperx/bin/python -m pip install whisperx`
- **Repo-local cache/runtime assumptions confirmed:** the JS helper expects repo-local `.venv-whisperx/bin/python`, repo-local model cache roots under `.cache/huggingface` and `.cache/whisperx`, host `ffmpeg`, and a CUDA-capable Torch runtime when available with CPU/int8 fallback still preserved in the Python bridge.
- **Import verification:** `.venv-whisperx/bin/python` successfully imported `torch` and `whisperx` on this host; observed runtime was Torch `2.8.0+cu128`, `torch.cuda.is_available() == True`, WhisperX `3.8.5`.
- **Bounded bridge smoke test:** ran the actual bridge on `output/_archives/cod-test-optimized-mp4-source/phase1-gather-context/raw/ffmpeg/music/chunks/chunk_000.mp3` using `small.en` and batch size `4`. The bridge completed on CUDA/float16 and returned 8 timed segments over `29.478s`; first segment was `I want you afraid.` at `1.013s–1.993s`.
- **Validation commands used:**
  - `.venv-whisperx/bin/python - <<'PY' ... import torch, whisperx ... PY`
  - `.venv-whisperx/bin/python server/scripts/get-context/whisperx-transcribe.py --asset-path output/_archives/cod-test-optimized-mp4-source/phase1-gather-context/raw/ffmpeg/music/chunks/chunk_000.mp3 --download-root .cache/whisperx-models --batch-size 4`
  - `node - <<'JS' ... require('./server/lib/whisperx-music-vocals-timing.cjs') ... deriveWhisperXMusicVocalsTiming(...) ... JS`
- **Important runtime fix discovered during bootstrap:** the first real run showed WhisperX/torchaudio progress chatter leaking to stdout during model/bootstrap downloads, which broke the JS wrapper's `JSON.parse(stdout)` assumption. Fixed this narrowly in `server/scripts/get-context/whisperx-transcribe.py` by redirecting third-party stdout noise to stderr during the run so the wrapper contract remains `stdout = JSON payload`, `stderr = diagnostics/progress`.
- **Smoke-test evidence after fix:** the Python bridge now emits clean JSON on stdout, and the Node helper `deriveWhisperXMusicVocalsTiming(...)` completed successfully with engine `{ name: 'whisperx', version: '3.8.5' }`, runtime `{ device: 'cuda', computeType: 'float16', model: 'small.en', batchSize: 4, language: 'en' }`, `segmentCount: 8`, `warnings: []`, `totalDuration: 29.478`.
- **Scope note:** bootstrap stayed bounded to the music-vocals QA slice; no broader runtime packaging or workflow redesign was attempted.

---

### Task 3: QA both timing backends against representative media

**Bead ID:** `ee-3z03`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** QA the configurable music-vocals timestamp backend. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Use a timestamp-enabled config (not plain `configs/cod-test.yaml`, which does not invoke the timestamp scripts) and run the music-vocals timestamp pass on the same COD-style asset twice with only `settings.phase1.music_vocals.timestamp_backend` changed between `faster_whisper` and `whisperx`, writing to separate output dirs. Verify the reconciled-first fallback path, verify that unchanged source lyric text remains verbatim, inspect backend-specific raw debug evidence when `debug.captureRaw` is enabled, and compare the resulting segments side by side. Record exact commands, backend-selection settings, artifact/debug paths, resolved/partial/unresolved counts, repeated-hook ambiguity behavior, strengths, failures, and whether WhisperX materially improved timestamp usefulness enough to justify using it over faster-whisper. Include benchmark/scoring evidence when available, especially `vocal_timing_resolved_pct`, `vocal_timing_window_pct`, and `vocal_timing_blocked_by_text_drift_pct`. 

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh output artifacts/logs/comparison notes
- `.plans/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit and default-backend recommendation

**Bead ID:** `ee-phiq`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the configurable music-vocals timestamp slice. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Verify that the implementation preserved the reconciled-first contract, handled unresolved timings honestly, and kept the high-level script behavior stable across backend choice. Review the comparison evidence and recommend the default backend: keep faster-whisper, switch default to WhisperX, or expose both with an explicit non-default experimental path. If the slice passes, close the bead with a precise reason. If it fails, leave a concrete gap report and recommendation on whether to keep iterating, restrict WhisperX, or pivot to a different aligner.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Execution plan, completed audit of the current music-vocals timestamp path, and a configurable faster-whisper/WhisperX backend implementation. A repo-local WhisperX runtime bootstrap task was added after verification showed the code path exists but `.venv-whisperx` is not yet installed on this host, so QA cannot honestly run the side-by-side comparison until that blocker is cleared.

**Reference Check:** `REF-01` carries forward the earlier fallback contract; `REF-02` through `REF-07` were traced concretely in the Task 1 audit results and now define the exact code, config, artifact, and QA surfaces the implementation must respect.

**Commits:**
- `d6acd659c2a62b22f499a01f1473473e1b7b9670` - Add configurable music-vocals timestamp backends

**Lessons Learned:** For this lane, “better timestamps” only counts if the swap improves real segment anchoring on mixed trailer audio without silently inventing timings.

---

*Completed on 2026-05-07*
