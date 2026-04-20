# COD test famous-song reconciliation QA verification

**Date:** 2026-04-20  
**Role:** QA verification for bead `ee-l3s6`  
**Scope:** Verify that the post-fix reconciliation artifacts for the live `output/cod-test/phase1-gather-context` leakage case differ meaningfully from the raw artifacts, and that the rewrite is scoped rather than overcorrected.

---

## Files inspected

- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`

---

## QA verdict

**Pass.** The reconciliation fix is active on the leakage case and now produces a materially different reconciled surface without broad overcorrection.

---

## What changed materially

### 1) Reconciliation ledger is now applied

In `famous-song-reconciliation.json`:

- `status` = `"applied"`
- `trigger.reasons` = `[]`

That means the reconciliation step did not merely route benchmark consumers toward `*.reconciled.json`; it actually authorized and recorded a real rewrite on this run.

### 2) Dialogue raw vs reconciled are no longer byte-identical

Artifact hashes differ:

- `dialogue-data.json` SHA-256 = `e96a9f34b700b1275bc097f49b1867ffba1b6f5550b2c7aaa8af1e27c79de6f8`
- `dialogue-data.reconciled.json` SHA-256 = `596f37d514cf934ff51412ed6d09f4f566e7f9b37c37966c18d39bb39faa85ed`

Counts differ as well:

- raw dialogue segments: `18`
- reconciled dialogue segments: `17`

The only dialogue segment removed is former segment `11`.

Removed raw segment `11` text:

> Obey your master... Master... Just call me faster... Master... Master... The master's puppet's a puppet's brain... Twisting your mind, smashing your day... Blinding from me, you can't see... Just go ahead, it's all in your head... Master, master... Plans and dreams are now in the after... Master, master... You'll be in my grasp...

All surviving dialogue segments remain otherwise unchanged. This is a targeted removal, not a broader rewrite of the dialogue lane.

### 3) The removed dialogue segment is explicitly justified by composite anchor evidence

`famous-song-reconciliation.json` records the removed entry under `decisions.removedDialogueSegments[0]` with:

- `index` = `11`
- `reason` = `"likely_lyric_contamination"`
- `evidence.evidenceType` = `"composite_anchor_bundle"`

The recorded anchor bundle is consistent with the observed leakage shape. It includes support from:

- vocal phrase `Blinded by me, you can't see a thing`
- vocal phrase `Twisting your mind and smashing your dreams`
- vocal phrase `Obey your master!`
- matched lyric `I'll be your master`
- matched lyric `Master, master`

So the removal is not a silent disappearance; it is ledger-backed and attributable to the new anchored contamination evidence path.

### 4) Music-vocals reconciled reflects one permitted correction only

Artifact hashes differ slightly:

- `music-vocals-data.json` SHA-256 = `a5e67216508070686324fa3b4b7fee01144546d0c9bcf9188d80ad55167bb623`
- `music-vocals-data.reconciled.json` SHA-256 = `6c3959b638b5c19a81aa65f5abea813b004c00b7267f39c992751c6f9e258997`

But the segment count stays stable:

- raw vocal segments: `14`
- reconciled vocal segments: `14`

Observed segment-level delta:

- vocal segment `4`
  - raw: `Obey your master!`
  - reconciled: `I'll be your master`

No other vocal segment changed.

This matches the ledger under `decisions.lyricCorrections`, which contains exactly one correction:

- `index` = `4`
- `from` = `Obey your master!`
- `to` = `I'll be your master`
- `reason` = `recognized_song_near_miss`

### 5) Skipped corrections stayed skipped

The ledger still records non-applied entries under `decisions.skippedCorrections` for vocal segment indexes:

- `3`
- `5`
- `8`
- `9`
- `10`
- `12`

Those segments remain unchanged in `music-vocals-data.reconciled.json`, confirming the fix did **not** overcorrect the rest of the song lane.

---

## What stayed stable

- The reconciliation change did **not** rewrite the remaining 17 dialogue segments.
- The music-vocals lane kept the same total segment count (`14`).
- Only one vocal text normalization was applied.
- Previously skipped corrections remained skipped instead of being force-normalized.

This is the behavior we want from QA’s perspective: the fix is active and meaningful, but still constrained.

---

## Auditor handoff for bead `ee-gz79`

Recommended next checks:

1. Re-run the relevant comparator surfaces against the now-materially-different reconciled artifacts.
2. Confirm benchmark evidence now reflects the intended dialogue-vs-music-vocals split rather than scoring the leaked dialogue mashup.
3. Validate that any remaining benchmark red is an honest comparator/truth issue, not another reconciliation skip.

Concrete facts established by QA and ready for audit:

- reconciliation ledger status is `applied`
- raw vs reconciled dialogue are no longer byte-identical
- former dialogue segment `11` is removed from reconciled dialogue
- the removal is justified by `evidenceType = "composite_anchor_bundle"`
- music-vocals reconciled applies exactly one correction at segment `4`
- skipped corrections remain unchanged, so the lane is not overcorrected
