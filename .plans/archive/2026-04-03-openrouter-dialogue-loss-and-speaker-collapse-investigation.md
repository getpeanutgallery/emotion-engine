# emotion-engine: investigate OpenRouter dialogue loss and speaker collapse

**Date:** 2026-04-03  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Determine why the guarded full-file OpenRouter MiMo dialogue lane still drops large portions of dialogue and collapses too many distinct speakers, then identify the smallest truthful fix lane to improve benchmark quality.

---

## Overview

The previous tranche proved something important: the current OpenRouter MiMo compare lane is no longer failing because of watchdog clipping or forced chunk-refine fallback. The fresh guarded run completed as a genuine whole-asset dialogue pass with `analysisMode: whole_asset`, `timingMode: full_timeline`, and `provenance.usedChunking: false`.

That removes one class of confusion and leaves us with a cleaner root-cause surface. The benchmark artifact is still structurally weak: it only retains 15 dialogue segments versus 30 in human truth, collapses many identities into `spk_001`, and still loses the late trailer block in benchmark terms. Raw capture shows the model attempted some late lines, but assigned several of them timestamps beyond the true asset duration. That strongly suggests the current failure is no longer “the run stopped early”; it is more likely a combination of whole-asset segmentation/compression, timestamp drift or overrun, artifact normalization/filtering, and weak speaker decomposition in the model output contract.

This investigation should therefore be source- and artifact-first. We should inspect the exact whole-asset prompt, raw provider response, normalization/filtering path, and final artifact-writing code to determine where information is being lost or collapsed. The right fix may live in the prompt contract, the post-processing/clamping logic, the segment-normalization rules, the speaker-profile synthesis rules, or some combination. Before changing any of those, we should isolate which stage is actually responsible for each failure bucket.

**This tranche is review-only.** It may inspect prompts and prompt-building code as evidence, but it should **not modify any prompts, schemas, or implementation behavior**. The only allowed output from this tranche is a source-backed diagnosis plus a recommendation for the next bounded implementation lane.

---

## Tasks

### Task 1: Audit the raw whole-asset OpenRouter dialogue response versus the final saved artifact to locate exactly where late lines are lost

**Bead ID:** `ee-ton2`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the fresh guarded OpenRouter whole-asset dialogue raw response against the final saved dialogue-data.json and identify exactly where the late trailer lines are lost. Determine whether loss happens in model output itself, timestamp validation/clamping, normalization/filtering, schema repair, or artifact writing. Use the current fresh cod-test-mimo-openrouter-compare run artifacts and relevant source paths, then update the active plan with the exact failure stage(s) and evidence. This is review-only: do not modify prompts, schemas, or implementation behavior. Claim bead ee-ton2 on start with bd update ee-ton2 --status in_progress --json and close it on completion with bd close ee-ton2 --reason "Audited raw whole-asset response vs final artifact for late-line loss" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `server/scripts/get-context/`
- `server/lib/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-dialogue-loss-and-speaker-collapse-investigation.md`
- optional audit note to be determined

**Status:** ✅ Complete

**Results:** Audited the fresh `output/cod-test-mimo-openrouter-compare/phase1-gather-context` whole-asset dialogue lane end-to-end. Exact failure stage for the late trailer block is **whole-asset timestamp normalization/filtering**, not artifact writing and not the validator/tool-loop schema repair step.

Evidence:
- Raw model output in `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` contains **19** dialogue segments. The late trailer lines are present in `rawResponse.content` at:
  - `140.6-142.2` — “So eager to leave, David.”
  - `143.2-146.0` — “Killing the man is a hell of a lot easier than killing the idea.”
  - `148.4-150.2` — “You were never cut out to be a Mason.”
  - `153.2-155.0` — “No more games. This ends now.”
