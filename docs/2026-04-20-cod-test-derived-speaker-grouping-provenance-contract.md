# cod-test Derived Speaker-Grouping Provenance Contract

**Date:** 2026-04-20  
**Status:** Locked for grouping-artifact refresh work  
**Applies to:**
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- any directly dependent grouping comparator/projection outputs refreshed from those artifacts

---

## Purpose

Define the exact provenance and ownership rules for the **derived** `speaker-grouping*.json` artifacts now that active `cod-test` `dialogue-data.json` is a **traits-only gold source-truth** file.

This contract exists to remove stale legacy provenance language from the grouping lane without collapsing the important boundary between:

- **gold source truth** owned by `dialogue-data.json`, and
- **deterministic grouping / projection outputs** owned by `speaker-grouping*.json`.

This is a contract/provenance-definition step only. It does **not** itself regenerate the grouping artifacts.

---

## Governing boundary

### `dialogue-data.json` remains the only gold source truth for this lane

The active `benchmarks/fixtures/cod-test/truth/dialogue-data.json` file owns only:

- `summary`
- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- `dialogue_segments[*].traits`

It does **not** own:

- `speaker_id`
- speaker labels
- speaker profiles
- grouping membership
- runtime alignment
- comparator projection metadata
- timestamps
- free-text grouping notes

### `speaker-grouping*.json` remains derived, deterministic, and non-gold

The grouping artifacts may still be stable, reviewable, and comparator-usable, but they are **not** human-reviewable gold source truth. They are projections that begin **after** the traits-only dialogue truth is fixed.

Important rule: deterministic grouping may derive `speaker_id`-like continuity assignments, but it must never claim that those fields came from active `dialogue-data.json`.

---

## Exact allowed ownership for derived grouping artifacts

The active derived grouping artifacts may contain the following classes of information.

### 1. Deterministic grouping identity surface

Allowed:

- `speaker_group_key`
- group creation/reuse identifiers
- `first_segment_index` / `source_first_segment_index` style stable-key anchors
- group membership collections such as `segment_indexes`, `source_truth_segment_indexes`, or `runtime_segment_indexes`
- deterministic continuity identifiers such as `source_speaker_id` **only if clearly documented as derived grouping output, not source-truth ownership**
- human-readable comparator labels such as `label` **only if clearly documented as derived grouping output, not source-truth ownership**
- summary counts such as `group_count`, `assignment_count`, `segment_count`

### 2. Assignment surface

Allowed:

- `assignments[*].segment_index`
- `assignments[*].speaker_group_key`
- projected/derived continuity ids or labels
- assignment-local text copies for audit/comparator convenience
- matched truth indexes when the artifact needs to show how grouping references the source truth

### 3. Runtime alignment metadata

Allowed in runtime-aligned artifacts:

- `runtime_dialogue_path`
- `alignment_strategy`
- runtime vs source-truth segment counts
- matched/unmatched runtime segment indexes
- matched/unmatched truth segment indexes
- runtime normalized text
- `alignment_kind`
- explicit split / merge / fuzzy / extra-segment alignment bookkeeping

### 4. Comparator projection metadata

Allowed:

- `source_path` pointing to active `truth/dialogue-data.json`
- explicit metadata that the artifact is a derived comparator projection
- `derived_from_paths` that reference only active gold-owned source-truth fields and/or runtime alignment fields that truly participate in the projection
- stable-group-key rules and similar derivation notes

---

## Exact provenance language required going forward

When refreshed, the grouping artifacts should describe themselves using language like:

- derived from `dialogue_segments[*].index`
- derived from `dialogue_segments[*].text`
- grouped using deterministic post-truth heuristics over the traits-only dialogue truth
- runtime-aligned against reconciled runtime dialogue output when applicable
- may project comparator labels / continuity ids for grouping review

The artifacts should be explicit that:

1. active `dialogue-data.json` supplies line identity and text/traits only
2. grouping identity is created by deterministic grouping logic after source truth
3. runtime alignment is a separate projection layer, not evidence that timing/speaker ownership lives in source truth
4. any `source_speaker_id` / `label` fields inside grouping artifacts are compatibility/projection outputs of the grouping lane itself

---

## Forbidden legacy provenance references

The refreshed grouping artifacts must **no longer** describe themselves as derived from removed legacy fields that no longer belong to active `dialogue-data.json`.

### Forbidden source references

Do **not** reference any of the following as active provenance inputs:

- `dialogue_segments[*].speaker_id`
- `dialogue_segments[*].speaker`
- `dialogue_segments[*].speaker_group_id`
- `dialogue_segments[*].group_id`
- `dialogue_segments[*].start`
- `dialogue_segments[*].end`
- `dialogue_segments[*].confidence`
- `dialogue_segments[*].notes`
- `speaker_profiles[*].speaker_id`
- `speaker_profiles[*].grounded.linked_segment_indexes`
- `speaker_profiles[*].label`
- any `speaker_profiles[*]...` path
- any `_benchmark`-style comparator scaffolding path inside active source truth
- any provenance claim that implies active `dialogue-data.json` still owns speaker labels, profiles, timing, or grouping

### Forbidden narrative posture

Do **not** say or imply that:

- grouping artifacts are direct gold truth
- `speaker_id` came from active `dialogue-data.json`
- speaker labels came from active `dialogue-data.json`
- speaker profiles remain part of the live cod-test truth lane
- runtime alignment metadata proves runtime timing/speaker ownership inside source truth

---

## Required `derived_from_paths` posture

If a refreshed artifact keeps `projection.derived_from_paths`, the list must be restricted to paths that are still real and owned by the active contract.

### Allowed active truth paths

- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- optionally `dialogue_segments[*].traits` or explicit subpaths under `traits` **only if the refreshed artifact actually uses them for grouping derivation or explainability**

### Allowed runtime-alignment paths for the runtime-aligned artifact

- `runtime.dialogue_segments[*].index`
- `runtime.dialogue_segments[*].text`
- other runtime alignment fields only if they actually exist in the runtime reconciliation input and are truly consumed by the projection

### Disallowed posture

`derived_from_paths` must not preserve historical speaker/profile paths just because old artifacts had them.

---

## Compatibility fields: allowed but must be truthfully framed

Some fields may remain for continuity with comparator consumers even though they are no longer source-truth-owned.

These may remain if clearly treated as derived grouping outputs:

- `source_speaker_id`
- `label`
- stable `speaker_group_key`

Interpretation rule:

- these are **grouping-lane compatibility fields**, not evidence of live upstream source-truth ownership
- if future refresh work can rename them to clearer derived names without breaking consumers, that is allowed, but not required by this contract step

---

## Artifact-specific expectations

### `truth/speaker-grouping.json`

This artifact may contain:

- deterministic grouping groups
- assignment lists keyed by source-truth segment index
- stable group key metadata
- derived compatibility ids/labels
- minimal summary counts

This artifact should **not** claim runtime alignment ownership.

### `truth/speaker-grouping.reconciled-runtime-aligned.json`

This artifact may additionally contain:

- ordered text alignment metadata
- runtime split/merge/fuzzy alignment notes
- runtime unmatched/matched bookkeeping
- runtime-segment keyed assignments and groups
- source-truth segment crosswalks used for comparator projection

This artifact should still avoid claiming that active source truth owns timing, runtime segmentation, or speaker ids.

---

## Refresh guidance for follow-on implementation tasks

Task `ee-bhhv` should refresh `truth/speaker-grouping.json` so that:

1. metadata points only at active truth-owned fields
2. any retained `source_speaker_id` / `label` fields are framed as derived compatibility outputs
3. group keys / assignments / summaries remain comparator-usable
4. no legacy `speaker_profiles` or removed segment speaker-path provenance remains

Task `ee-ss6p` should refresh `truth/speaker-grouping.reconciled-runtime-aligned.json` and dependent comparator outputs so that:

1. runtime alignment bookkeeping remains explicit and honest
2. `derived_from_paths` reflects only active truth fields plus real runtime alignment fields
3. unmatched runtime/truth cases remain documented
4. no legacy source-field ownership is implied anywhere in the metadata or prose

---

## cod-test legacy posture

`benchmarks/fixtures/.archived/cod-test (legacy)/` remains archived historical reference only.

That archive may still contain speaker-oriented truth and profile-based provenance language. This contract does **not** rewrite history there.

The active refresh work must leave archived `cod-test` untouched.

---

## Bottom line

After the clean break:

- `dialogue-data.json` owns only line-local gold truth
- deterministic grouping begins after that truth is fixed
- `speaker-grouping*.json` may still contain group keys, assignments, runtime alignment metadata, and comparator projection info
- but those artifacts must no longer claim provenance from removed legacy speaker/profile fields or imply that active source truth still owns speaker identity

---

## References

- `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-audit-note.md`
- `benchmarks/fixtures/.archived/cod-test (legacy)/`
