# Deterministic Speaker Grouping Architecture

**Date:** 2026-04-14  
**Status:** Design / implementation-ready spec  
**Scope:** Deterministic Phase 1 speaker grouping that consumes `dialogue-data.json` line traits and emits grouped speaker assignments  
**Related plan:** `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`

---

## 1) Purpose

This document defines the architecture for the post-transcription deterministic speaker-grouping layer.

The core split is intentional:

- the **dialogue model** should produce line text plus a closed per-line `traits` object in `dialogue-data.json`
- the **deterministic grouping layer** should own all weighting, comparison, thresholding, grouping, and final `speaker_id` assignment
- the **heuristics/rules configuration** should live in an external versioned YAML file so benchmark-driven tuning can happen without changing prompt wording or code for every iteration

This is a design/spec artifact only. It does **not** implement the grouping engine.

---

## 2) Goals and non-goals

### Goals

- Keep speaker identity logic out of the model prompt.
- Make grouping decisions deterministic, explainable, and replayable.
- Preserve a clean separation between:
  - model-authored descriptive traits
  - deterministic decision logic
  - benchmark/tuning artifacts
- Support versioned heuristics experiments against benchmark truth.
- Produce outputs that downstream phases can consume without needing to understand the grouping internals.

### Non-goals

- Do not ask the model to emit weights, confidences for rule importance, or speaker IDs.
- Do not hide grouping behavior inside prompt prose.
- Do not use a black-box clustering model in this layer.
- Do not mutate the source `dialogue-data.json` in-place as the only record of truth; derived grouping output should be a separate durable artifact.

---

## 3) Ownership boundaries

### 3.1 Dialogue model owns

The dialogue lane owns only:

- line extraction
- line ordering/index
- line text
- the closed per-line `traits` contract
- schema validity for those traits

The dialogue lane must **not** own:

- speaker grouping weights
- thresholds
- tie-break policy
- merge/split policy
- `speaker_id` assignment
- benchmark-tuning behavior

### 3.2 Traits validator owns

The traits validator owns:

- closed-schema enforcement for `traits`
- allowed keys / allowed values
- invalid-combination rejection
- retry-trigger behavior when the model returns invalid `traits`

The validator must fail loudly before deterministic grouping runs.

### 3.3 Deterministic speaker-grouping layer owns

The grouping layer owns:

- canonicalizing validated `traits` into comparable feature buckets
- candidate group scoring
- hard blockers / merge guards
- ambiguity handling
- new-group creation policy
- final group summaries
- stable `speaker_id` assignment
- explainability artifacts

### 3.4 Downstream reconciliation / later phases own

Downstream phases own:

- consuming grouped speaker assignments
- combining grouping output with other phase outputs
- any later content-level reconciliation

They should treat the deterministic grouping output as the source of truth for Phase 1 speaker assignment.

---

## 4) High-level architecture

```text
AI dialogue lane
  -> phase1-gather-context/dialogue-data.json
     (text + traits, no speaker_id)
  -> deterministic speaker-grouping engine
     + external YAML ruleset
  -> phase1-gather-context/speaker-grouping.json
  -> phase1-gather-context/dialogue-speakers.json   (derived convenience view)
  -> phase1-gather-context/_debug/speaker-grouping/*
```

### Recommended durable artifacts

1. **Source artifact**  
   `phase1-gather-context/dialogue-data.json`

2. **Primary deterministic output**  
   `phase1-gather-context/speaker-grouping.json`

3. **Derived convenience output for downstream compatibility**  
   `phase1-gather-context/dialogue-speakers.json`

4. **Debug / tuning artifacts**  
   `phase1-gather-context/_debug/speaker-grouping/`

The deterministic engine should read the source artifact and emit new artifacts. It should not overwrite the model-authored source as its only output.

---

## 5) Input contract to the grouping engine

## 5.1 Required source input

The grouping engine consumes validated `dialogue-data.json` entries shaped conceptually like:

```json
{
  "dialogue_segments": [
    {
      "index": 0,
      "text": "They want you afraid.",
      "traits": {}
    }
  ]
}
```

This document does **not** lock the exact traits fields; that belongs to the traits-contract design. What this layer requires is that the traits validator produces a closed, normalized, comparable trait object for every line.

## 5.2 Canonical feature buckets expected by this layer

The grouping engine should not compare raw prompt field names directly. Instead, it should canonicalize validated `traits` into internal feature buckets.

