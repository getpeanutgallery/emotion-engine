# Famous-song reconciliation under-removal audit

**Date:** 2026-04-27  
**Scope:** Explain why `cod-test` famous-song reconciliation removed only two dialogue lyric-contamination segments from reconciled dialogue, and propose the narrowest safe edit set for Derrick approval.  
**Status:** Audit only — no implementation, no rerun.

## Executive summary

The reconciliation gate *did* fire correctly for `Master of Puppets`. The under-removal happened later inside `reconcileDialogue()`.

Only **2 of 9 lyric-contaminated dialogue segments** were removed:

- removed: dialogue indexes **11** (`Obey your master, master.`) and **25** (`Obey your master.`)
- wrongly kept lyric contamination: dialogue indexes **12, 13, 14, 15, 16, 17, 18, 19**
  - `12` `Come crawling faster, master.`
  - `13` `Master of puppets, I'm pulling your strings.`
  - `14` `Twisting your mind and smashing your dreams.`
  - `15` `Blinded by me, you can't see a thing.`
  - `16` `Just call my name, 'cause I'll hear you scream.`
  - `17` `Master, master.`
  - `18` `Just call my name, 'cause I'll hear you scream.`
  - `19` `Master, master.`

That happened for **two distinct reasons**:

1. **The dialogue removal candidate set is seeded almost entirely from `matchedLyrics` hits.**
   - `matchedLyrics` contains only four fragments in the live artifact:
     - `Obey your master`
     - `Master of puppets I'll pull your strings`
     - `Master`
     - `Come crawling faster`
   - So dialogue indexes **14, 15, 16, 18** never even become removal candidates, despite exact or near-exact support in `music-vocals-data.json`.

2. **The spoken-signal heuristic then protects the remaining lyric candidates from each other.**
   - For indexes **12, 13, 17, 19**, the code recognizes them as lyric-like, but `hasStrongSpokenSignal()` returns true because each line has a same-speaker neighboring line with 4+ tokens that is not classified as refrain-like.
   - In the live artifact, those neighbors are **other lyric lines in the same contamination block**, so the heuristic mistakes a sung lyric run for coherent spoken dialogue.

The result is the worst of both worlds:

- the recognizer is strong enough to identify the song,
- but the reconciler is too narrow to nominate the whole lyric run,
- and too permissive in preserving same-speaker runs that are obviously part of the lyric block.

## Artifact evidence

### Gate state

From `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`:

- `status: "applied"`
- recognized song: `Master of Puppets`
- confidence: `0.93`
- `matchedLyrics`:
  - `Obey your master`
  - `Master of puppets I'll pull your strings`
  - `Master`
  - `Come crawling faster`

So this is **not** a gate-failed case. The gate passed and the bug is in dialogue removal selection/preservation.

### What the ledger shows was removed

The ledger records only:

- index `11` — `Obey your master, master.`
- index `25` — `Obey your master.`

Both were removed with direct lyric evidence.

### What remained in reconciled dialogue

`output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` still contains indexes:

- `12` `Come crawling faster, master.`
- `13` `Master of puppets, I'm pulling your strings.`
- `14` `Twisting your mind and smashing your dreams.`
- `15` `Blinded by me, you can't see a thing.`
- `16` `Just call my name, 'cause I'll hear you scream.`
- `17` `Master, master.`
- `18` `Just call my name, 'cause I'll hear you scream.`
- `19` `Master, master.`

These are the main extra-output windows driving the benchmark miss.

### Vocal transcript support exists for the kept lines

`output/cod-test/phase1-gather-context/music-vocals-data.json` contains strong direct support for the same lyric material, including:

- `Come crawling faster`
- `Master of puppets I'll pull your strings`
- `Twisting your mind and smashing your dreams`
- `Blinded by me you can't see a thing`
- `Just call my name 'cause I'll hear you scream`
- repeated `Master! Master!`

So the problem is **not lack of vocal transcript evidence**. The problem is how that evidence is allowed to participate in dialogue removal.

## Code-path diagnosis

## 1) Limited `matchedLyrics` coverage blocks half the lyric run before removal logic even starts

Relevant code:

- `buildRecognitionGate()` calls `buildLyricEvidence()` for dialogue using `matchedLyrics` as the primary phrase list.
- `reconcileDialogue()` then begins with:

```js
const evidenceHit = dialogueEvidenceHitsByOrderIndex.get(dialogueOrderIndex) || null;
const bestMatch = chooseBestLyricMatch(segment?.text, gate.matchedLyrics);
const hasStrictLyricMatch = Boolean(bestMatch && bestMatch.similarity >= MIN_DIALOGUE_LYRIC_SIMILARITY);
if (!hasStrictLyricMatch && !evidenceHit) return true;
```

That early return means a dialogue segment is never examined further unless it already has a strong `matchedLyrics` hit or a composite hit derived from `matchedLyrics` anchors.

