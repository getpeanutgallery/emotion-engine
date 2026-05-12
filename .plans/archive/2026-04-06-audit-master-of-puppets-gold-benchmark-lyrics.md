# emotion-engine: audit Master of Puppets gold benchmark lyrics against canonical lyrics and plan benchmark fixes

**Date:** 2026-04-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Audit the `music-vocals` gold benchmark lyric lines that appear to correspond to Metallica's `Master of Puppets`, compare them against the real song lyrics, and produce a precise delta plan for correcting the gold benchmark where it currently differs.

---

## Overview

Derrick manually typed parts of the gold benchmark lyric truth, and the benchmark currently contains several lines that clearly intend to represent `Master of Puppets` but do not match the canonical released lyrics. The benchmark is therefore usable as an audit target, not yet as trusted lyric truth.

For the canonical reference, I used Metallica's own song catalog page for `Master of Puppets`: <https://www.metallica.com/songs/master-of-puppets.html>. I compared every benchmark `vocal_segments` entry that appears to be from the song against the corresponding canonical lyric line(s), then classified each segment as `exact`, `punctuation-only`, `wording-different`, `line-boundary-shifted`, or `timing-shifted`.

Important constraint preserved: this audit does **not** modify `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` yet. It only records the exact mismatches and a proposed repair plan.

---

## Tasks

### Task 1: Extract benchmark vocal lines and compare them to canonical Master of Puppets lyrics

**Bead ID:** `ee-8sj8`  
**SubAgent:** `research`

**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect benchmarks/fixtures/cod-test/truth/music-vocals-data.json, list all sung-vocal lines that appear to be from Metallica's Master of Puppets, fetch a reliable online lyric source for the song, and compare the benchmark wording against the canonical lyrics. For each benchmark segment, classify whether it is exact, punctuation-only, wording-different, line-boundary-shifted, or timing-shifted. Update the plan truthfully with the exact benchmark lines, the canonical lyric lines, and the comparison findings. Do not edit the benchmark yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-audit-master-of-puppets-gold-benchmark-lyrics.md`

**Status:** ✅ Complete

**Results:**

Identified 10 benchmark vocal segments that appear to be from `Master of Puppets`, at times `64-65`, `68-70`, `76-78`, `80-83`, `84-86`, `87-88`, `89-94`, `94-98`, `116-118`, and `127-130`.

Canonical lyric source used:
- Metallica official song catalog page: <https://www.metallica.com/songs/master-of-puppets.html>

Segment-by-segment comparison:

1. **64-65**
   - Benchmark: `Obey your master.`
   - Canonical: `Obey your master`
   - Classification: `punctuation-only`
   - Notes: wording matches; trailing period is extra.

2. **68-70**
   - Benchmark: `Control faster.`
   - Canonical: `Your life burns faster`
   - Classification: `wording-different`
   - Notes: benchmark text is not a minor variant; it substitutes an incorrect phrase.

3. **76-78**
   - Benchmark: `Master of puppets are pulling the strings!`
   - Canonical: `Master of puppets I’m pulling your strings`
   - Classification: `wording-different`
   - Notes: `are` should be `I’m`; `the strings` should be `your strings`; trailing exclamation is also non-canonical.

4. **80-83**
   - Benchmark: `Twisting your mind, smashing your dreams!`
   - Canonical: `Twisting your mind and smashing your dreams`
   - Classification: `wording-different`
   - Notes: comma replaces `and`, which changes the lyric wording rather than just punctuation; trailing exclamation is also extra.

5. **84-86**
   - Benchmark: `Blinded by me, you can’t see a thing`
   - Canonical: `Blinded by me, you can’t see a thing`
   - Classification: `exact`
   - Notes: exact match.

6. **87-88**
   - Benchmark: `Just call my name ’cause I’ll hear you scream`
   - Canonical: `Just call my name, ‘cause I’ll hear you scream`
   - Classification: `punctuation-only`
   - Notes: missing comma before `‘cause`; wording otherwise matches.

