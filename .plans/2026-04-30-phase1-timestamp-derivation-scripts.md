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

**Retry update (audit gap ee-12u0):** Fixed the hydrated canonical reconciled source-resolution gap in `get-dialogue-timestamps.cjs`. The script no longer hard-requires `phase1-gather-context/dialogue-data.reconciled.json` on disk before checking runtime/hydrated artifacts; it now accepts canonical reconciled dialogue from either `artifacts-complete.json` or `artifacts.dialogueDataReconciled`, while keeping `provenance.sourcePath` truthful to the logical reconciled source path (`phase1-gather-context/dialogue-data.reconciled.json`) for those hydrated runs. Added regressions covering both hydrated canonical cases and re-ran the focused dialogue timestamp suite successfully: `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js`.

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

**Status:** ⚠️ Partial

**Results:**

### QA pass — 2026-04-30 (Cookie / `qa` role)

**QA status:** ✅ Dialogue timestamp slice passes QA on the bounded contract. Auditor pass still pending; bead remains in progress for independent audit.

**Scope executed:** dialogue timestamp lane only (`get-dialogue-timestamps`). I did **not** broaden into the pending music-vocals timestamp lane.

**References checked:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, plus the contract in `docs/2026-04-30-phase1-timestamp-derivation-contract.md` and feasibility memo `docs/2026-04-30-whisper-timestamp-feasibility.md`.

**Commit inspected:** `6b59e77` (`Add phase1 dialogue timestamp derivation lane`).

**Exact commands run:**

```bash
bd update ee-ser0 --status in_progress --json
bd where --json
bd context --json

git show --stat --summary --oneline 6b59e77
git show --name-only --format=fuller 6b59e77 | sed -n '1,120p'

node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js
node --test test/lib/script-contract.test.js
```

**Representative COD-family E2E QA runs executed:**

1. **Live canonical/reconciled run on copied `output/cod-test` Phase 1 artifacts** using `examples/videos/emotion-tests/cod.mp4` and `configs/cod-test.yaml`, invoking `server/scripts/get-context/get-dialogue-timestamps.cjs` programmatically with `runtimeArtifactSurface: 'canonical'`.
   - temp run root: `/tmp/ee-qa-cod-live-NPmwjI`
   - generated artifact: `/tmp/ee-qa-cod-live-NPmwjI/run/phase1-gather-context/dialogue-timestamps-data.reconciled.json`
   - observed result: runtime key `dialogueTimestampsDataReconciled`, surface `reconciled`, source runtime key `dialogueDataReconciled`, source path `phase1-gather-context/dialogue-data.reconciled.json`
   - alignment summary: `19` segments total, `15` aligned, `0` partial, `4` unresolved

2. **Live raw-surface run on copied `output/cod-test` Phase 1 artifacts** using the same COD asset/config, invoking the same script with `runtimeArtifactSurface: 'raw'`.
   - temp run root: `/tmp/ee-qa-cod-live-ECAZMe`
   - generated artifact: `/tmp/ee-qa-cod-live-ECAZMe/run/phase1-gather-context/dialogue-timestamps-data.json`
   - observed result: runtime key `dialogueTimestampsData`, surface `raw`, source runtime key `dialogueData`, source path `phase1-gather-context/dialogue-data.json`
   - alignment summary: `29` segments total, `28` aligned, `1` partial, `0` unresolved

3. **Strict canonical-missing verification on COD-family persisted artifacts** (copied raw dialogue + reconciliation marker, intentionally omitted `dialogue-data.reconciled.json`).
   - temp run root: `/tmp/ee-qa-cod-missing-rec-qOSo3w`
   - observed failure: `Famous-song reconciliation is configured, but the reconciled dialogueData artifact is missing: /tmp/ee-qa-cod-missing-rec-qOSo3w/run/phase1-gather-context/dialogue-data.reconciled.json`
   - this matches the contract’s strict failure posture when canonical should resolve reconciled but the reconciled source artifact is absent.