In the live artifact, that creates dialogue evidence only for indexes:

- `11` → `Obey your master`
- `12` → `Come crawling faster`
- `13` → `Master of puppets I'll pull your strings`
- `17` → `Master`
- `19` → `Master`
- `25` → `Obey your master`

Indexes **14, 15, 16, 18** are missing from the evidence set even though each has direct 1.0-ish support in `music-vocals-data.json`.

Why composite evidence did not rescue them:

- `buildCompositeDialogueLyricHit()` requires at least one anchor from `matchedLyrics`
- the unmatched lines above mainly align to **vocal transcript phrases not present in `matchedLyrics`**
- so they never produce `evidenceHit`, and the early return keeps them untouched

## 2) The spoken-signal heuristic falsely preserves lyric candidates because lyric neighbors count as “spoken”

Relevant code:

```js
if (hasStrongSpokenSignal(dialogueSegments, index)) return true;
```

And inside `hasStrongSpokenSignal()`:

```js
return proximity <= 1 && tokenize(neighbor.text).length >= 4 && !isShortOrRefrainLike(neighbor);
```

This heuristic only checks:

- same speaker
- adjacent order index
- neighbor has 4+ tokens
- neighbor is not short/refrain-like

It does **not** check whether the neighbor itself is lyric-like.

In the live dialogue block, indexes `12-19` are all `Speaker 8`, adjacent, and many have 5-8 tokens. That means:

- `12` is protected by lyric neighbor `13`
- `13` is protected by lyric neighbor `12` or `14`
- `17` is protected by lyric neighbor `16` or `18`
- `19` is protected by lyric neighbor `18`

So once the lyric block is grouped into one speaker run, the heuristic treats the lyric cluster as evidence of spoken continuity.

## Segment-by-segment failure map

| Dialogue index | Text | Why it was kept |
| --- | --- | --- |
| `12` | `Come crawling faster, master.` | **Candidate found**, but `hasStrongSpokenSignal()` preserved it because neighboring lyric lines from the same speaker look like coherent speech under the current heuristic. |
| `13` | `Master of puppets, I'm pulling your strings.` | **Candidate found**, but again preserved by the same-speaker spoken-signal heuristic. |
| `14` | `Twisting your mind and smashing your dreams.` | **Never became a candidate** because no strong `matchedLyrics` hit and no composite hit, even though a direct vocal segment matches exactly. |
| `15` | `Blinded by me, you can't see a thing.` | Same as `14`: **never became a candidate** despite direct vocal-text support. |
| `16` | `Just call my name, 'cause I'll hear you scream.` | Same as `14`: **never became a candidate** despite direct vocal-text support. |
| `17` | `Master, master.` | **Candidate found**, but preserved by the same-speaker spoken-signal heuristic. |
| `18` | `Just call my name, 'cause I'll hear you scream.` | Same as `14`: **never became a candidate** despite direct vocal-text support. |
| `19` | `Master, master.` | **Candidate found**, but preserved by the same-speaker spoken-signal heuristic. |

## Root cause ranking

1. **Limited `matchedLyrics` coverage** — primary cause  
   This is the biggest reason the lyric run under-removes. Four live contamination lines (`14, 15, 16, 18`) are excluded before the later safety checks even run.

2. **Spoken-signal heuristic** — co-primary practical blocker  
   This is why the remaining recognized lyric candidates (`12, 13, 17, 19`) still survive. The heuristic is preserving lyric neighbors as if they were spoken support.

3. **Direct-vocal-text support behavior** — secondary architectural cause  
   The code already computes direct vocal support, but only *after* a dialogue segment has already passed the `matchedLyrics`/`evidenceHit` gate. So direct vocal support exists but cannot promote unmatched lyric lines into candidates.

4. **Other: no lyric-run propagation / no contamination-cluster handling** — secondary  
   There is no narrow “same low-confidence lyric run adjacent to already-confirmed lyric contamination” expansion step. That makes the reconciler brittle when `matchedLyrics` is sparse.

5. **Vocal-index proximity** — low impact here  
   This did **not** cause the live under-removal. The lines blocked by spoken-signal already had nearby vocal evidence, and index `25` was removed even without nearby vocal index support because direct vocal text support was enough.

## Narrowest safe change set

The safest fix is **not** “remove any dialogue that matches any vocal line.” That would be too broad. The narrow fix should only expand removals inside a recognized-song, low-confidence lyric-contamination run.

### Proposed edit set

#### Edit 1 — Promote strong vocal-text matches into dialogue removal candidates, but only under the recognized-song gate

