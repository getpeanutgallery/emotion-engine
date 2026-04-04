# emotion-engine: dialogue metadata honesty fix investigation

**Date:** 2026-04-03  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Determine the smallest truthful implementation needed to stop whole-asset dialogue artifacts from overstating coverage/timeline confidence, while preserving useful evidence about what the model actually returned.

---

## Overview

The latest Xiaomi/OpenRouter high-thinking rerun exposed a layered contradiction in the dialogue artifact contract. The returned dialogue text appears too accurate to dismiss as blind hallucination, yet the model self-reports approximate/non-audio grounding, and our local finalization path then rewrites the artifact into a falsely complete full-timeline object. The result is an artifact that is simultaneously too pessimistic about its own grounding note and too optimistic about its coverage metadata.

The most immediate repo-owned issue is the local metadata inflation seam. Today, the whole-asset finalize path rewrites `totalDuration`, `coverage`, and `timingMode` from asset-duration facts rather than from the actual recovered segment reach and confidence of the returned artifact. That makes partial or weakly grounded results look benchmark-clean when they are not. Before implementing a fix, we should pin down exactly what semantics we want these fields to carry: transport eligibility, requested analysis scope, recovered segment reach, or verified grounded coverage.

This investigation should stay review-only. It should inspect the current code, existing artifact contracts, validator expectations, and downstream consumers/benchmarks to define the smallest safe change. The output should be a precise recommendation for how to represent partial/approximate whole-asset dialogue results honestly without breaking the rest of the pipeline more than necessary.

---

## Tasks

### Task 1: Audit the current whole-asset dialogue metadata contract and define the honest semantics for duration/coverage/timing fields

**Bead ID:** `ee-d1am`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current whole-asset dialogue metadata contract in source and artifacts to define what totalDuration, coverage, timingMode, and related quality notes should honestly mean. Distinguish between asset duration, requested analysis scope, and actual recovered grounded segment reach. Update the active plan with the recommended semantics and the smallest safe contract adjustment. This is review-only: do not modify prompts or code. Claim bead ee-d1am on start with bd update ee-d1am --status in_progress --json and close it on completion with bd close ee-d1am --reason "Audited honest semantics for whole-asset dialogue metadata" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `output/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-metadata-honesty-fix-investigation.md`

**Status:** ✅ Complete

**Results:** Audit complete. Current source shows the inflation seam in `server/scripts/get-context/get-dialogue.cjs` via `buildDialogueAnalysisMetadata()`, which always rewrites `coverage` to `{ start: 0, end: durationSeconds, duration: durationSeconds, complete: true }` using transport/asset duration instead of the model's actual recovered reach. The validator contract in `server/lib/structured-output.cjs` currently permits additive metadata but does not define honest semantics strongly enough to stop this rewrite.

Recommended honest semantics:
- `totalDuration` should mean the **requested analysis timeline span**, not "how much grounded dialogue we actually recovered." For persisted whole-asset artifacts today, that is the full asset/request window duration. For chunk-local intermediate artifacts, it is the chunk window duration.
- `timingMode` should mean the **timestamp coordinate frame only**. `full_timeline` means timestamps are expressed against the full requested asset timeline; it does **not** imply full recovered coverage or dense grounding. `chunk_local` means timestamps are local to a chunk window / stitch workflow; it does **not** imply lower quality by itself.
- `coverage` should mean the **actual recovered grounded segment reach within that timeline frame**. It should describe where the returned segments actually land (`start=min(segment.start)`, `end=max(segment.end)`, `duration=end-start`) and whether the recovered reach honestly covers the requested span (`complete=true` only when the recovered dialogue reach meaningfully spans the requested window, not merely because the request targeted the whole asset).
- `qualityNotes` should remain explanatory only: caveats about approximate timestamps, non-audio grounding, sparse recovery, or mode-resolution behavior. They must not be the only place where partial coverage is disclosed.

