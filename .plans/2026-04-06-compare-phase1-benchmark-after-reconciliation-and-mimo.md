# emotion-engine: compare Phase 1 benchmark behavior after reconciliation + MiMo rerun

**Date:** 2026-04-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Break down how the current Phase 1 outputs compare to benchmark truth, with emphasis on whether dialogue contamination from sung vocals and music-vocals lyric accuracy are better now than before the reconciliation script was introduced.

---

## Overview

Derrick wants a truth-focused comparison rather than another blind rerun. The specific question is whether the reconciliation step that rewrites dialogue/music-vocals artifacts improved the benchmark-relative behavior in the intended ways: less sung-vocal leakage into dialogue and more canonical lyric behavior in music-vocals.

The comparison should use the latest successfully completed run with the `232144` cap as the current point, then contrast it with the most relevant earlier completed runs from before/around reconciliation rollout. The output should separate measurable benchmark deltas from qualitative artifact review so we do not overclaim when the benchmark surfaces are imperfectly aligned with the failure shape.

---

## Tasks

### Task 1: Compare current Phase 1 dialogue/music-vocals outputs against benchmark and prior completed runs

**Bead ID:** `ee-wsc7`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-wsc7 immediately with \`bd update ee-wsc7 --status in_progress --json\`, then inspect the latest successful cod-test run after max_tokens=232144 and compare its Phase 1 dialogue and music-vocals artifacts against benchmark truth and the most relevant earlier completed runs from before/around the reconciliation rollout. Focus specifically on whether dialogue now contains less sung-vocal contamination and whether music-vocals now contains better canonical lyric behavior. Use the benchmark reports plus direct artifact/ledger review where needed, update this plan truthfully with exact files and findings, do not change code, and close bead ee-wsc7 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-compare-phase1-benchmark-after-reconciliation-and-mimo.md`
- analysis notes only; no code changes expected

**Status:** ✅ Complete

**Results:** Claimed `ee-wsc7` and treated the latest successful post-`232144` run as the completed rerun documented in `.plans/2026-04-06-set-cod-test-max-tokens-to-232144-and-rerun.md`: log `.logs/cod-test-20260406-103734-ee-t1h0-max232144-rerun.log`, completed output `output/cod-test/`, event ledger `output/cod-test/_meta/events.jsonl`, and benchmark reports under `benchmarks/fixtures/cod-test/_reports/`.

Files reviewed directly for the comparison:
- current truth + report surface:
  - `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
  - `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- current Phase 1 artifacts:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- earlier comparison anchors:
  - pre-reconciliation completed run `ee-7h2e`: `output/_archives/cod-test-pre-ee-7h2e-20260405-151939/phase1-gather-context/{dialogue-data.json,music-vocals-data.json}` plus `.plans/archive/2026-04-05-implement-sharper-arbitration-and-rerun.md`
  - reconciliation rollout completed run `ee-k4o2a`: `output/_archives/cod-test-pre-ee-k4o2a-20260405-210753/phase1-gather-context/{dialogue-data.reconciled.json,music-vocals-data.reconciled.json,famous-song-reconciliation.json}` plus `.plans/archive/2026-04-05-investigate-reconciliation-rerun-stall-and-recover.md`
  - supporting near-rollout Phase 1 evidence from the later-but-partial reconciled rerun `ee-r4u4`: `output/_archives/cod-test-pre-ee-r4u4-20260406-081320/phase1-gather-context/{dialogue-data.reconciled.json,music-vocals-data.reconciled.json,famous-song-reconciliation.json}` plus `.plans/2026-04-05-tune-reconciliation-lyric-correction.md`

Current benchmark-relative snapshot (`ee-t1h0`):
- `benchmark-summary.json` shows overall benchmark failure at `1866/2916` passed (`63.99%`), with `dialogueData` accuracy `77/220 = 35.0%` and coverage `220/246 = 89.43%`, and `musicVocalsData` accuracy `14/37 = 37.84%` with coverage `37/56 = 66.07%`.
- `artifact-results/dialogueData.json` shows the dialogue artifact is still structurally off from truth (`17` output segments vs `20` truth) and mostly fails on timing/segmentation drift, especially in the opening minute; the report does **not** point to a new lyric-spill cluster as the dominant benchmark failure.
- `artifact-results/musicVocalsData.json` shows the music-vocals artifact collapsed to only `2` segments versus `10` truth segments, so benchmark failure here is primarily missing-canonical-coverage and timing mismatch.

