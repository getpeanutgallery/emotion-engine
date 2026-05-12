# emotion-engine: checkpoint current music-vocals tuning, then investigate the lyric hallucination against dialogue and benchmark truth

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Checkpoint the current music-vocals prompt-tuning lane in git so it is not lost, then compare the hallucinated sung-vocal segment against the same timeframe dialogue output and the human-verified benchmark truth to identify the most obvious cause of the hallucination.

---

## Overview

The current prompt-tuning lane recovered most of the expected `Master of Puppets` sequence while keeping dialogue free of obvious lyric contamination, but the rerun still produced at least one bogus lyric rewrite: `Come crawling faster`. Derrick wants that work safely committed first, then a direct comparison of the hallucinated sung-vocal line against the same timeframe in the dialogue lane and against the gold benchmark so we can see whether the failure came from cross-lane contamination, weak audio support, canonical overfill, or some other obvious cause.

This plan keeps the checkpoint and the investigation separate. First we will commit/push the current lane so the prompt/test/plan state is preserved. Then we will inspect the exact time range around the hallucinated segment in the fresh `music-vocals` artifact, compare it with `dialogue-data.reconciled.json` over the same interval, compare both to benchmark truth, and document whether there is an obvious reason the line drifted into a wrong canonical fill.

---

## Tasks

### Task 1: Checkpoint current music-vocals tuning with commit and push

**Bead ID:** `ee-psnx`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-psnx immediately with \`bd update ee-psnx --status in_progress --json\`, then checkpoint the current music-vocals prompt-tuning lane in git so it is not lost. Commit the files that belong to this lane, push them to main via the SSH origin, and update this plan truthfully with the exact committed files, commit hash, and push result. Do not mix in unrelated repo noise. Close bead ee-psnx with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`
- `.plans/2026-04-06-investigate-music-vocals-hallucination-vs-dialogue-and-benchmark.md`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-music-vocals.test.js`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

**Status:** ✅ Complete

**Results:** Claimed `ee-psnx`, then checkpointed the current lane with commit `832e843` on `main` and pushed it successfully to `origin` (`git@github.com:getpeanutgallery/emotion-engine.git`).

Committed files:
- `.plans/2026-04-06-investigate-music-vocals-hallucination-vs-dialogue-and-benchmark.md`
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-music-vocals.test.js`

Push result:
- `To github.com:getpeanutgallery/emotion-engine.git`
- `89be1ab..832e843  main -> main`

This preserved the current prompt-tuning lane in git without pulling in the broader repo noise.

---

### Task 2: Compare the hallucinated sung-vocal segment against dialogue and benchmark truth

**Bead ID:** `ee-y5v0`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after ee-psnx is complete, claim bead ee-y5v0 immediately with \`bd update ee-y5v0 --status in_progress --json\`, then inspect the hallucinated music-vocals segment around the bogus line \`Come crawling faster\` in the fresh rerun. Compare that exact timeframe against the same timeframe in dialogue-data.reconciled.json and against the human benchmark truth in benchmarks/fixtures/cod-test/truth/music-vocals-data.json and dialogue-data.json. Document whether there is an obvious reason for the hallucination: cross-lane leakage, weak/partial audio support, canonical overfill after recognized-song grounding, timing drift, or something else. Update this plan truthfully with the exact files reviewed, timeframe comparisons, and your best evidence-backed conclusion. Do not change code or push in this task. Close bead ee-y5v0 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-investigate-music-vocals-hallucination-vs-dialogue-and-benchmark.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-y5v0` and directly compared the fresh `music-vocals` artifact against the same timeframe in dialogue and against benchmark truth.

Files reviewed:
- current output:
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- benchmark truth/report surface:
  - `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
  - `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

Exact timeframe comparison around the suspect line:
- Current raw and reconciled `music-vocals` are identical in the key window, which means the hallucinated line was generated by the live `music-vocals` model pass and **not** introduced by reconciliation.
- Current output around `76-84s`:
  - `76-78`: `Obey your master`
  - `78-80`: `Come crawling faster`
  - `80-84`: `Master of puppets, I'm pulling your strings`
- Dialogue comparison for the same general window found **no dialogue segments at all** in `dialogue-data.reconciled.json`, and no nearby lyric-like text. So there is no evidence that `Come crawling faster` came from dialogue leakage or cross-lane contamination.
- Benchmark truth in the same broader region is itself noisy / approximate rather than perfectly canonical:
  - `64-65`: `Obey your master.`
  - `68-70`: `Control faster.`
  - `76-78`: `Master of puppets are pulling the strings!`
  - `80-83`: `Twisting your mind, smashing your dreams!`
- The benchmark report confirms the exact mismatch at `vocal_segments[1].text`: truth `Control faster.` vs output `Come crawling faster`.

Most important supporting evidence from the reconciliation ledger:
- The ledger shows `recognizedSong.status = recognized` with high confidence (`0.95`) for `Master of Puppets`.
- Its matched lyric evidence is anchored on stronger nearby lines (`Obey your master`, `Master of puppets, I'm pulling your strings`, `Just call my name, 'cause I'll hear you scream`, `Master, master`).
- The ledger also shows `skippedCorrections` because lyric similarity was below threshold, so reconciliation did not rewrite this weakly grounded segment after the model produced it.

Best evidence-backed conclusion:
1. **Not dialogue contamination.** There is no same-timeframe dialogue text to leak from, and the line already exists in the raw `music-vocals` output before reconciliation.
2. **Likely canonical overfill on weak audio support.** The prompt now allows bounded recognized-song scaffolding after literal grounding. Once the model confidently identified `Master of Puppets`, it appears to have filled a partially heard transition line with a plausible-sounding lyric-like phrase rather than staying fragmentary.
3. **Timing drift amplifies the problem.** Benchmark truth places a short rough phrase earlier (`68-70`) and moves to `Master of puppets...` by `76-78`, while the output inserts the hallucinated transition at `78-80`. So the model is both overfilling and slightly sliding the lyric sequence forward.
4. **Benchmark truth itself is imperfectly canonical.** The human-verified benchmark says `Control faster.` rather than a canonical Metallica line, which suggests the underlying audio is genuinely murky in this section. That makes this a weak-audio / ambiguous-chant zone where overfill is especially likely.

Net judgment: the obvious cause is **recognized-song-assisted canonical smoothing in a murky window, not dialogue leakage**. The lane now has enough song identity to recover coverage, but that same scaffold makes it prone to inventing a smoother transition phrase when the audio support is thin and the benchmark itself reflects an imperfectly heard chant-like line.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** We checkpointed the current `music-vocals` prompt-tuning lane in git (`832e843` pushed to `main`) and completed a direct evidence review of the bogus sung-vocal line `Come crawling faster` against the same-timeframe dialogue lane and the human benchmark truth. The investigation shows the bad line is present in the raw `music-vocals` output before reconciliation, has no corresponding dialogue text to leak from, and most likely comes from recognized-song-assisted overfill in a murky chant window where the benchmark truth is itself only approximate.

**Commits:**
- `832e843` - Checkpoint music-vocals prompt tuning lane

**Lessons Learned:**
- The recovered song-identity scaffold is doing the intended coverage work, but it also creates a specific failure mode: smoothing weakly heard transition lines into plausible lyric text.
- Reconciliation is not the source of this hallucination; the live `music-vocals` generation step is.
- The benchmark’s own `Control faster.` wording is a clue that this audio window is genuinely ambiguous, so the next fix should make the model stay fragmentary or uncertain in exactly these short chant-transition spans.

---

*Completed on 2026-04-06*
