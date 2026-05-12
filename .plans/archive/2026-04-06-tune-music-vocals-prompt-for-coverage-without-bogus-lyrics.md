# emotion-engine: tune music-vocals prompt for better canonical lyric coverage without bogus rewrites

**Date:** 2026-04-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Improve the `music-vocals` lane so it preserves more canonical lyric coverage while keeping the dialogue cleanup gains and avoiding a return to bogus or misheard lyric lines.

---

## Overview

The latest successful `232144` run clarified the shape of the remaining problem. Dialogue contamination from sung vocals is improved, which means the reconciliation architecture is paying off there. But the `music-vocals` side is now under-covering badly, collapsing to only a tiny subset of the expected lyric sequence.

This lane should start with prompt/design work before code edits. Derrick specifically wants to see the exact prompt delta between the old and new prompt wording. So the first step is to identify the current `music-vocals` prompt surface(s), propose a narrow wording change that should recover canonical lyric coverage without inviting hallucinated lyrics, and present that delta clearly in the plan and results. After that, implementation and rerun work can proceed in controlled follow-up steps.

---

## Tasks

### Task 1: Design the prompt delta for music-vocals coverage recovery

**Bead ID:** `ee-60cn`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-60cn immediately with \`bd update ee-60cn --status in_progress --json\`, then inspect the current music-vocals prompt surface(s) and the latest successful post-232144 run artifacts to design a narrow prompt change that should recover more canonical lyric coverage without reintroducing bogus or misheard lyric lines. Compare against the prior stronger reconciliation-era artifacts where useful. Update this plan truthfully with: (1) the exact old prompt text, (2) the exact proposed new text, (3) a unified-diff-style delta, and (4) a short rationale for each change. Do not change code in this task, and close bead ee-60cn with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`

**Status:** ✅ Complete

**Results:**

Inspected the live prompt surfaces in `server/scripts/get-context/get-music-vocals.cjs` and compared them against:

- latest successful post-`232144` artifact: `output/cod-test/phase1-gather-context/music-vocals-data.json`
- prior stronger reconciliation-era artifact: `output/_archives/cod-test-pre-ee-r4u4-20260406-081320/phase1-gather-context/music-vocals-data.reconciled.json`
- prior overreach / bogus-lyrics artifact for contrast: `output/_archives/cod-test-pre-ee-k4o2b-20260405-211939/phase1-gather-context/music-vocals-data.reconciled.json`
- benchmark truth reference: `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`

Observed behavior:

- Current prompting is now very conservative and under-covers badly: the latest successful artifact only returns two safe fragments (`"Obey your master"` and `"Master, master"`) for the whole cue.
- Earlier reconciliation-era output recovered much more of the canonical lyric sequence, but some older runs also overreached into polished wrong lines such as `"Come control your master"`.
- The right fix is therefore **not** to broadly loosen lyric invention rules; it is to give the model a **bounded canonical-recall scaffold after song grounding**, while still forcing fragment-level discipline when the audio is masked.

#### Exact old prompt text

Targeted whole-asset rules block as it exists now:

```text
- Aim for full-trailer lyric coverage, not just representative examples.
- Capture each distinct lyric-bearing entry, reprise, or short return at the point it occurs on the global timeline.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the audio is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not merge multiple lyric lines into one segment.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use the whole-asset context as a checklist so chunk refinement revisits late and brief lyric windows instead of forgetting them.
- Treat whole-asset lyric phrases as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If multiple songs or cues are plausibly present, set multipleSongsDetected to true and prefer multiple_possible unless one clearly dominates.
- delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- If no text-bearing music-led vocals are present, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

Targeted chunk rules block as it exists now:

```text
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the chunk is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Do not merge multiple lyric lines into one segment.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use rollingSummary and whole-asset context as a checklist so late and brief lyric windows are revisited instead of forgotten.
- Treat whole-asset lyric phrases as recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- If no text-bearing music-led vocals are present in this chunk, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

#### Exact proposed new prompt text

Proposed replacement whole-asset rules block:

```text
- Aim for full-trailer lyric coverage, not just representative examples.
- Capture each distinct lyric-bearing entry, reprise, or short return at the point it occurs on the global timeline.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the audio is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not merge multiple lyric lines into one segment.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use the whole-asset context as a checklist so chunk refinement revisits late and brief lyric windows instead of forgetting them.
- After at least one literal lyric fragment grounds a likely song, you may use a high-confidence recognizedSong hypothesis as bounded recall scaffolding for nearby lines in the same cue.
- Treat whole-asset lyric phrases and recognizedSong matches as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
- If an expected canonical line is only partly supported by the audio, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a vague melody/hook match into a full canonical lyric line without audible lexical support in this asset.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If multiple songs or cues are plausibly present, set multipleSongsDetected to true and prefer multiple_possible unless one clearly dominates.
- delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- If no text-bearing music-led vocals are present, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

Proposed replacement chunk rules block:

```text
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the chunk is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Do not merge multiple lyric lines into one segment.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use rollingSummary, whole-asset context, and any high-confidence recognizedSong match as a checklist so late and brief lyric windows are revisited instead of forgotten.
- Treat whole-asset lyric phrases and recognizedSong matches as bounded recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
- If an expected canonical line is only partly supported in this chunk, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a weak hook/vibe match into a canonical lyric line just because the likely song identity is known.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- If no text-bearing music-led vocals are present in this chunk, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

