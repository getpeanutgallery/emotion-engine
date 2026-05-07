# Peanut Gallery Emotion Engine

**Date:** 2026-05-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Keep `faster_whisper` as the default music-vocals timestamp backend, then determine whether any other deterministic, AWS-viable approach is worth prototyping for better music-vocals timestamps or whether the current ceiling is already reasonable.

---

## Overview

The WhisperX experiment landed cleanly as a configurable backend, but the real-media QA and independent audit both said the same thing: on this COD-style music-vocals slice, WhisperX did not materially improve timestamp usefulness over `faster_whisper`. That means the immediate product decision is straightforward: keep `faster_whisper` as default and treat WhisperX only as an optional experimental path.

The next question is more strategic. We need to decide whether there is another **deterministic** path that could plausibly do better for music-vocals while still fitting our operational constraints: local or server-executable tooling, honest repeatability, and eventual deployment on an AWS-hosted system. This plan is therefore not “try random ML stuff.” It is a bounded evaluation of realistic next options: whether a different deterministic aligner, pre-processing chain, or hybrid forced-alignment approach is worth prototyping, or whether the current `faster_whisper` result is already near the practical limit for mixed trailer audio without moving into non-deterministic or operationally awkward systems.

The output of this plan should be a decision Derrick can trust: either (a) we have a specific next deterministic prototype worth trying, with a clear reason and bounded scope, or (b) we have enough evidence to stop chasing marginal timestamp gains on this lane and accept the current quality envelope.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Archived WhisperX evaluation plan and final audit | `.plans/archive/2026-05-07-whisperx-music-vocals-timestamp-evaluation.md` |
| `REF-02` | Current configurable music-vocals timestamp entrypoint | `server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-03` | Current faster-whisper backend implementation | `server/lib/faster-whisper-music-vocals-timing.cjs` |
| `REF-04` | Current optional WhisperX backend implementation | `server/lib/whisperx-music-vocals-timing.cjs` |
| `REF-05` | Shared timestamp derivation contract | `server/lib/phase1-timestamp-derivation.cjs` |
| `REF-06` | Side-by-side backend comparison artifacts | `output/cod-test-phase1-backend-qa-2026-05-07-comparison.json` |
| `REF-07` | Timestamp-enabled COD validation config | `configs/cod-test-phase1-timestamp-validation.yaml` |

---

## Tasks

### Task 1: Lock the product default back to faster-whisper and document WhisperX as experimental

**Bead ID:** `ee-f7dh`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-07`  
**Prompt:** Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Audit the current repo state after the WhisperX slice and make sure the practical default for music-vocals timestamping is explicitly `faster_whisper` in the relevant code/config surfaces, while `whisperx` remains available only as an optional experimental backend. Update any narrow docs/config comments needed so future runs do not accidentally treat WhisperX as preferred. Keep this bounded; do not redesign the backend system.

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/get-context/`
- `configs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/music-vocals-timestamp-backend.cjs`
- `configs/cod-test-phase1-timestamp-validation.yaml`
- `configs/cod-test-phase2-only-retest-2026-05-06.yaml`
- `.plans/2026-05-07-deterministic-music-vocals-timestamp-next-step-evaluation.md`

**Status:** ✅ Complete

**Results:** Repo audit confirmed the implementation-level default was already `faster_whisper` in `server/lib/music-vocals-timestamp-backend.cjs`, and the timestamp-enabled COD configs already pinned `settings.phase1.music_vocals.timestamp_backend: faster_whisper`. I made the remaining bounded clarity updates needed so future runs do not accidentally treat WhisperX as preferred: (1) added an inline product-default comment above `DEFAULT_TIMESTAMP_BACKEND`, (2) expanded the unsupported-backend error to explicitly say `faster_whisper` is the practical default and `whisperx` is experimental, and (3) added config comments in the timestamp-enabled COD YAML surfaces stating that `whisperx` should be used only for bounded comparison/experimental runs. Practical default-enforcement/communication surfaces now are: `server/lib/music-vocals-timestamp-backend.cjs` (actual default + error guidance), `configs/cod-test-phase1-timestamp-validation.yaml` (explicit default config + comment), and `configs/cod-test-phase2-only-retest-2026-05-06.yaml` (explicit default config + comment). Validation run: `node --test test/lib/music-vocals-timestamp-backend.test.js` and `npm run validate-configs`. Durable changes were committed and pushed to `main`.