**Artifacts inspected/generated during QA:**
- inspected source artifacts:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- generated QA artifacts:
  - `/tmp/ee-qa-cod-live-NPmwjI/run/phase1-gather-context/dialogue-timestamps-data.reconciled.json`
  - `/tmp/ee-qa-cod-live-ECAZMe/run/phase1-gather-context/dialogue-timestamps-data.json`

**What QA proved:**
- ✅ **Chooses reconciled artifacts when canonical resolves to reconciled.**
  - Canonical COD run wrote only the reconciled timestamp artifact surface and reported `sourceRuntimeKey: dialogueDataReconciled` with `sourcePath: phase1-gather-context/dialogue-data.reconciled.json`.
  - The source artifact family difference is real on COD: raw dialogue has `29` segments while reconciled dialogue has `19`, with raw-only lyric contamination lines such as `Obey your master.`, `Come crawling faster.`, and `Master, master.` absent from the reconciled source.
- ✅ **Chooses raw artifacts when raw is selected.**
  - Explicit raw COD run wrote `dialogue-timestamps-data.json` and reported `sourceRuntimeKey: dialogueData` with `runtimeArtifactSurface: raw`.
- ✅ **Preserves source transcript text verbatim.**
  - In both live runs, emitted segment text matched the selected source artifact text verbatim (for example the first persisted line remained `They want you afraid.`).
  - Focused automated tests also cover punctuation/case-normalization only as internal alignment logic while persisted text stays untouched.
- ✅ **Does not mutate the original canonical dialogue artifact.**
  - I ran both live QA passes against copied COD artifact directories and SHA-256 checked `dialogue-data.json` and `dialogue-data.reconciled.json` before/after each run; both remained byte-identical (`rawUnchanged: true`, `reconciledUnchanged: true`).
- ✅ **Writes the expected timestamp artifact surface/path/provenance.**
  - Raw run wrote `phase1-gather-context/dialogue-timestamps-data.json`.
  - Canonical/reconciled run wrote `phase1-gather-context/dialogue-timestamps-data.reconciled.json`.
  - Both emitted provenance fields required by contract, including `derivationKind: phase1_timestamp_derivation`, `sourceTextIntegrity: verbatim`, `sourceTimingPolicy: source_artifact_was_untimed`, and `alignmentEngine: phase1_dialogue_asr_rerun`.
- ✅ **Fails loudly when reconciled/canonical source is required but missing.**
  - Verified on copied COD-family artifacts with the exact missing-reconciled error above.

**Automated test result summary:**
- ✅ `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js`
  - passed (`19` tests, `0` failures)
- ⚠️ `node --test test/lib/script-contract.test.js`
  - still has the previously noted unrelated failure: `script-runner - executeScript performs one bounded AI recovery re-entry for eligible AI lanes` expected provider call count `2`, got `1`
  - this failure is outside the dialogue timestamp slice; no QA evidence here suggests the new lane caused it

**QA conclusion for auditor/coder:**
- The bounded **dialogue** timestamp derivation lane introduced in `6b59e77` passes QA against the contract on representative COD-family assets.
- No slice-local bugs were found in raw/reconciled source selection, verbatim text preservation, output path/runtime-surface selection, or non-mutation behavior.
- Remaining caution for audit: the lane is proven for dialogue only; Task 4 / music-vocals remains pending and should not be conflated with this pass.
- Separate, pre-existing issue remains in `test/lib/script-contract.test.js` and should stay isolated from this bead’s dialogue QA judgment.

### Auditor result — 2026-04-30 (Cookie / `auditor` role)

**Audit status:** ❌ FAIL — the dialogue slice is close, but it does **not** fully satisfy the approved contract yet because persisted/runtime wiring is incomplete for canonical reconciled inputs loaded from `artifacts-complete.json` or supplied via the runtime artifact bag.

