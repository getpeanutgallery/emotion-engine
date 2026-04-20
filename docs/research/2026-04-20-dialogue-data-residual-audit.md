# cod-test dialogueData residual audit after reconciliation fix

Date: 2026-04-20  
Auditor: Cookie 🍪

## Scope

This note audits the **remaining `dialogueData` benchmark residuals only** after the famous-song reconciliation fix. It separates the live failures into:

1. transcript text drift
2. summary-contract drift
3. other contract mismatch

Reviewed artifacts/code:

- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `server/lib/benchmark-runner.cjs`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/structured-output.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `docs/research/2026-04-20-cod-benchmark-postfix-dialogue-vs-vocals-audit.md`

## Current benchmark posture

Live report facts from `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`:

- status: `error`
- scoreable pass rate: `19/39`
- mismatch classes:
  - `deferred_contract_drift`: `2`
  - `reconciled_post_processing_contract_mismatch`: `95`
- comparison boundary:
  - `comparisonMode = phase1-dialogue-provisional`
  - `outputSurface = reconciled`
  - `truthSurface = provisional-truth`
  - deferred paths are only:
    - `$.cleanedTranscript`
    - `$.speaker_profiles`
    - `$.handoffContext`

That posture matters: only those three paths are currently tolerated as provisional/deferred. Everything else on the reconciled output surface is still treated as a real mismatch.

## Residual categories

### 1) Transcript text drift — **19 scoreable failures**

This bucket contains every scoreable `dialogue_segments` failure except the top-level `summary` mismatch.

Breakdown:

- `1` structural failure
  - `dialogue_segments` array length mismatch: truth `20` vs output `17`
- `15` text mismatches on aligned segment pairs
  - `dialogue_segments[truth=0,output=0].text`
  - `dialogue_segments[truth=1,output=1].text`
  - `dialogue_segments[truth=2,output=2].text`
  - `dialogue_segments[truth=3,output=3].text`
  - `dialogue_segments[truth=4,output=4].text`
  - `dialogue_segments[truth=5,output=5].text`
  - `dialogue_segments[truth=7,output=7].text`
  - `dialogue_segments[truth=9,output=9].text`
  - `dialogue_segments[truth=10,output=10].text`
  - `dialogue_segments[truth=12,output=11].text`
  - `dialogue_segments[truth=13,output=12].text`
  - `dialogue_segments[truth=14,output=13].text`
  - `dialogue_segments[truth=15,output=14].text`
  - `dialogue_segments[truth=16,output=15].text`
  - `dialogue_segments[truth=17,output=16].text`
- `3` unmatched truth segments
  - `dialogue_segments[truth=11]`
  - `dialogue_segments[truth=18]`
  - `dialogue_segments[truth=19]`

#### What the drift actually is

This is not one uniform text-quality problem. It is a **segment-shape/alignment problem with a few genuine wording drifts mixed in**.

Observed transcript deltas in `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`:

- truth segment `0` is split into two runtime segments:
  - truth: `They want you afraid. Fear makes you easier to control.`
  - output `0`: `They want you afraid.`
  - output `1`: `Fear makes you easier to control.`
- truth segments `4` and `5` are merged into one runtime segment:
  - truth `4`: `Menendez is a terrorist.`
  - truth `5`: `We're bringing peace and security to the world.`
  - output `5`: `Menendez is a terrorist. We're bringing peace and security to the world.`
- truth segment `7` has a real wording drift:
  - truth: `Stop looking backwards, David. What matters is what we do next.`
  - output: `Stop looking backwards, David, but matters is what we do next.`
- the comms block is missing in the runtime transcript where truth expects:
  - truth `9`: `You shall know fear.`
  - truth `10`: `Specter one, report.`
  - truth `11`: `Need a sitrep.`
  - output jumps directly to `This isn't real.` / `The hell it isn't!`
- the tail content is present but shifted after the missing comms block:
  - output `15`: `No more games. This ends now.`
  - output `16`: `Get the Reznov challenge pack when you pre-order now.`
  - but the comparator aligns those outputs to truth `16` and `17`, leaving truth `18` and `19` unmatched

#### Why the comparator cascades after one miss

The report alignment for `dialogue_segments` is `strategy: time-aware-segments`, but all overlap/timing fields are `null` in the emitted alignment record. The runtime dialogue artifact has its segment timing stripped in `server/scripts/get-context/get-dialogue.cjs:598-615` and again the reconciled artifact stays timing-free, so the benchmark effectively falls back to near-index alignment.

Relevant surfaces:

- `server/scripts/get-context/get-dialogue.cjs:598-615` — `stripDialogueSegmentTiming(...)`
- `server/scripts/get-context/get-dialogue.cjs:2056-2070` — writes `dialogue-data.json` and `dialogue-v3-source-truth.json` after timing is stripped
- `server/lib/benchmark-runner.cjs:1578-1605` — array comparison/alignment flow
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` — alignment record confirms null timing overlap data

#### Most likely responsible surfaces

Primary upstream surfaces for coder bead `ee-tzlr`:

1. `server/scripts/get-context/get-dialogue.cjs`
   - segment splitting/merging behavior in the final dialogue artifact
   - missing comms lines (`You shall know fear.`, `Specter one, report.`, `Need a sitrep.`)
   - wording drift (`but matters` / `ain't` vs `isn't` / `idea` vs `the idea` / promo punctuation)
2. `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
   - verify the reconciliation step is not collapsing or preserving stale segment grouping that worsens the downstream index shift
3. `server/lib/benchmark-runner.cjs`
   - only as a secondary surface if the product intentionally remains timing-free; otherwise a single upstream missing/merged line keeps cascading into the tail

### 2) Summary-contract drift — **1 scoreable failure**

Failing field:

- `summary` — `Normalized strings differed`

Truth summary (`benchmarks/fixtures/cod-test/truth/dialogue-data.json`):

> `Human-reviewed spoken dialogue only for the cod-test trailer: tense trailer VO, antagonist taunts, squad chatter, filtered comms, and the closing promo read. Lyrics and chants remain in music-vocals-data.json.`

Runtime summary (`output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` and `dialogue-v3-source-truth.reconciled.json`):

> `A dramatic trailer featuring multiple voices discussing themes of fear, control, terrorism, and personal conflict, interspersed with song lyrics and concluding with a promotional message for a game pre-order.`

#### Why this is a summary-contract problem, not a transcript problem

The summary is still describing the old mixed-content interpretation:

- it explicitly says `interspersed with song lyrics`
- truth now requires a spoken-dialogue-only summary boundary and explicitly says lyrics/chants belong in `music-vocals-data.json`
- reconciliation removes the leaked lyric mashup from the dialogue lane, but the summary text is simply carried forward rather than rewritten to the cleaned contract

Relevant surfaces:

- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:676-683` — preserves `dialogueData.summary` verbatim after reconciliation
- `server/scripts/get-context/get-dialogue.cjs:2009-2022` — whole-asset summary is preserved into final dialogue data
- `server/scripts/get-context/get-dialogue.cjs:2061-2070` — the v3 artifact inherits the same summary string
- `server/lib/dialogue-v3-source-truth-emitter.cjs` — emitter mirrors the supplied summary; it is not the source of the wrong summary text

#### Most likely responsible surfaces

Primary upstream surfaces for coder bead `ee-tzlr`:

1. `server/scripts/get-context/get-dialogue.cjs`
   - tighten the generated summary contract so it reflects spoken-dialogue-only output
2. `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
   - if reconciliation removes lyric contamination, consider whether the summary also needs a deterministic cleanup/rewrite pass instead of verbatim carry-forward

### 3) Other contract mismatch — **77 errors total, of which 75 are non-deferred shape mismatches**

This bucket is not transcript text drift and not the top-level summary mismatch.

#### Deferred-only items (expected under current posture)

These are currently classified as `deferred_contract_drift`, not the main residual lane:

- `speaker_profiles` — truth object missing field present in output
- `handoffContext` — truth object missing field present in output

Those two paths are explicitly deferred by `benchmarks/fixtures/cod-test/benchmark.json:31-38` and `server/lib/benchmark-runner.cjs:733-745`.

#### Non-deferred contract mismatches still counted as real residuals

Count: `75`

Top-level shape mismatches (`7`):

- output extra fields not present in truth:
  - `analysisMode`
  - `timingMode`
  - `sourceStrategy`
  - `coverage`
  - `provenance`
- output missing fields required by truth:
  - `schema_version`
  - `contract`

Per-segment shape mismatches (`68` = `17 matched segments × 4 fields`):

For every matched runtime segment, the benchmark reports:

- output extra legacy fields:
  - `.speaker`
  - `.speaker_id`
  - `.confidence`
- output missing truth field:
  - `.traits`

Examples from the report:

- `dialogue_segments[truth=0,output=0].speaker`
- `dialogue_segments[truth=0,output=0].speaker_id`
- `dialogue_segments[truth=0,output=0].confidence`
- `dialogue_segments[truth=0,output=0].traits`
- ...repeated through the matched segment set up to `truth=17,output=16`