- The same capture’s `toolLoop.history` shows the local validator accepted that 19-segment candidate with `valid: true`, so the lines were **not** rejected during validator/schema acceptance.
- The validator itself (`server/lib/structured-output.cjs`) only checks that segment timestamps are finite and non-negative; it does **not** enforce `segment.end <= totalDuration` or reject segments beyond asset duration. See `validateDialogueSegments` / `validateDialogueTranscriptionObject`.
- The real audio duration from `raw/ffmpeg/dialogue/ffprobe-audio-duration.json` is `140.042449s`, while the model reported `totalDuration: 139.0` and also emitted four segments entirely beyond the true asset end.
- The drop happens in `server/scripts/get-context/get-dialogue.cjs` inside `normalizeDialogueDataToDuration()`:
  - `start` and `end` are clamped to `[0, boundedDuration]`
  - any segment where `end <= start` is discarded
  - any implausibly clipped overrun segment can also be discarded
  For these four late lines, both start and end clamp to `140.042449`, so `end <= start` and each segment is removed.
- The final saved artifact `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json` therefore contains **15** segments, exactly matching the normalized/clamped result. Artifact writing is just `fs.writeFileSync(JSON.stringify(finalDialogueData...))`, so writing is **not** the loss stage.
- Secondary downstream effect: once those four segments are dropped, `normalizeDialogueSpeakerContract` also removes `spk_006` from `speaker_profiles` because its only linked late segment disappeared. That speaker loss is a consequence of segment filtering, not a separate earlier failure stage.

Conclusion for late trailer loss:
1. **Model output stage:** not the direct loss point for these specific trailer lines — they are present, though mistimed past asset end.
2. **Timestamp validation/clamping + normalization/filtering:** **yes, this is the exact loss stage** for the late trailer lines.
3. **Schema repair / validator acceptance:** no — it accepted the overrun candidate.
4. **Artifact writing:** no — it faithfully wrote the already-filtered normalized result.

Important nuance: broader benchmark undercoverage still partly exists at the **model output** stage, because even the raw 19-line whole-asset output is far short of truth-level coverage. But the specific late-trailer disappearance from raw whole-asset response to final `dialogue-data.json` is caused by normalization-time clamping/filtering of overrun timestamps.

---

### Task 2: Audit how speaker profiles and speaker IDs are synthesized, normalized, and linked, and identify why so much collapses into `spk_001`

**Bead ID:** `ee-3akp`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current OpenRouter whole-asset dialogue output and the source code that normalizes speaker IDs/profiles/linkage to determine why distinct speakers are collapsing into coarse buckets like spk_001. Identify whether the collapse is primarily model-output level, schema/prompt contract level, or normalization/linkage logic level. Update the active plan with the exact evidence and the most likely root causes. This is review-only: do not modify prompts, schemas, or implementation behavior. Claim bead ee-3akp on start with bd update ee-3akp --status in_progress --json and close it on completion with bd close ee-3akp --reason "Audited speaker collapse root causes in OpenRouter dialogue lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `server/scripts/get-context/`
- `server/lib/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-dialogue-loss-and-speaker-collapse-investigation.md`
- optional audit note to be determined

**Status:** ✅ Complete

**Results:** The collapse is primarily **model-output level**, with a secondary **schema/prompt-contract weakness**, and **not primarily normalization/linkage logic** in the current lane.

