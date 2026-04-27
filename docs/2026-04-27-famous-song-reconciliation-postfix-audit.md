# Audit note: post-fix cod-test rerun after generic recognized-song reconciliation change

**Date:** 2026-04-27  
**Scope:** Independent audit of the rerun after commit `eb4cc6a` (`Fix generic recognized-song dialogue reconciliation`).

## Verdict

The improvement is real.

This was not report noise or a scoring-surface artifact. The reconciled dialogue artifact itself is materially cleaner because the fixer now removes five lyric-contamination lines that survived the prior rerun.

## What improved in the actual artifacts

### Current reconciled dialogue state

From `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, the famous-song block was reduced from a long lyric burst to only three surviving lyric lines:

- removed from reconciled dialogue: indexes `13`, `14`, `18`, `19`, `20`
  - `Obey your master`
  - `Come crawling faster`
  - `Just call my name, 'cause I'll hear you scream`
  - `Master, master`
  - `Just call my name, 'cause I'll hear you scream`
- still surviving: indexes `15`, `16`, `17`
  - `Master of puppets, I'm pulling your strings`
  - `Twisting your mind and smashing your dreams`
  - `Blinded by me, you can't see a thing`

That matches the current ledger in `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`, which records exactly those five removals.

### Score movement supported by the artifact change

The benchmark numbers moved in the same direction as the artifact cleanup:

- pre-fix failed rerun: `dialogue_text_full_transcript_pct=66.5`, `dialogue_text_windowed_pct=67.2`, `extra_output_window_count=6`
- post-fix rerun: `dialogue_text_full_transcript_pct=81.3`, `dialogue_text_windowed_pct=81.7`, `extra_output_window_count=1`

Given that the post-fix artifact literally removes five extra lyric outputs from the dialogue surface, this is genuine reconciliation improvement, not bookkeeping noise.

## Did it improve the right thing without hurting real speech?

Yes.

The lines removed are all lyric contamination and they correspond directly to the recognized `Master of Puppets` vocal transcript.

I did not find evidence that legitimate nearby spoken lines were wrongly deleted. In the same local region, these spoken lines remain present in `dialogue-data.reconciled.json`:

- `This isn't real.`
- `The hell it ain't!`
- `Pull it together, man.`
- `So eager to leave, David.`
- `Killing the man is a hell of a lot easier than killing the idea.`
- `You were never cut out to be a Mason.`

So the fix improved the intended failure mode: lyric contamination removal.

## Why the remaining lyric lines still survive

The remaining survivors are explained by a narrow limitation in the new generic logic, not by benchmark randomness.

The current recognized-song gate only surfaces two native lyric anchors in the live ledger:

- `Master, master`
- `Obey your master`

Commit `eb4cc6a` added fallback promotion for strong direct vocal-text matches, but only when the unmatched line is:

- near vocal evidence, or
- adjacent to a dialogue neighbor that already has existing lyric evidence

In this live artifact, that lets the fix promote only the first-hop neighbors of anchored lines:

- `14` is promoted because it sits next to anchored `13`
- `18` and `20` are promoted because they sit next to anchored `19`

But the surviving middle trio `15`, `16`, `17` are not themselves matched by the sparse recognized-song anchor list, and their immediate neighbors are only direct-vocal-support promotions rather than native anchor/evidence hits. Because `hasAdjacentLyricEvidence()` currently checks only `hasExistingLyricEvidence`, the promotion does not chain through the whole low-confidence lyric run.

So the current fix is effectively a one-hop expansion from sparse anchors, not full cluster propagation.

## Recommendation

Stop here on this generic reconciliation lane and move back to the weak-line issue.

Why:

- the generic fix already recovered most of the score loss from under-removal
- the current artifact now has only three surviving lyric lines instead of the larger contaminated run
- the remaining dialogue miss surface is no longer dominated by reconciliation failure alone
- `You shall know fear.` is still missing, and that spoken-line omission remains a cleaner next target with less false-positive risk than broadening lyric removal again

If this reconciliation lane is revisited later, the next step should be a very narrow follow-up: allow cluster-local propagation across contiguous low-confidence direct-vocal-supported lyric runs after the recognized-song gate passes. But I would not make that the next task now.