7. **89-94**
   - Benchmark: `Master, master, where’s the dreams that I’ve been after?`
   - Canonical lines:
     - `Master, master`
     - `Where’s the dreams that I’ve been after?`
   - Classification: `line-boundary-shifted`
   - Notes: benchmark merges two canonical lines into one segment; wording is otherwise effectively canonical apart from the extra comma after the second `master`.

8. **94-98**
   - Benchmark: `Master, master, you promised only lies!`
   - Canonical lines:
     - `Master, master`
     - `You promised only lies`
   - Classification: `line-boundary-shifted`
   - Notes: benchmark merges two canonical lines into one segment; trailing exclamation is extra.

9. **116-118**
   - Benchmark: `Obey your master!`
   - Canonical: `Obey your master`
   - Classification: `punctuation-only`
   - Notes: wording matches; trailing exclamation is extra.

10. **127-130**
    - Benchmark: `Master, master`
    - Canonical: `Master, master`
    - Classification: `exact`
    - Notes: exact match.

High-level findings:
- `exact`: 2 segments (`84-86`, `127-130`)
- `punctuation-only`: 3 segments (`64-65`, `87-88`, `116-118`)
- `wording-different`: 3 segments (`68-70`, `76-78`, `80-83`)
- `line-boundary-shifted`: 2 segments (`89-94`, `94-98`)
- `timing-shifted`: 0 confirmed from this text-only audit

No confirmed timing errors were required to explain the observed differences. The main structural issue is that two segments appear to compress paired canonical lines into single benchmark entries.

---

### Task 2: Produce a benchmark delta plan to fix the gold truth

**Bead ID:** `ee-9q7y`  
**SubAgent:** `research`

**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the lyric audit is complete, prepare a precise delta plan for correcting benchmarks/fixtures/cod-test/truth/music-vocals-data.json where it differs from the real Master of Puppets lyrics. Include the exact current benchmark text, the proposed replacement text, any timing/alignment changes you recommend, and a unified-diff-style summary. Update the plan truthfully, but do not modify the benchmark file yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-audit-master-of-puppets-gold-benchmark-lyrics.md`

**Status:** ✅ Complete

**Results:**

Precise delta plan for `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`:

#### Proposed segment-level corrections

1. **64-65**
   - Current benchmark text: `Obey your master.`
   - Proposed replacement text: `Obey your master`
   - Recommended timing/alignment change: none
   - Reason: remove non-canonical terminal punctuation only.

2. **68-70**
   - Current benchmark text: `Control faster.`
   - Proposed replacement text: `Your life burns faster`
   - Recommended timing/alignment change: none
   - Reason: replace incorrect phrase with canonical lyric.

3. **76-78**
   - Current benchmark text: `Master of puppets are pulling the strings!`
   - Proposed replacement text: `Master of puppets I’m pulling your strings`
   - Recommended timing/alignment change: none
   - Reason: correct subject/verb wording and object (`your strings`), and remove non-canonical exclamation.

4. **80-83**
   - Current benchmark text: `Twisting your mind, smashing your dreams!`
   - Proposed replacement text: `Twisting your mind and smashing your dreams`
   - Recommended timing/alignment change: none
   - Reason: restore canonical conjunction `and`; remove non-canonical exclamation.

5. **84-86**
   - Current benchmark text: `Blinded by me, you can’t see a thing`
   - Proposed replacement text: no change
   - Recommended timing/alignment change: none
   - Reason: already canonical.

6. **87-88**
   - Current benchmark text: `Just call my name ’cause I’ll hear you scream`
   - Proposed replacement text: `Just call my name, ‘cause I’ll hear you scream`
   - Recommended timing/alignment change: none
   - Reason: insert canonical comma before `‘cause`.

7. **89-94**
   - Current benchmark text: `Master, master, where’s the dreams that I’ve been after?`
   - Proposed replacement text: split into two segments:
     - `Master, master`
     - `Where’s the dreams that I’ve been after?`
   - Recommended timing/alignment change: yes — split the current `89-94` window into two adjacent lyric segments instead of one merged segment.
   - Suggested alignment approach: keep the existing `89-94` span overall, but divide it at the audible phrase boundary between the repeated chant and the following question line.
   - Reason: benchmark currently collapses two canonical lines into one entry.

8. **94-98**
   - Current benchmark text: `Master, master, you promised only lies!`
   - Proposed replacement text: split into two segments:
     - `Master, master`
     - `You promised only lies`
   - Recommended timing/alignment change: yes — split the current `94-98` window into two adjacent lyric segments instead of one merged segment.
   - Suggested alignment approach: keep the existing `94-98` span overall, but divide it at the audible phrase boundary after the repeated chant.
   - Reason: benchmark currently collapses two canonical lines into one entry and adds non-canonical terminal punctuation.

9. **116-118**
   - Current benchmark text: `Obey your master!`
   - Proposed replacement text: `Obey your master`
   - Recommended timing/alignment change: none
   - Reason: remove non-canonical exclamation only.

10. **127-130**
    - Current benchmark text: `Master, master`
    - Proposed replacement text: no change
    - Recommended timing/alignment change: none
    - Reason: already canonical.

#### Recommended implementation order

1. Apply text-only fixes to the punctuation-only and wording-different segments.
2. Rework the two merged chorus/question segments (`89-94`, `94-98`) into separate entries aligned to the audible phrase boundaries.
3. Re-run any benchmark or fixture validation that assumes stable segment counts, since splitting two entries into four will likely change fixture shape and downstream expectations.

#### Unified-diff-style summary

```diff
--- a/benchmarks/fixtures/cod-test/truth/music-vocals-data.json
+++ b/benchmarks/fixtures/cod-test/truth/music-vocals-data.json
@@ vocal_segments @@
- {"start":64,"end":65,"text":"Obey your master."}
+ {"start":64,"end":65,"text":"Obey your master"}

