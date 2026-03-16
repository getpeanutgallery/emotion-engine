# emotion-engine: run-root raw layout decision

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Resolve bead `ee-0gv` by deciding whether the run-root `raw/` namespace should remain as-is or move to a clearer canonical location, then implement the chosen layout safely if warranted.

---

## Overview

Now that the immediate rerun-artifact hygiene bug is fixed, `ee-0gv` is back to what it fundamentally was: a code/project layout smell around the run-root `raw/` namespace. Today the system has both phase-scoped raw folders and a run-root raw folder, which makes it unclear whether a given `raw/` path is phase-local capture data or run-level metadata/debug state.

This is not a correctness blocker for the next full run in the same way the stale-artifact mixing bug was, but it is worth tackling because it affects human browsing, tooling assumptions, docs clarity, and future maintenance. The right move is to first make an explicit decision about canonical ownership and layout, then either implement the rename/migration or document why the current layout should remain.

The owning repo is `emotion-engine`, because the run output structure, prompt store, events timeline, docs, and backward-compat readers all live here.

---

## Tasks

### Task 1: Audit current run-root raw responsibilities and choose a canonical layout

**Bead ID:** `ee-0gv`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-0gv immediately. Audit the current responsibilities of run-root raw paths versus phase-scoped raw paths, confirm all writers/readers/docs impacted, and choose the canonical layout direction (keep raw/, move to _meta/, move to _debug/, or another clearly justified structure). Update this plan with the decision, exact impacted files, migration approach, and rationale. Do not implement yet unless the decision is absolutely trivial. Close the bead only if the full ee-0gv scope is completed; otherwise leave it open and document next child beads needed.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-run-root-raw-layout-decision.md`

**Status:** ✅ Complete

**Results:** Audited current ownership and chose a canonical layout: keep phase-scoped `phase*/raw/` exactly as the debug/audit namespace for script-local captures, but move the run-level timeline + prompt dedupe store out of run-root `raw/` into a run-root `_meta/` namespace. Canonical target paths:
- `output/<run>/_meta/events.jsonl`
- `output/<run>/_meta/ai/_prompts/<sha256>.json`

Confirmed current responsibilities:
- **Phase-scoped `phase*/raw/`** = attempt captures, ffmpeg/ffprobe logs, tool version snapshots, per-phase error summaries, stitcher/debug artifacts.
- **Run-root `raw/` today** = cross-phase metadata only: append-only events timeline plus prompt payload dedupe store referenced by `promptRef.file`.

Exact impacted files for implementation:
- **Direct writers/readers**
  - `server/lib/events-timeline.cjs`
  - `server/lib/prompt-store.cjs`
  - `server/lib/ai-recovery-lane.cjs` (prompt-ref discovery heuristic currently keys off `/_prompts/`; keeping `_meta/ai/_prompts/` preserves that anchor)
- **Indirect promptRef / timeline producers to regression-check**
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/process/video-chunks.cjs`
  - `server/scripts/report/recommendation.cjs`
  - `server/lib/local-validator-tool-loop.cjs`
  - `server/lib/script-contract.cjs`
  - `server/run-pipeline.cjs`
- **Docs**
  - `README.md`
  - `docs/DEBUG-CONFIG.md`
  - `docs/CONFIG-GUIDE.md`
  - `docs/PIPELINE-SCRIPTS.md`
- **Tests**
  - `test/lib/script-contract.test.js`
  - `test/scripts/get-dialogue.test.js`
  - `test/scripts/get-music.test.js`
  - `test/scripts/video-chunks.test.js`
  - `test/scripts/recommendation.test.js`
- **Fixtures**
  - No tracked `test/fixtures/` or checked-in output fixtures currently encode the run-root prompt/timeline path; compatibility mainly matters for existing on-disk historical outputs and replay/debug browsing.

Migration approach recommended for `ee-lgb`:
1. Change canonical writers to emit only to `_meta/...`.
2. Update `promptRef.file` canonical values to `_meta/ai/_prompts/<sha>.json`.
3. Make prompt-store readers accept **both** `_meta/ai/_prompts/<sha>.json` and legacy `raw/ai/_prompts/<sha>.json` so old runs/replays still load.
4. For run timeline, do a clean writer cutover to `_meta/events.jsonl`; no in-repo runtime reader currently requires dual-read, but docs should note that historical runs may still contain `raw/_meta/events.jsonl`.
5. Do **not** dual-write unless verification uncovers an external consumer that hard-depends on the old path; dual-read is enough and keeps the tree from staying ambiguous.

Compatibility strategy:
- **Prompt store:** dual-read old + new paths, single-write new path.
- **Timeline:** single-write new path, document old-path tolerance for humans/tooling, and if any verifier exists later it should check new path first then legacy fallback.

