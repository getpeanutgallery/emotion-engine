# emotion-engine: apply Master of Puppets gold benchmark lyric fixes and validate the updated truth

**Date:** 2026-04-06  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Apply the approved `Master of Puppets` lyric corrections to `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`, resolve the merged-line segment splits, and validate that the updated gold benchmark is internally consistent for future comparisons.

---

## Overview

The completed audit established that the current gold `music-vocals` benchmark contains several non-canonical lyric wordings plus two merged segments that compress paired `Master, master` chorus lines into single entries. Derrick agrees that the benchmark, not the current `music-vocals` system, should be corrected.

This next lane should implement the audited text replacements, choose concrete split points for the two merged segments, and then run focused validation so the truth file remains structurally sound for downstream benchmark comparisons. Because the benchmark is itself a gold fixture, the edit should be narrow, explicit, and documented. We should preserve a clean record of exactly what changed and why.

---

## Tasks

### Task 1: Apply the approved lyric text fixes and segment splits to the gold benchmark

**Bead ID:** `ee-pocc`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update benchmarks/fixtures/cod-test/truth/music-vocals-data.json to apply the approved Master of Puppets lyric fixes from .plans/2026-04-06-audit-master-of-puppets-gold-benchmark-lyrics.md. Use the canonical wording agreed in that audit, choose explicit split points for the two merged chorus segments, keep the rest of the truth file stable, and update this plan truthfully with the exact text/timing changes you made. Add bead IDs and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-apply-master-of-puppets-gold-benchmark-fixes.md`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`

**Status:** ✅ Complete

**Results:** Updated `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` in-place using the canonical wording from the audit and kept all non-lyric metadata stable.

Exact text changes applied:
- `64-65`: `Obey your master.` → `Obey your master`
- `68-70`: `Control faster.` → `Your life burns faster`
- `76-78`: `Master of puppets are pulling the strings!` → `Master of puppets I’m pulling your strings`
- `80-83`: `Twisting your mind, smashing your dreams!` → `Twisting your mind and smashing your dreams`
- `87-88`: `Just call my name ’cause I’ll hear you scream` → `Just call my name, ‘cause I’ll hear you scream`
- `116-118`: `Obey your master!` → `Obey your master`

Exact timing / segmentation changes applied:
- Replaced merged segment `89-94` `Master, master, where’s the dreams that I’ve been after?` with:
  - `89-91` `Master, master`
  - `91-94` `Where’s the dreams that I’ve been after?`
- Replaced merged segment `94-98` `Master, master, you promised only lies!` with:
  - `94-95.5` `Master, master`
  - `95.5-98` `You promised only lies`

Why those split points:
- I chose explicit internal phrase boundaries while preserving the original outer windows.
- The first merged 5-second window became a `2s + 3s` split (`89-91`, `91-94`).
- The second merged 4-second window became a `1.5s + 2.5s` split (`94-95.5`, `95.5-98`).

Net fixture shape change:
- `vocal_segments` count increased from `10` to `12` because two merged entries were expanded into four canonical line-level entries.
- No top-level fields changed.
- No segment outside the audited Master of Puppets block changed.

---

### Task 2: Validate the updated gold benchmark against fixture expectations

**Bead ID:** `ee-6qul`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after applying the approved Master of Puppets benchmark fixes, run focused validation for benchmarks/fixtures/cod-test/truth/music-vocals-data.json. Check JSON validity plus any relevant local tests or benchmark/fixture validation you can run without broad unrelated work. Update this plan truthfully with the exact commands, outcomes, and any downstream shape changes caused by the segment splits. Close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-apply-master-of-puppets-gold-benchmark-fixes.md`
- validation artifacts if any

**Status:** ✅ Complete

**Results:** Ran focused validation against the updated truth file without broad unrelated reruns.

Exact commands run:
1. JSON / schema validation via the repo’s local music-vocals validator:
   - `node -e "const fs=require('fs'); const {executeMusicVocalsValidatorTool}=require('./server/lib/phase1-validator-tools.cjs'); const data=JSON.parse(fs.readFileSync('benchmarks/fixtures/cod-test/truth/music-vocals-data.json','utf8')); const result=executeMusicVocalsValidatorTool({musicVocals:data}); console.log(JSON.stringify(result,null,2)); if(!result.valid) process.exit(1);"`
2. Focused benchmark/fixture regression surface:
   - `node --test test/lib/benchmark-runner.test.js`

Outcomes:
- Command 1 passed.
  - `JSON.parse(...)` succeeded, so the file is syntactically valid JSON.
  - `executeMusicVocalsValidatorTool(...)` returned `ok: true` and `valid: true` for the updated `music-vocals-data.json` content.
- Command 2 passed.
  - `13` tests passed, `0` failed.
  - This includes the benchmark-runner coverage that explicitly checks the separate `music-vocals` truth/comparator path (`benchmark runner - music-vocals truth is benchmarked separately from dialogue truth`).

Downstream shape changes caused by the segment splits:
- `vocal_segments.length` changed from `10` to `12`.
- Segment indexes after the first split shifted by `+1`, and indexes after the second split shifted by `+2` relative to the old file.
- The old merged entries no longer exist:
  - old index `6` / `89-94` → new indexes `6` (`89-91`) and `7` (`91-94`)
  - old index `7` / `94-98` → new indexes `8` (`94-95.5`) and `9` (`95.5-98`)
- The later reprise entries moved accordingly:
  - `116-118` `Obey your master` moved from index `8` to index `10`
  - `127-130` `Master, master` moved from index `9` to index `11`
- Any downstream checks that assumed the old 10-entry index layout will need to consume the updated 12-entry shape, but the repo’s local validator and benchmark-runner tests still pass.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Updated the cod-test `music-vocals` gold truth so the `Master of Puppets` lines now use canonical wording, the two merged chorus/question segments are split into explicit line-level entries, and the revised fixture passes focused local validation.

**Commits:**
- None; per instruction, I did not push.

**Lessons Learned:**
- The gold fixture drift was mostly straightforward lyric wording cleanup, but the two chorus entries were a real structural benchmark-shape correction rather than mere text edits.
- The repo already has a useful narrow validation path for this area: the local music-vocals validator plus `test/lib/benchmark-runner.test.js` are enough to sanity-check fixture integrity without rerunning broader pipelines.

---

*Completed on 2026-04-06*