#### Unified-diff-style delta

```diff
--- whole-asset-rules.old
+++ whole-asset-rules.new
@@
 - Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
 - Use the whole-asset context as a checklist so chunk refinement revisits late and brief lyric windows instead of forgetting them.
-- Treat whole-asset lyric phrases as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
+- After at least one literal lyric fragment grounds a likely song, you may use a high-confidence recognizedSong hypothesis as bounded recall scaffolding for nearby lines in the same cue.
+- Treat whole-asset lyric phrases and recognizedSong matches as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
+- If an expected canonical line is only partly supported by the audio, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
+- Do not promote a vague melody/hook match into a full canonical lyric line without audible lexical support in this asset.
 - recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
```

```diff
--- chunk-rules.old
+++ chunk-rules.new
@@
 - Do not merge multiple lyric lines into one segment.
 - Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
-- Use rollingSummary and whole-asset context as a checklist so late and brief lyric windows are revisited instead of forgotten.
-- Treat whole-asset lyric phrases as recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
+- Use rollingSummary, whole-asset context, and any high-confidence recognizedSong match as a checklist so late and brief lyric windows are revisited instead of forgotten.
+- Treat whole-asset lyric phrases and recognizedSong matches as bounded recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
+- If an expected canonical line is only partly supported in this chunk, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
+- Do not promote a weak hook/vibe match into a canonical lyric line just because the likely song identity is known.
 - recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
```

#### Short rationale for each change

1. **Add bounded recognized-song scaffold after literal grounding**  
   The current prompt is so cautious that once it avoids bogus rewrites, it also stops recovering nearby canonical lines. This change gives the model permission to use song identity as a coverage aid, but only **after** at least one literal fragment grounds the song.

2. **Expand “recall scaffolding” from whole-asset phrases to recognizedSong matches too**  
   The current wording only allows recall help from prior lyric phrases. In practice, the model already knows the likely song but is not being told how to use that safely. Making that explicit should recover more verse/refrain coverage without reverting to blind copying.

3. **Force partial-fragment emission when support is incomplete**  
   This is the main safety valve against bogus polished lyrics like `"Come control your master"`. When the audio only partly supports a line, the model should emit the shortest supported fragment, not a smoothed canonical sentence.

4. **Explicitly ban upgrading hook/vibe matches into full lyric lines**  
   Earlier stronger-but-riskier outputs show that once the song is recognized, the model can overfill from canonical memory. This extra negative rule keeps the new scaffold narrow and evidence-gated.

Net judgment: this is the smallest prompt-only change that should move the system from **under-coverage** toward **truthy canonical recovery**, without reopening the door to polished wrong lyric fabrication.

---

### Task 2: Implement the approved prompt change and focused validation

**Bead ID:** `ee-r8p2`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after bead ee-60cn is complete, claim bead ee-r8p2 immediately with \`bd update ee-r8p2 --status in_progress --json\`, then implement the approved music-vocals prompt change exactly as documented in the plan. Preserve the dialogue cleanup behavior, avoid broad unrelated changes, add or update focused validation where appropriate, and update this plan truthfully with what changed and how it was checked. Do not push, and close bead ee-r8p2 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `test/scripts/get-music-vocals.test.js`
- `test/lib/phase1-validator-tools.test.js`

**Status:** ✅ Complete

**Results:**

Implemented the approved prompt-only delta in the two live `music-vocals` prompt surfaces inside `server/scripts/get-context/get-music-vocals.cjs`.

What changed:
- Whole-asset rules now allow **bounded** recognized-song recall only after at least one literal lyric fragment grounds the likely song.
- Whole-asset rules now explicitly treat both prior lyric phrases and `recognizedSong` matches as recall scaffolding rather than copyable truth.
- Whole-asset rules now force shortest-supported partial fragments when a canonical line is only partly audible, and explicitly ban promoting vague hook matches into full canonical lyric lines.
- Chunk rules now use `rollingSummary`, whole-asset context, and any high-confidence `recognizedSong` match as the checklist for late/brief lyric windows.
- Chunk rules now add the same bounded-scaffold / shortest-supported-fragment / no weak vibe-to-canonical-line protections.

To keep validation aligned with the live prompt contract, I also tightened the music-vocals validator tool description in `server/lib/phase1-validator-tools.cjs` so it documents the same bounded `recognizedSong` scaffold and partial-support behavior, without changing the underlying schema.

Focused validation updated:
- `test/scripts/get-music-vocals.test.js` now asserts the new chunk prompt lines are present.
- `test/lib/phase1-validator-tools.test.js` now asserts the validator contract description reflects the bounded-scaffold wording.

How this was checked:
- `node --test test/scripts/get-music-vocals.test.js`
- `node --test test/lib/phase1-validator-tools.test.js`

Result:
- Both focused test files passed (`6/6` and `14/14`).
- No dialogue-lane prompt text or dialogue cleanup behavior was changed in this task.
- I did not push.

---

### Task 3: Rerun cod-test and compare Phase 1 benchmark behavior

**Bead ID:** `ee-2n8y`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after bead ee-r8p2 is complete, claim bead ee-2n8y immediately with \`bd update ee-2n8y --status in_progress --json\`, then rerun cod-test with the updated active config/prompt behavior. Compare the resulting dialogue and music-vocals artifacts against the latest successful 232144 run and benchmark truth, focusing on whether canonical lyric coverage improves without reintroducing sung-vocal contamination into dialogue or bogus lyric lines into music-vocals. Update this plan truthfully with exact command, artifacts, and findings. Do not push, and close bead ee-2n8y with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`
- fresh rerun artifacts/logs/reports

