# Phase 1 non-chunked dialogue/music + visual identity planning

**Date:** 2026-03-31  
**Status:** Planning only  
**Scope:** Expand Phase 1 so dialogue and music can optionally run against the whole asset instead of chunked-only, and add a new Phase 1 visual identity lane that emits timeline-aware metadata across the video.

---

## Why this should exist even if whole-video MiMo works

A whole-video MiMo path may become the best *judgment* layer, but it should not be the only *evidence* layer.

The current chunked Phase 1/2 pipeline produces structured, diffable artifacts that are useful for benchmarking, rollback analysis, prompt tuning, and editorial recommendations. Even if MiMo can analyze the full video in one pass, we still want:

- stable Phase 1 artifacts with durable schema contracts
- timeline-addressable evidence that can be cited in Phase 3 outputs
- provider-agnostic fallback when a whole-video multimodal pass fails or is too expensive
- richer explanation surfaces than a single monolithic model answer
- support for localized recommendation generation (hook issues, title-card dips, repeated motif fatigue, VO/music clashes, etc.)

So the design goal is **not** “replace Phase 1 with MiMo.” It is:

> make Phase 1 capable of richer whole-asset context while preserving the localized reporting value that chunked systems already give us.

---

## Design goals

1. **Add optional non-chunked Phase 1 modes** for dialogue and music.
2. **Add a new Phase 1 visual identity artifact** with timeline-aware video metadata.
3. **Preserve existing downstream contracts** for current Phase 2 and Phase 3 scripts.
4. **Keep chunking available** where transport, duration, retry isolation, or timing fidelity still require it.
5. **Make whole-video MiMo complementary**, not a destructive fork.

---

## Recommended architecture

### 1) Keep current artifact keys stable

Do not rename the current top-level artifacts:

- `dialogueData`
- `musicData`

Those keys are already part of the current Phase 1 → Phase 2 contract. Existing consumers should continue to work without needing immediate rewrites.

Instead, extend those artifacts with optional provenance/analysis metadata so downstream code can tell whether a result came from:

- chunked extraction
- whole-asset extraction
- hybrid extraction (whole-asset primary with chunk fallback or chunk-derived timing refinement)

Recommended additive metadata fields:

```json
{
  "analysisMode": "chunked | whole_asset | hybrid",
  "timingMode": "chunk_local | full_timeline",
  "sourceStrategy": "base64 | public_url | file_handle | mixed",
  "provenance": {
    "transportMode": "inline | remote_url",
    "usedChunking": true,
    "chunkCount": 8,
    "fallbackApplied": false,
    "fallbackReason": null
  }
}
```

These should be additive only so benchmark truth payloads and existing code paths do not break by default.

### 2) Introduce a new dedicated visual metadata artifact

Create a new Phase 1 script and artifact:

- script: `server/scripts/get-context/get-visual-identity.cjs` *(planned, not implemented here)*
- artifact key: `visualIdentityData`
- artifact path: `phase1-gather-context/visual-identity-data.json`

This lane should be separate from `chunkAnalysis`.

Reason:
- `chunkAnalysis` is Phase 2 persona/emotion judgment.
- `visualIdentityData` is Phase 1 evidence/context extraction.

That separation keeps Phase 1 as a fact-pattern and timeline metadata layer, while Phase 2/3 remain interpretation/reporting layers.

---

## Expected artifacts

### A. `dialogueData` (extended, same primary contract)

Keep the existing essentials:

- `dialogue_segments[]`
- `summary`
- `handoffContext`
- `totalDuration`

Add optional fields for non-chunked support:

```json
{
  "analysisMode": "whole_asset",
  "timingMode": "full_timeline",
  "coverage": {
    "start": 0,
    "end": 140.04,
    "duration": 140.04,
    "complete": true
  },
  "provenance": {
    "usedChunking": false,
    "chunkCount": 0,
    "fallbackApplied": false
  },
  "qualityNotes": [
    "Whole-asset pass preserved cross-scene speaker continuity.",
    "Per-line timestamps may be coarser than chunked recovery mode."
  ]
}
```

#### Why non-chunked dialogue helps