**File:** `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

**Change direction:** inside `reconcileDialogue()` around the current early-return candidate gate.

**Current behavior:**
- a dialogue segment is considered only if it already matches `gate.matchedLyrics` strongly or has a `dialogueLyricEvidence` hit

**Proposed behavior:**
- compute `bestVocalMatch` **before** the early return
- allow a segment to continue into the removal logic when all of the following are true:
  - gate already passed
  - segment is low confidence (`<= 0.96` under current rule)
  - `bestVocalMatch.similarity >= MIN_GATE_LYRIC_TEXT_SIMILARITY`
  - and either:
    - the segment is within `MIN_DIALOGUE_INDEX_PROXIMITY` of a vocal evidence index, **or**
    - an adjacent dialogue segment already has strict lyric evidence / `evidenceHit`

**Why this is safe:**
- it only activates after a strong recognized-song gate
- it still requires strong direct vocal-text support
- it keeps the proximity/adjacency fence so we do not suddenly remove arbitrary spoken lines elsewhere in the trailer

**Implementation note:** represent this as a fallback evidence object, e.g. `evidenceType: 'direct_vocal_support'`, so the ledger records why a segment was removed.

#### Edit 2 — Prevent lyric-like neighbors from counting as “strong spoken signal”

**File:** `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

**Change direction:** refine `hasStrongSpokenSignal()` so it can reject neighbors that are themselves lyric-like.

**Current behavior:**
- any same-speaker adjacent 4+ token line that is not short/refrain-like counts as spoken support

**Proposed behavior:**
- pass contextual inputs into `hasStrongSpokenSignal()` so it can see whether a neighbor has:
  - a strict `matchedLyrics` match,
  - direct vocal-text support above `MIN_GATE_LYRIC_TEXT_SIMILARITY`, or
  - fallback lyric evidence selected under Edit 1
- if a neighbor is lyric-like by those checks, **do not** let it count as spoken support

**Why this is safe:**
- it does not delete anything by itself
- it only stops obviously lyric-like neighbors from shielding each other
- genuine same-speaker spoken context still works for nearby non-lyric lines

#### Edit 3 — Preserve current safety fences

Keep these rules unchanged unless implementation proves otherwise:

- recognized-song gate requirements
- high-confidence preservation for non-short segments
- no rewriting of `music-vocals-data.reconciled.json`
- removal still requires lyric evidence plus either nearby-vocal or direct-vocal support

This keeps the patch narrow and avoids scope drift into transcript rewriting or broader prompt work.

## Exact proposed test additions/changes

**File:** `test/scripts/reconcile-famous-song-phase1.test.js`

### Add test 1 — removes the full cod-test-style lyric run, not just the first anchor lines

Add a new fixture-style test modeled on the live artifact:

- dialogue indexes `11-19` plus `25`
- `matchedLyrics` only includes:
  - `Obey your master`
  - `Master of puppets I'll pull your strings`
  - `Master`
  - `Come crawling faster`
- vocal segments include direct transcript support for:
  - `Twisting your mind and smashing your dreams`
  - `Blinded by me you can't see a thing`
  - `Just call my name 'cause I'll hear you scream`
- expect reconciled dialogue to remove **all lyric-contamination lines in that run**, not just indexes `11` and `25`
- assert ledger evidence includes at least one removal with `evidenceType: 'direct_vocal_support'` (or the exact name chosen in implementation)

### Add test 2 — lyric-like neighbors must not trigger spoken-signal preservation

Add a focused unit/integration test where:

- three same-speaker dialogue lines appear consecutively
- the middle and neighboring lines are lyric-contaminated
- all are low confidence
- neighbors are long enough to satisfy the old spoken-signal heuristic

Expected result:
- the middle candidate is **not** preserved just because the neighbors are same-speaker lyric lines
- ledger should show removal rather than silent preservation

### Add test 3 — keep a real spoken line adjacent to lyric contamination

Add a regression safety test where:

- a real spoken sentence by the same speaker sits next to a lyric-contaminated line
- the spoken sentence does **not** have strong direct vocal-text support
- the lyric line does

Expected result:
- lyric line is removed
- spoken line remains

This is the safety test that proves Edit 2 is narrow rather than aggressive.

### Update expectations in existing tests only if evidence metadata changes

If the implementation adds a new ledger evidence type such as `direct_vocal_support`, update assertions in existing tests to allow the more specific evidence object where appropriate, but do **not** broaden the behavioral expectations beyond the three tests above.

## Recommended approval-ready patch strategy

If Derrick approves, the implementation pass should:

1. update `reconcileDialogue()` first
2. add the new focused tests before/with the code change
3. avoid touching gate thresholds unless the new tests prove a threshold issue remains
4. avoid changing `reconcileMusicVocals()` entirely

## Files referenced

- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

## Conclusion

The live under-removal is not a recognition failure. It is a reconciliation-selection failure:

- **sparse `matchedLyrics` leaves half the lyric block invisible**, and
- **the spoken-neighbor heuristic shields the rest**.

The narrowest safe fix is to:

- let strong direct vocal-text support promote low-confidence dialogue lines into candidate status inside an already-recognized-song lyric cluster, and
- stop lyric-like same-speaker neighbors from counting as “spoken signal.”