Rationale:
- Run-root `raw/` is semantically different from phase `raw/`; it holds metadata/indexing state, not phase-local raw capture.
- `_meta/` makes that ownership explicit without disturbing the established per-phase debug layout.
- Keeping `ai/_prompts/` under `_meta/` preserves the existing `_prompts` anchor, which minimizes churn in heuristics and keeps the implementation bounded.
- This decision is solid enough to implement now. Recommend proceeding to bead `ee-lgb`.

---

### Task 2: Implement the chosen run-root metadata/debug layout

**Bead ID:** `ee-lgb`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the chosen ee-0gv layout decision. Update writers, readers, docs, tests, and any promptRef path handling needed for compatibility. Preserve replay/fixture usability and avoid breaking existing outputs if a dual-read transition is needed. Update this plan with exact files changed, validation evidence, migration compatibility details, and close the implementation bead when done.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `docs/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/events-timeline.cjs`
- `server/lib/prompt-store.cjs`
- `test/lib/prompt-store.test.js`
- `test/lib/script-contract.test.js`
- `README.md`
- `docs/DEBUG-CONFIG.md`
- `docs/CONFIG-GUIDE.md`
- `docs/PIPELINE-SCRIPTS.md`
- `.plans/2026-03-15-run-root-raw-layout-decision.md`

**Status:** ✅ Complete

**Results:** Implemented the run-root metadata cutover to `_meta/` while leaving phase-local raw capture under `phase*/raw/`.

Implementation details:
- `server/lib/events-timeline.cjs`
  - canonical run timeline writer now creates/appends `output/<run>/_meta/events.jsonl`
  - no dual-write to `raw/_meta/events.jsonl`
- `server/lib/prompt-store.cjs`
  - canonical prompt store now writes to `output/<run>/_meta/ai/_prompts/<sha>.json`
  - canonical `promptRef.file` now emits `_meta/ai/_prompts/<sha>.json`
  - prompt loading accepts both canonical `_meta/ai/_prompts/...` and legacy `raw/ai/_prompts/...`
  - compatibility fallback resolves across canonical/legacy aliases if the on-disk file only exists in the other location
- `test/lib/prompt-store.test.js`
  - added focused coverage for canonical writes, canonical reads, legacy reads, and alias fallback
- `test/lib/script-contract.test.js`
  - updated canonical promptRef/captureRefs expectations to `_meta/ai/_prompts/...`
- Docs (`README.md`, `docs/DEBUG-CONFIG.md`, `docs/CONFIG-GUIDE.md`, `docs/PIPELINE-SCRIPTS.md`)
  - updated canonical run-level paths to `_meta/events.jsonl` and `_meta/ai/_prompts/...`
  - explicitly marked `raw/_meta/events.jsonl` and `raw/ai/_prompts/...` as historical legacy paths where appropriate

Validation evidence:
- Ran focused regression suite:
  - `node --test test/lib/prompt-store.test.js test/lib/script-contract.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/video-chunks.test.js`
- Result: `78` tests passed, `0` failed.
- New prompt-store tests verify:
  - single-write canonical prompt refs under `_meta/ai/_prompts/`
  - dual-read support for legacy `raw/ai/_prompts/...`
  - compatibility fallback when a legacy ref points at a canonicalized on-disk file

Compatibility caveats:
- Prompt payloads are now single-written only to `_meta/ai/_prompts/...`; no dual-write to `raw/ai/_prompts/...`.
- Timeline is now single-written only to `_meta/events.jsonl`; older runs may still contain `raw/_meta/events.jsonl`.
- External tooling/docs must treat run-root `raw/` metadata paths as historical, not canonical.

---

### Task 3: Verify output layout clarity and compatibility