---

### Task 2: Research deterministic, AWS-viable alternatives for music-vocals timestamping

**Bead ID:** `ee-skli`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Research realistic deterministic alternatives to the current music-vocals timestamp approach that could still run in a controlled AWS server environment. Focus on bounded candidates such as forced aligners, lyrics/singing alignment tools, source-separation-plus-alignment pipelines, or conservative preprocessing steps that may improve alignment without introducing LLM-style non-determinism. For each candidate, evaluate technical fit, likely benefit on mixed trailer audio, operational complexity, licensing/dependency risks, GPU/CPU expectations, and AWS deployability. Also identify when a candidate is probably a dead end so we do not waste a prototype cycle.

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional notes/artifacts locations if needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-07-deterministic-music-vocals-timestamp-next-step-evaluation.md`
- optional research notes/artifacts if needed

**Status:** ✅ Complete

**Results:** Research completed against the actual repo constraints and prior QA evidence, not just generic ASR folklore. The current lane already tells us something important: on the COD comparison slice (`REF-06`), `faster_whisper` and `whisperx` both landed at `0.0%` resolved timing, with `50.0%` of scored timing opportunities blocked by text drift; `faster_whisper` was still slightly more useful because it at least surfaced two partial `Master, master` hook anchors while WhisperX left all 10 rows unresolved. That means the next deterministic options only make sense if they directly attack one of two concrete failure modes visible in `REF-05`/`REF-06` and the derivation rules in `REF-05`: **(a)** accompaniment / mix interference, or **(b)** transcript-to-audio mismatch that prevents exact or near-exact anchoring.

Repo-specific constraint check before evaluating alternatives:
- `buildMusicVocalsTimestampArtifact(...)` (`REF-05`) preserves source lyric text verbatim and intentionally refuses to fabricate timings; repeated short hooks stay `partial`/`unresolved` when placement is ambiguous.
- The current failure is therefore not just "timestamp model bad"; it is a combination of mixed trailer audio, heavy music, repeated short hooks, and transcript drift relative to what the aligner actually hears.
- Any new lane that still depends on unconstrained ASR over the full trailer mix is likely to hit the same ceiling. The realistic deterministic gains are therefore most likely to come from **better vocal isolation before alignment** or **transcript-constrained alignment when the transcript is already close enough to reality**.

Candidate options, ranked by practical value:

1. **Vocal separation first, then rerun the existing faster-whisper backend**
   - **What it is:** add a deterministic vocal-isolation step (Demucs-class separator; the widely used Demucs repo is MIT-licensed, though its upstream repo now states it is no longer actively maintained and only receives important bug fixes) before feeding audio into the existing `faster_whisper` bridge.
   - **Technical fit for mixed trailer audio / music-vocals:** strongest fit of the bounded options because the current problem includes accompaniment and cinematic mix clutter. This directly targets the acoustic interference instead of changing the downstream timing contract.
   - **Likely benefit vs current baseline:** the best realistic chance of improving lyric-near anchors, especially for shouted / sung hooks buried under score, because `faster_whisper` already showed it can find some useful hook windows when the words are audible at all. Separation may improve those windows or surface additional lyric-near segments. It will not solve transcript drift by itself.
   - **Operational complexity:** moderate. Adds a new Python/model runtime and a preprocessing step, but the rest of the lane can stay almost unchanged.
   - **Licensing / dependency risk:** moderate but manageable. Demucs itself is permissive (MIT), but upstream maintenance is soft and model/runtime pinning would need to be explicit for reproducibility.
   - **GPU / CPU expectations:** GPU preferred for sane throughput; CPU possible but slower. Still operationally normal on AWS GPU instances.
   - **AWS deployability:** good. This is just another deterministic model pass plus the existing backend. Easy to containerize if versions are pinned.
   - **Dead-end risk:** **medium, not high**. Worth one prototype because it attacks the most obvious acoustic problem without forcing a rewrite.
   - **Prototype recommendation:** **Yes — strongest next prototype if we do anything.** Keep it narrow: isolated vocals -> existing `faster_whisper` -> existing derivation/scoring.

2. **Transcript-constrained CTC forced alignment on top of a known lyric transcript, ideally after vocal separation**
   - **What it is:** use a deterministic forced aligner based on wav2vec2 / HuBERT / MMS-style CTC alignment instead of free transcription. A current open-source example is `ctc-forced-aligner`, which explicitly aligns text to audio using Hugging Face pretrained models and supports word/char granularity with GPU or CPU execution.
   - **Technical fit for mixed trailer audio / music-vocals:** potentially better than plain speech ASR *if* the transcript is already close to what is sung, because it converts the problem from "guess the lyric" to "place this lyric in time." On this repo, that matters because the current derivation logic is explicitly blocked by text drift in half the scored windows.
   - **Likely benefit vs current baseline:** moderate upside, but only when the source lyric rows are near-verbatim. If the reconciled lyrics still diverge from the actual performance, the aligner will fail honestly or produce low-confidence garbage. This means it is better as a second prototype after separation, not the first standalone bet.
   - **Operational complexity:** moderate-to-high. New runtime, text normalization rules, and likely per-row or per-window handling for repeated hooks. It is still deterministic and AWS-sane, but it is more invasive than just adding separation.
   - **Licensing / dependency risk:** moderate / needs explicit review. The open-source path is feasible, but this repo would need deliberate model and license pinning before adoption.
   - **GPU / CPU expectations:** works on either; GPU preferable for throughput, CPU acceptable for bounded offline processing.
   - **AWS deployability:** good if model artifacts are pinned and cached.
   - **Dead-end risk:** **medium-high as a first move, medium as a follow-up after separation.** It can help only when the transcript is already close enough.
   - **Prototype recommendation:** **Conditional yes, but only as a phase-2 experiment after the separation-first prototype or on a handpicked truth slice with accurate lyrics.**

3. **Montreal Forced Aligner / Kaldi-style transcript-constrained alignment**
   - **What it is:** classic forced alignment using pronunciation dictionaries and Kaldi-style acoustic models. MFA’s own docs describe it as orthographic-transcript-to-time alignment using pronunciation dictionaries; it is mature and deterministic.
   - **Technical fit for mixed trailer audio / music-vocals:** weak-to-middling for this exact use case. It is far better matched to spoken read speech than to distorted sung vocals over trailer music. It may help if the input is already strongly cleaned and the lyrics are near exact, but that is a narrow win condition.
   - **Likely benefit vs current baseline:** low-to-moderate at best. The main attraction is constrained alignment, but singing, growled metal vocals, and repeated hooks are hostile to speech-trained lexicon aligners.
   - **Operational complexity:** high relative to likely value. Pronunciation dictionaries, text preparation, and alignment plumbing add more ceremony than a separation-first pass.
   - **Licensing / dependency risk:** manageable; mature open-source stack, but more moving parts than the current lane.
   - **GPU / CPU expectations:** typically CPU-friendly, which is nice operationally.
   - **AWS deployability:** technically good; operational return still questionable.
   - **Dead-end risk:** **high for the COD-style music-vocals slice.** More likely to become a yak-shave than a win unless the audio is already cleaned and the transcript is very exact.
   - **Prototype recommendation:** **No for now.** Keep it on the long list only if separation + lighter CTC alignment surprisingly show promise and we later want a CPU-heavy production fallback.

4. **Gentle / aeneas / older speech-first aligners**
   - **What it is:** older forced-alignment stacks. Gentle is a Kaldi-based "robust yet lenient" aligner; aeneas describes itself as forced alignment but its surfaced docs/versioning are old and it is AGPL-licensed.
   - **Technical fit for mixed trailer audio / music-vocals:** poor. These tools were built around speech/narration alignment, not aggressive sung trailer vocals in dense mixes.
   - **Likely benefit vs current baseline:** low. If WhisperX could not beat faster-whisper on the real slice, it is hard to justify expecting an older speech-first aligner to do better on metal vocals.
   - **Operational complexity:** deceptively high because old tools often bring packaging, runtime, and platform friction.
   - **Licensing / dependency risk:** high enough to matter. Aeneas is AGPLv3, which is an unnecessary licensing complication for a speculative experiment; Gentle is older / effectively legacy.
   - **GPU / CPU expectations:** mostly CPU, which is nice, but not enough to outweigh weak fit.
   - **AWS deployability:** possible, but not worth the maintenance burden.
   - **Dead-end risk:** **very high.**
   - **Prototype recommendation:** **Discard now.**

5. **Conservative preprocessing only: mono/downmix, loudness normalization, band-limited EQ / HPSS, optional chunk tightening around vocal-active regions before the existing backend**
   - **What it is:** no new recognizer, just a disciplined input-conditioning pass before `faster_whisper`. Examples: consistent resampling, LUFS normalization, mild high-pass / band-pass emphasis, harmonic-percussive separation, maybe pruning non-vocal sections if we already have a credible vocal-activity signal.
   - **Technical fit for mixed trailer audio / music-vocals:** reasonable because it attacks the mix problem a little without changing architecture.
   - **Likely benefit vs current baseline:** low-to-moderate. This is unlikely to magically unlock exact alignments, but it is cheap and may slightly improve lyric-near segment quality or stability.
   - **Operational complexity:** low. Best cost/benefit ratio of the non-separation options.
   - **Licensing / dependency risk:** low if implemented with standard ffmpeg/librosa-style tooling already acceptable in server environments.
   - **GPU / CPU expectations:** trivial on CPU.
   - **AWS deployability:** excellent.
   - **Dead-end risk:** **low cost, but also low ceiling.**
   - **Prototype recommendation:** **Yes, but only bundled with the separation-first experiment or as a very small A/B pre-pass.** Not worth a big standalone project.

6. **Singing-specific research systems / joint lyrics-note alignment papers**
   - **What it is:** dedicated singing alignment methods from recent literature. Some papers explicitly compare against MFA or combine alignment with singing-aware separation.
   - **Technical fit for mixed trailer audio / music-vocals:** on paper, potentially the best fit. In practice, most are research-grade, dataset-specific, underpackaged, or expect cleaner vocal material and note-level supervision than this repo has.
   - **Likely benefit vs current baseline:** unknown, maybe high in a lab, but not honestly bounded for this repo right now.
   - **Operational complexity:** high-to-extreme.
   - **Licensing / dependency risk:** unclear until audited case by case.
   - **GPU / CPU expectations:** often GPU-heavy and bespoke.
   - **AWS deployability:** possible eventually, but not operationally sane as the next move.
   - **Dead-end risk:** **very high for this planning horizon.**
   - **Prototype recommendation:** **Discard for now as a moonshot lane.**

Recommendation set for the auditor:
- **Strongest next option:** prototype **vocal separation -> existing faster-whisper -> existing derivation/scoring** on the same COD slice and one additional representative slice. This is the one candidate that directly attacks accompaniment interference while preserving nearly all repo contracts.
- **Secondary option only if the first one shows signal:** try **transcript-constrained CTC alignment on the separated vocals** using the existing source lyric rows as the text, but only on a truth-backed slice where lyric text is already close enough to what is sung.
- **Cheap supporting work worth doing inside the same prototype window:** conservative preprocessing A/Bs (normalization / mild filtering / HPSS) because they are operationally trivial and may stack with separation.
- **Probably discard now:** MFA as a near-term production path for this music-vocals lane, Gentle, aeneas, and research-only singing aligners. They are either poor fit, too old, too license-risky, or too operationally awkward relative to likely return.

Bottom-line judgment: there **is** one bounded deterministic lane still worth trying, but it is not "swap to a different speech aligner and hope." It is **improve the audio presented to the already-better backend first**, then optionally add transcript-constrained alignment only if that cleaned input actually increases lyric-text fidelity enough to matter.

---

### Task 3: Recommend whether to prototype another deterministic lane or stop here

**Bead ID:** `ee-8vj8`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Independently review the archived WhisperX outcome, the current default-backend state, and the deterministic alternatives research. Then answer the real decision question: is there a specific next deterministic, AWS-viable prototype worth running for music-vocals timestamps, or is current `faster_whisper` performance already close enough to the practical ceiling that we should stop investing here for now? If you recommend a next prototype, specify exactly which one and why. If not, state that clearly and explain why the likely return is too low.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-07-deterministic-music-vocals-timestamp-next-step-evaluation.md`