Recommended internal buckets:

- **stable_identity**
  - traits expected to persist across multiple lines from the same speaker
  - examples: pitch band, rasp/smoothness, accent family, age presentation, gender presentation, vocal texture family
- **delivery_style**
  - traits that may vary but still help grouping
  - examples: calm vs urgent, clipped vs flowing, shouted vs conversational, formal vs casual cadence
- **channel_production**
  - traits describing recording/filter context
  - examples: radio-filtered, close-mic, distant, PA/announcer texture, distorted, crowd-masked
- **role_context**
  - scene-role hints that may help but should carry lower authority
  - examples: briefing voice, command voice, promo voice, antagonist taunt, teammate chatter
- **uncertainty markers**
  - explicit unknown/uncertain/ambiguous values from the closed contract

The canonicalizer is the seam between the traits contract and grouping logic. If the traits contract evolves, only the canonicalizer + validator compatibility layer should need to adapt.

## 5.3 Preconditions

The grouping engine should refuse to run if:

- `dialogue_segments` is missing or malformed
- any segment lacks `index`
- any segment lacks `text`
- any segment lacks `traits`
- the artifact's `traits` contract version is unsupported by the selected ruleset

---

## 6) Output contract

## 6.1 Primary output: `speaker-grouping.json`

Recommended structure:

```json
{
  "schema_version": 1,
  "ruleset": {
    "id": "default",
    "version": "1.0.0",
    "schema_version": 1,
    "traits_contract_version": "1.0.0"
  },
  "input": {
    "artifact": "phase1-gather-context/dialogue-data.json",
    "segment_count": 20
  },
  "speaker_groups": [
    {
      "group_id": "grp_001",
      "speaker_id": "spk_001",
      "first_segment_index": 0,
      "segment_indexes": [0, 1, 4, 5],
      "canonical_traits": {
        "stable_identity": {},
        "delivery_style": {},
        "channel_production": {},
        "role_context": {}
      }
    }
  ],
  "assignments": [
    {
      "segment_index": 0,
      "group_id": "grp_001",
      "speaker_id": "spk_001",
      "decision": {
        "action": "create_group",
        "score": null,
        "reason": "first segment"
      }
    }
  ],
  "summary": {
    "group_count": 1,
    "ambiguous_assignment_count": 0,
    "singleton_group_count": 0
  }
}
```

## 6.2 Derived convenience output: `dialogue-speakers.json`

This is a downstream-friendly view that combines source lines with deterministic assignments.

Recommended shape:

```json
{
  "schema_version": 1,
  "dialogue_segments": [
    {
      "index": 0,
      "text": "They want you afraid.",
      "traits": {},
      "speaker_group_id": "grp_001",
      "speaker_id": "spk_001"
    }
  ],
  "speaker_groups": []
}
```

### Important rule

`speaker_id` is **derived output**, not AI-authored input.

---

## 7) Deterministic grouping flow

## 7.1 Overview

The grouping engine should use an explainable deterministic flow:

1. **Validate source artifact presence and version compatibility**
2. **Canonicalize traits** into internal feature buckets
3. **Process segments in stable order** (`index` ascending)
4. For each segment, **compare against existing groups**
5. Apply **hard blockers** first
6. Apply **weighted evidence rules** to remaining candidates
7. Choose one of:
   - assign to best existing group
   - create a new group
   - mark assignment as low-confidence but still choose deterministically
8. Update the chosen group's aggregate trait profile
9. After first pass, run a **bounded cleanup pass** for obvious singleton merges/splits
10. Finalize `speaker_id` values by first appearance order
11. Emit debug/tuning artifacts

## 7.2 Why sequential grouping instead of pure global clustering

A strict forward grouping pass is preferable because it is:

- easier to explain line-by-line
- easier to debug against benchmark truth
- easier to emit decision ledgers for
- more stable under small ruleset edits

A bounded second pass is still useful for deterministic cleanup, but the architecture should avoid opaque global optimization as the main decision engine.

## 7.3 Candidate comparison model

For each segment, evaluate every existing group using three layers:

### Layer A: hard blockers

Examples:

- incompatible stable identity combination
- traits contract says feature is explicitly contradictory
- ruleset forbids merging certain channel/voice combinations without stronger evidence

If a blocker fires, that candidate group is removed before scoring.

### Layer B: weighted evidence

For non-blocked candidates, add/subtract deterministic weights based on rules such as:

- stable identity match
- stable identity mismatch
- delivery-style consistency
- channel-production consistency
- role-context hints
- adjacency / recent continuity bonuses
- singleton-merge penalties
- cross-scene persistence penalties if applicable

### Layer C: decision policy

After scores are computed:

- if no candidate clears `assign_threshold`, create a new group
- if the top score clears threshold but the margin over second place is too small, assign deterministically but mark ambiguous
- if the top score clears a stronger `reuse_threshold`, reuse that group normally

## 7.4 Group aggregate state

Each group should maintain deterministic aggregate state, not free-form prose.

Recommended group state:

- first and last seen segment index
- list of member segment indexes
- per-feature histograms / support counts
- canonical trait values chosen from strongest support
- cumulative decision evidence
- ambiguity flags

Canonical group traits should be derived from repeated support, not copied from the most recent line blindly.

## 7.5 Bounded cleanup pass

After the forward pass, run a deterministic cleanup pass with strict bounds:

- merge singleton groups into a neighbor group only if the merged score clears a dedicated `singleton_merge_threshold`
- split a group only if contradictory stable-identity evidence persists across multiple member lines and crosses a dedicated split threshold
- never rewrite the whole grouping through unconstrained iterative merging

This keeps the engine explainable and avoids unstable emergent behavior.

---

## 8) Explainability requirements

Every line assignment must be explainable from emitted artifacts alone.

For each segment assignment, persist:

- candidate groups considered
- groups excluded by blockers
- score contributions by rule
- top candidate, runner-up, and margin
- final action: `assign_existing`, `create_group`, `cleanup_merge`, `cleanup_split`
- human-readable short reason

Example decision ledger shape:

```json
{
  "segment_index": 4,
  "candidates": [
    {
      "group_id": "grp_001",
      "blocked": false,
      "score": 7.5,
      "contributions": [
        { "rule": "stable.pitch_band.match", "weight": 3 },
        { "rule": "stable.accent_family.match", "weight": 3 },
        { "rule": "adjacency.recent_same_style", "weight": 1.5 }
      ]
    },
    {
      "group_id": "grp_003",
      "blocked": true,
      "blockers": ["stable.accent_family.contradiction"]
    }
  ],
  "chosen_group_id": "grp_001",
  "runner_up_group_id": null,
  "decision": "assign_existing",
  "ambiguous": false,
  "reason": "matched stable voice profile and recent continuity"
}
```

This is the minimum needed to make ruleset tuning credible.

---

## 9) External YAML heuristics/rules file

## 9.1 Why YAML

The rules file should be external because the repo needs to:

- clone rulesets for benchmark experiments
- diff rule changes clearly in git
- archive benchmark-winning variants
- separate code changes from tuning changes

## 9.2 Recommended location

```text
config/heuristics/speaker-grouping/
  default.v1.yaml
  cod-benchmark-tuned.v1.yaml
  archive/
```

## 9.3 Recommended schema shape

```yaml
schema_version: 1
ruleset:
  id: default
  version: 1.0.0
  description: Baseline deterministic speaker grouping ruleset
compatibility:
  traits_contract: 1.x
  grouping_output_schema: 1.x
canonicalization:
  bucket_map:
    stable_identity:
      - pitch_band
      - vocal_texture
      - accent_family
      - presentation
    delivery_style:
      - intensity
      - cadence
      - phrasing
    channel_production:
      - channel_texture
      - mic_distance
    role_context:
      - role_mode
      - scene_function
hard_blockers:
  - id: stable_identity_direct_contradiction
    when:
      all:
        - feature: accent_family
          relation: contradictory
        - feature: vocal_texture
          relation: contradictory
  - id: announcer_vs_radio_filtered_guard
    when:
      all:
        - feature: role_mode
          relation: contradictory
        - feature: channel_texture
          relation: contradictory
weights:
  positive:
    stable_identity.match: 3.0
    delivery_style.match: 1.5
    channel_production.match: 1.0
    role_context.match: 0.5
    adjacency.recent_group_bonus: 1.0
  negative:
    stable_identity.mismatch: -3.0
    delivery_style.mismatch: -1.0
    channel_production.mismatch: -0.75
    role_context.mismatch: -0.25
    singleton_creation_penalty: -0.5
decision_policy:
  assign_threshold: 3.5
  reuse_threshold: 5.0
  ambiguity_margin: 1.0
  singleton_merge_threshold: 6.0
  split_threshold: 7.0
tie_breakers:
  - highest_score
  - most_stable_identity_matches
  - nearest_previous_occurrence
  - earliest_group_creation
```

