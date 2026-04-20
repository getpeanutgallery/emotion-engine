# cod-test speaker-grouping derived QA handoff — 2026-04-20

## Scope

Independent QA review of the refreshed derived grouping artifacts and comparator evidence:
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`

This was a review pass only, not another regeneration pass.

---

## QA verdict

**Verdict:** provenance cleanup passed; comparator remains honestly red on real residual grouping/runtime differences.

What passed:
- no remaining references to legacy source paths such as `dialogue_segments[*].speaker_id` or `speaker_profiles[*]...` were found in the reviewed artifacts
- both truth-side grouping artifacts now constrain `projection.derived_from_paths` to active truth-owned dialogue inputs, with the runtime-aligned file explicitly adding runtime alignment inputs only where appropriate
- `source_speaker_id` and `label` are explicitly framed as **derived compatibility/readability outputs**, not active `dialogue-data.json` source truth
- runtime-vs-truth separation stays explicit in comparator evidence via separate `grouping_input_surface`, `truth_grouping`, and `runtime_grouping` paths plus preserved alignment bookkeeping

What did **not** pass green:
- the comparator still reports **9 mismatches** and those should currently be treated as candidate real residual grouping/runtime issues, not dismissed as old provenance leakage

---

## Evidence summary

### 1) Legacy provenance leakage appears gone

QA check result:
- `speaker_profiles[*]` references: none found
- `dialogue_segments[*].speaker_id` references: none found

Reviewed provenance posture now present:
- `truth/speaker-grouping.json` derives from:
  - `dialogue_segments[*].index`
  - `dialogue_segments[*].text`
  - `dialogue_segments[*].traits`
- `truth/speaker-grouping.reconciled-runtime-aligned.json` derives from:
  - `dialogue_segments[*].index`
  - `dialogue_segments[*].text`
  - `dialogue_segments[*].traits`
  - `runtime.dialogue_segments[*].index`
  - `runtime.dialogue_segments[*].text`

### 2) Compatibility-field framing is explicit and acceptable

Both truth-side grouping artifacts now say:
- `source_speaker_id`: derived deterministic grouping continuity id retained for comparator compatibility; not owned by active `dialogue-data.json` source truth
- `label`: derived grouping label retained for comparator readability; not owned by active `dialogue-data.json` source truth

That framing is the right clean-break posture.

### 3) Runtime-vs-truth separation remains explicit

Comparator evidence still cleanly separates surfaces:
- `grouping_input_surface`: `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `truth_grouping`: `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `runtime_grouping`: `output/cod-test/phase1-gather-context/speaker-grouping.json`

The runtime-aligned truth artifact also keeps the alignment ledger honest:
- matched runtime segments: `17`
- unmatched runtime indexes: `[11]`
- unmatched truth indexes: `[9, 10, 11]`

So the comparator is still showing truth, runtime, and alignment evidence as distinct layers rather than blurring them together.

---

## Residual risk areas

These are the remaining red areas Derrick should treat as real candidate issues until disproven by later investigation:

1. **Grouping reuse misses remain the dominant failure mode**
   - 5 mismatches at runtime segment indexes `1`, `2`, `5`, `8`, `16`
   - Pattern: truth expects reuse of an earlier group, runtime left the line as a singleton or new group
   - Risk: grouping heuristics are still under-reusing across same-speaker returns after source-truth conversion

2. **One explicit runtime-extra segment still exists before grouping parity even begins**
   - runtime index `11`
   - category: `runtime_extra_segment_not_in_truth`
   - Risk: extraction/segmentation drift is still feeding noise into grouping comparison; this is not a provenance wording problem

3. **Stable group-key assignment mismatches still exist on later aligned dialogue**
   - runtime segment indexes `13`, `14`, `17`
   - Risk: even where both sides assign a segment, runtime grouping is still attaching it to a different group lineage than truth expects

4. **Human review edits to `dialogue-data.json` may legitimately move grouping evidence again**
   - especially if Derrick changes the watchlist items called out in `2026-04-20-dialogue-traits-human-review-packet.md`
   - Risk: current grouping mismatch counts are useful, but not necessarily final if dialogue gold truth changes

---

## Exact point to switch Derrick into the human review pass

**Switch now.**

Task 4 QA is good enough to hand off because the remaining grouping red surface no longer looks like stale legacy provenance leakage.

The next step for Derrick is **not** another grouping metadata cleanup. The next step is to open:
- `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-human-review-packet.md`

…and start the `dialogue-data.json` human review at the packet's **High-priority review items** watchlist:
- `2` — Menendez threat line
- `9` — filtered threat line
- `16` — antagonist/expository line
- `17` — overlap/Mason line
- `19` — preorder CTA

That is the correct handoff boundary because:
- provenance cleanup is now sufficiently verified
- remaining grouping mismatches should be treated as substantive evidence, not metadata contamination
- dialogue gold review is the next human decision point before any later rerun/recompare loop

---

## Recommended next step

1. Derrick reviews the `dialogue-data.json` watchlist from `2026-04-20-dialogue-traits-human-review-packet.md` starting with indexes `2, 9, 16, 17, 19`.
2. Only after any confirmed dialogue truth edits, rerun the narrow dialogue/comparator refreshes.
3. Then revisit speaker-grouping mismatches as genuine runtime/grouping residuals.

---

## Bottom line

The derived grouping lane is now honest about provenance.

It is **not** green for grouping parity, but it is clean enough that the remaining `9` mismatches should be carried forward as real residual candidate issues rather than written off as legacy leakage.
