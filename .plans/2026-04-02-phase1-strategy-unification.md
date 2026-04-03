# emotion-engine: unify Phase 1 strategy controls

**Date:** 2026-04-02  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Unify Phase 1 strategy controls across the Phase 1 extraction scripts so dialogue, music, and visual-identity use a consistent YAML-driven mode surface for whole-asset vs chunked behavior, while deferring deeper Phase 2 video unification design until after the Phase 1 surface is landed and reviewed.

---

## Overview

The current repo already has partial strategy support, but it is uneven. `get-dialogue.cjs` and `get-music.cjs` both support `auto` / `chunked` / `whole_asset` / `hybrid` concepts, while `get-visual-identity.cjs` is effectively whole-asset-oriented and does not yet expose the same first-class mode surface. That means Phase 1 behavior is already drifting toward the design Derrick wants, but not through one unified config contract.

This plan proposes finishing that unification at the Phase 1 layer first. The core work is to define and implement one consistent YAML control shape under `settings.phase1.<script>` for the relevant Phase 1 scripts, validate that existing configs still parse and behave truthfully, and document any semantic differences that remain. We should keep the implementation narrow and avoid prematurely forcing all configs into whole-asset mode before the strategy surface is stable.

Once the unified control surface exists, we can review the current OpenRouter MiMo cod-test lane and decide whether to flip dialogue/music/visual-identity to whole-asset or hybrid. Phase 2 video should be discussed afterward because its artifact contract and evaluation semantics differ materially from the Phase 1 extraction family.

---

## Tasks

### Task 1: Audit current Phase 1 strategy-control surfaces and define the target unified YAML contract

**Bead ID:** `ee-wp3q`  
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the current Phase 1 strategy-control surfaces for get-dialogue.cjs, get-music.cjs, and get-visual-identity.cjs. Define the target unified YAML contract for whole-asset vs chunked strategy selection under settings.phase1.<script>, identify any semantic mismatches or missing support, and update the active plan with the recommended contract before implementation. Claim bead ee-wp3q on start with bd update ee-wp3q --status in_progress --json and close it on completion with bd close ee-wp3q --reason "Audited Phase 1 strategy surfaces and defined unified YAML contract" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- optional `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-02-phase1-strategy-unification.md`
- optional notes/docs to be determined

**Status:** ✅ Complete

**Results:** Audit complete. Current behavior and the recommended implementation contract are:

**Current surface audit**
- `get-dialogue.cjs` already reads `settings.phase1.dialogue` and supports `mode`, `timing_refinement`, `max_whole_asset_duration_seconds`, `fallback_to_chunked`, and `preserve_chunk_plan_metadata`.
- `get-music.cjs` already reads `settings.phase1.music` and supports `mode`, `max_whole_asset_duration_seconds`, `fallback_to_chunked`, `analysis_window_seconds`, and `emit_global_arc`.
- `get-visual-identity.cjs` does **not** currently read a Phase 1 strategy block. It is effectively always whole-asset/full-timeline and only sees an ad hoc `settings.phase1.visual_identity.enabled: true` in config examples.

**Recommended unified YAML contract (target)**
```yaml
settings:
  phase1:
    dialogue:
      mode: auto | chunked | whole_asset | hybrid
      max_whole_asset_duration_seconds: <number>
      fallback_to_chunked: true | false
      timing_refinement: auto | disabled | chunk_refine   # dialogue-specific
      preserve_chunk_plan_metadata: true | false          # dialogue-specific

    music:
      mode: auto | chunked | whole_asset | hybrid
      max_whole_asset_duration_seconds: <number>
      fallback_to_chunked: true | false
      analysis_window_seconds: <number>                   # music-specific chunk window
      emit_global_arc: true | false                       # music-specific output toggle

    visual_identity:
      mode: auto | chunked | whole_asset | hybrid
      max_whole_asset_duration_seconds: <number>
      fallback_to_chunked: true | false
      # no script-specific extras required in the first implementation pass
```