Whole-asset dialogue can be stronger when:
- speaker identity depends on long-range context
- the model needs the full narrative arc to avoid mislabeling promo VO, lyrics, or recurring characters
- we want fewer stitch artifacts and fewer boundary hallucinations

#### Why chunking still matters for dialogue

Keep chunking when:
- duration or provider budgets exceed whole-file limits
- timestamp precision degrades too much in full-asset mode
- we need retry isolation on one bad span rather than re-running the whole transcript
- overlapping speech or noisy segments need localized rework
- benchmark lanes still depend on seam-level diagnosis and stitch behavior

### B. `musicData` (extended, same primary contract)

Keep current essentials:

- `segments[]`
- `summary`
- `hasMusic`

Add optional whole-asset/hybrid metadata and stronger timeline detail:

```json
{
  "analysisMode": "whole_asset",
  "timingMode": "full_timeline",
  "globalArc": {
    "dominantMood": "energetic",
    "energyCurve": "rising_then_plateau_then_drop",
    "notableTransitions": [
      { "start": 58.0, "end": 65.0, "label": "rock vocal entry" }
    ]
  },
  "provenance": {
    "usedChunking": false,
    "analysisWindowSeconds": null,
    "fallbackApplied": false
  }
}
```

#### Why non-chunked music helps

Whole-asset music can be stronger when:
- the score has cross-cut build/release structure
- recurring motifs matter to editorial interpretation
- short chunk windows flatten the emotional arc
- vocals/lyrics need to be understood as part of a larger musical shift

#### Why chunking still matters for music

Keep chunking when:
- the asset is long-form and music changes exceed prompt budget
- we need finer-grained cue timing than a whole-pass summary can reliably produce
- transport limits force windowed audio submission
- failure isolation matters more than long-arc coherence

### C. `visualIdentityData` (new)

This is the main addition.

Recommended shape:

```json
{
  "schemaVersion": 1,
  "analysisMode": "whole_asset | hybrid",
  "videoDuration": 140.04,
  "summary": "High-intensity trailer driven by surreal spectacle, military action, title-card interruptions, and recurring menace-coded iconography.",
  "timeline": [
    {
      "start": 0,
      "end": 5,
      "kind": "sequence",
      "visualSummary": "Glitch intro and title-card framing before spectacle begins.",
      "hooks": ["title-card cold open", "threat motif"],
      "risks": ["generic corporate trailer framing"],
      "entities": ["title card", "destruction imagery"],
      "continuity": {
        "introduces": ["threat motif"],
        "paysOff": [],
        "callbacks": []
      }
    }
  ],
  "identityRegistry": {
    "characters": [],
    "locations": [],
    "objects": [],
    "motifs": []
  },
  "visualBeats": {
    "hookMoments": [],
    "patternInterrupts": [],
    "titleCards": [],
    "ctaScreens": [],
    "noveltyPeaks": [],
    "fatigueRisks": []
  },
  "editorialSignals": {
    "openingRead": "weak",
    "midpointEscalation": "strong",
    "endingMomentum": "softens",
    "continuityStrength": "high spectacle / mixed narrative clarity"
  },
  "provenance": {
    "usedChunking": false,
    "fallbackApplied": false
  }
}
```

### What `visualIdentityData` should capture

At minimum:

- **timeline summaries** across the full video
- **scene/sequence boundaries** or hybrid fixed-window spans
- **recurring entities and motifs**
  - characters / faces / speaker-adjacent visuals when identifiable
  - locations / environments
  - objects / vehicles / weapons / mechs / icons
  - title cards / text overlays / branding / CTA slates
- **continuity relationships**
  - first appearance
  - callbacks
  - escalation / repetition / payoff
- **editorial interpretation aids**
  - hook moments
  - novelty spikes
  - title-card drag regions
  - static exposition stretches
  - end-slate energy collapse

This artifact should stay **timeline-aware and evidence-oriented**, not persona-judgment-heavy.

---

## Config toggles

Because the repo already uses `settings` for behavior and `ai.<domain>` for targets, the least disruptive design is:

- behavior toggles under `settings`
- provider/model selection under `ai`

### Recommended config additions