**Status:** ✅ Complete

**Results:** Independent audit completed against the archived WhisperX evidence, the active backend/config surfaces, the current derivation contract, and the deterministic-alternatives research. Key checks:
- `REF-02` still keeps the high-level timestamp flow stable and bounded: select canonical source artifact, rerun alignment, then derive timestamps while preserving source lyric text verbatim.
- `REF-03` / current backend dispatcher still make `faster_whisper` the explicit product default and keep `whisperx` opt-in experimental only.
- `REF-05` confirms the practical ceiling is not just “pick a different speech aligner.” The derivation contract intentionally refuses fabricated placements, repeated short hooks remain partial/unresolved when ambiguous, and exact/near-exact text anchoring still matters.
- `REF-06` confirms the real comparison result: both backends scored `0.0%` resolved timing on the COD slice, both had `50.0%` of timing opportunities blocked by text drift, but `faster_whisper` still surfaced two useful partial `Master, master` hook anchors while WhisperX surfaced none.

**Decision:** recommend **one more bounded deterministic prototype**, not a broader exploration program.

**Exact prototype worth running:** **deterministic vocal separation on the trailer mix first, then feed the separated-vocals audio into the existing `faster_whisper` backend and unchanged timestamp-derivation/scoring path.** In practice this means a pinned, containerizable AWS-viable separator such as a Demucs-class vocal-isolation pass, followed by the current `faster_whisper` alignment and the same `buildMusicVocalsTimestampArtifact(...)` contract.

