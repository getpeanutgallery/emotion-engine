# emotion-engine: runtime-anchored Xiaomi vs golden truth dialogue compare

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Compare the latest runtime-anchored Xiaomi whole-asset dialogue artifact against the canonical golden-truth benchmark so we can measure content, speaker, timestamp, and tail-coverage quality after the prompt experiment.

---

## Overview

The runtime-anchored Xiaomi prompt experiment materially improved whole-asset duration honesty and late-tail recovery, but it did not fully solve end-of-file timestamp accuracy. Before choosing the next repair lane, we should compare the latest Xiaomi artifact directly against the golden truth benchmark.

This tranche is comparison-only. We want a source-backed diagnosis of how the runtime-anchored Xiaomi result differs from truth across transcript content, segment ordering, speakers, timestamps, and end coverage. The output should tell us whether the latest improvement actually moved the artifact closer to benchmark truth overall, and which mismatch pattern is now dominant.

---

## Tasks

### Task 1: Identify and compare the latest runtime-anchored Xiaomi dialogue artifact against canonical golden truth

**Bead ID:** `ee-3njd`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, identify the latest runtime-anchored Xiaomi/OpenRouter whole-asset dialogue artifact and the canonical golden-truth dialogue benchmark file, then compare them directly. Measure content accuracy, missing/extra lines, ordering, speaker alignment, timestamp drift, and tail coverage. Be explicit about which mismatches are old carryovers versus changes introduced or improved by the runtime anchor. Update the plan with exact evidence paths and a concise findings summary. Claim bead ee-3njd on start with bd update ee-3njd --status in_progress --json and close it on completion with bd close ee-3njd --reason "Compared runtime-anchored Xiaomi dialogue artifact against golden truth benchmark" --json. Review-only; do not modify code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `benchmarks/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-runtime-anchored-xiaomi-vs-golden-truth-dialogue-compare.md`

**Status:** ✅ Complete

**Results:** Identified the exact comparison pair and measured the latest runtime-anchored artifact directly against the human-reviewed gold dialogue truth.

