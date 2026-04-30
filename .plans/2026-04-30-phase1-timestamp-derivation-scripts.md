# Peanut Gallery Emotion Engine

**Date:** 2026-04-30  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Design and implement the first bounded Phase 1 timestamp-derivation lane that takes existing dialogue and music-vocals artifacts plus source audio and produces timestamped dialogue/music-vocals outputs, preferring reconciled artifacts when available and falling back to raw artifacts otherwise.

---

## Overview

The current Phase 1 dialogue and music-vocals artifacts are intentionally index-first and strip final `start` / `end` timing from their shipped artifacts. That made prior benchmark and reconciliation work more honest, but it means any downstream consumer that needs timestamps now requires a separate derivation step rather than trying to treat the existing artifacts as already timed.

This plan treats timestamp recovery as a new, bounded Phase 1 follow-on lane. The first pass should not reopen the broader dialogue/music-vocals extraction architecture. Instead, it should add explicit scripts — likely `get-dialogue-timestamps` and `get-music-vocals-timestamps` — that read the already-produced artifact surfaces, choose the correct input surface (`reconciled` when present and intended, otherwise raw), and derive timestamps against the source audio. Whisper is the first candidate tool for dialogue timing because it is naturally ASR-oriented; music-vocals timing is riskier because sung lyrics and chant-like hooks may align poorly or inconsistently, so that lane needs an explicit feasibility / fallback posture rather than assuming Whisper parity.