```yaml
settings:
  phase1:
    dialogue:
      mode: auto            # auto | chunked | whole_asset | hybrid
      fallback_to_chunked: true
      max_whole_asset_duration_seconds: 180
      preserve_chunk_plan_metadata: true
      timing_refinement: auto   # auto | disabled | chunk_refine

    music:
      mode: auto            # auto | chunked | whole_asset | hybrid
      fallback_to_chunked: true
      max_whole_asset_duration_seconds: 240
      analysis_window_seconds: 30
      emit_global_arc: true

    visual_identity:
      enabled: true
      mode: whole_asset     # whole_asset | hybrid | chunked
      segmentation: hybrid  # scene | fixed_window | hybrid
      target_window_seconds: 5
      emit_identity_registry: true
      emit_hook_signals: true
      emit_continuity_links: true
      fallback_to_chunked: true
```

And a new domain for provider routing:

```yaml
ai:
  video_identity:
    targets:
      - adapter:
          name: openrouter
          model: xiaomi/mimo-v2-omni
```

### Mode semantics

- `auto`
  - prefer whole-asset when duration, transport, provider support, and configured budgets permit
  - fall back to chunked/hybrid otherwise
- `chunked`
  - preserve current behavior
- `whole_asset`
  - one pass across the full asset; fail or fall back depending on config
- `hybrid`
  - use a whole-asset pass for global coherence, then optionally refine timing or local detail with chunk-level extraction

### Recommendation: prefer `auto` as the default rollout mode

That lets the pipeline stay conservative in production while enabling whole-asset behavior only where it is safe.

---

## Interoperability with current phase reporting

### Preserve current reporting surfaces

Current Phase 3 depends primarily on:

- `chunkAnalysis`
- `metrics`
- `recommendation`
- `emotionalAnalysis`

Current Phase 2 `video-chunks.cjs` also expects the existing Phase 1 context shape.

So the compatibility rule should be:

> non-chunked dialogue/music and the new visual identity artifact must be additive inputs, not destructive replacements.

### Interop plan

#### 1) Dialogue/music remain same-named artifacts

That means:
- no immediate Phase 2 breakage
- no forced benchmark fixture migration
- old configs can remain chunked-only

#### 2) `visualIdentityData` is optional at first

Phase 2 and Phase 3 should treat it as:
- absent = current behavior
- present = richer context and stronger editorial evidence

#### 3) Phase reporting should reference provenance

Add optional reporting metadata so downstream summaries can say things like:

- “dialogue extracted in whole-asset mode”
- “music arc derived from whole-file pass with chunk fallback disabled”
- “visual identity timeline available for 100% of asset duration”

This is especially important for benchmark interpretation and future A/B comparisons.

#### 4) Do not overload `chunkAnalysis`

`chunkAnalysis` should remain the Phase 2 emotion/persona analysis surface.

If it later consumes `visualIdentityData`, it should do so as context, not by collapsing Phase 1 metadata into the Phase 2 artifact schema.

---

## How this supports stronger Phase 3 outputs

This planning work is mainly valuable because it gives Phase 3 more grounded evidence.

### Recommendation quality should improve because the system can cite:

- **visual motif fatigue**
  - e.g. title cards or exposition overlays recurring at weak moments
- **hook-specific image evidence**
  - which opening frames underperformed vs which later visuals should be front-loaded
- **dialogue/music/visual interplay**
  - whether a strong music lift is covering for weak visuals
  - whether strong visuals are being blunted by generic VO
- **continuity-aware observations**
  - whether callbacks pay off or just repeat without escalation
- **CTA/end-slate diagnosis**
  - not just “boredom rose,” but *which visual identity shift caused it*

### Concretely, stronger Phase 3 outputs could include

#### Recommendation
More surgical edits such as:
- move a specific novelty beat into the first 3–5 seconds
- remove or compress a specific title-card run
- preserve a recurring visual motif but shorten its second repetition
- keep the music build but replace the matching visuals that flatten momentum

#### Emotional analysis
Better explanations for emotional shifts:
- excitement spike tied to mech reveal / surreal geography / combat escalation
- boredom spike tied to static exposition or promo slate
- curiosity rise tied to tombstone / mystery-object callback / identity ambiguity

