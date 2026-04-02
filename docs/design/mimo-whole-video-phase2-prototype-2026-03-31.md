# MiMo whole-video Phase 2 prototype design note

**Date:** 2026-03-31  
**Scope:** Planning/design only. No product code changes.  
**Related bead:** `ee-k3ls`  
**Status:** Proposed side-path prototype

---

## Goal

Design the minimum viable **whole-video** Phase 2 prototype for MiMo-style persona evaluation using a **staged public video URL** so we can test whether one multimodal pass can replace or meaningfully complement the current chunked Phase 2 lane.

This prototype is intentionally **side-path only**:

- it must not replace the current `video-chunks.cjs` benchmarked path
- it must not silently reuse the canonical `chunk-analysis.json` contract in a misleading way
- it must produce an artifact that is **comparable enough for inspection**, not falsely equivalent to the existing chunked benchmark lane

---

## Why this cut

The current Phase 2 system is honest but expensive and seam-heavy:

- it evaluates the video in short chunks
- it injects Phase 1 dialogue/music context into each chunk
- downstream metrics and emotional-analysis reports derive timeline behavior from those chunk scores

That gives us fine-grained signals, but it also creates real sources of drift:

- chunk boundary artifacts
- repeated re-grounding cost
- cross-chunk summary carryover bias
- separate dialogue/music/video reasoning instead of one native multimodal view

The MiMo whole-video prototype should answer a narrower question first:

> If we send the entire staged video once, can the model produce a grounded, useful persona-evaluation artifact that preserves the important judgment calls of the chunked system without pretending to have the same temporal resolution?

---

## Prototype boundaries

### In scope

- single full-video submission via **public/presigned URL**
- provider transport that may resolve to **OpenRouter** or **Xiaomi-direct** depending on adapter contract
- one whole-video persona evaluation prompt covering the categories currently spread across dialogue/music/video reasoning
- a **new sidecar artifact** for whole-video output
- a comparison note or comparison JSON versus the current chunked cod-test baseline

### Out of scope

- replacing the canonical chunked Phase 2 path
- changing the existing cod-test benchmark manifest/truth files
- claiming per-second or per-5-second fidelity from a single whole-video pass
- retrofitting the current Phase 3 metrics/emotional-analysis scripts to treat whole-video output as equivalent to chunked output
- productionizing Xiaomi-direct or OpenRouter transport details beyond what is minimally needed for the prototype

---

## Minimum viable input contract

Task 2 owns the final shared transport contract, but the whole-video prototype only needs a small subset.

### Required prototype inputs

- `persona.soulPath`
- `persona.goalPath`
- `asset.stagedPublicUrl` — public or presigned video URL reachable by provider
- `asset.mimeType` — likely `video/mp4`
- `asset.durationSeconds`
- `provider.adapter.name`
- `provider.adapter.model`
- `provider.transport.mediaMode = public_url`
- `phase2.mode = whole_video_mimo`

### Recommended minimal config shape

```yaml
asset:
  inputPath: examples/videos/emotion-tests/cod.mp4
  stagedPublicUrl: https://.../cod-test.mp4
  mimeType: video/mp4

phase2:
  mode: whole_video_mimo
  inputMode: full_video_url

ai:
  video:
    targets:
      - adapter:
          name: openrouter # or xiaomi-direct
          model: xiaomi/mimo-v2-omni
          params:
            max_tokens: 12000
            thinking:
              level: low
```

### Transport note

The prototype should assume the adapter normalizes request shape, not the script:

- **OpenRouter path:** whichever OpenRouter multimodal request shape is actually supported for the chosen provider/model route
- **Xiaomi-direct path:** first-party OpenAI-compatible `video_url` shape using the same staged URL

The Phase 2 prototype should operate on the abstract contract: **"here is a provider-reachable video URL"**.

---

## Prompt scope

The whole-video prompt should evaluate the categories we currently split across dialogue/music/video reasoning, but it should do so at the **whole-video judgment layer**, not as fake granular extraction.

### What the prompt must cover

#### 1) Core comparable lenses

These should remain the primary numeric output because they map to the current Phase 2 persona lane:

- `patience`
- `boredom`
- `excitement`

#### 2) Goal-level whole-video categories

These should be secondary structured fields, because they are already present in the GOAL and currently inferred indirectly across phases:

- `hookEffectiveness` — how well the first 0-3s earns continued watching
- `valueClarity` — whether the viewer understands what they are watching by ~10s
- `dialogueAuthenticity` — whether spoken lines help or hurt retention/trust
- `musicEnergyAlignment` — whether score/audio supports the intended emotional arc
- `visualMomentum` — pattern interrupts, novelty, motion, and pacing
- `ctaPackaging` — whether ending/title/upsell/CTA helps or hurts the finish
- `trust` — authenticity / skepticism / polish issues that affect belief

#### 3) Evidence expectations

The model must cite **sparse timed evidence moments**, not dense fake timeseries:

- opening hook moment(s)
- 2-4 strongest positive moments
- 2-4 strongest friction or abandonment-risk moments
- ending/CTA assessment moment(s)

Each evidence item should include a timestamp or time range and a grounded explanation of whether the driver was mainly:

- `dialogue`
- `music`
- `visual`
- `cross_modal`

### Prompt guidance

The prompt should explicitly instruct the model to:

- ground in the **attached full video** first
- treat the video’s native audio as part of the evidence
- use whole-video reasoning rather than pretending it observed perfect per-second certainty
- avoid inventing transcript details not confidently perceived
- separate **overall verdicts** from **timed evidence moments**
- keep comparison-friendly numeric scores only at the whole-video level

### Prompt anti-hallucination rules

The prompt should explicitly forbid:

- claiming per-second measurements
- inventing exact dialogue lines when unclear
- fabricating music segmentation detail it cannot support
- outputting derived chunk-by-chunk scores unless the script explicitly asks for a synthetic compatibility view

---

## Recommended artifact shape

### Canonical prototype artifact

Create a new sidecar artifact rather than overloading the benchmarked chunk artifact:

`phase2-process/whole-video-analysis.json`

Recommended shape:

```json
{
  "schemaVersion": "ee.phase2.whole-video/v1",
  "analysisMode": "whole_video_mimo",
  "provider": {
    "adapter": "openrouter",
    "model": "xiaomi/mimo-v2-omni",
    "transport": "public_url"
  },
  "input": {
    "videoUrl": "https://...",
    "mimeType": "video/mp4",
    "durationSeconds": 140.017
  },
  "persona": {
    "soulPath": "../cast/impatient-teenager/SOUL.md",
    "goalPath": "../goals/video-ad-evaluation.md",
    "primaryLenses": ["patience", "boredom", "excitement"]
  },
  "wholeVideoScores": {
    "patience": { "score": 6, "reasoning": "..." },
    "boredom": { "score": 4, "reasoning": "..." },
    "excitement": { "score": 8, "reasoning": "..." }
  },
  "wholeVideoCategories": {
    "hookEffectiveness": { "score": 3, "reasoning": "..." },
    "valueClarity": { "score": 6, "reasoning": "..." },
    "dialogueAuthenticity": { "score": 4, "reasoning": "..." },
    "musicEnergyAlignment": { "score": 8, "reasoning": "..." },
    "visualMomentum": { "score": 8, "reasoning": "..." },
    "ctaPackaging": { "score": 2, "reasoning": "..." },
    "trust": { "score": 5, "reasoning": "..." }
  },
  "overallSummary": "...",
  "retentionVerdict": {
    "wouldComplete": "yes|maybe|no",
    "confidence": 0.84,
    "reasoning": "..."
  },
  "evidenceMoments": [
    {
      "timestamp": 0,
      "timeRange": { "start": 0, "end": 3 },
      "type": "friction",
      "driver": "cross_modal",
      "category": "hookEffectiveness",
      "impact": "high",
      "summary": "..."
    }
  ],
  "strongestMoments": ["..."],
  "biggestRisks": ["..."],
  "recommendationSeeds": ["..."],
  "comparisonHints": {
    "safeForChunkEquivalence": false,
    "safeForPhase3Metrics": false,
    "reason": "Whole-video output is sparse, evidence-based, and not a per-chunk timeseries."
  },
  "ai": {
    "usage": { "input": 0, "output": 0 },
    "requestCount": 1
  }
}
```

### Optional compatibility envelope

If we want the quickest manual comparison helper, add a second derived file:

`phase2-process/whole-video-analysis.compat.json`

That file may contain a **single synthetic full-span chunk** only for tooling convenience:

```json
{
  "chunks": [
    {
      "chunkIndex": 0,
      "startTime": 0,
      "endTime": 140.017,
      "status": "success",
      "summary": "...",
      "emotions": {
        "patience": { "score": 6, "reasoning": "..." },
        "boredom": { "score": 4, "reasoning": "..." },
        "excitement": { "score": 8, "reasoning": "..." }
      },
      "dominant_emotion": "excitement",
      "confidence": 0.84,
      "persona": { "...": "..." },
      "synthetic": true
    }
  ],
  "videoDuration": 140.017,
  "totalTokens": 12345,
  "compatibilityOnly": true
}
```

This file is useful for eyeballing old consumers, but it should **not** be treated as benchmark-equivalent truth-bearing output.

---

## Comparison method versus current chunked Phase 2

The comparison should be explicit about what is and is not comparable.

### What is honestly comparable

#### A) Whole-video lens verdicts

Compare the whole-video prototype’s top-level lens scores against chunked-run aggregates:

- average or median `patience`
- average or median `boredom`
- average or median `excitement`
- dominant overall takeaway

This is approximate but fair.

#### B) Major moment agreement

Check whether the whole-video prototype identifies the same high-salience beats the chunked system already surfaced, for example:

- weak/generic opening
- strongest action-heavy middle sections
- late title/upsell/info-dump drop-off

Treat this as **thematic + timed agreement**, not exact chunk alignment.