Exact evidence paths used:
- Runtime-anchored persisted artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- Runtime-anchored raw provider capture (shows the dropped out-of-range promo tail): `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Runtime-anchored measured source duration: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ffmpeg/dialogue/ffprobe-audio-duration.json`
- Canonical human-reviewed golden truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Immediate pre-anchor honest baseline for carryover/change comparison: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-x0g9-2026-04-04-103401/phase1-gather-context/dialogue-data.json`
- Direct benchmark-style comparison report for runtime artifact: `tmp/runtime-anchor-benchmark-runtime/reports/artifact-results/dialogueData.json`
- Direct benchmark-style comparison report for pre-anchor baseline: `tmp/runtime-anchor-benchmark-baseline/reports/artifact-results/dialogueData.json`

Concise findings summary:
- **Canonical pair confirmed.** The latest runtime-anchored Xiaomi/OpenRouter whole-asset artifact is the active rerun output above, and the canonical gold benchmark remains `benchmarks/fixtures/cod-test/truth/dialogue-data.json` as documented across the fixture/benchmark plans and provenance docs.
- **Benchmark-style field accuracy improved versus the immediate pre-anchor honest baseline, but content recall dropped.** The direct structured compare moved from **78/248 passed scoreable fields (31.45%) / 80.78% scoreable coverage** on the pre-anchor honest baseline to **74/197 (37.56%) / 83.83% scoreable coverage** on the runtime-anchored artifact. So the anchor improved overall structured alignment rate, but partly by producing a shorter saved transcript surface.
- **Content coverage vs gold truth:** the runtime-anchored saved artifact contains **17 segments** and directly covers about **18/30 gold truth dialogue lines (~60%)** once split/merged equivalences are accounted for. The immediate pre-anchor honest baseline covered about **23/30 (~76.7%)** truth lines, but with much worse timing collapse. The runtime-anchored saved artifact is therefore **more time-honest but less text-complete** than the prior honest baseline.
- **Missing/extra lines in the runtime-anchored saved artifact:**
  - Missing truth lines still include the old mid/late omissions plus a dropped end tail: `"You shall know fear."`, the full Metallica lyric run (`"Obey your master"`, `"Control faster"`, `"Master of Puppets are pulling the strings"`, `"Twisting your mind..."`, `"Blinded by me..."`, `"Just call my name..."`, `"Master, master where's the dreams..."`, `"Master, master you promised only lies"`), the late `"Obey your master"`, the promo VO `"Get the Reznov challenge pack when you preorder now"`, and the final `"Master, master"` tag.
  - No clearly spurious persisted dialogue lines were added in the saved artifact. The one notable extra **raw** line is the promo VO at `141.0-146.0s` in `capture.json`; it is real trailer content, but it is **mis-timed beyond the true `140.042449s` asset runtime** and is therefore dropped from the normalized saved artifact.
- **Ordering:** broad scene order is still correct. The opening and early dialogue beats remain in the right narrative sequence, and the runtime anchor materially improved the placement/order of the late spoken block (`"Pull it together, man"` → `"So eager to leave..."` → `"You were never cut out..."` → `"No more games..."`) by keeping it near the actual tail instead of collapsing it into the first ~80 seconds. However, the saved runtime-anchored artifact now skips the lyric/promo truth lines that should appear between those late beats in the canonical gold sequence, so tail ordering is still incomplete.
- **Speaker alignment:** early opening speakers remain mostly correct, but the old speaker-registry drift is still present and not solved by the runtime anchor. On a content-aligned read, only about **6 of 17** runtime segments keep an exact gold speaker id match. Mid/late lines are repeatedly attached to the wrong speaker buckets (`"He refuses to let me go"`, `"Stop looking backwards, David"`, radio lines, `"This isn't real"`, `"The hell it ain't"`, `"Pull it together, man"`, `"You were never cut out..."`, `"No more games..."`). The runtime anchor also introduces/preserves one explicit multi-speaker merge: `"So eager to leave, David. Killing the man is a hell of a lot easier than killing the idea."` is saved as one `spk_002` segment even though the gold truth splits that material across `spk_002` and `spk_013`.
- **Timestamp drift:** the runtime anchor clearly improved late-placement honesty even though absolute timing is still wrong. For content-aligned segments, the immediate pre-anchor honest baseline was on average about **21s early** versus gold truth, while the runtime-anchored artifact averages about **9s late**. The opening six beats are close to truth (mostly within about `±1s`), but drift grows sharply after the skipped `"You shall know fear"` / lyric region: radio lines are about **+7 to +8.5s** late, `"This isn't real"` / `"The hell it ain't"` are about **+21 to +23s** late, and the final spoken block is still about **+18 to +22s** late versus gold truth.
- **Tail coverage:** this is the main genuine runtime-anchor improvement. The pre-anchor honest baseline only persisted through `80s`; the runtime-anchored saved artifact now persists through `136s` with `totalDuration: 140.04`, so whole-file reach is far closer to the real asset runtime. But that tail reach is still **content-incomplete** relative to the gold benchmark because the saved artifact misses the promo and final lyric tail, and the raw promo recovery is emitted out of bounds at `141-146s`.

Carryovers vs runtime-anchor changes:
- **Old carryovers still present:** speaker misassignment, missing `"You shall know fear"`, lyric-region loss/weak grounding, and incorrect final-tail content ordering remain unresolved; the artifact still does not match gold truth line-for-line.
- **Clearly improved by the runtime anchor:** duration honesty, saved-artifact tail reach, and placement of the final spoken confrontation block are materially better than the pre-anchor honest baseline.
- **Clearly introduced or made more visible by the runtime anchor:** the saved artifact now drops more gold-truth content than the pre-anchor honest baseline because the late promo line is pushed past real runtime and filtered out, and the lyric/promo tail is not preserved in-range even though overall timeline reach improved.

---

### Task 2: Synthesize the comparison into next-lane guidance

**Bead ID:** `ee-wgto`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the runtime-anchored Xiaomi vs golden-truth dialogue comparison into a ranked diagnosis. Decide whether the dominant remaining problem is content grounding, speaker identity, timestamp placement, late-tail clipping, or another seam. Recommend the smallest next implementation lane based on the comparison evidence. Update the active plan with the final recommendation. Review-only; do not implement changes yet. Claim bead ee-wgto on start with bd update ee-wgto --status in_progress --json and close it on completion with bd close ee-wgto --reason "Synthesized Xiaomi vs golden truth dialogue comparison into next lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-runtime-anchored-xiaomi-vs-golden-truth-dialogue-compare.md`