- {"start":68,"end":70,"text":"Control faster."}
+ {"start":68,"end":70,"text":"Your life burns faster"}

- {"start":76,"end":78,"text":"Master of puppets are pulling the strings!"}
+ {"start":76,"end":78,"text":"Master of puppets I’m pulling your strings"}

- {"start":80,"end":83,"text":"Twisting your mind, smashing your dreams!"}
+ {"start":80,"end":83,"text":"Twisting your mind and smashing your dreams"}

- {"start":87,"end":88,"text":"Just call my name ’cause I’ll hear you scream"}
+ {"start":87,"end":88,"text":"Just call my name, ‘cause I’ll hear you scream"}

- {"start":89,"end":94,"text":"Master, master, where’s the dreams that I’ve been after?"}
+ {"start":89,"end":<split_a>,"text":"Master, master"}
+ {"start":<split_a>,"end":94,"text":"Where’s the dreams that I’ve been after?"}

- {"start":94,"end":98,"text":"Master, master, you promised only lies!"}
+ {"start":94,"end":<split_b>,"text":"Master, master"}
+ {"start":<split_b>,"end":98,"text":"You promised only lies"}

- {"start":116,"end":118,"text":"Obey your master!"}
+ {"start":116,"end":118,"text":"Obey your master"}
```

Open timing questions to resolve during the eventual benchmark edit:
- Exact split point inside `89-94`
- Exact split point inside `94-98`

Those are alignment decisions, not wording decisions; the wording mismatches are already clear from the canonical lyrics.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- A full audit of every benchmark vocal segment that appears to quote `Master of Puppets`
- A canonical source reference from Metallica's official site
- A segment-by-segment classification of benchmark vs. canonical lyric differences
- A precise delta plan for how to repair the benchmark later without editing the fixture yet

**Commits:**
- None; per instruction, no benchmark edits were made and nothing was pushed.

**Lessons Learned:**
- The benchmark errors are mostly manual lyric-entry drift rather than subtle transcription ambiguity.
- Two of the benchmark entries likely need structural splitting, not just text correction.
- Timing review should be limited to those split points; the rest of the observed problems are straightforward text fixes.

---

*Completed on 2026-04-06*
