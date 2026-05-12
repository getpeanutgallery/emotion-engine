# emotion-engine: strengthen music-vocals transcript contract

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Strengthen `musicVocalsData` so it behaves more like a conservative lyric transcript and less like a music-summary generator, then rerun the canonical cod-test to compare lyric capture against benchmark truth.

---

## Overview

The Phase 1 split fixed the contract conflict: spoken dialogue is cleaner once `get-dialogue.cjs` stays spoken-only, and the music lane now owns text-bearing music-led vocals via `musicVocalsData`. But the lane still is not benchmark-strong. It has been recovering some useful lyric material while still missing key lines, paraphrasing or inventing substitutes, and sometimes collapsing lyrics into summary-like blobs.

This lane tightened the prompt/validator contract so `musicVocalsData` should prefer literal heard words or short partial fragments, preserve distinct lyric/refrain boundaries, and avoid leaking music-summary language into transcript text. The verification rerun below records what actually happened after that change.

---

## Tasks

### Task 1: Refine the music-vocals prompt/contract for literal lexical capture

**Bead ID:** `ee-uaoa`  
**SubAgent:** `coder`

**Status:** ✅ Complete

**Results:** Tightened the Phase 1 music-lane contract so `musicVocalsData` is explicitly transcript-like lexical capture rather than summary-flavored text. The whole-asset and chunk prompts now require: only audible sung/chanted/rapped words with discernible lexical content; literal heard words or short partial fragments over paraphrase / invented completions; new `vocal_segments` whenever lyric wording changes, a refrain repeats after a gap, or a vocal phrase is audibly distinct; no merging of multiple lyric lines into one segment; and no leaking `musicData` summary language into `vocal_segments`. Focused verification passed with `node --test test/scripts/get-music.test.js test/lib/phase1-validator-tools.test.js` (39 passing).

---

### Task 2: Rerun the canonical cod-test and compare lyric capture against benchmark truth

**Bead ID:** `ee-jeni`  
**SubAgent:** `primary`

**Status:** ❌ Failed

**Results:** Ran the canonical command exactly as requested:
`node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`

The rerun did **not** complete successfully. Phase 1 dialogue succeeded and refreshed `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`, but Phase 1 music failed in `server/scripts/get-context/get-music.cjs` with `OpenRouterNoContentError: OpenRouter: No content in response`.

Fresh failure artifact:
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/_meta/errors.summary.json`

Key artifact paths to report truthfully:
- fresh dialogue artifact from the failed attempt: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- stale prior-success `musicVocalsData` still on disk: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-vocals-data.json`
- stale prior-success `musicData` still on disk: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-data.json`
- stale prior-success `whole-video-analysis.json` still on disk: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase2-process/whole-video-analysis.json`
- fresh whole-asset raw music capture from this failed attempt: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/music-whole-asset/attempt-01/capture.json`
- fresh partial chunk raw capture before failure: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/music-segment-0002/attempt-01/capture.json`
- failing chunk raw record: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/music-segment-0003/attempt-01/capture.json`

Benchmark lyric/chant truth used for comparison: `benchmarks/fixtures/cod-test/truth/dialogue-data.json` lines 14-21, 27, 29 (`spk_011`).

Truthful comparison result:
- Because the rerun failed before Phase 1 music completed, there is **no fresh regenerated `musicVocalsData` artifact** from this attempt to compare directly against the benchmark.
- The still-present top-level `music-vocals-data.json` is the older pre-failure artifact from the prior successful split-lane rerun, so it cannot be counted as this task's rerun output.
- Fresh partial evidence does exist in the raw whole-asset music capture. That raw pass is more transcript-like than the previous saved split-lane `musicVocalsData`: it breaks out distinct lyric lines instead of collapsing them into four summary-like segments, and it newly surfaces near-literal versions of several benchmark lines including `Master of puppets ... pulling the strings`, `Twisting your mind ... smashing your dreams`, `Blinded by me ...`, and `Just call my name ... hear you scream`.
- But that partial win is not enough to claim Task 2 succeeded. The same fresh raw whole-asset pass still shows timing drift and remaining text drift (`Obey your master, master.` too early around `60-63s`; late return at `130-133s`; no fresh benchmark-faithful recovery of `Control faster.` or the longer `Master, master ... where's the dreams / you promised only lies` refrain pair).
- The failed `90-120s` chunk explains why no new final artifact landed. In `music-segment-0003/attempt-01/capture.json`, OpenRouter/Xiaomi returned HTTP 200 with `finish_reason: "length"`, `message.content: null`, and an enormous repeated `Master! Master!` reasoning trace, which then surfaced as `OpenRouter: No content in response`.
- Bottom line: there is **promising partial raw evidence of improved transcript-likeness**, but the canonical rerun itself failed, so there is **no truthful fresh final `musicVocalsData` verification result** to compare against the benchmark.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Task 1 successfully tightened the `musicVocalsData` contract toward literal lexical capture. Task 2 then ran the canonical rerun command exactly, but the verification pass failed in Phase 1 music before it could regenerate a fresh final `musicVocalsData` artifact. The only fresh lyric evidence from this attempt is partial raw capture, which looks directionally more transcript-like but is not a valid replacement for the missing final artifact.

**Commits:**
- Pending.

**Lessons Learned:** Prompt/contract tightening appears directionally helpful for lyric line literalness and segmentation in the whole-asset raw pass, but the lane is still vulnerable to provider/path failures on later chunk refinement. Future verification must distinguish: (1) fresh final artifact success, (2) partial raw evidence, and (3) leftover prior-success artifacts still on disk.

*Updated on 2026-04-04*
