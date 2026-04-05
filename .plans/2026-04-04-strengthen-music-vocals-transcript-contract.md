# emotion-engine: strengthen music-vocals transcript contract

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Strengthen the isolated `musicVocalsData` lane so it behaves more like a conservative lyric transcript and less like a music-summary generator, then rerun the canonical cod-test to compare lyric capture against benchmark truth.

---

## Overview

The Phase 1 split succeeded architecturally: spoken dialogue got cleaner once `get-dialogue.cjs` returned to spoken-only scope, and the music lane now owns text-bearing music-led vocals through `musicVocalsData`. That solved the contract conflict, but the new music-vocals lane is still not benchmark-strong. It recovers some useful lyric material, yet it still misses key lines, rewrites lyrics into statistically plausible substitutes, and sometimes emits summary-flavored vocal text rather than conservative transcript-like capture.

The next lane should stay focused on `musicVocalsData` only. We want to tighten the prompt and validator expectations so this artifact captures audible lexical vocals literally when possible, falls back to short partial fragments rather than fluent inventions when uncertain, and preserves line/refrain boundaries instead of collapsing them into summary blobs. This should improve benchmark fidelity without reopening the spoken-dialogue lane we just cleaned up.

---

## Tasks

### Task 1: Refine the music-vocals prompt/contract for literal lexical capture

**Bead ID:** `ee-uaoa`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, refine the existing Phase 1 music-lane prompt/contract so musicVocalsData behaves like a transcript-like lexical vocal capture, not a summary. Keep the wording generic across assets. Emphasize: only include audible sung/chanted/rapped words with discernible lexical content; prefer literal heard words or short partial fragments over paraphrase or invented completions; break vocal_segments when lyric wording changes, refrains repeat after a gap, or a new vocal phrase is audibly distinct; do not merge multiple lyric lines into one summary segment; do not leak musicData summary language into musicVocalsData text. Update focused tests if needed, update this plan with exact Task 1 results, commit after tests pass, and do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-strengthen-music-vocals-transcript-contract.md`
- `server/scripts/get-context/get-music.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `test/scripts/get-music.test.js`
- `test/lib/phase1-validator-tools.test.js`

**Status:** ✅ Complete

**Results:** Tightened the Phase 1 music-lane contract so `musicVocalsData` is explicitly transcript-like lexical capture rather than summary-flavored text. In `server/scripts/get-context/get-music.cjs`, both the whole-asset and chunk prompts now require: only audible sung/chanted/rapped words with discernible lexical content; literal heard words or short partial fragments over paraphrase / invented completions; new `vocal_segments` whenever lyric wording changes, a refrain repeats after a gap, or a vocal phrase is audibly distinct; no merging of multiple lyric lines into a single summary segment; and no leaking `musicData` summary/description language into `vocal_segments` text. The validator-tool loop rules were updated with the same lexical-capture guidance, and the validator-tool contract text in `server/lib/phase1-validator-tools.cjs` now describes `vocal_segments` / `vocalSummary` as transcript-like literal lexical capture. Focused regression coverage was added in `test/scripts/get-music.test.js` and `test/lib/phase1-validator-tools.test.js` to assert the new whole-asset/chunk prompt language and validator contract wording. Focused verification passed with `node --test test/scripts/get-music.test.js test/lib/phase1-validator-tools.test.js` (39 tests passed). A repo-wide `npm test -- test/scripts/get-music.test.js test/lib/phase1-validator-tools.test.js` invocation was also attempted, but the package test script expanded to the full suite and hit a pre-existing unrelated failure in `test/lib/script-contract.test.js` (`script-runner - executeScript performs one bounded AI recovery re-entry for eligible AI lanes`, expected `2`, actual `1`).

---

### Task 2: Rerun the canonical cod-test and compare lyric capture against benchmark truth

**Bead ID:** `ee-jeni`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical cod-test after Task 1 lands: node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose. Compare musicVocalsData specifically against the benchmark lyric/chant lines. Evaluate whether the lane becomes more transcript-like: fewer paraphrased/hallucinated lyric substitutes, better recovery of distinct lyric lines, and clearer refrain segmentation. Keep the writeup truthful and separate lyric-capture gains from any remaining timing drift. Update the plan with exact evidence, commit the verification writeup if appropriate, and do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-strengthen-music-vocals-transcript-contract.md`
- fresh output/log artifacts

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Task 1 is complete: the music-vocals lane contract now pushes `musicVocalsData` toward conservative transcript-like lexical capture, with focused regression tests covering the new prompt/contract language. Task 2 remains pending.

**Commits:**
- Pending.

**Lessons Learned:** Tightening transcript behavior here is mostly a prompt/contract problem, so targeted assertions on exact wording are useful to keep the lane from drifting back toward summary-style vocal text.

---

*Created on 2026-04-04*