**Unified semantics to implement**
- `mode: auto`
  - Prefer `whole_asset` when the asset is eligible for whole-asset execution for that lane.
  - Otherwise select `chunked`.
- `mode: chunked`
  - Force chunked execution for that lane.
- `mode: whole_asset`
  - Require a whole-asset attempt first.
  - If whole-asset is not eligible or fails, only fall back to chunked when `fallback_to_chunked: true`; otherwise fail loudly.
- `mode: hybrid`
  - Run a whole-asset pass **plus** a chunked refinement pass when the lane has meaningful chunk refinement behavior.
  - If whole-asset is unavailable and `fallback_to_chunked: true`, degrade honestly to chunked-only and mark provenance/quality notes accordingly.
  - If the lane has no meaningful hybrid refinement beyond whole-asset yet, hybrid should currently behave the same as whole-asset rather than inventing fake chunk behavior.

**Per-script interpretation that the implementation subagent should follow**
- `dialogue.hybrid` should remain: whole-asset transcript/context pass + chunked timing refinement/stitching pass.
- `music.hybrid` should remain: whole-asset global arc/context pass + chunked local-window refinement pass.
- `visual_identity.hybrid` should initially alias to `whole_asset` behavior, with explicit provenance/quality note that no chunk-refinement lane exists yet. Do **not** invent a chunk-based visual identity pass in this implementation.
- `visual_identity.chunked` should parse as a valid request surface but should fail clearly as unsupported for now, unless the implementation explicitly chooses the softer behavior of degrading to whole-asset in `auto` only. Recommendation: keep `chunked`/true hybrid unsupported for visual identity in code, but make the config contract uniform now.

**Semantic mismatches / missing support identified**
- Default mode mismatch: dialogue defaults to `auto`, music defaults to `chunked`, visual identity has no strategy mode at all. Recommendation: normalize all three to `auto` as the contract default.
- Eligibility mismatch: music uses `max_whole_asset_duration_seconds` as a real whole-asset eligibility guard, but dialogue currently uses that threshold only for `auto` selection and hybrid timing-refinement decisions; dialogue whole-asset/hybrid can still attempt whole-asset above the configured max if transport is inline-safe. Recommendation: make dialogue use `max_whole_asset_duration_seconds` as a true whole-asset eligibility threshold, same as music.
- Hybrid mismatch: dialogue hybrid can become conditional on `timing_refinement`; music hybrid always means whole-asset + chunk refinement; visual identity has no hybrid support. Recommendation: preserve dialogue’s `timing_refinement` as a dialogue-only extra, but align the top-level `mode` semantics across all three lanes.
- Transport mismatch: dialogue/music are inline audio/base64 lanes, while visual identity can use URL/path/data media delivery for full video. Recommendation: unify the YAML selection surface anyway, but do **not** force identical transport internals.
- Existing `settings.phase1.visual_identity.enabled` is orthogonal to strategy selection and should not be treated as the long-term strategy contract. If retained for compatibility, it should coexist with the new `mode` surface rather than replacing it.

**Concrete implementation guidance for Task 2**
- Add a Phase 1 visual-identity mode normalizer parallel to dialogue/music.
- Make visual identity accept the unified keys above, defaulting `mode` to `auto` and resolving `auto => whole_asset` for now.
- Thread the selected/requested mode into visual-identity provenance so downstream artifacts truthfully show requested vs effective behavior.
- Align dialogue default/eligibility behavior with the music-style contract, but keep dialogue-specific `timing_refinement` and chunk-plan metadata features intact.
- Align music default mode to `auto` unless there is a deliberate backward-compatibility blocker discovered during implementation/tests.
- Preserve existing config compatibility where possible: omitted legacy blocks should still run, but through normalized defaults instead of bespoke per-script assumptions.

---

### Task 2: Implement the unified Phase 1 strategy controls across dialogue, music, and visual identity

