# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Remove canonical lyric repair from famous-song reconciliation in the music-vocals lane so song recognition remains metadata/support only, while transcript text stays grounded in what the model actually heard.

---

## Overview

Derrick’s diagnosis is that the current architecture is fundamentally flawed if song recognition is allowed to repair lyric text. If the model can recognize a famous song from training data but also hallucinate canonical lyrics from that training data, then using recognized-song scaffolding to “fix” the transcript turns a transcription problem into a memory-regeneration problem. That makes the output potentially cleaner-looking but less truthful.

The correct architecture is to separate concerns. `recognizedSong` should be used for identity, attribution, and support metadata only. The `musicVocalsData` transcript should remain an audio-faithful estimate of what was actually heard, even when incomplete or noisy. Reconciliation should continue to help with ownership, segmentation, dedupe, and support annotation, but it should not rewrite transcript text toward canonical lyrics.

This lane should remove lyric-text correction from famous-song reconciliation, preserve song recognition as metadata/support only, update the report/benchmark expectations accordingly, and verify on cod-test that the system no longer “improves” lyrics by making them more canonical than the audio evidence supports.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Music-vocals benchmark error investigation | `docs/2026-04-24-music-vocals-benchmark-error-investigation.md` |
| `REF-02` | Current benchmark summary with music-vocals percentages | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-03` | Current music-vocals artifact result surface | `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` |
| `REF-04` | Current runtime music-vocals output | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-05` | Famous-song reconciliation evidence showing harmful rewrite | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-06` | Prior guidance that famous-song support should be bounded by audible evidence | `memory/2026-04-06-music-vocals.md` |
| `REF-07` | Current reconciliation / benchmark implementation | `server/` |

---

## Tasks

### Task 1: Design the contract change for music-vocals reconciliation and support metadata

**Bead ID:** `ee-p2o5`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Design the architecture change that removes lyric-text correction from famous-song reconciliation in music-vocals. Define the new contract boundary: transcript text stays audio-faithful, recognizedSong remains metadata/support only, and reconciliation may assist ownership/segmentation/annotation but not canonical lyric replacement. Inspect the current investigation memo, cod-test artifacts, reconciliation evidence, prior guidance, and relevant code. Write a concise implementation memo with the exact behavior changes, fields that remain allowed vs disallowed, backward-compatibility notes, and validation strategy.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-music-vocals-no-lyric-repair-plan.md`
- `.plans/2026-04-24-remove-canonical-lyric-repair-from-music-vocals.md`

**Status:** ✅ Complete

**Results:** Research/design completed. Inspected REF-01 through REF-07, including the repo-local docs/artifacts, relevant `server/` code, and the workspace memory handoff at `/home/derrick/.openclaw/workspace/memory/2026-04-06-music-vocals.md` because the repo-relative `memory/2026-04-06-music-vocals.md` path listed in the plan did not exist. Wrote `docs/2026-04-24-music-vocals-no-lyric-repair-plan.md` with the implementation-ready contract change: `musicVocalsData.vocal_segments[*].text` must remain audio-faithful, `recognizedSong` stays metadata/support only, and famous-song reconciliation may not perform canonical lyric replacement. Strongest evidence validated against REF-03/REF-05: current reconciliation rewrites `"Obey your master!"` to `"I'll be your master"`, proving the existing architecture allows harmful metadata-driven transcript mutation.

---

### Task 2: Implement removal of lyric-text repair and preserve support-only song metadata

**Bead ID:** `ee-lp88`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-07`  
**Prompt:** Implement the approved change so famous-song reconciliation no longer rewrites music-vocals transcript text toward canonical lyrics. Keep recognizedSong as identity/support metadata only. Preserve any safe ownership/segmentation/dedupe behavior that does not alter lyric text into canonical memory-based lines. Update tests and report surfaces as needed, commit, and push unless blocked.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-24-remove-canonical-lyric-repair-from-music-vocals.md`

**Status:** ✅ Complete

**Results:** Implemented the approved contract change in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`. Music-vocals reconciliation now preserves `musicVocalsData.vocal_segments[*].text` exactly as captured while still emitting `music-vocals-data.reconciled.json`. `recognizedSong` remains present as support/identity metadata only. The reconciliation ledger now bumps to `ee.famous-song-reconciliation/v2`, keeps `decisions.lyricCorrections` empty for music-vocals, and records explicit `musicVocalsPolicy` / `musicVocalsNotes` transparency entries instead of lyric-fix events. Replaced the outdated lyric-repair assertions in `test/scripts/reconcile-famous-song-phase1.test.js` with regression coverage proving the harmful `Obey your master!` → `I'll be your master` rewrite no longer occurs while dialogue lyric-contamination cleanup still works. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js` (pass, 7/7).

---

### Task 3: QA cod-test for no-lyric-repair behavior

**Bead ID:** `ee-60bj`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-07`  
**Prompt:** Verify on cod-test that music-vocals transcript text is no longer being rewritten toward canonical famous-song lyrics during reconciliation. Confirm song identity/support metadata still behaves usefully, and inspect before/after artifacts to ensure harmful rewrites like `Obey your master!` -> `I'll be your master` are gone.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- generated report surfaces as needed
- `.plans/2026-04-24-remove-canonical-lyric-repair-from-music-vocals.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of final no-lyric-repair architecture

**Bead ID:** `ee-2j2x`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the final music-vocals reconciliation change. Confirm song recognition is no longer used to repair transcript text, only to provide identity/support metadata; verify harmful canonical lyric substitution behavior is removed; and ensure the resulting system still preserves useful support/diagnostic information.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-24-remove-canonical-lyric-repair-from-music-vocals.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on 2026-04-24*