#### Why this bucket exists

The benchmark truth file is now a v3-ish spoken-dialogue contract:

- `schema_version`
- `contract`
- `dialogue_segments[*].traits`
- no persisted `speaker_profiles`
- no persisted `handoffContext`

But the benchmark artifact being scored is still `dialogueData`, which resolves to the reconciled legacy artifact path:

- `benchmarks/fixtures/cod-test/benchmark.json:12-40`
- `server/lib/phase1-baseline-resolution.cjs:17-29`
- `server/lib/phase1-baseline-resolution.cjs:112-129`

That reconciled runtime file is `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, which still carries the legacy dialogue schema produced by `validateDialogueTranscriptionObject(...)` in `server/lib/structured-output.cjs:649-690` and written by `server/scripts/get-context/get-dialogue.cjs:2065-2070`.

Meanwhile, the same pipeline also emits a v3-shaped artifact:

- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`

That file already has:

- `schema_version`
- `contract`
- `dialogue_segments[*].traits`
- the same summary string as the legacy artifact
- the same 17-segment transcript content drift as the legacy artifact

So this bucket is telling us something specific:

- **most of the remaining red is not about transcript wording anymore; it is a contract-surface mismatch between the scored artifact (`dialogue-data.reconciled.json`) and the truth contract (`truth/dialogue-data.json`)**

#### Most likely responsible surfaces

Primary upstream surfaces for coder bead `ee-tzlr`:

1. `benchmarks/fixtures/cod-test/benchmark.json`
   - artifact selection/posture may still be pointed at the legacy dialogue artifact contract
2. `server/lib/phase1-baseline-resolution.cjs`
   - `dialogueData` canonically resolves to `dialogue-data.reconciled.json`, not the v3 artifact
3. `server/scripts/get-context/get-dialogue.cjs`
   - writes both artifacts; legacy and v3 are diverging contracts on purpose, but the benchmark truth now matches the v3-shaped one more closely
4. `server/lib/structured-output.cjs`
   - confirms the emitted `dialogue-data.json` contract still includes legacy fields (`speaker_profiles`, `handoffContext`, speaker metadata, provenance metadata) and does not emit truth-side `schema_version` / `contract` / per-segment `traits`

## Concrete handoff guidance for coder bead `ee-tzlr`

Keep this lane tightly scoped to `dialogueData` residuals only.

Recommended order:

1. **Decide the owning contract surface first.**
   - If `truth/dialogue-data.json` is the intended v3 spoken-dialogue contract, then the benchmark is probably scoring the wrong runtime artifact family today.
   - Compare any proposed change against `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` before editing comparator tolerances.

2. **Fix summary-contract drift without hiding transcript misses.**
   - The summary should stop claiming lyrics remain in the dialogue lane.
   - Best surfaces: `server/scripts/get-context/get-dialogue.cjs` or a narrow deterministic post-reconciliation summary cleanup in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`.

3. **Fix transcript residuals at the source, not by relaxing the benchmark.**
   - Priority transcript issues:
     - restore the missing comms block (`You shall know fear.` / `Specter one, report.` / `Need a sitrep.`)
     - stop splitting truth `0`
     - stop merging truth `4` + `5`
     - clean up obvious wording drift (`but matters`, `isn't` vs `ain't`, `idea` vs `the idea`, promo punctuation)
   - Because timings are stripped, one missing/merged line causes a long downstream alignment cascade.

4. **Do not paper over the 75 structural mismatches by broadening deferred paths unless that is explicitly the intended contract.**
   - Right now those mismatches are useful evidence that the benchmark truth and scored runtime artifact are from different contract families.

## Bottom line

The live `dialogueData` residuals separate cleanly into three lanes:

- **transcript text drift:** `19` scoreable failures, mostly driven by split/merged/missing segments plus a downstream alignment cascade
- **summary-contract drift:** `1` scoreable failure, because the summary still describes a lyrics-mixed dialogue lane
- **other contract mismatch:** `77` errors total, where `75` are real non-deferred legacy-vs-v3 shape mismatches and `2` are currently deferred (`speaker_profiles`, `handoffContext`)

The important handoff: **coder bead `ee-tzlr` should treat the big structural bucket as contract-family drift, not as more transcript text drift.** The transcript and summary fixes are real, but the dominant remaining red is that the benchmark truth is v3-shaped while `dialogueData` still resolves to the legacy reconciled artifact.