**Status:** ✅ Complete

**Results:** Ranked diagnosis based on the completed runtime-vs-truth comparison:
1. **Dominant seam: content grounding / content retention** — this is the main remaining failure. The runtime anchor fixed whole-file reach, but the saved artifact still only covers about **18/30 truth lines (~60%)** versus about **23/30 (~76.7%)** on the immediate pre-anchor baseline. The biggest losses are not random: the processed/anthemic/overlap-heavy region is still under-grounded (`"You shall know fear."`, most of the `Master of Puppets` lyric run, the promo VO, and the final `"Master, master"` tag). Once those lines drop out, downstream comparisons look worse because later truth lines get matched against the wrong surviving segments.
2. **Secondary seam: speaker identity drift** — still severe, but mostly downstream of missing/merged content. Only about **6/17** saved runtime segments keep an exact gold speaker-id match, and the artifact still collapses distinct voices/roles (radio, squadmate, lyric vocalist, promo VO, overlap-heavy montage voice) into the wrong buckets. This matters, but the comparison evidence says many speaker mismatches are being amplified by absent or merged segments rather than by a clean transcript with only bad speaker labels.
3. **Tertiary seam: timestamp placement after skipped anchors** — improved from the pre-anchor baseline, but still wrong once the transcript misses anchor lines. The opening block is mostly within about `±1s`, while drift grows after the skipped `"You shall know fear"` / lyric region and pushes later spoken beats roughly **+7s to +23s** late. That pattern points to a missing-content-induced alignment slide, not a pure global timestamping defect.
4. **Lower-priority seam: late-tail clipping** — no longer the dominant problem. The runtime-anchored artifact now reaches `136s` with `totalDuration: 140.04`, so whole-file coverage is materially better than the pre-anchor `80s` cutoff. There is still a specific tail issue — the promo VO is recovered in raw capture but emitted out of bounds at `141-146s` and therefore dropped from the normalized artifact — yet the broader tail-reach problem is improved enough that it should not be the next top-level lane.

Smallest next implementation lane:
- **Add a narrowly scoped recovery/normalization lane for missing grounded dialogue segments in the mid/late truth-critical region, not a full speaker or timestamp rewrite.**
- Concretely, the next lane should focus on preserving and placing in-range any confidently detected lines that the whole-asset pass currently drops or merges, especially across the seam starting around `45s` (`"You shall know fear"`) and the lyric/promo tail region (`64s` through the final promo/tag block).
- The minimal implementation target is: **recover missing content first, clamp recovered tail content to real runtime bounds, and only then let existing speaker/timestamp logic operate on the fuller segment set.**
- Why this is the smallest useful lane: it directly attacks the highest-impact error class, should improve speaker/timestamp outcomes indirectly by restoring missing anchors, and avoids prematurely opening a much larger speaker-registry or alignment-system rewrite.

Recommended acceptance focus for that next lane:
- The saved normalized artifact should preserve the currently missing truth-critical lines when they are present in raw capture or recoverable from the same pass.
- Recovered promo/tail content must stay within the measured asset runtime instead of being dropped as out-of-bounds.
- Re-run the same benchmark pair and verify that content coverage rises back above the current runtime-anchored ~60% without regressing the improved whole-file reach.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A source-backed synthesis of the runtime-anchored Xiaomi/OpenRouter dialogue artifact versus canonical gold truth. The final diagnosis is that **content grounding / content retention** is now the dominant remaining seam, with speaker drift and late timestamp errors largely downstream of missing or merged mid/late segments. The recommended next lane is a **small, targeted recovery/normalization pass for missing grounded lines in the `~45s` through tail region**, including in-range preservation of promo/tail content.

**Commits:**
- Pending

**Lessons Learned:** Runtime anchoring solved the big honesty problem — the artifact now reaches the real end of the asset — but that surfaced the next bottleneck more clearly: if the model cannot retain difficult processed/lyric/overlap-heavy lines, later speaker and timing quality will still collapse even when total duration looks correct. The next repair should restore missing anchors before attempting a broader speaker or timestamp rewrite.

---

*Completed on 2026-04-04*
