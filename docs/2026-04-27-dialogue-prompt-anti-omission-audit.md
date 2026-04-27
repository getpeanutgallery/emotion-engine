# Dialogue prompt anti-omission audit

Date: 2026-04-27
Status: Draft recommendation for approval
Related plan: `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

## Scope

Audit the current live cod-test dialogue prompt/runtime for wording that could suppress weak-but-real spoken lines such as `You shall know fear.`. No prompt implementation or rerun was performed.

## Artifacts reviewed

- Plan: `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`
- Draft prompt: `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`
- Live prompt/runtime: `server/scripts/get-context/get-dialogue.cjs`
- Raw accepted capture: `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Runtime dialogue outputs: `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.json`, `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- Benchmark truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Benchmark report: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- Benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

## Findings

### 1) Yes: current wording still over-rewards omission under uncertainty

The live prompt in `server/scripts/get-context/get-dialogue.cjs` contains strong anti-hallucination language, but it still frames inclusion too narrowly around intelligibility:

- `If no intelligible dialogue or dialogue-like vocal material is present, return an empty dialogue_segments array.`
- `Scope rules:` → `Include intelligible spoken dialogue.`

Those lines conflict with the otherwise good damaged-speech rules:

- `When speech is partially masked, clipped, distant, distorted, or overlapped, prefer a short literal fragment of what is actually audible.`
- `If only part of a line is supported by the audio, return only that supported fragment.`

Problem: a weak but real line can be audible enough to preserve as a fragment while still feeling less than fully “intelligible.” In practice, the prompt gives the model two competing instincts:

- preserve weak audible fragments
- but only include intelligible dialogue

That conflict biases toward dropping a faint line instead of keeping a low-confidence fragment.

### 2) The main merge risk is not explicit merge wording; it is weak-line absorption into stronger nearby lines

The prompt’s explicit segmentation guidance is mostly good and already anti-merge:

- `Do not merge adjacent beats...`
- `Do not bridge across silence...`
- `Preserve utterance ordering...`

So the prompt is not directly telling the model to merge. The issue is subtler: nothing explicitly says that a short weak line between two stronger lines must still survive as its own segment when it is audibly present.

That gap matters in cod-test. The benchmark summary shows a three-truth-to-one-output collapse at the relevant spot:

- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `truth_indexes: [8, 9, 10]`
- `output_indexes: [8]`
- `boundary_status: "merge"`
- `text_similarity_pct: 56.3`

And the report shows the missing middle line directly:

- Truth `dialogue_segments[9].text`: `You shall know fear.`
- Output aligned at that slot: `This isn't real.`

So the weak line was not preserved as its own uncertain segment; it was effectively skipped and the timeline moved on.

### 3) Yes: current confidence wording can be read as “omit unless confident enough”

Current confidence rules are good for calibration but incomplete for recall:

- `Use conservative confidence values.`
- `Lower confidence materially when speech is short, masked, clipped...`
- `Do not use near-certain scores unless the words and the speaker match are both strongly supported...`

What is missing is an explicit counterweight:

- low confidence is acceptable
- uncertainty should lower confidence, not suppress a supported fragment

Without that sentence, models often convert `be conservative` into `exclude borderline material`.

### 4) Nearby runtime behavior also fails to pressure recovery of weak omissions

The cod-test live run used the lean local-validator loop:

- `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md` says `the first valid JSON is accepted immediately`
- `server/scripts/get-context/get-dialogue.cjs` runs dialogue transcription with `runtimeStyle: 'lean'`
- `server/lib/phase1-validator-tools.cjs` returns success when the JSON is schema-valid: `JSON is valid. The validator returned valid=true. Return the final JSON artifact with no wrapper.`

That means the runtime checks shape, not coverage or weak-line retention. In the captured cod-test attempt, the accepted first-turn artifact already omitted `You shall know fear.` and was accepted without any model-visible pressure to revisit faint/filtered lines:

- `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

Important nuance: there are merge helpers in `server/scripts/get-context/get-dialogue.cjs` (`mergeAdjacentDialogueSegments`, `repairBoundaryContinuationSpeakerDrift`), but they are not the main cause of this specific cod-test miss. The accepted whole-asset raw capture already omitted the line before downstream reconciliation. So the first fix should be prompt wording, not those helpers.

## Answers to Derrick’s four questions

### 1. Is any current wording likely to over-reward omission under uncertainty?

Yes.

Highest-risk wording:

- `Include intelligible spoken dialogue.`
- `If no intelligible dialogue or dialogue-like vocal material is present...`

These are too strict when paired with partially masked / filtered / distorted speech. They should be reframed around **audibly supported spoken words or fragments**, not only “intelligible” lines.

### 2. Is any wording likely to encourage aggressive merging of weak adjacent speech into stronger surrounding lines?

Indirectly yes, but not because the prompt says “merge.”

The current prompt does not explicitly instruct:

- if a short weak line occurs between stronger lines, keep it as its own segment when audibly present
- do not let uncertainty about speaker or full wording cause that weak line to be absorbed into surrounding segments

That omission leaves room for models to smooth the local sequence by skipping the weak insert and continuing with the next clearer line.

### 3. Is any wording likely to require too much confidence before preserving a faint/filtered spoken line?

Yes.

The confidence section strongly emphasizes caution, but never explicitly says:

- low-confidence retention is preferred over omission when some spoken words are genuinely audible

That missing sentence is the narrowest high-value fix.

### 4. What exact prompt edits would reduce omission risk without inviting hallucinations?

Recommended approach:

- keep the existing anti-hallucination and anti-reconstruction rules
- replace `intelligible`-only scope language with `audibly supported spoken words or fragments`
- add one explicit anti-omission rule that says uncertainty lowers confidence rather than suppressing a weak line
- add one explicit anti-absorption rule for short weak inserts between stronger lines

## Proposed replacement wording for approval

### A. Replace the scope opening

Current:

```text
- Include intelligible spoken dialogue.
```

Proposed:

```text
- Include audibly supported spoken dialogue, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable.
```

### B. Replace the empty-output rule

Current:

```text
- If no intelligible dialogue or dialogue-like vocal material is present, return an empty dialogue_segments array.
```

Proposed:

```text
- Return an empty dialogue_segments array only when no audibly supported spoken words or spoken fragments are present.
```

### C. Add an explicit anti-omission rule to damaged-speech rules

Add:

```text
- If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.
- When deciding between omitting a weak spoken line and keeping a short supported fragment with low confidence, prefer the supported fragment.
```

### D. Add an explicit anti-absorption rule to segmentation rules

Add:

```text
- Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.
- A brief audible insert between stronger surrounding lines should stay as its own segment when the insert itself is audibly supported, even if its confidence is low.
```

### E. Add an explicit confidence counterweight

Add to confidence rules:

```text
- Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.
```

## Proposed revised prompt snippet

This is the minimal snippet I’d recommend Derrick approve/reject directly:

```text
Rules:
- Return JSON only. No markdown. No explanation.
- Preserve dialogue segment chronology via array order/index values.
- start/end timestamps are optional and should be included only when directly supportable from the audio.
- If no audibly supported spoken words or spoken fragments are present, return an empty dialogue_segments array.

Segmentation rules:
- Preserve real utterance boundaries.
- Do not merge adjacent beats just because they are semantically related, grammatically compatible, or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if combining them would read more smoothly.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Preserve utterance ordering from the source audio; do not pull later lines earlier or compress dialogue into earlier entries.
- Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.
- A brief audible insert between stronger surrounding lines should stay as its own segment when the insert itself is audibly supported, even if its confidence is low.

Damaged-speech rules:
- When speech is partially masked, clipped, distant, distorted, reverberant, filtered, synthetic-sounding, or overlapped, prefer a short literal fragment of what is actually audible.
- Preserve damaged speech as heard.
- Do not smooth a damaged line into a cleaner full sentence.
- Do not borrow missing words from neighboring beats, scene context, likely script memory, or semantic expectation.
- If only part of a line is supported by the audio, return only that supported fragment.
- If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.
- When deciding between omitting a weak spoken line and keeping a short supported fragment with low confidence, prefer the supported fragment.

Confidence rules:
- Use conservative confidence values.
- Confidence must reflect both transcription certainty and speaker-assignment certainty.
- Lower confidence materially when speech is short, masked, clipped, overlapped, stylized, distant, noisy, filtered, reverberant, or speaker attribution is ambiguous.
- Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.
- Do not use near-certain scores unless the words and the speaker match are both strongly supported by the audio.
- Do not signal certainty you did not earn from the audio.

Scope rules:
- Include audibly supported spoken dialogue, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable.
- Exclude purely instrumental or non-vocal sections.
- Do not drop or trim audibly supported spoken words merely because musical score is present underneath, the delivery has melodic contour, or the phrase might also resemble lyrics.
- If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.
```

## Recommendation

Approve a narrow live-prompt revision built from the snippet above before any rerun.

Why this is narrow enough:

- it does not weaken the anti-hallucination guardrails
- it does not reopen the broader split/merge scoring debate
- it directly targets the failure mode shown in cod-test: a weak real line getting skipped between stronger surrounding lines

## Bottom line

The current prompt is close, but it still contains an omission-biased contradiction:

- damaged-speech rules say to preserve weak audible fragments
- scope/intelligibility framing still implies “keep only clearly intelligible speech”

For `You shall know fear.` specifically, the next best move is not a broad prompt rewrite. It is a narrow wording change that explicitly says:

- weak real spoken fragments still count
- low confidence is acceptable
- do not absorb short weak lines into clearer neighbors