Recommended tolerance for timed matches: **±10 seconds**.

#### C) Recommendation agreement

Compare whether both paths converge on the same major creative actions:

- rebuild the opening
- compress exposition
- keep/distill strongest mid-video action beats
- simplify the ending/CTA / remove dense promo packaging

#### D) Operational comparison

Track:

- request success/failure rate
- latency
- total tokens / cost signal
- provider transport reliability
- failure modes tied to URL fetch or model output shape

### What is not honestly comparable

Do **not** claim parity on:

- per-second timeline metrics
- friction index derived from dense chunk repetition
- benchmark manifest pass/fail against current `truth/chunk-analysis.json`
- exact chunk-by-chunk emotional arc

The existing Phase 3 stack derives timelines from repeated chunk scores. A single whole-video pass cannot honestly claim the same granularity.

### Minimal comparison deliverable

For the prototype, the comparison output should be a lightweight sidecar such as:

`phase2-process/whole-video-vs-chunked-comparison.json`

with:

- baseline run path
- whole-video run path
- score deltas on primary lenses
- matched positive/friction moments
- agreement/disagreement summary
- transport/cost/runtime notes
- rollout recommendation: `promising`, `mixed`, or `not_promising`

---

## Benchmark-honest rollout rule

This prototype must remain outside the canonical benchmark lane until it earns its place.

### Therefore

- keep existing `video-chunks.cjs` output and truth set untouched
- do not rewrite the benchmark manifest to point at whole-video output
- do not compare a single synthetic chunk against the current 28-chunk truth artifact as if they were equivalent
- do not route whole-video output through current metrics/emotional-analysis scripts unless those scripts are explicitly taught a new whole-video mode with downgraded claims

The correct first use is **human inspection + side-by-side comparison**, not truth-substitution.

---

## Rollback boundaries

Rollback is easy if we keep the prototype isolated.

### Hard rollback boundary

Any of the following means we stop at prototype-only and do not expand rollout:

- provider cannot reliably fetch staged public video URLs
- output is generic and ungrounded
- output misses obvious cod-test friction points already found by chunked analysis
- output produces confident but weakly evidenced claims
- transport complexity/cost is worse than chunking without quality gain
- current downstream reporting would require dishonest shims to make the result look comparable

### Soft rollback boundary

If the prototype works technically but quality is mixed:

- keep it as an exploratory side-path
- do not replace chunked Phase 2
- consider limited use only as a **whole-video sanity oracle** layered on top of chunked analysis

---

## What counts as promising output

The prototype is promising if most of these are true on cod-test:

1. **Transport succeeds cleanly**
   - staged public URL works reliably
   - same script can route through OpenRouter or Xiaomi-direct at adapter level

2. **Grounding is visibly real**
   - evidence moments match observable moments in the trailer
   - no obvious hallucinated dialogue/music claims

3. **It catches the same big truths as chunked Phase 2**
   - weak opening
   - strong action-heavy middle
   - weak promo/upsell tail

4. **It adds integrated value**
   - dialogue/music/visual reasoning feels more unified than stitched
   - recommendations show cross-modal understanding rather than single-lane summaries

5. **Operational profile is acceptable**
   - fewer calls than chunking
   - latency/tokens not absurdly worse
   - error handling remains tractable

### Strongly promising

Call it strongly promising if it also:

- produces better overall recommendation quality than the stitched path
- highlights the same critical moments with less seam noise
- makes the chunked path feel redundant for at least some fixtures

---

## Top prototype recommendation

### Recommended minimum viable path

1. **Use a new Phase 2 whole-video script**
   - separate from `video-chunks.cjs`
   - one request against a staged public URL

2. **Emit a new canonical sidecar artifact**
   - `phase2-process/whole-video-analysis.json`

3. **Optionally emit a clearly labeled compatibility helper**
   - `whole-video-analysis.compat.json`
   - synthetic, inspection-only, not benchmark-equivalent

4. **Compare against the existing cod-test chunked output with a dedicated comparison file**
   - no benchmark manifest changes
   - no truth-file substitution

5. **Gate expansion on agreement + groundedness, not novelty**
   - the prototype wins only if it reproduces the important truths honestly and with manageable ops

### Recommendation on prompt breadth

Keep the prompt **broad enough to integrate dialogue/music/visual categories**, but keep the numeric output narrow:

- numeric: `patience`, `boredom`, `excitement`
- structured qualitative categories: hook, clarity, dialogue authenticity, music alignment, visual momentum, CTA, trust
- sparse evidence moments instead of fake dense timeseries

That is the best minimum cut because it is useful immediately without overstating precision.

---

## Files this plan expects to touch when implemented later

- new Phase 2 whole-video script path (TBD)
- new config for cod-test whole-video MiMo lane (TBD)
- `phase2-process/whole-video-analysis.json` output
- optional `phase2-process/whole-video-analysis.compat.json`
- optional `phase2-process/whole-video-vs-chunked-comparison.json`

For this task, planning only artifacts are:

- `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md`
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