**Audit scope held:** dialogue timestamp slice only (`get-dialogue-timestamps`). Music-vocals timestamp work remains pending in `ee-669f` and was kept out of scope except to confirm it is still open.

**Evidence reviewed:**
- Plan: `.plans/2026-04-30-phase1-timestamp-derivation-scripts.md`
- Contract: `docs/2026-04-30-phase1-timestamp-derivation-contract.md`
- Feasibility memo: `docs/2026-04-30-whisper-timestamp-feasibility.md`
- Commit: `6b59e77` (`Add phase1 dialogue timestamp derivation lane`)
- Implementation: `server/scripts/get-context/get-dialogue-timestamps.cjs`, `server/lib/phase1-timestamp-derivation.cjs`, `server/lib/phase1-baseline-resolution.cjs`, `server/lib/persisted-artifacts.cjs`, `server/lib/script-contract.cjs`, `server/scripts/get-context/get-dialogue.cjs`
- Tests: `test/scripts/get-dialogue-timestamps.test.js`, `test/lib/phase1-baseline-resolution.test.js`, `test/scripts/tool-wrapper-contract.test.js`

**Independent findings:**
- ✅ **Dialogue-only scope stayed bounded.** No `get-music-vocals-timestamps.cjs` implementation landed in `6b59e77`, and bead `ee-669f` remains open.
- ✅ **Canonical/reconciled vs raw selection logic is implemented for file-backed runs.** The new script uses the shared baseline resolver and mirrors the selected output surface (`dialogue-timestamps-data.json` vs `dialogue-timestamps-data.reconciled.json`).
- ✅ **Verbatim text preservation is real.** The derivation helper emits source segment `text` unchanged and only normalizes internally for matching.
- ✅ **No mutation of canonical dialogue artifacts was introduced in code.** The lane writes a sibling timestamp artifact, and `get-dialogue.cjs` only skips timing stripping during the temp rerun when `preserveSegmentTiming: true` is explicitly passed.
- ✅ **Fail-loudly behavior exists for missing reconciled file-backed source artifacts.** The missing-reconciled error seen in QA matches the contract for persisted canonical/reconciled file runs.
- ❌ **Persisted/runtime wiring is incomplete and breaks a required contract case.** `ensureSourceDialogue()` calls `resolvePhase1ArtifactPath(... strict: true ...)` before it decides whether the selected source is already available in-memory or in `artifacts-complete.json`. As a result, canonical/reconciled runs fail unless `phase1-gather-context/dialogue-data.reconciled.json` exists on disk, even when the reconciled source artifact is already present in:
  - `artifacts-complete.json` as `dialogueDataReconciled`, or
  - the runtime artifact bag as `artifacts.dialogueDataReconciled`

**Why this fails the contract:**
- The contract says persisted loading should work through `persisted-artifacts.cjs`, including canonical raw/reconciled resolution.
- The contract also says runtime artifact bag behavior should follow the existing pattern.
- QA only proved copied-file runs, so it did not cover these hydrated/runtime entrypoints.
- In the current implementation, both of these cases throw the same file-path error before the script can use the already-hydrated reconciled source.

**Exact retry gaps:**
1. Fix `server/scripts/get-context/get-dialogue-timestamps.cjs` so canonical/reconciled source resolution does **not** require the reconciled file path to exist when the selected source artifact is already available from the runtime artifact bag or `artifacts-complete.json`.
2. Preserve truthful `provenance.sourcePath` for hydrated canonical runs. If the logical source surface is `dialogue-data.reconciled.json`, provenance should keep that logical source path rather than collapsing to `artifacts-complete.json` or failing before provenance can be built.
3. Add regression coverage that proves:
   - canonical reconciled derivation works when only `artifacts-complete.json` is present with `dialogueDataReconciled`
   - canonical reconciled derivation works when `artifacts.dialogueDataReconciled` is provided in-memory
   - provenance still reports the reconciled logical source path/runtime key correctly in those cases
