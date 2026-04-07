# emotion-engine: rerun song-grounding lane and review latest artifacts

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Run a fresh cod-test after the benchmark split and famous-song grounding changes, verify the new artifact fields end-to-end, and review whether the updated music-vocals grounding materially improves dialogue-vs-sung separation and lyric truthfulness.

---

## Overview

The benchmark split and additive song-grounding contract are now implemented and committed locally. The next step is not more design work; it is a real validation pass. We need a fresh pipeline run that exercises the updated `music` and `music-vocals` prompts/contracts so we can see whether `recognizedSong` and `recognitionNotes` appear in persisted artifacts, whether the model uses them sensibly, and whether the output is genuinely more trustworthy under the new spoken-vs-sung evaluation split.

This lane should stay focused on validation and human review. First we rerun the cod-test with the updated Phase 1 contract and collect the fresh artifacts/logs. Then we inspect the resulting `dialogue`, `music`, and `music-vocals` outputs against the newly split benchmark truth to determine whether famous-song grounding is helping, whether it reduces spoken-dialogue contamination in `music-vocals`, and what the next iteration should be if the improvement is still insufficient.

---

## Tasks

### Task 1: Rerun the cod-test with the new song-grounding contract and capture artifacts

**Bead ID:** `ee-tpgy`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-tpgy with bd update ee-tpgy --status in_progress --json, then run a fresh cod-test using the current canonical config after the benchmark split and song-grounding changes. Capture the exact command, verify the run completes, and update this plan with the resulting artifact/log paths. Confirm that the persisted Phase 1 music and music-vocals artifacts include any new recognizedSong / recognitionNotes fields when emitted. Do not push. Commit only if the validation lane creates a durable doc/plan update worth committing.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-rerun-song-grounding-and-review.md`
- fresh log/output artifacts from the rerun

**Status:** ✅ Complete

**Results:** Claimed bead `ee-tpgy`, then ran a fresh record-mode cod-test with the canonical config using:

```bash
set -a
. ./.env
set +a
export DIGITAL_TWIN_MODE=record
export DIGITAL_TWIN_CASSETTE="cod-test-record-20260405-112324-ee-tpgy-song-grounding"
npm run pipeline -- --config configs/cod-test.yaml --verbose
```

The rerun reached the end of Phases 1–3 and then failed the benchmark gate with a non-zero exit: `0/7 artifacts passed. 1783/2907 scoreable fields passed. Truth coverage was 2907/3034 fields.` Wall-clock runtime from `/usr/bin/time` was `real 2810.61` seconds (~46m 51s).

Fresh evidence/artifacts:
- Log: `.logs/cod-test-20260405-112324-ee-tpgy-song-grounding.log`
- Timing: `.logs/cod-test-20260405-112324-ee-tpgy-song-grounding.time`
- Cassette: `cod-test-record-20260405-112324-ee-tpgy-song-grounding`
- Event stream: `output/cod-test/_meta/events.jsonl`
- Phase 1 persisted artifacts:
  - `output/cod-test/phase1-gather-context/music-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
- Phase 1 raw AI payloads:
  - `output/cod-test/phase1-gather-context/raw/ai/music-whole-asset.json`
  - `output/cod-test/phase1-gather-context/raw/ai/music-vocals-whole-asset.json`
- Phase 2 aggregate: `output/cod-test/phase2-process/chunk-analysis.json`
- Phase 3 review entrypoints:
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
  - `output/cod-test/phase3-report/summary/summary.json`
  - `output/cod-test/phase3-report/recommendation/recommendation.json`
- Benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Field verification for the new song-grounding contract:
- `music-data.json` **does include** both `recognizedSong` and `recognitionNotes`.
  - `recognizedSong.status`: `possible`
  - top candidate: `Master of Puppets` / `Metallica`
- `music-vocals-data.json` **does include** `recognizedSong` but **does not include** `recognitionNotes` in this emitted artifact (`null` / absent as a populated field).
  - `recognizedSong.status`: `recognized`
  - top candidate: `Master of Puppets` / `Metallica`
  - matched lyrics include `"Master, master"`, `"Where's the dreams that I've been after"`, `"Promised only lies"`, `"All I hear or see is laughter"`, and `"Laughing at my cries"`

Pointers left for Task 2 review:
- Start with the persisted Phase 1 artifacts above, then compare them to the split benchmark truth and the benchmark summary at `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`.
- For the famous-song grounding check, the strongest evidence lives in `output/cod-test/phase1-gather-context/music-data.json`, `output/cod-test/phase1-gather-context/music-vocals-data.json`, and their paired raw AI payloads under `output/cod-test/phase1-gather-context/raw/ai/`.
- For overall pipeline quality review, use `output/cod-test/phase3-report/summary/FINAL-REPORT.md` plus `output/cod-test/phase2-process/chunk-analysis.json`.

---

### Task 2: Review the fresh artifacts against the split benchmark truth and recommend the next lane