**Why this clears the bar:**
- It directly attacks the only remaining failure mode that still looks plausibly movable under deterministic constraints: accompaniment / dense mix interference.
- It preserves nearly all of the proven code path and therefore yields a clean A/B against the current baseline.
- It is operationally normal for AWS compared with more speculative singing-specific research systems or more invasive forced-alignment stacks.
- The current evidence does **not** support spending more time swapping speech aligners; WhisperX already failed that test.

**Why not stop immediately:** current `faster_whisper` is probably near the ceiling for **unaltered mixed trailer audio**, but not yet proven to be the ceiling for a **separation-first deterministic pipeline**. Because `faster_whisper` already found two partial lyric-near anchors where WhisperX found none, there is still a credible, bounded chance that cleaner vocals could improve anchor density without changing the downstream contract.

**Why not recommend other deterministic options right now:** transcript-constrained CTC alignment remains only a conditional phase-2 option because half of the current scoring windows are still blocked by text drift; classic MFA/Gentle/aeneas-style aligners and research-grade singing systems do not clear the effort-to-return bar for this repo and this media type.

**Practical stop rule:** run exactly one separation-first prototype on the same COD slice (and optionally one additional representative slice). If it still does not materially improve resolved/partial anchor usefulness over the current `faster_whisper` baseline, we should stop investing here for now.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Locked the practical default back to `faster_whisper`, completed a bounded deterministic-alternatives research pass, and finished an independent audit that answers the actual decision question. Final recommendation: run **one** more deterministic, AWS-viable prototype — **vocal separation first, then the existing `faster_whisper` backend with the unchanged timestamp-derivation/scoring path**. Do **not** spend further time on alternative speech-aligner swaps like WhisperX for this lane.

**Reference Check:** `REF-01` supplies the real-media WhisperX outcome; `REF-02` through `REF-05` confirm the current default/backend and conservative derivation contract; `REF-06` shows the practical comparison evidence that drives the decision; `REF-07` remains the timestamp-enabled config surface for the bounded next prototype.

**Commits:**
- Pending

**Lessons Learned:** For this lane, “deterministic alternative” is only worth prototyping when it attacks the observed bottleneck directly. Backend swaps did not move the needle; acoustic cleanup before alignment is the only remaining bounded option that still clears the effort-to-return bar.

---

*Completed on 2026-05-07*