**Bead ID:** `ee-me3`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the new run-root metadata/debug layout after implementation. Confirm docs match the code, promptRef compatibility works as intended, and a representative dry-run or focused test leaves a clearer output tree than before. Update this plan with exact evidence and decide whether ee-0gv can close fully.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- representative temp output under `/tmp/ee-run-root-verify-ZW6LLo`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-run-root-raw-layout-decision.md`

**Status:** ✅ Complete

**Results:** Verified the implementation, docs, compatibility behavior, and a representative output tree.

Verification evidence:
- **Focused regression suite passed:**
  - `node --test test/lib/prompt-store.test.js test/lib/script-contract.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/video-chunks.test.js`
  - Result: `78` tests passed, `0` failed.
- **Code/docs alignment checked:**
  - `server/lib/events-timeline.cjs` documents and writes canonical run timeline to `_meta/events.jsonl`.
  - `server/lib/prompt-store.cjs` documents and writes canonical prompt refs to `_meta/ai/_prompts/<sha>.json`, while accepting legacy `raw/ai/_prompts/<sha>.json` reads.
  - `README.md`, `docs/DEBUG-CONFIG.md`, `docs/CONFIG-GUIDE.md`, and `docs/PIPELINE-SCRIPTS.md` all describe `_meta/events.jsonl` + `_meta/ai/_prompts/...` as canonical and legacy `raw/...` locations as historical.
- **Representative output tree / dry-run-style verification:**
  - Created a minimal representative run root at `/tmp/ee-run-root-verify-ZW6LLo` by invoking `storePromptPayload()` and `getEventsLogger()` directly, then writing a phase raw capture that references the stored prompt.
  - Root entries were only `_meta/` and `phase1-gather-context/`; there was **no** run-root `raw/` directory.
  - Observed canonical files:
    - `/tmp/ee-run-root-verify-ZW6LLo/_meta/events.jsonl`
    - `/tmp/ee-run-root-verify-ZW6LLo/_meta/ai/_prompts/b4c025762bf66a03ab5270f31624dcd9c1219cf4817d263884778e434fa04e59.json`
    - `/tmp/ee-run-root-verify-ZW6LLo/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
  - The capture payload contained canonical `promptRef.file = "_meta/ai/_prompts/b4c025762bf66a03ab5270f31624dcd9c1219cf4817d263884778e434fa04e59.json"`.
  - The timeline recorded the phase raw artifact path while living at run-root `_meta/events.jsonl`, which makes the ownership split clearer than the old mixed run-root `raw/` namespace.
- **Compatibility check:**
  - In the same representative run root, `loadPromptPayload()` successfully loaded the canonical stored prompt when given a **legacy** ref file of `raw/ai/_prompts/b4c025762bf66a03ab5270f31624dcd9c1219cf4817d263884778e434fa04e59.json` (`legacyLoadedMatches: true`).
  - This matches the explicit regression coverage in `test/lib/prompt-store.test.js` for canonical writes, canonical reads, legacy reads, and alias fallback.

Decision on parent bead:
- The evidence now supports closing `ee-0gv` fully. The canonical layout decision was implemented, documented, regression-tested, and verified with a representative output tree showing the clearer run-root `_meta/` vs phase-scoped `raw/` split.

---

## Key decision questions

1. Should run-level timeline + prompt-store artifacts stay under `output/<run>/raw/` at all?
2. If not, is `_meta/` or `_debug/` the clearer canonical home?
3. How should `promptRef.file` compatibility be handled for existing captures/fixtures?
4. Do we need dual-read, dual-write, or a simple cutover?
5. What docs and tooling assumptions need to move with the change?

---

## Constraints

- Prefer a clear canonical layout over preserving a confusing name for inertia.
- Preserve compatibility for existing recorded outputs/fixtures where practical.
- Keep the migration bounded and well documented.
- Do not mix this work with unrelated recommendation or provider investigations.

---

## Decision

### Canonical layout

Keep **phase-scoped** raw capture where it already belongs:
- `output/<run>/phase1-gather-context/raw/`
- `output/<run>/phase2-process/raw/`
- `output/<run>/phase3-report/raw/`

Move **run-level metadata** out of run-root `raw/` and make `_meta/` the canonical run-level namespace:
- `output/<run>/_meta/events.jsonl`
- `output/<run>/_meta/ai/_prompts/<sha256>.json`

### Why this is the right split

Phase `raw/` is true script/phase debug evidence. Run-root timeline + prompt dedupe are cross-phase metadata and traceability infrastructure. They should not compete for the same `raw/` label.

### Implementation recommendation

Proceed now with bead `ee-lgb`.

- **Writers:** cut over to `_meta/...` only.
- **Prompt refs:** make `_meta/ai/_prompts/<sha>.json` the canonical new `promptRef.file` value.
- **Compatibility:** prompt payload loading must accept both old `raw/ai/_prompts/...` and new `_meta/ai/_prompts/...` refs; timeline can be single-write new path with docs/tooling fallback guidance for older runs.
- **Migration shape:** no bulk on-disk migration required; support historical outputs by tolerant reads instead of rewriting old run folders.

## Final Results

**Status:** ✅ Complete

**What We Built:** Resolved the run-root layout ambiguity by making run-level metadata canonical under `_meta/` while preserving phase-local debug evidence under `phase*/raw/`. The implementation now single-writes the run timeline to `_meta/events.jsonl`, single-writes stored prompts to `_meta/ai/_prompts/<sha>.json`, preserves promptRef compatibility for historical `raw/ai/_prompts/...` refs, and documents the old `raw/...` locations as legacy-only.

**Commits:**
- Pending in this task scope.

**Lessons Learned:** The cleanest migration was single-write + dual-read rather than dual-write. Keeping the `_prompts` anchor stable while moving only the run-root namespace minimized reader churn and made the output tree obviously easier to browse.

---

*Completed on 2026-03-15*