## 9.4 Ruleset schema constraints

The YAML schema should itself be validated strictly.

Requirements:

- unknown top-level keys should be rejected
- unknown rule IDs or relation types should be rejected
- missing required thresholds should be rejected
- non-numeric weights should be rejected
- duplicate rule IDs should be rejected

No arbitrary executable code should live in the YAML.

## 9.5 Versioning strategy

Use three distinct version concepts:

### A. `schema_version`

Version of the YAML structure itself.

- bump **major** when parser expectations change
- old rulesets become incompatible unless migrated

### B. `ruleset.version`

Semantic version for the heuristic content.

- **major**: intentional decision-policy change likely to alter many assignments
- **minor**: normal tuning changes to weights/thresholds/rule lists
- **patch**: comments, naming cleanup, non-behavioral metadata edits

### C. compatibility target

The ruleset must declare the supported traits-contract version range, e.g. `traits_contract: 1.x`.

This prevents silently applying a ruleset tuned for one traits vocabulary onto another.

## 9.6 Ruleset identity in every output

Every deterministic output and benchmark artifact must record:

- ruleset ID
- ruleset version
- ruleset schema version
- traits contract version
- code revision / commit if available

That metadata is essential for benchmark replay.

---

## 10) Benchmark-driven tuning artifacts

The tuning lane needs more than a final grouped output. It needs reproducible internals.

Recommended artifact set under:

```text
phase1-gather-context/_debug/speaker-grouping/
```

### 10.1 `normalized-input.json`

The validated, canonicalized line traits the deterministic engine actually used.

Purpose:

- prove the grouping engine did not compare raw prompt text directly
- isolate ruleset issues from traits-validator issues

### 10.2 `decision-log.jsonl`

One line per segment decision.

Each record should include:

- segment index
- candidate groups
- blocker results
- score contributions
- chosen action
- ambiguity flag

### 10.3 `group-state-snapshots.jsonl`

Snapshot after each assignment or cleanup action.

Purpose:

- show how group profiles evolve
- debug bad early-group anchoring

### 10.4 `score-matrix.json`

A compact matrix of segment-to-group scores before final assignment.

Purpose:

- compare two rulesets quickly
- inspect whether a wrong choice came from blockers, weights, or thresholds

### 10.5 `summary.json`

High-level run metrics:

- segment count
- final group count
- singleton count
- ambiguous count
- cleanup merges/splits count
- ruleset metadata

### 10.6 `benchmark-comparison.json`

When truth exists, compare deterministic grouping to truth using grouping-aware metrics.

Recommended metrics:

- pairwise same-speaker precision / recall / F1
- split error count
- over-merge error count
- first-appearance speaker ID ordering parity
- per-segment assignment agreement

Literal `speaker_id` strings are order-sensitive; pairwise grouping metrics are the safer tuning signal.

### 10.7 `benchmark-comparison.md`

Human-readable explanation of where the ruleset failed:

- wrong merges
- wrong splits
- ambiguous cases
- candidate groups that nearly won

This should be the document humans read before editing the YAML.

---

## 11) Worked example

This example uses illustrative trait buckets. Exact field names depend on the final traits contract.

### 11.1 Input lines

```json
[
  {
    "index": 0,
    "text": "They want you afraid.",
    "traits": {
      "pitch_band": "mid",
      "vocal_texture": "smooth_intense",
      "accent_family": "general_american",
      "presentation": "feminine_coded",
      "intensity": "urgent",
      "channel_texture": "clean_close_mic",
      "role_mode": "narration"
    }
  },
  {
    "index": 1,
    "text": "Fear makes you easier to control.",
    "traits": {
      "pitch_band": "mid",
      "vocal_texture": "smooth_intense",
      "accent_family": "general_american",
      "presentation": "feminine_coded",
      "intensity": "urgent",
      "channel_texture": "clean_close_mic",
      "role_mode": "narration"
    }
  },
  {
    "index": 2,
    "text": "Your streets shall once again run red with your blood.",
    "traits": {
      "pitch_band": "low",
      "vocal_texture": "raspy",
      "accent_family": "latam_colored",
      "presentation": "masculine_coded",
      "intensity": "threatening",
      "channel_texture": "clean_close_mic",
      "role_mode": "taunt"
    }
  },
  {
    "index": 4,
    "text": "Menendez is a terrorist.",
    "traits": {
      "pitch_band": "mid",
      "vocal_texture": "smooth_intense",
      "accent_family": "general_american",
      "presentation": "feminine_coded",
      "intensity": "urgent",
      "channel_texture": "clean_close_mic",
      "role_mode": "narration"
    }
  }
]
```