4. Re-run the focused dialogue timestamp test suite after the fix and refresh QA/audit evidence.

**Exact commands run during audit:**
```bash
bd show ee-ser0 --json
bd update ee-ser0 --status in_progress --json

git show --stat --summary --oneline 6b59e77
git show --name-only --format=fuller 6b59e77 | sed -n '1,160p'
git diff 6b59e77^ 6b59e77 -- server/scripts/get-context/get-dialogue.cjs server/lib/phase1-baseline-resolution.cjs server/lib/persisted-artifacts.cjs server/lib/script-contract.cjs server/scripts/get-context/get-dialogue-timestamps.cjs server/lib/phase1-timestamp-derivation.cjs test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js | sed -n '1,260p'
grep -nE "preserveSegmentTiming|stripDialogueSegmentTiming|async function run|module\.exports" server/scripts/get-context/get-dialogue.cjs | sed -n '1,120p'

node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js
node --test test/lib/script-contract.test.js

node - <<'NODE'
# canonical reconciled derivation with only artifacts-complete.json present
NODE

node - <<'NODE'
# canonical reconciled derivation with only in-memory artifacts.dialogueDataReconciled present
NODE
```

**Audit conclusion:** send Task 3 back for a small follow-up fix before considering the dialogue slice complete. The implementation is otherwise bounded and promising, but the persisted/runtime wiring claim is not yet fully true.

### Retry status — 2026-04-30 late session wrap-up (Cookie / orchestrator)

**Retry status:** ✅ Bounded coder retry landed, but **re-QA / re-audit are still pending** for the fixed dialogue slice.

**What changed after the failed auditor pass:**
- Reopened `ee-12u0` for the exact hydrated canonical reconciled source-resolution defect.
- Landed follow-up commit `445eea1` (`Fix hydrated dialogue timestamp source resolution`).
- The fix updates `get-dialogue-timestamps.cjs` so canonical reconciled dialogue can now be consumed from either `artifacts-complete.json` (`dialogueDataReconciled`) or in-memory `artifacts.dialogueDataReconciled` without first requiring `phase1-gather-context/dialogue-data.reconciled.json` on disk.
- Added regressions for both hydrated canonical reconciled cases while keeping the prior fail-loud missing-reconciled behavior intact.

**Validation rerun after retry:**
- ✅ `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/phase1-baseline-resolution.test.js test/scripts/tool-wrapper-contract.test.js`

**Current stopping point / exact next step:**
1. Re-run **QA** on the fixed dialogue slice against commit `445eea1`, specifically covering the two hydrated canonical reconciled entrypoints.
2. Re-run the **auditor** pass on the same fixed slice.
3. If dialogue then passes audit cleanly, continue to **Task 4** (`ee-669f`) for the bounded music-vocals timestamp lane.

**Bead state at stop:**
- `ee-12u0` — closed again after retry fix
- `ee-ser0` — left in progress as the shared QA/audit bead because re-QA / re-audit still need to validate `445eea1`
- `ee-669f` — still pending; not started

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** The bounded Phase 1 **dialogue** timestamp derivation lane, including sibling timestamp artifact wiring, a new `get-dialogue-timestamps` script, and a follow-up fix for hydrated canonical reconciled source resolution. The corresponding **music-vocals** timestamp lane has not started yet.

**Reference Check:** Dialogue-side contract work is implemented and partly validated, but the final re-QA / re-audit pass against retry commit `445eea1` is still outstanding before this slice can be called complete.

**Commits:**
- `6b59e77` - Add phase1 dialogue timestamp derivation lane
- `445eea1` - Fix hydrated dialogue timestamp source resolution

**Lessons Learned:** File-backed QA alone was not enough for this lane; hydrated/runtime entrypoints needed explicit audit coverage because canonical artifact resolution can succeed from in-memory or `artifacts-complete.json` surfaces even when a sibling reconciled file is absent on disk.

---

*Draft created on 2026-04-30*