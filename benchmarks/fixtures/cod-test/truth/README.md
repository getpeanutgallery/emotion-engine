# cod-test truth artifact boundaries

Active Phase 1 contract summary for this folder:

- `dialogue-data.json` = **gold spoken-dialogue source truth**
  - owns only `summary`, `dialogue_segments[*].index`, `dialogue_segments[*].text`, and closed `dialogue_segments[*].traits`
  - does **not** own timestamps, `speaker_id`, grouping outputs, speaker profiles, confidence scores, or handoff prose
- `music-vocals-data.json` = **gold music-vocals truth**
  - owns sung/chanted vocal segments and related recognition evidence
  - lyric content stays here, not in `dialogue-data.json`
- `speaker-grouping*.json` = **derived deterministic artifacts**
  - own `speaker_id`, grouping, alignment, and comparator projection behavior
  - never redefine source truth

Important current-state note:

- the live `dialogue-data.json` file has now been migrated to the clean-break traits-mode contract and is the active spoken-dialogue gold-review surface
- the normative clean-break contract is documented in:
  - `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md`
- sibling `speaker-grouping*.json` artifacts remain derived comparator/projection surfaces and may need regeneration when the gold dialogue truth changes