### 11.2 Deterministic decisions

- **Line 0**: no existing groups -> create `grp_001` / later `spk_001`
- **Line 1** vs `grp_001`:
  - stable matches on pitch, texture, accent, presentation
  - same channel texture
  - same delivery/role profile
  - score exceeds `reuse_threshold`
  - assign to `grp_001`
- **Line 2** vs `grp_001`:
  - hard contradiction on accent + presentation + vocal texture
  - candidate blocked
  - no valid reusable group remains
  - create `grp_002` / later `spk_002`
- **Line 4** vs `grp_001` and `grp_002`:
  - strong stable match with `grp_001`
  - contradiction against `grp_002`
  - assign to `grp_001`

### 11.3 Result

```json
{
  "assignments": [
    { "segment_index": 0, "speaker_id": "spk_001" },
    { "segment_index": 1, "speaker_id": "spk_001" },
    { "segment_index": 2, "speaker_id": "spk_002" },
    { "segment_index": 4, "speaker_id": "spk_001" }
  ]
}
```

This example shows the intended behavior: the model only describes line-local traits, while the deterministic layer owns the actual continuity decision.

---

## 12) Interaction with current repo state

The current `get-dialogue.cjs` implementation still mixes model-authored `speaker` / `speaker_id` / `speaker_profiles` into the dialogue lane contract. Under the pivot, that ownership should move.

Target direction:

- `get-dialogue.cjs` should eventually emit text + closed `traits`
- current prompt-side speaker continuity guidance should be reduced or removed
- deterministic grouping should become the sole owner of `speaker_id`
- any current benchmark truth/comparison flow that assumes AI-authored `speaker_id` should be updated to compare deterministic grouping outputs instead

The deterministic design here is compatible with the repo's validator-first architecture: the new grouping layer is not another AI lane. It is a deterministic post-processing stage that consumes already-validated AI output.

---

## 13) Dependencies on the traits contract and validator design

This design depends on the traits lane landing a few guarantees.

### 13.1 Traits contract dependencies

The grouping engine needs the traits contract to provide:

- a **closed vocabulary**
- explicit `unknown` / abstain states where needed
- stable versioning metadata
- values that can be compared deterministically without free-form parsing
- enough separation between:
  - stable identity cues
  - transient delivery cues
  - channel/production cues
  - role/context cues

If those categories are not distinct in the traits contract, grouping rules will become brittle.

### 13.2 Validator dependencies

The validator must guarantee that:

- all required trait fields are present where required by contract
- enum values are canonicalized
- invalid combinations fail loudly
- unknown keys are rejected
- unsupported traits-contract versions are rejected before grouping

The grouping engine should be allowed to assume it is receiving clean, normalized trait values.

### 13.3 Canonicalization seam

If the traits contract field names evolve, do **not** rewrite grouping rules to chase prompt vocabulary.

Instead:

- update the traits validator/canonicalizer
- preserve the grouping engine's internal feature buckets
- keep rulesets compatible through declared `traits_contract` ranges

That seam is what makes long-term benchmark tuning sustainable.

---

## 14) Recommended implementation order

1. Finalize the closed `traits` contract.
2. Finalize validator + retry behavior for invalid traits.
3. Implement a traits canonicalizer for deterministic comparison buckets.
4. Implement the YAML ruleset schema validator.
5. Implement the forward-pass grouping engine.
6. Implement the bounded cleanup pass.
7. Emit debug/tuning artifacts.
8. Add benchmark comparison for grouping-aware metrics.
9. Switch downstream consumers from AI-authored speaker IDs to deterministic output.

---

## 15) Final recommendation

The repo should treat speaker identity as a deterministic post-processing problem, not a prompt-authoring problem.

That means:

- the model describes each line with a strict traits contract
- the deterministic layer decides who matches whom
- the YAML ruleset records how those decisions are made
- benchmark artifacts make the behavior inspectable and tunable

That is the cleanest path to stable speaker grouping without burying decision logic in prompt wording.