#### Summary/final report
A stronger narrative of:
- what the video *is visually doing*
- where that aligns or conflicts with the dialogue/music lanes
- which moments are hooks, bridges, payoffs, and drag zones

---

## Coexistence with a whole-video MiMo path

This Phase 1 expansion should coexist cleanly with a future whole-video MiMo evaluation path.

### Recommended relationship

#### MiMo whole-video path = high-level evaluator
Use it for:
- unified persona judgment
- cross-modal interpretation
- one-pass “what does this video feel like and why” analysis

#### Expanded Phase 1 = structured evidence layer
Use it for:
- localized timeline metadata
- benchmarkable JSON artifacts
- deterministic-ish downstream grounding
- model/provider fallback and comparison
- editorial detail that a single summary answer may omit

### Important rule

Do **not** make richer Phase 1 metadata contingent on whether MiMo succeeds.

Even if MiMo becomes the preferred main path, the repo should preserve:
- additive Phase 1 evidence artifacts
- chunk-capable fallback lanes
- benchmark-friendly structured outputs

### Best future state

A future run can produce both:

1. `wholeVideoPersonaData` / MiMo Phase 2 artifact for unified judgment
2. `dialogueData`, `musicData`, `visualIdentityData` for evidence and editorial grounding

Then Phase 3 can combine them:
- use MiMo for holistic thesis
- use Phase 1 metadata to justify and localize recommendations

---

## Explicit boundaries: when non-chunked makes sense vs when chunking still should win

### Non-chunked is a good fit when

- the asset is short/medium length and fits provider transport constraints
- long-range continuity matters more than local retry isolation
- the goal is a coherent full-asset read
- the model can return full-timeline metadata with acceptable precision
- the video is ad/trailer scale and not long-form documentary/podcast scale
- we want fewer stitching artifacts in speaker/music continuity

### Chunking is still the better fit when

- transport budgets or provider caps force it
- the asset is long enough that whole-file reasoning becomes unreliable or expensive
- retries need to be isolated to small spans
- timing precision matters more than global coherence
- we want benchmark surfaces that expose seam failures explicitly
- the model/provider path has unstable large-file support
- multi-hour or high-density assets would create unacceptable latency/cost in whole mode

### Hybrid should likely be the strategic default

For many real runs, the best long-term behavior is:

- whole-asset pass for continuity and global narrative/music/visual identity
- chunk refinement only where timing fidelity or recovery isolation is needed

That preserves rich reporting value while still taking advantage of whole-video-capable multimodal models.

---

## Rollout recommendation

### Stage 1 — contract-first, no disruption

Plan/add support for:
- `analysisMode` + `provenance` on `dialogueData` and `musicData`
- new `visualIdentityData` artifact contract
- YAML toggles for `auto | chunked | whole_asset | hybrid`

### Stage 2 — safe enablement

Enable non-chunked modes only for:
- cod-test
- URL-based or otherwise provider-safe whole-asset fixtures
- explicit opt-in configs

### Stage 3 — downstream adoption

Teach Phase 2/3 to *optionally* consume `visualIdentityData` and provenance fields without requiring them.

### Stage 4 — MiMo integration

Use whole-video MiMo as a parallel/adjacent high-level evaluation lane, not a replacement for the above artifacts.

---

## Top recommendations

1. **Keep `dialogueData` and `musicData` contract-stable; extend them additively with `analysisMode` and `provenance`.**
2. **Create a new `visualIdentityData` Phase 1 artifact rather than stuffing visual metadata into `chunkAnalysis`.**
3. **Default future configs to `auto` or `hybrid`, not forced whole-asset everywhere.**
4. **Treat whole-video MiMo as a holistic evaluator and expanded Phase 1 as the evidence layer beneath it.**
5. **Preserve chunking for long assets, retry isolation, timing refinement, and benchmark seam diagnosis.**

---

## Files intentionally proposed, not implemented

- `server/scripts/get-context/get-visual-identity.cjs`
- updates to `server/scripts/get-context/get-dialogue.cjs`
- updates to `server/scripts/get-context/get-music.cjs`
- config/schema changes for `settings.phase1.*` and `ai.video_identity.*`

No code changes were made in this task. This note is design-only.