**Bead ID:** `ee-9720`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the unified Phase 1 YAML strategy-control surface across get-dialogue.cjs, get-music.cjs, and get-visual-identity.cjs using the agreed settings.phase1.<script> contract. Keep the implementation narrow, preserve honest fallback behavior, avoid unrelated cleanup, and update the active plan with exactly what changed. Claim bead ee-9720 on start with bd update ee-9720 --status in_progress --json and close it on completion with bd close ee-9720 --reason "Implemented unified Phase 1 strategy controls across dialogue music and visual identity" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`
- optional `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-02-phase1-strategy-unification.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-visual-identity.test.js`

**Status:** ✅ Complete

**Results:** Implemented the unified Phase 1 strategy surface narrowly across the three scripts and added focused regression coverage.

**Implementation changes landed**
- `server/scripts/get-context/get-music.cjs`
  - Changed the normalized default from `settings.phase1.music.mode: chunked` to `auto`.
  - Preserved the existing shared top-level keys under `settings.phase1.music`: `mode`, `max_whole_asset_duration_seconds`, and `fallback_to_chunked`.
  - Kept only the real music-specific extras: `analysis_window_seconds` and `emit_global_arc`.
  - Left the existing honest fallback behavior intact: explicit whole-asset / hybrid requests still degrade to chunked only when `fallback_to_chunked` allows it, with provenance + quality notes preserved.

- `server/scripts/get-context/get-dialogue.cjs`
  - Kept the unified dialogue block under `settings.phase1.dialogue` with shared keys `mode`, `max_whole_asset_duration_seconds`, and `fallback_to_chunked`.
  - Kept only the real dialogue-specific extras: `timing_refinement` and `preserve_chunk_plan_metadata`.
  - Aligned whole-asset eligibility semantics more closely to music: whole-asset / hybrid attempts now require both inline-transport safety **and** duration within `max_whole_asset_duration_seconds`.
  - When explicit `whole_asset` / `hybrid` requests are ineligible, the lane now falls back honestly to chunked only if `fallback_to_chunked: true`; otherwise it fails with a clear error that distinguishes inline-budget vs duration-threshold rejection.
  - Threaded the duration-threshold ineligibility through provenance fallback reasons (`max_whole_asset_duration_exceeded`) instead of treating only transport-budget failures as whole-asset-unavailable.

- `server/scripts/get-context/get-visual-identity.cjs`
  - Added a normalized `settings.phase1.visual_identity` strategy surface using the same shared top-level keys: `mode`, `max_whole_asset_duration_seconds`, and `fallback_to_chunked`.
  - Set the normalized default to `auto`.
  - Implemented first-pass unified behavior exactly as audited:
    - `auto` resolves to effective `whole_asset`
    - `hybrid` aliases to `whole_asset`
    - `chunked` fails clearly as unsupported right now
  - Kept the implementation honest by threading requested vs effective mode into provenance, including an explicit hybrid alias marker/reason rather than pretending chunk refinement exists.
  - Added a quality note when `hybrid` is requested so downstream consumers can see that the current first pass is a whole-asset alias.

**Focused test updates**
- `test/scripts/get-music.test.js`
  - Added coverage proving omitted `settings.phase1.music.mode` now defaults to `auto` and selects whole-asset when eligible.
  - Kept existing chunked-path expectations explicit by making the shared test helper request `mode: chunked` unless a test overrides it.

- `test/scripts/get-dialogue.test.js`
  - Updated the hybrid test fixture so its whole-asset pass stays eligible under the new duration-threshold semantics.
  - Added a focused regression test proving explicit `whole_asset` dialogue falls back honestly to chunked when `max_whole_asset_duration_seconds` is exceeded and `fallback_to_chunked: true`.

- `test/scripts/get-visual-identity.test.js`
  - Added assertions for the new visual-identity provenance fields (`requestedMode`, `effectiveMode`, alias markers).
  - Added a focused hybrid-alias test and an explicit unsupported-`chunked` failure test.

**Verification run**
- Syntax-checked the touched implementation + test files with `node --check`.
- Ran targeted tests successfully:
  - `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/get-visual-identity.test.js`
  - Result: 62 tests passed, 0 failed.

---

### Task 3: Verify config compatibility and identify which current configs should adopt the unified Phase 1 whole-asset/hybrid settings next

**Bead ID:** `ee-kc5t`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the unified Phase 1 strategy-control implementation. Confirm existing configs still validate, identify any behavior changes or caveats, and recommend which current configs should adopt explicit whole-asset/hybrid settings next, especially for the OpenRouter MiMo cod-test lane. Update the active plan with what actually happened, claim bead ee-kc5t on start with bd update ee-kc5t --status in_progress --json, and close it on completion with bd close ee-kc5t --reason "Verified unified Phase 1 strategy controls and recommended next config adoptions" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- optional `test/`
- optional `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-02-phase1-strategy-unification.md`
- optional verification artifacts to be determined

**Status:** ✅ Complete

**Results:** Verified the unified Phase 1 strategy surface without changing any configs.
- Validation commands run successfully:
  - `npm run validate-configs`
  - `for f in configs/*.yaml; do node server/run-pipeline.cjs --config "$f" --dry-run >/tmp/ee-dryrun.log; done`
  - `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/get-visual-identity.test.js`
- Result: all 26 config YAML files parsed successfully and all 26 configs passed pipeline `--dry-run` validation after the strategy unification.
- Result: the focused Phase 1 regression suite passed (`62` tests passed, `0` failed), covering dialogue whole-asset/hybrid behavior, music whole-asset/hybrid behavior, and visual-identity hybrid alias / unsupported chunked behavior.
- Compatibility finding: configs that do not declare `settings.phase1.*` continue to validate because dialogue/music default to `mode: auto`, so the unification is backward-compatible at the current config surface.
- Behavior change confirmed: dialogue now treats `settings.phase1.dialogue.max_whole_asset_duration_seconds` as a real whole-asset eligibility guard, matching music more closely. Explicit `whole_asset` / `hybrid` requests can now degrade to chunked because of duration threshold, not just inline/base64 transport pressure.
- Caveat: `visual_identity.hybrid` is currently an honest alias for `whole_asset`, and `visual_identity.mode: chunked` still fails explicitly as unsupported.
- Caveat: `settings.phase1.visual_identity.max_whole_asset_duration_seconds` and `fallback_to_chunked` now exist in the unified surface, but the current visual-identity implementation does not yet enforce a duration-based eligibility branch or real chunked fallback path; those values are effectively preparatory metadata until a chunk-capable visual-identity lane exists.
- Recommendation: adopt explicit Phase 1 settings next in the cod-focused configs that are meant to exercise or compare strategy behavior, not the generic examples. Highest priority is `configs/cod-test-mimo-openrouter-compare.yaml`.
  - Specific recommendation for `cod-test-mimo-openrouter-compare.yaml`: add an explicit `settings.phase1` block with `dialogue.mode: hybrid`, `dialogue.timing_refinement: chunk_refine`, `dialogue.max_whole_asset_duration_seconds: 180`, `dialogue.fallback_to_chunked: true`, `dialogue.preserve_chunk_plan_metadata: true`, plus `music.mode: hybrid`, `music.max_whole_asset_duration_seconds: 180`, `music.analysis_window_seconds: 30`, `music.emit_global_arc: true`, and `music.fallback_to_chunked: true`.
  - Rationale: that lane is the current OpenRouter MiMo comparison target, so making dialogue/music strategy explicit removes ambiguity about whether results came from auto-selection vs intended whole-asset-plus-refinement behavior. It also keeps honest fallback behavior if provider/runtime limits reject whole-asset execution.
  - Follow-on config priority after that: `configs/cod-test-phase1-review.yaml` and `configs/cod-test.yaml` should adopt the same explicit dialogue/music settings for cod-lane comparability; `configs/cod-test-phase2-3chunk-comparison.yaml` should stay chunk-oriented and does not need this flip.
  - Visual-identity recommendation: do not add `visual_identity.mode: hybrid` to the OpenRouter MiMo compare lane yet unless the lane also adds `server/scripts/get-context/get-visual-identity.cjs` plus an `ai.video_identity` target. When that lane is ready, prefer explicit `visual_identity.mode: whole_asset` first; save `hybrid` for later when the alias is replaced by a real refinement path.

---

## Success Criteria

- Dialogue, music, and visual identity share one coherent Phase 1 YAML strategy surface.
- Existing configs remain valid or any required migrations are explicit and bounded.
- The implementation preserves truthful fallback behavior and does not silently force whole-asset mode where it is unsafe.
- We end with a clear recommendation for which configs to flip next before discussing Phase 2 unification.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Unified the Phase 1 strategy-control surface across dialogue, music, and visual identity, verified that the repo's existing configs still parse and pass pipeline dry-run validation under the new contract, and then flipped `configs/cod-test-mimo-openrouter-compare.yaml` to explicit Phase 1 hybrid settings for dialogue and music. The verification also documented the main semantic changes: dialogue now honors the whole-asset duration threshold as a true eligibility guard, visual-identity hybrid remains a truthful whole-asset alias, and visual-identity chunked mode is still explicitly unsupported.

**Commits:**
- Pending

**Lessons Learned:** Keep the config surface uniform, but be explicit about where implementation depth still differs. Dialogue and music are now genuinely strategy-selectable lanes; visual identity has the same YAML shape but not yet the same fallback/refinement depth. For benchmark-sensitive cod lanes, explicit Phase 1 settings are now preferable to relying on `auto`, especially in `configs/cod-test-mimo-openrouter-compare.yaml`.

---

## Follow-on config adoption lane

### Task 4: Flip the OpenRouter MiMo compare config to the new explicit Phase 1 hybrid strategy settings for dialogue and music

**Bead ID:** `ee-nvwv`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update configs/cod-test-mimo-openrouter-compare.yaml to use the newly unified explicit Phase 1 strategy settings recommended in the verification step. For dialogue, add mode: hybrid, timing_refinement: chunk_refine, max_whole_asset_duration_seconds: 180, fallback_to_chunked: true, and preserve_chunk_plan_metadata: true. For music, add mode: hybrid, max_whole_asset_duration_seconds: 180, analysis_window_seconds: 30, emit_global_arc: true, and fallback_to_chunked: true. Keep the change narrow, validate config shape with focused checks, update the active plan with exactly what changed, and do not broaden the lane beyond this config. Claim bead ee-nvwv on start with bd update ee-nvwv --status in_progress --json and close it on completion with bd close ee-nvwv --reason "Flipped OpenRouter MiMo compare config to explicit Phase 1 hybrid settings" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- optional `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-02-phase1-strategy-unification.md`
- `configs/cod-test-mimo-openrouter-compare.yaml`

**Status:** ✅ Complete

**Results:** Updated `configs/cod-test-mimo-openrouter-compare.yaml` narrowly to make the Phase 1 strategy explicit for the OpenRouter MiMo comparison lane.
- Added `settings.phase1.dialogue` with:
  - `mode: hybrid`
  - `timing_refinement: chunk_refine`
  - `max_whole_asset_duration_seconds: 180`
  - `fallback_to_chunked: true`
  - `preserve_chunk_plan_metadata: true`
- Added `settings.phase1.music` with:
  - `mode: hybrid`
  - `max_whole_asset_duration_seconds: 180`
  - `analysis_window_seconds: 30`
  - `emit_global_arc: true`
  - `fallback_to_chunked: true`
- Kept the change scoped to this config only; no script, test, or other config changes were made.
- Focused validation completed successfully:
  - `python3` YAML shape/assertion check against the new `settings.phase1` block
  - `node server/run-pipeline.cjs --config configs/cod-test-mimo-openrouter-compare.yaml --dry-run`
- Result: the config parses cleanly and passes pipeline dry-run validation with the explicit hybrid settings in place.

---

*Completed on 2026-04-02*