The key architectural question for this slice is not just “can Whisper timestamp words?” but “what exact contract should these new scripts own?” We need to lock down artifact selection rules, output schemas, and truth posture before implementation so we do not accidentally blur raw vs reconciled semantics or silently claim more confidence than the underlying timing method earns.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Prior session handoff / current request context for the new timestamp lane | `/home/derrick/.openclaw/workspace/memory/2026-04-24.md` |
| `REF-02` | Current Phase 1 dialogue producer; confirms final artifact strips timing and owns dialogue contract | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue.cjs` |
| `REF-03` | Current Phase 1 music-vocals producer; confirms final artifact strips timing and owns music-vocals contract | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals.cjs` |
| `REF-04` | Raw vs reconciled artifact selection helpers / canonical surface resolution rules | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/phase1-baseline-resolution.cjs` |
| `REF-05` | Famous-song reconciliation step; writes reconciled dialogue/music-vocals artifacts and defines reconciliation boundary | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-06` | Persisted artifact key/path contract for Phase 1 artifact surfaces | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/persisted-artifacts.cjs` |

---

## Tasks

**Execution bead package:** prep `ee-4l1r`; research `ee-gtkz`, `ee-gn04`; coder `ee-12u0`, `ee-669f`; QA/audit `ee-ser0`.


### Task 1: Design the timestamp-derivation contract and artifact-selection rules

**Bead ID:** `ee-gtkz`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Audit the current Phase 1 dialogue/music-vocals artifact surfaces in projects/peanut-gallery/emotion-engine and design the exact contract for new timestamp-derivation scripts. Claim the assigned bead on start. Determine how the new lane should choose reconciled vs raw inputs, what output files/runtime keys it should write, whether the timestamped outputs should preserve source text verbatim or allow local timing-normalization transforms, and what confidence / quality notes the contract needs. Explicitly call out where dialogue and music-vocals should share infrastructure vs differ. Save the design note in docs/ and update the plan with exact artifact names and decision points. Close the bead only when the design package is durable and implementation-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/lib/`
- `server/scripts/get-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- `docs/2026-04-30-phase1-timestamp-derivation-contract.md`
- `server/lib/phase1-baseline-resolution.cjs` (contract extension identified; implementation pending)
- `server/lib/persisted-artifacts.cjs` (contract extension identified; implementation pending)
- `server/lib/script-contract.cjs` (contract extension identified; implementation pending)
- `server/scripts/get-context/get-dialogue-timestamps.cjs` (planned)
- `server/scripts/get-context/get-music-vocals-timestamps.cjs` (planned)

**Status:** ✅ Complete

**Results:** Design contract documented in `docs/2026-04-30-phase1-timestamp-derivation-contract.md`. Exact artifact family chosen: raw `phase1-gather-context/dialogue-timestamps-data.json` and `phase1-gather-context/music-vocals-timestamps-data.json`; reconciled `phase1-gather-context/dialogue-timestamps-data.reconciled.json` and `phase1-gather-context/music-vocals-timestamps-data.reconciled.json`; runtime keys `dialogueTimestampsData`, `dialogueTimestampsDataReconciled`, `musicVocalsTimestampsData`, `musicVocalsTimestampsDataReconciled`. Default source-selection decision: both scripts should resolve input with `runtimeArtifactSurface: 'canonical'`, which means reconciled when famous-song reconciliation is configured and the artifact family supports it, otherwise raw. Output surface must mirror the source surface actually used. Text-preservation decision: emitted timed segments must preserve source text verbatim; normalization is allowed only internally for matching/alignment and never as persisted text rewrite. Important bounded-scope decision: do **not** add a timed `dialogue-v3-source-truth` artifact in this slice. Helper-fit decision: extend `phase1-baseline-resolution.cjs`, `persisted-artifacts.cjs`, and `script-contract.cjs` rather than introducing ad-hoc timestamp path logic.

---

### Task 2: Feasibility spike for Whisper-backed dialogue timestamps and music-vocals timestamp posture

**Bead ID:** `ee-gn04`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Run a bounded feasibility spike for timestamp derivation in projects/peanut-gallery/emotion-engine. Claim the assigned bead on start. Evaluate whether Whisper (or Whisper-compatible timestamp surfaces already available in the repo/toolchain) can truthfully support dialogue timestamp derivation against the current dialogue artifact contract, and separately evaluate likely failure modes for music-vocals timing on sung/chant/rap material. The deliverable should recommend: (a) dialogue implementation posture, (b) music-vocals implementation posture, (c) what fallback or partial-support semantics we should encode for music-vocals if word/segment timing is weak, and (d) what fixture/sample assets would be best for validation. Save findings in docs/ and link them back into the plan. Close the bead only when the feasibility memo is concrete enough to drive implementation.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- `docs/2026-04-30-whisper-timestamp-feasibility.md`

**Status:** ✅ Complete

**Results:** Feasibility memo documented in `docs/2026-04-30-whisper-timestamp-feasibility.md`. Main finding: the repo already carries ephemeral producer-side segment timing internally for both dialogue and music-vocals, but intentionally strips persisted `start`/`end` before shipping canonical Phase 1 artifacts; that means the current codebase demonstrates timing-shaped internals but does **not** already provide a truthful reusable derivation engine for the new contract. Concrete toolchain check found no installed/local Whisper entrypoint (`whisper`, `whisperx`, `faster_whisper`, `torch` all absent) and no repo-local provider wrapper exposing word-timestamp transcription APIs. Recommended implementation posture: ship `get-dialogue-timestamps` first using a newly added Whisper-compatible/equivalent aligner and verbatim transcript-preserving alignment against the selected raw/reconciled dialogue artifact; do **not** treat existing extraction-time timestamps as authoritative output for the new lane. Recommended music-vocals posture: support the contract, but with an explicitly weaker truth model where `aligned` is reserved for strong anchors and many sung/chant/rap cases legitimately land as `partial` or `unresolved`; recognized-song metadata may support provenance/quality notes only and must not authorize lyric rewrites or fake exact placement. Recommended first validation assets: `examples/videos/emotion-tests/cod.mp4` plus the paired `output/cod-test/phase1-gather-context/*` artifacts and archived COD variants (`cod-test-high-fidelity-flac`, `cod-test-optimized-mp4-source`) because they exercise both dialogue timing and repeated famous-song vocals in one repo-local fixture family.

---

### Task 3: Create execution beads and implement `get-dialogue-timestamps`

**Bead ID:** `ee-12u0`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-06`  
**Prompt:** `After the contract and feasibility work are approved, claim the assigned bead on start and implement the bounded Phase 1 dialogue timestamp derivation lane in projects/peanut-gallery/emotion-engine. The script should prefer reconciled dialogue when available/appropriate, otherwise fall back to raw dialogue, and derive timestamped dialogue output against the source audio without mutating the canonical existing dialogue artifact. Reuse existing artifact/path resolution helpers where possible. Add focused tests and validation, then commit/push before QA handoff. Close the bead only when implementation and repo-local validation are complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/phase1-timestamp-derivation.cjs`
- `server/lib/script-contract.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-dialogue-timestamps.cjs`
- `test/lib/phase1-baseline-resolution.test.js`
- `test/scripts/tool-wrapper-contract.test.js`
- `test/scripts/get-dialogue-timestamps.test.js`

**Status:** ✅ Complete

**Results:** Implemented the bounded dialogue timestamp lane first. Added the new `dialogueTimestampsData` / `dialogueTimestampsDataReconciled` artifact family to the shared raw/reconciled resolver seams (`phase1-baseline-resolution.cjs`, `persisted-artifacts.cjs`, `script-contract.cjs`) and added a small shared derivation helper in `server/lib/phase1-timestamp-derivation.cjs`. Shipped `server/scripts/get-context/get-dialogue-timestamps.cjs`, which resolves source dialogue with the same canonical/raw/reconciled selection logic as other Phase 1 artifacts, reruns `get-dialogue` in a temp output with an opt-in `preserveSegmentTiming` flag, aligns against that timed rerun without rewriting the chosen source transcript text, mirrors the selected runtime surface in persisted output/provenance, and fails loudly when reconciled/canonical dialogue is expected but missing. Focused regression coverage now proves raw vs reconciled source selection, reconciled path/runtime-key wiring, verbatim text preservation, and canonical-missing failure behavior. Validation run that passed: `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js`. Additional note: `node --test test/lib/script-contract.test.js` still has one unrelated pre-existing failure in the AI-recovery call-count assertion (`script-runner - executeScript performs one bounded AI recovery re-entry for eligible AI lanes`, expected provider call count `2`, got `1`); no code for that lane was changed in this slice.

---

### Task 4: Decide and, if viable, implement `get-music-vocals-timestamps`

**Bead ID:** `ee-669f`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `After the feasibility spike, claim the assigned bead on start and implement the bounded music-vocals timestamp lane only to the extent justified by the evidence. The script should prefer reconciled music-vocals when available/appropriate, otherwise fall back to raw music-vocals, and must not over-claim timestamp certainty on sung/chant/rap material. If full segment timing is not supportable, encode the approved partial/fallback contract instead of faking exactness. Add focused tests and validation, then commit/push before QA handoff. Close the bead only when the implementation matches the approved contract.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
- related library/helpers/tests to be finalized after Task 1 and Task 2

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: QA and independent audit of the new timestamp lanes

**Bead ID:** `ee-ser0`  
**SubAgent:** `primary` (for `qa` then `auditor` workflow roles)  
**Role:** `qa` / `auditor`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `After implementation, run the normal QA then auditor loop. QA should verify end-to-end behavior on representative assets, proving that the scripts choose reconciled artifacts when present, raw artifacts when reconciliation is absent, and produce timestamp outputs that match the approved contract without mutating the original canonical dialogue/music-vocals artifacts. Auditor should independently truth-check the contract, diff, tests, and QA evidence, then either pass/close the work or send it back for retry with exact gaps.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- QA/audit notes if needed

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Draft

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Draft created on 2026-04-30*