Dialogue contamination finding:
- **Yes: dialogue now contains less sung-vocal contamination than the most relevant earlier runs.**
- In the current reconciled dialogue file `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, the late trailer block contains spoken lines only: `Pull it together, man.`, `So eager to leave, David. Killing a man is is a hell of a lot easier than killing the idea.`, `You were never cut out to be a Mason.`, `No more games. This ends now.`, and the preorder CTA. There are **no** surviving explicit Metallica lyric lines in dialogue.
- That is cleaner than pre-reconciliation `ee-7h2e`, whose `dialogue-data.json` still leaked `Obey your master!` as dialogue at `113-116`.
- It is also cleaner than completed reconciliation run `ee-k4o2a`, whose reconciled dialogue still contained obvious lyric spill such as `I'm a monster.`, `Control.`, `Master of the bullet and the blade.`, `Crushing your bones, smashing your teeth.`, and a long contaminated line ending with `Obey your master.`
- Versus `ee-r4u4`, current dialogue is roughly similar on the narrow contamination question: `ee-r4u4` was already clean and its ledger explicitly removed one `Obey your master!` contamination segment. Current `ee-t1h0` is clean too, but its reconciliation ledger shows **zero** removals/corrections because the lyric spill never appeared in the current detected lyric range.
- Net on the dialogue question: **improved vs the earlier completed runs, but not because benchmark dialogue accuracy is suddenly good**. The current dialogue benchmark is still poor for structural reasons; it is just no longer obviously polluted by sung-vocal text.

Music-vocals canonical-lyric finding:
- **No: the latest successful `ee-t1h0` run does not show better overall canonical lyric behavior than the best runs from before/around reconciliation rollout.** It is cleaner in a narrow sense, but materially worse in recall and truth coverage.
- Truth expects `10` vocal segments in `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`, covering the recognizable `Master of Puppets` lyric progression from `64-130s`.
- Current `ee-t1h0` reconciled output has only `2` segments in `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`:
  - `76-82`: `Obey your master`
  - `82-98`: `Master, master`
  Those two phrases are canonical fragments, but the artifact drops the rest of the truth lyric chain entirely: no `Control faster.`, no `Master of puppets ... pulling your strings`, no `Twisting your mind ...`, no `Blinded by me ...`, no `Just call my name ...`, and no late `Obey your master!` / trailing `Master, master` return.
- The benchmark report matches that qualitative read: `artifact-results/musicVocalsData.json` scores only `14/37` scoreable fields passed with a structural mismatch of `2` output segments vs `10` truth segments.
- Compared with pre-reconciliation completed run `ee-7h2e`, the latest run is **less hallucination-prone but also much thinner**. `ee-7h2e` had the full `10`-segment shape but several obviously non-canonical lines (`Control your master`, `Master, master, obey your master`, `Crushing your mind`, `Crushing your day`). Current `ee-t1h0` avoids those bogus rewrites, so the surviving fragments are more canonical, but only because most of the song disappeared.
- Compared with completed reconciliation rollout run `ee-k4o2a`, the latest run is clearly worse overall. `ee-k4o2a` had `11` vocal segments and preserved most of the canonical lyric ladder (`Obey your master`, `Master, master`, `Master of puppets ... pulling your strings`, `Twisting your mind and smashing your dreams`, `Blinded by me ...`, `Just call my name ...`, late `Obey your master`). The current run lost that breadth entirely.
- Supporting partial run `ee-r4u4` reinforces the same conclusion: even without benchmark completion, its reconciled music-vocals artifact had `13` segments with broadly canonical lines across `58-134s`, while current `ee-t1h0` recognizes only the two chant fragments and nothing else. `ee-r4u4` also had a stronger recognition ledger (`confidence 0.98`, five matched lyric lines, time range `58-134`) than current `ee-t1h0` (`confidence 0.93`, only two matched lyric lines, time range `76-98`).
- Net on the music-vocals question: **the current run is better only at avoiding some bad/non-canonical phrases, but worse at actually producing the canonical lyric sequence the benchmark truth expects.** If the bar is “better canonical lyric behavior overall,” the answer is **no**.

Bottom line:
- **Dialogue:** yes, cleaner than before/around reconciliation rollout; sung-vocal contamination is materially reduced versus the earlier completed anchors.
- **Music-vocals:** no, not improved overall; the surviving lyrics are cleaner but the artifact regressed into severe under-coverage and missed most canonical lines.
- **Benchmark interpretation:** the current reports are directionally useful for this read, but they understate the qualitative dialogue cleanup and correctly expose the music-vocals collapse. The dominant remaining Phase 1 problem after the `232144` rerun is no longer lyric spill into dialogue; it is weak/partial music-vocals capture.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A truth-backed comparison of the latest successful post-`232144` Phase 1 output (`ee-t1h0`) against benchmark truth and the most relevant earlier comparison anchors. The resulting judgment is asymmetric: dialogue contamination from sung vocals is genuinely better than the earlier completed runs, but music-vocals canonical lyric behavior is not better overall because the current run collapses the song to two generic chant fragments and misses most of the benchmark truth timeline.

**Commits:**
- None. This task updated only the plan file and did not change code.

**Lessons Learned:** Reconciliation seems to have succeeded at keeping lyrics out of dialogue, but that should not be mistaken for improved lyric transcription quality. The next Phase 1 quality lane should focus on restoring full music-vocals lyric recall/timeline coverage without reintroducing dialogue contamination.

---

*Completed on 2026-04-06*
