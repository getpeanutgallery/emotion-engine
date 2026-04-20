# cod-test speaker-grouping derived refresh audit note — 2026-04-20

## Scope

Independent audit of the grouping refresh lane against the residual provenance gap recorded in `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-audit-note.md`.

Reviewed artifacts:
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `docs/2026-04-20-cod-test-derived-speaker-grouping-provenance-contract.md`
- `benchmarks/fixtures/cod-test/review/2026-04-20-speaker-grouping-derived-qa-handoff.md`

This was an audit pass only, not another regeneration pass.

---

## Verdict

**Pass for provenance honesty. Not green for grouping parity.**

The residual provenance gap identified in the earlier audit is now resolved in the refreshed grouping lane:
- no reviewed grouping truth/comparator artifact still advertises removed legacy source paths such as `dialogue_segments[*].speaker_id` or `speaker_profiles[*]...`
- both truth-side grouping artifacts now honestly describe themselves as **derived non-gold** projections of the traits-only dialogue truth
- retained `source_speaker_id` and `label` fields are explicitly framed as compatibility/readability outputs, not source-truth ownership
- comparator outputs still preserve the separation between active truth, runtime evidence, and mismatch accounting

The lane is therefore **clean enough for Derrick's human `dialogue-data.json` review pass and later reruns**.

What is **not** resolved is grouping correctness: the remaining `9` mismatches should now be treated as real residual runtime/grouping issues unless a later human truth edit changes the benchmark surface again.

---

## Audit findings

### 1) The specific provenance leakage from the prior audit is gone

Observed in `truth/speaker-grouping.json`:
- `projection.derived_from_paths` is now limited to:
  - `dialogue_segments[*].index`
  - `dialogue_segments[*].text`
  - `dialogue_segments[*].traits`
- no reviewed metadata claims ownership from removed speaker-profile or source-speaker fields

Observed in `truth/speaker-grouping.reconciled-runtime-aligned.json`:
- `projection.derived_from_paths` is now limited to the same active truth-owned fields plus the explicit runtime alignment inputs actually used:
  - `runtime.dialogue_segments[*].index`
  - `runtime.dialogue_segments[*].text`
- runtime alignment metadata remains explicit instead of being smuggled in as source-truth ownership

Observed in comparator outputs:
- no legacy source-path references were found in `speakerGrouping.json` or `speakerGrouping.miss-clusters.json`

### 2) Compatibility-field framing is explicit and honest

Both truth-side grouping artifacts retain:
- `source_speaker_id`
- `label`

But both now document them as:
- derived deterministic grouping continuity/readability fields
- retained for comparator compatibility/readability
- **not** owned by active `dialogue-data.json` source truth

That is the right contract posture for the clean-break world.

### 3) Comparator outputs still keep runtime and truth separate

The comparator evidence remains honest about which layer owns what:
- `evidence.posture.grouping_input_surface` = `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `evidence.artifacts.truth_grouping` = `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `evidence.artifacts.runtime_grouping` = `output/cod-test/phase1-gather-context/speaker-grouping.json`

The runtime-aligned truth artifact also keeps the alignment ledger explicit:
- matched runtime segments: `17`
- unmatched runtime indexes: `[11]`
- unmatched truth indexes: `[9, 10, 11]`

So the lane is no longer blurring source truth, derived truth projection, and runtime evidence.

### 4) The remaining 9 mismatches should now be treated as substantive residuals

Current comparator totals:
- `mismatch_count: 9`
- `grouping_reuse_miss_after_source_truth_conversion: 5`
- `runtime_extra_segment_not_in_truth: 1`
- `grouping_assignment_mismatch: 3`

Because the provenance leakage appears resolved, these should now be read as **real residual grouping/runtime issues**, not stale metadata drift:
- reuse misses at runtime indexes `1`, `2`, `5`, `8`, `16`
- runtime extra segment at `11`
- assignment mismatches at `13`, `14`, `17`

One caveat remains: if Derrick materially edits `benchmarks/fixtures/cod-test/truth/dialogue-data.json` during the human review pass, the grouping comparison surface may legitimately move again on the next rerun.

---

## Readiness call

### Ready now
- Derrick's human review pass on `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- follow-on reruns after any confirmed dialogue truth edits
- treating the current grouping red surface as honest benchmark evidence rather than provenance contamination

### Not ready to claim
- that speaker grouping parity is solved
- that the remaining 9 mismatches are harmless or stale

---

## Bottom line

The grouping refresh lane fixed the honesty problem.

It did **not** fix grouping parity, but it did leave the repo in the right pre-review state: Derrick can now do the human `dialogue-data.json` pass, then rerun, and interpret any remaining grouping failures as real residual behavior unless the gold truth itself changes.