**Evidence from the current whole-asset run:**
- The raw model response already over-collapses speakers before post-processing. In `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, the model returns **19 segments / 6 profiles**, but assigns **13/19 segments to `spk_001`**. Those `spk_001` segments span obviously heterogeneous lines such as:
  - `0.0-2.2` “They want you afraid.”
  - `9.3-10.7` “It's time to wake up.”
  - `28.1-37.0` “He refuses to let me go ... A lot of people counting on us for answers.”
  - `102.2-104.2` “This isn't real.” / “The hell it ain't.”
  - `138.1-146.0` “Pull it together, man.” / “So eager to leave, David.” / “Killing the man...”
  - `153.2-155.0` “No more games. This ends now.”
- The normalized saved artifact preserves that same coarse allocation rather than creating any new collapse. `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json` ends with **15 segments / 5 profiles** and still has **10/15 segments on `spk_001`**. The only lost IDs are from the late out-of-bounds segments (including `spk_006`), not from speaker-merging logic.
- The difference between raw model output and saved artifact is explained by duration clamping/drop, not speaker relinking. `server/scripts/get-context/get-dialogue.cjs:86-100` drops implausibly clipped segments when their original `end` exceeds the bounded asset duration, and the current raw response contains late lines at `140.6-155.0` while the asset duration is ~`140.04s`.

**Evidence from normalization/linkage code:**
- `server/lib/structured-output.cjs:396-471` does not perform acoustic clustering or semantic speaker merging beyond honoring the incoming `speaker_id` first. For each segment it uses `explicitId = normalizeSpeakerId(segment.speaker_id)` and then `speaker_id = explicitId || speakerIdByLabel.get(label) || generatedIdsByLabel.get(label)` (`server/lib/structured-output.cjs:421-449`). In this run, because the model already emits explicit IDs like `spk_001`, normalization mostly preserves them.
- The validator path at `server/lib/structured-output.cjs:611-640` validates shape, then normalizes the speaker contract. It does **not** check whether one `speaker_id` is acoustically plausible across the linked segments. So the validator accepts a coarse-but-schema-valid `spk_001` bucket as long as the JSON shape is legal.
- There is a potential generic-label fallback hazard in normalization: if segments arrive **without** explicit `speaker_id`, then repeated generic labels like `Speaker 1` would be mapped through `speakerIdByLabel` / `generatedIdsByLabel` and can collapse by label (`server/lib/structured-output.cjs:398-429`). But that is not the main failure in this artifact, because the model supplied explicit IDs and the collapse is already present upstream.

**Evidence from the prompt / contract layer:**
- The whole-asset prompt is already trying to prevent this. It explicitly says speaker continuity is acoustic, not semantic; warns not to merge public-address/newsreel/comms/promotional voices; and says to create a new `speaker_id` when cues do not line up (`server/scripts/get-context/get-dialogue.cjs:2081-2097`).
- Even with those instructions, the model still collapses many distinct voices into `spk_001`, which points to a model-behavior failure rather than a missing basic instruction.
- That said, the contract remains soft: it requires valid JSON and speaker/profile linkage shape, but it does **not** require per-speaker acoustic justification strong enough to reject over-broad reuse. The local validator therefore cannot push back on a schema-valid but acoustically implausible monobucket.

**Most likely root-cause stack:**
1. **Primary:** the OpenRouter whole-asset model pass is acoustically under-separating voices across a long montage and reusing `spk_001` as a catch-all bucket.
2. **Secondary:** the prompt/schema contract is advisory, not enforceable; the validator can confirm shape/linkage but not whether linked segments truly belong to the same voice.
3. **Tertiary / not primary in this run:** normalization/linkage logic can collapse by label when `speaker_id` is absent, but in the inspected artifact it does not appear to be the source of the observed `spk_001` overuse.

---

### Task 3: Synthesize the two audits into the smallest truthful implementation recommendation and bounded next fix lane

**Bead ID:** `ee-4cvl`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the late-line-loss audit and speaker-collapse audit into the smallest truthful next implementation lane. Decide whether the first fix should target prompt/schema contract, timestamp repair/clamping, normalization/filtering, speaker linkage rules, or another narrow seam, and explain why that is the best next move. Update the active plan with the recommendation, its expected effect on benchmark buckets, and any risks. This is review-only: recommend, do not implement. Claim bead ee-4cvl on start with bd update ee-4cvl --status in_progress --json and close it on completion with bd close ee-4cvl --reason "Recommended bounded next fix lane for OpenRouter dialogue loss and speaker collapse" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-dialogue-loss-and-speaker-collapse-investigation.md`

**Status:** ✅ Complete

**Results:** Recommended the first implementation lane as a **bounded timestamp-repair seam immediately before `normalizeDialogueDataToDuration()` drops overrun segments**, not a prompt rewrite and not speaker-linkage surgery.

Why this is the smallest truthful next move:
- The late-line-loss audit identified an **exact deterministic loss point** in source: `server/scripts/get-context/get-dialogue.cjs` clamps out-of-range late segments to the asset end and then discards them when `end <= start`. That is the clearest proven defect in the current path.
- The speaker-collapse audit did **not** find an equally crisp downstream bug. Most of the `spk_001` collapse is already present in the raw model response, and the prompt already contains strong anti-collapse guidance. That makes prompt/schema tweaks a lower-confidence first move and speaker-linkage code changes even less justified for the first lane.
- The current normalization/linkage code largely preserves explicit `speaker_id`s coming from the model. Changing linkage rules first would therefore risk papering over or distorting model behavior without recovering the known missing late block.
- A narrow timestamp-repair seam can be implemented and validated locally against the captured failure pattern without pretending to solve the broader acoustic speaker-separation problem.