Concrete evidence from artifacts:
- In `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, the model/validator-approved payload explicitly returned `totalDuration: 46.0`, `coverage.end: 46.0`, `coverage.complete: true`, plus `qualityNotes: ["Transcription estimated from provided text without actual audio; timestamps are approximate."]`.
- The persisted finalized artifact at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` was then rewritten to `totalDuration: 140.042449`, `coverage.end: 140.042`, and `coverage.complete: true` while preserving the same caveat note. That makes the artifact simultaneously confess weak grounding in prose and overstate full-timeline reach in metadata.

Smallest safe contract adjustment recommended:
- **Do not rename or remove fields.** Preserve the existing shape for validator and downstream compatibility.
- **Change only the semantics and finalization behavior of `coverage`.** For whole-asset outputs, preserve model-supplied coverage when present; otherwise derive it from returned segment bounds instead of from asset duration. Keep `totalDuration` as the requested scope duration so existing consumers that expect a full asset duration field remain stable.
- Treat `coverage.complete=false` as the honest signal for partial whole-asset recovery. Append/retain `qualityNotes` to explain why (approximate timing, likely text-derived reconstruction, sparse late-asset recovery, etc.), but do not use notes as a substitute for the coverage flag.
- Optional later additive improvement, not required for the first fix: add an explicit `requestedScope` / `analysisScope` object if we need to represent non-zero-start windows or distinguish full asset duration from subrange requests more explicitly. That is not necessary for the first honesty fix because `totalDuration` + truthful `coverage` already separate request scope from recovered reach.

---

### Task 2: Audit downstream validators/benchmarks/consumers that depend on the current metadata shape

**Bead ID:** `ee-yatq`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect validators, downstream consumers, and benchmark/comparison paths that read dialogue metadata fields such as totalDuration, coverage, timingMode, and qualityNotes. Identify what would break, what would merely become more honest, and what compatibility-preserving change shape is safest for a first fix. Update the active plan with exact findings. This is review-only: do not modify prompts or code. Claim bead ee-yatq on start with bd update ee-yatq --status in_progress --json and close it on completion with bd close ee-yatq --reason "Audited downstream dependencies on dialogue metadata shape" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `benchmarks/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-metadata-honesty-fix-investigation.md`

**Status:** ✅ Complete

**Results:** Exact downstream dependency audit:
- **Validator acceptance is permissive about semantics, not strict about truthfulness.** `server/lib/structured-output.cjs` accepts `totalDuration` as any non-negative number, `timingMode` as either `chunk_local` or `full_timeline`, optional `coverage` as any non-negative `{start,end,duration,complete}` object, and optional `qualityNotes` as a string array. It does **not** require `coverage.end` to match the last segment, `coverage.complete` to be justified, or `totalDuration` to agree with recovered coverage. So changing metadata values while preserving field types/shapes should not break validation.
- **The Phase 1 validator-tool examples currently encode the optimistic whole-asset shape.** `server/lib/phase1-validator-tools.cjs` teaches models/examples that whole-asset dialogue should emit `analysisMode: "whole_asset"`, `timingMode: "full_timeline"`, `coverage.complete: true`, and `coverage.end = totalDuration`. That would become stale/misleading after an honesty fix, but it would not hard-break runtime acceptance unless the prompt/example contract is updated later.
- **The main source-owned whole-asset consumer is the finalizer/tests, not hidden business logic.** `server/scripts/get-context/get-dialogue.cjs` always writes additive metadata and logs `finalDialogueData.totalDuration`. Repo tests in `test/scripts/get-dialogue.test.js` and `test/lib/phase1-validator-tools.test.js` explicitly assert the current optimistic whole-asset metadata (`timingMode: "full_timeline"`, `coverage: {start:0,end:duration,duration,complete:true}`, and quality-note wording). Those tests would need updates if semantics change, but production runtime would not otherwise break as long as `totalDuration` stays numeric.
- **Benchmark/comparison paths are the most sensitive downstream consumer.** The benchmark runner (`server/lib/benchmark-runner.cjs`) treats `totalDuration` as a tolerant-time scoreable field, but treats extra object fields structurally: any output field missing from truth becomes an error (`Truth object missing field present in output`). In live benchmark reports this already hits `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance` as structural errors (see `tmp/openrouter-mimo-dialogue-benchmark/reports/artifact-results/dialogueData.json` and `tmp/openrouter-mimo-dialogue-benchmark-current/reports/artifact-results/dialogueData.json`). Therefore:
  - changing the **value** of `coverage` / `timingMode` will not newly break the comparator beyond the structural error it already has for those additive fields;
  - changing **`totalDuration` away from asset/runtime duration** would newly affect a truth-scored field and materially worsen benchmark comparability;
  - removing additive fields entirely would reduce structural benchmark noise, but that is a separate compatibility/contract decision, not the safest first honesty fix.