**Status:** ✅ Complete

**Results:** Claimed `ee-2n8y`, then reran the active canonical lane with the prompt changes from `ee-r8p2` using the exact command:

`set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE=record && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-1159-ee-2n8y-music-vocals-prompt-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-1159-ee-2n8y-music-vocals-prompt-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260406-1159-ee-2n8y-music-vocals-prompt-rerun.log"`

Fresh evidence paths:
- log: `.logs/cod-test-20260406-1159-ee-2n8y-music-vocals-prompt-rerun.log`
- timing: `.logs/cod-test-20260406-1159-ee-2n8y-music-vocals-prompt-rerun.time` → `real 1431.64`, `user 11.03`, `sys 1.62`
- cassette: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-1159-ee-2n8y-music-vocals-prompt-rerun.json`
- fresh dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- fresh music-vocals artifact: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- fresh benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Run outcome:
- The pipeline again completed Phase 1, Phase 2, and Phase 3, wrote fresh output artifacts, then failed at benchmark.
- Current benchmark summary: `0/7` artifacts passed, `1501/2957` scoreable fields passed, truth coverage `2957/3079`.

Comparison vs the latest successful `232144` run (`ee-t1h0`):
- The immediately prior successful `232144` Phase 1 comparison, documented in `.plans/2026-04-06-compare-phase1-benchmark-after-reconciliation-and-mimo.md`, showed a very thin `music-vocals` result: only `2` reconciled vocal segments (`76-82: Obey your master`, `82-98: Master, master`) and clean dialogue with no surviving sung-lyric contamination.
- The fresh rerun materially improved `music-vocals` coverage versus that thin baseline. The reconciled artifact now contains `10` vocal segments spanning `76-132s`, including:
  - `76-78`: `Obey your master`
  - `78-80`: `Come crawling faster`
  - `80-84`: `Master of puppets, I'm pulling your strings`
  - `84-88`: `Twisting your mind and smashing your dreams`
  - `88-92`: `Blinded by me, you can't see a thing`
  - `92-96`: `Just call my name, 'cause I'll hear you scream`
  - `96-98`: `Master, master`
  - `98-102`: `Just call my name, 'cause I'll hear you scream`
  - `102-104`: `Master, master`
  - `130-132`: `Obey your master`
- Dialogue stayed clean on the contamination question. Direct inspection of `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` found no obvious lyric spill such as `master`, `puppets`, `obey`, or `crawling` in any dialogue segment.
- This means the prompt change did recover the intended canonical-sequence shape without obviously reintroducing sung-vocal contamination into dialogue.
- However, the lane is still not truth-clean. The second segment (`Come crawling faster`) is a bogus lyric rewrite relative to benchmark truth, and the artifact still shows timing/tail drift around the late refrain/return compared with `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`.
- Net judgment: this prompt change is a **mixed partial improvement** — it substantially fixes under-coverage, preserves the dialogue cleanup gain, but does not yet eliminate bogus lyric filling or alignment drift.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A bounded prompt-tuning pass for the `music-vocals` lane, plus focused validator/test updates and a full cod-test rerun. The rerun confirms that the new prompt successfully restores most of the expected `Master of Puppets` sequence while keeping dialogue free of obvious lyric contamination, but it still produces at least one bogus lyric rewrite (`Come crawling faster`) and retains timing/tail drift that keeps the benchmark red.

**Commits:**
- None yet. The work is present in the repo and documented in this plan, but this lane still wants one more tightening pass before I’d call it truly done.

**Lessons Learned:**
- The bounded `recognizedSong` scaffold was the right direction for recovering coverage.
- The remaining failure mode is no longer catastrophic under-coverage; it is selective overfill / canonical smoothing on partially supported lines.
- The next useful lane should tighten the first canonical-line transition and late-tail timing behavior without backing out the recovered coverage or recontaminating dialogue.

---

*Completed on 2026-04-06*