Recommended lane shape:
1. Detect the specific whole-asset failure pattern where a **late suffix** of dialogue segments lands beyond the real asset duration even though the raw response otherwise appears timeline-ordered.
2. Before existing clamp/drop logic runs, apply a **bounded repair/re-anchor pass** for that suffix so segments are shifted or compressed back into the remaining legal timeline instead of collapsing to a zero-length point and being discarded.
3. Keep the fix intentionally narrow:
   - only for whole-asset / full-timeline dialogue outputs
   - only when the overrun appears to be a suffix/tail drift rather than arbitrary timestamp chaos
   - only when repaired ordering remains monotonic and segment durations stay plausible relative to text length
   - otherwise preserve current fail/drop behavior
4. After repair, allow the existing validator / normalization / speaker-contract path to run unchanged.

Why this lane beats the alternatives right now:
- **Prompt/schema contract first:** lower confidence. The prompt already says not to compress dialogue into the opening seconds and not to merge clearly different voices, yet the model still does both. Another wording pass may help later, but it is not the most evidence-backed first intervention.
- **Normalization/filtering first (generic):** too broad. The actual generic normalization logic is not the main bug; the proven problem is a specific overrun-tail timestamp failure.
- **Speaker linkage rules first:** not supported by evidence. Linkage is mostly preserving model-supplied IDs, not causing the main collapse.
- **Speaker-collapse prompt enforcement first:** valuable later, but harder to validate objectively because the present collapse is upstream model behavior rather than a single repairable post-processing bug.

Expected effect on benchmark buckets if this lane works:
- **Biggest likely win:** `missing_or_extra_segments` should improve first, because up to four currently present-but-dropped late lines could survive into the final artifact.
- **Likely secondary win:** `segment_timing` should improve for those recovered late segments because they would re-enter the legal timeline instead of disappearing.
- **Likely secondary win:** `speaker_profile_linkage` and `missing_or_extra_speaker_profiles` should improve modestly because at least one dropped late-only speaker bucket (`spk_006` in the current artifact) would stop disappearing as a downstream consequence of segment loss.
- **Possible but limited win:** `segment_speaker_identity` may improve slightly for the recovered suffix simply because additional distinct late lines/speakers remain represented.
- **Little expected immediate change:** the large `spk_001` over-collapse bucket will probably remain the dominant speaker-quality problem for earlier and mid-file segments, because this lane does not directly change the model’s acoustic decomposition behavior.

Risks / caveats:
- The repair could accidentally preserve **hallucinated late lines** if the model is inventing content rather than merely misplacing real suffix lines. Any implementation should therefore stay conservative and be auditable from raw capture.
- A generic re-anchoring heuristic could mis-order segments or create unrealistic speech density if applied outside the narrow suffix-overrun pattern.
- This lane may improve benchmark coverage without materially fixing the broader speaker-collapse problem, so it should be framed as a **coverage-recovery pass**, not as a full dialogue-quality solution.
- If the raw whole-asset output remains only 19 segments versus 30 in truth, this fix alone cannot close the full benchmark gap; it just addresses the highest-confidence loss seam before we revisit prompt/contract pressure on speaker separation and broader segmentation coverage.

Recommended follow-on after this lane (not part of the first fix): if the repaired suffix materially improves coverage but `spk_001` collapse still dominates, the next tranche should target a **tighter prompt/schema contract for acoustic speaker separation**, because that is where the remaining evidence points.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed a review-only synthesis of the late-line-loss and speaker-collapse audits and identified the most bounded next implementation lane: a narrow whole-asset late-suffix timestamp repair step before duration clamp/drop. The recommendation explicitly does **not** claim to solve the full speaker-collapse problem; it is the best first move because it addresses the only source-proven deterministic loss seam and should yield the cleanest immediate benchmark recovery.

**Commits:**
- None (review-only tranche)

**Lessons Learned:** When one failure bucket is source-proven and deterministic while another is still mostly upstream model behavior, the right first fix is the bounded deterministic seam. In this case, coverage recovery via late-suffix timestamp repair is a better first step than trying to out-prompt or out-normalize a model that is already collapsing speakers in raw output.

---

*Completed on 2026-04-03*