**Bead ID:** `ee-9ei7`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the fresh cod-test rerun artifacts after the song-grounding changes. Compare dialogue-data.json against spoken-only truth, compare music-vocals-data.json against sung-vocal truth, inspect recognizedSong / recognitionNotes if present, and decide whether the new grounding materially improved classification/truthfulness or whether a different next lane is required. Update this plan with exact findings and a concrete recommendation. No code changes.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-rerun-song-grounding-and-review.md`
- fresh rerun artifacts to be reviewed

**Status:** ✅ Complete

**Results:** Claimed bead `ee-9ei7` and reviewed the fresh rerun artifacts against the newly split truth.

Exact findings from the review:
- **Dialogue vs spoken-only truth is still materially wrong.** The rerun `output/cod-test/phase1-gather-context/dialogue-data.json` contains only **16** dialogue segments vs **20** in `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, for benchmark `dialogueData` accuracy **0.4360** and coverage **0.8473**.
  - It still leaks sung lyrics into dialogue (`"Your streets, so once again run red"` / `"with your blood"`) instead of preserving the spoken-only opening lines (`"It's time to wake up."`, `"Menendez is a terrorist."`) and the separate spoken villain line structure.
  - It completely misses several spoken truth segments after the split, including `"You shall know fear."`, `"Specter one, report."`, `"Need a sitrep."`, and then structurally drifts so the benchmark reports the final four truth items as missing array entries.
  - It also merges/rewrites spoken lines incorrectly (`"The hell it is!"` vs truth `"The hell it ain't!"`, `"So eager to leave, David?"` vs truth `"So eager to leave daddy."`, `"Killing men is Killing men is ..."` vs truth `"Killing the man is ..."`).
  - Bottom line: the spoken-vs-sung boundary is still not reliable enough for dialogue truthfulness.
- **Music-vocals truthfulness improved in song identification, but not enough in lyric coverage.** The rerun `output/cod-test/phase1-gather-context/music-vocals-data.json` correctly recognizes **Metallica — Master of Puppets** with `recognizedSong.status = "recognized"` and strong literal lyric evidence, but benchmark `musicVocalsData` still lands at accuracy **0.4359** and coverage **0.8478**.
  - The output captures the later `"Master, master"` / `"Where's the dreams that I've been after"` / `"Promised only lies"` / `"All I hear or see is laughter"` / `"Laughing at my cries"` stretch well.
  - But it misses the truth's earlier chant/lead-in lines (`"Obey your master."`, `"Control faster."`, `"Master of puppets are pulling the strings!"`, `"Twisting your mind, smashing your dreams!"`, `"Blinded by me..."`, `"Just call my name..."`) and the later repeated chant fragments at **116–118** and **127–130**.
  - So the new grounding helped the model **name the song and quote some correct later lyrics**, but it did **not** produce full sung-vocal truth coverage.
- **recognizedSong / recognitionNotes inspection:**
  - `output/cod-test/phase1-gather-context/music-data.json` now includes both `recognizedSong` and `recognitionNotes`. It identifies `Master of Puppets` as a **possible** match with confidence **0.85** and explicitly notes masking by dialogue/SFX.
  - `output/cod-test/phase1-gather-context/music-vocals-data.json` includes `recognizedSong` as **recognized** with confidence **0.99**, but the persisted artifact still omits `recognitionNotes` even though the split truth expects them. That is a remaining contract/persistence mismatch, not evidence of a fully solved grounding lane.
- **Benchmark summary remains decisively bad overall.** `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` shows **0/7 artifacts passed**, **1783/2907** scoreable fields passed (**61.33%**), with both `dialogueData` and `musicVocalsData` errored rather than close-to-pass.

Recommendation:
- Treat the song-grounding change as a **useful but limited local improvement**: it materially improved **song recognition confidence and some late-chorus lyric truthfulness**, but it did **not** materially improve the benchmark lane that matters most here: **spoken-vs-sung separation and end-to-end truthfulness**.
- The next lane should **not** be more famous-song grounding prompt work. It should focus on **boundary/classification behavior**:
  1. harden dialogue extraction so sung lyrics cannot leak into `dialogueData`,
  2. ensure spoken lines masked by music/SFX are still surfaced as dialogue,
  3. stabilize `music-vocals` coverage across the full trailer timeline (early chants + late reprises), and
  4. fix the `music-vocals` contract/persistence mismatch so `recognitionNotes` survives into the emitted artifact when present.
- In short: **song ID is now mostly grounded; the blocker has moved to lane separation and coverage.**

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Completed the rerun + human review loop. The new song-grounding contract now emits usable `recognizedSong` evidence and correctly identifies `Master of Puppets`, but the cod-test still fails badly because spoken dialogue and sung-vocal lanes remain misclassified/incomplete.

**Commits:**
- None

**Lessons Learned:** The famous-song grounding lane helped with identification, but benchmark quality is still dominated by separation/coverage errors. The next iteration should target dialogue/music-vocals boundary handling rather than piling on more song-recognition prompt detail.

---

*Started on 2026-04-05*