- **Truth/fixture docs currently prefer comparator-owned semantics over truth-payload drift.** `benchmarks/fixtures/cod-test/fixture.json` explicitly says dialogue truth kept provenance boundaries in docs rather than adding comparator-facing schema drift to the truth payload. So making dialogue metadata more detailed/honest without also changing benchmark ignore rules or truth shape will keep producing comparator structural errors on additive fields.
- **What would actually break vs. merely become more honest:**
  - **Would break / require deliberate follow-up:** changing `totalDuration` from asset duration to recovered-span duration; removing fields that tests/prompts currently expect; changing `timingMode` semantics without also updating validator-tool examples/tests/docs.
  - **Would mostly become more honest without breaking runtime:** keeping field presence/types stable but changing `coverage.end`, `coverage.duration`, and `coverage.complete` to reflect recovered span (or preserved model-returned partial coverage); appending/merging `qualityNotes` that explain partial/approximate reach.
  - **Already structurally noisy in benchmarks either way:** additive top-level metadata (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`).
- **Safest compatibility-preserving first-fix shape:** keep `totalDuration` as the real asset/runtime duration and keep the additive field names/types intact, but stop auto-stamping whole-asset `coverage` as full-file-complete. Instead, derive/preserve `coverage.end` and `coverage.duration` from the recovered segment reach (or the model-returned shorter coverage when present), set `coverage.complete` truthfully, and use `qualityNotes` for any caveat about approximate timing or partial reach. If `timingMode` remains schema-constrained to `full_timeline | chunk_local`, the least disruptive first pass is to avoid redefining it aggressively in this bead and let `coverage` carry the honesty load until a follow-up contract expansion decides whether a third mode (for example partial/approximate full-asset timing) is warranted.

---

### Task 3: Synthesize the audits into the smallest truthful implementation recommendation

**Bead ID:** `ee-z3u7`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the metadata-semantics audit and downstream-dependency audit into the smallest truthful implementation recommendation for the dialogue metadata honesty fix. Explain exactly which fields should change first, how to preserve compatibility where needed, and what focused rerun/validation should follow. Update the active plan with the final recommendation. This is review-only: recommend, do not implement. Claim bead ee-z3u7 on start with bd update ee-z3u7 --status in_progress --json and close it on completion with bd close ee-z3u7 --reason "Recommended smallest truthful dialogue metadata honesty fix" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-metadata-honesty-fix-investigation.md`

**Status:** ✅ Complete

**Results:** Final synthesis and smallest truthful implementation recommendation:

**Change these fields first, and only these fields first:**
1. **`coverage.start` / `coverage.end` / `coverage.duration` / `coverage.complete`** in the whole-asset finalize path (`buildDialogueAnalysisMetadata()` in `server/scripts/get-context/get-dialogue.cjs`). This is the proven inflation seam and the safest first-fix surface.
   - If the model already returned a `coverage` object, **preserve it** after light normalization/clamping.
   - Otherwise, **derive coverage from the recovered `dialogue_segments` bounds** in the same timing frame:
     - `start = min(segment.start)`
     - `end = max(segment.end)`
     - `duration = end - start`
     - `complete = true` only when recovered reach honestly spans the requested window in a defensible way; otherwise `false`
   - Do **not** restamp whole-asset outputs to `{ start: 0, end: assetDuration, duration: assetDuration, complete: true }` merely because the request targeted the whole file.
2. **`qualityNotes`** should remain additive/explanatory, but they should now support truthful partial coverage instead of being the only place that admits approximation. Preserve model-supplied notes and append a narrow local note only if needed to explain fallback/derived coverage semantics.

**Fields to leave unchanged in the first pass for compatibility:**
- **`totalDuration`** should stay the requested scope / asset runtime duration. This preserves existing runtime expectations, test shape, and benchmark comparability on the one dialogue metadata field that is already value-scored.
- **`timingMode`** should stay within the current enum (`full_timeline | chunk_local`) and should not carry the honesty fix by itself in the first pass. Keep `full_timeline` meaning "timestamps are expressed against the full requested timeline," not "coverage is complete." Changing `timingMode` semantics or adding a third mode is a separate contract-expansion lane.
- **`analysisMode`, `sourceStrategy`, `provenance`**, and the overall metadata object shape should remain intact.

**Why this is the smallest truthful fix:**
- It corrects the exact source-owned lie: local finalization currently overwrites recovered reach with asset reach.
- It preserves the current schema and nearly all field meanings, so validator acceptance should remain stable.
- It avoids changing `totalDuration`, which would newly perturb benchmark scoring and downstream assumptions.
- It lets whole-asset artifacts say the truthful thing we actually need: "this analysis targeted the full file, but only recovered / grounded dialogue through this smaller span."

**Compatibility-preserving implementation shape recommended:**
- Keep `buildDialogueAnalysisMetadata()` as the single finalize seam, but change it from **asset-duration stamping** to **coverage preservation/derivation**.
- Prefer model-returned `coverage` when present, because it carries the model's self-reported reach and avoids local fabrication.
- When model `coverage` is absent or unusable, derive from normalized persisted segments after the same timing normalization/clamping path used for the final artifact so `coverage` describes what the artifact actually contains.
- Clamp derived/preserved coverage into `[0, totalDuration]` and ensure `duration = max(0, end - start)`.
- If there are no recovered segments, emit truthful empty/degenerate coverage rather than synthetic full-file coverage.

**Required follow-up in the same implementation lane (still small, but necessary):**
- Update the stale optimistic examples in `server/lib/phase1-validator-tools.cjs` so whole-asset examples no longer teach `coverage.complete: true` + `coverage.end = totalDuration` as the default truth.
- Update targeted expectations in `test/scripts/get-dialogue.test.js` and `test/lib/phase1-validator-tools.test.js` so they assert honest coverage semantics instead of full-duration stamping.

**Focused rerun / validation after implementation:**
1. **Unit/regression first:**
   - `node --test test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js`
   - Confirm whole-asset outputs keep `totalDuration` stable while `coverage` reflects recovered reach.
2. **Bounded artifact repro second:**
   - Rerun the smallest known reproduction lane that exposed the dishonesty: `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
   - Inspect `phase1-gather-context/dialogue-data.json` and confirm it no longer inflates `coverage.end` / `coverage.complete` to full runtime when the recovered segments do not support that claim.
3. **Benchmark sanity, not pass/fail gating:**
   - If a comparator rerun is used, treat it as a smoke check only. Expect existing additive-field structural noise to remain unless benchmark ignore rules/truth payloads are changed in a separate lane. The key acceptance criterion for this fix is metadata honesty in the artifact, not eliminating pre-existing benchmark structural warnings.

**Decision:** the first implementation bead should be a narrow `coverage` honesty fix, not a broader metadata redesign. Defer any `requestedScope` object, `timingMode` expansion, or benchmark-contract cleanup until after this narrow truth repair lands and is validated.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A review-only synthesis of the metadata-semantics and downstream-dependency audits into a bounded implementation recommendation: keep the dialogue metadata shape stable, leave `totalDuration` and `timingMode` alone for now, and fix the proven lie by making whole-asset `coverage` preserve/derive actual recovered reach instead of auto-claiming full-file completeness.

**Commits:**
- None (review-only recommendation)

**Lessons Learned:** For this lane, the honest minimal repair is semantic, not structural. `coverage` is already the right field to express recovered reach; the bug is that finalization overwrites it with request/asset duration. Fixing that seam first gets truthfulness without paying the compatibility cost of a wider schema redesign.

---

*Completed on 2026-04-03*
