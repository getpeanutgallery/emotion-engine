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

**Status:** ⏳ Pending

**Results:** Pending.

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

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Archived the WhisperX evaluation and drafted the next decision plan for deterministic, AWS-viable music-vocals timestamp options while keeping `faster_whisper` as the intended default.

**Reference Check:** `REF-01` captures the completed WhisperX evidence and closure; `REF-02` through `REF-07` identify the current implementation and validation surfaces that any next-step decision must respect.

**Commits:**
- Pending

**Lessons Learned:** A new backend only matters if it beats the current lane on real mixed-audio evidence under the same operational constraints, not just on paper.

---

*Completed on 2026-05-07*
