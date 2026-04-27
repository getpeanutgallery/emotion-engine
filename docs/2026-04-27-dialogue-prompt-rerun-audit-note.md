# Dialogue rerun audit note after anti-omission prompt revision

Date: 2026-04-27
Bead: ee-l0l5
Related plan: `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

## Verdict

The regression is real, artifact-backed, and attributable to the prompt change broadening false-positive capture more than it improved weak-line recall. The rerun did **not** recover `You shall know fear.` and **did** materially worsen the canonical dialogue benchmark.

## Evidence checked

Compared current rerun artifacts against the tracked pre-rerun baseline at `HEAD`:

- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `git show 8ce05b6 -- server/scripts/get-context/get-dialogue.cjs test/scripts/get-dialogue.test.js`

## Findings

### 1) The regression is real, not report noise

Concrete before/after movement from the tracked baseline to the rerun:

- `dialogue_text_full_transcript_pct`: `90.7 -> 66.5`
- `dialogue_text_windowed_pct`: `90.7 -> 67.2`
- `dialogue_boundary_pct`: `0.0 -> 0.0`
- `output_segment_count`: `17 -> 25`
- `split_event_count`: `1 -> 3`
- `extra_output_window_count`: `0 -> 6`

The critical missed-line window did **not** improve:

- truth indexes `[8,9,10]` still align to output `[8]`
- `text_similarity_pct` stays `56.3`
- the output still jumps from `A lot of people counting on us for answers.` to `This isn't real.`
- truth `You shall know fear.` remains absent

So this is not scoring jitter. The canonical artifacts show both unchanged omission at the target spot and new extra-output damage elsewhere.

### 2) The new wording plausibly explains the lyric-heavy extras

The revision did not just add anti-omission guidance. It also made the inclusion rule much more permissive in lyric-adjacent conditions:

- `Include audibly supported spoken dialogue and dialogue-like vocal material ...`
- `Do not drop or trim audibly supported spoken words merely because ... a phrase might also resemble lyrics.`
- `If classification is ambiguous, preserve the line ... rather than suppressing it.`
- `Reconciliation happens later; do not act as the final filter ...`

That combination plausibly shifts the model from conservative omission to aggressive retention of any speech-like/lyric-like vocal phrase in the score-heavy section. The rerun artifacts match that exact failure mode:

- `Come crawling faster, master.`
- `Master of puppets, I'm pulling your strings.`
- `Twisting your mind and smashing your dreams.`
- `Blinded by me, you can't see a thing.`
- repeated `Just call my name, 'cause I'll hear you scream.` / `Master, master.`

Notably, the pre-rerun baseline already had one large lyric hallucination blob in raw capture, but the rerun turned that into many retained windows that now score as six explicit `extra_output` events. So the change appears to have widened retention/segmentation of lyric-like material rather than fixing the original omission.

### 3) Yes: the change failed to recover the target line while broadening false positives

Both claims are true in the artifacts:

- `You shall know fear.` is still missing in current output/reconciled output and in the benchmark alignment.
- false-positive capture is broader and more damaging than before, with `output_segment_count` rising by 8 and `extra_output_window_count` rising from `0` to `6`.

This is the worst combination for the stated goal: no gain on the target omission, plus a large regression in surrounding fidelity.

## Likely cause

The anti-omission fix was directionally correct on weak-line retention, but it coupled that goal to a broader "preserve ambiguous vocal material" policy in a lyric-heavy, score-backed region.

The strongest likely cause is the combination of:

1. broadened scope from `intelligible` to `audibly supported spoken ... or dialogue-like vocal material`
2. explicit instruction not to suppress lines that might resemble lyrics
3. ambiguity resolution that prefers keeping the line
4. runtime acceptance of the first schema-valid JSON without a model-visible coverage or false-positive guardrail

That combination makes the model more willing to keep lyric-like fragments, but it still does not force recovery of the very specific weak line `You shall know fear.`

## Recommendation

Best next step: **combination approach**.

### Immediate safety move

Restore the pre-rerun prompt behavior as the stable baseline **or otherwise back out the broadened lyric-tolerant scope wording before another canonical rerun**. The current revision is not shippable as-is.

### Then do a narrower follow-up revision

Keep the narrow recall-oriented idea, but constrain it tightly to weak spoken inserts rather than ambiguous lyric-like vocals. In practice, the next prompt revision should:

- keep the anti-absorption / weak-insert language
- keep the low-confidence-is-allowed language
- remove or tighten the broad `dialogue-like vocal material` / `might also resemble lyrics` preservation framing
- make the exception specifically about short weak spoken lines between stronger nearby spoken lines, not about preserving ambiguous sung/lyric-like phrases generally

### Add a validator/runtime guardrail before accepting output

Prompt-only tuning is too fragile here. Add a cheap runtime guardrail that rejects or re-prompts when dialogue capture suddenly expands in lyric-heavy sections. Examples:

- detect bursts of consecutive lyric-like segments in dialogue output
- flag large dialogue segment count growth versus expected baseline for the asset
- flag repeated rhyme/chorus patterns or repeated `master/master`-style refrain capture inside dialogue
- optionally run a post-pass that asks the model to justify whether ambiguous retained vocal lines are spoken dialogue versus song lyrics before final acceptance

## Bottom line

- The regression is real.
- The target omission stayed unfixed.
- The prompt change plausibly caused the lyric-heavy extras.
- The best next step is **not** a simple keep-going prompt tweak on top of this result.
- Recommended path: **revert the broadened scope behavior, then design a narrower weak-line prompt revision plus a validator/runtime guardrail.**
