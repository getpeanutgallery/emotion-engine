# Emotion Engine

**Date:** 2026-04-20  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Refresh the derived `speaker-grouping*.json` truth/comparator artifacts so they stop advertising legacy `dialogue-data.json` provenance fields and cleanly align with the new Phase 1 traits-only dialogue source-truth contract before Derrick starts the human review pass.

---

## Overview

The clean-break migration of `benchmarks/fixtures/cod-test/truth/dialogue-data.json` succeeded: the active file now matches the locked traits-only source-truth contract, and QA plus audit both agreed it is structurally ready for Derrick's human review pass. The one remaining honesty gap is not in the active source-truth file itself, but in the sibling **derived** grouping artifacts.

Both `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` and `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json` still contain projection metadata and provenance references that point at removed legacy source paths such as `dialogue_segments[*].speaker_id` and `speaker_profiles[*]...`. Those artifacts are explicitly non-gold derived outputs, but right now they still narrate themselves as if the old speaker-oriented truth contract were active.

This lane is a cleanup/regeneration pass for the derived grouping surface only. It should preserve the source-truth vs deterministic-grouping boundary, keep the archived legacy benchmark reference untouched, and leave Derrick with a coherent state for the next step: human review of `dialogue-data.json`, followed by refreshed dialogue/grouping reruns that no longer mix old and new provenance assumptions.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Active clean-break dialogue source-truth contract | `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md` |
| `REF-02` | Active dialogue truth artifact | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-03` | Derived grouping truth artifact needing refresh | `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` |
| `REF-04` | Runtime-aligned derived grouping artifact needing refresh | `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json` |
| `REF-05` | QA review packet for dialogue truth | `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-human-review-packet.md` |
| `REF-06` | Independent audit note identifying the residual grouping-provenance gap | `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-audit-note.md` |
| `REF-07` | Current grouping comparator outputs that may need refresh | `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` |
| `REF-08` | Current grouping miss-cluster output that may need refresh | `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json` |
| `REF-09` | Grouping heuristics contract summary | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md` |
| `REF-10` | Existing truth clean-break execution plan this work follows | `.plans/2026-04-20-reset-cod-test-dialogue-truth-for-phase1-traits-clean-break.md` |
| `REF-11` | Locked provenance contract for active derived speaker-grouping artifacts | `docs/2026-04-20-cod-test-derived-speaker-grouping-provenance-contract.md` |

---

## Tasks

### Task 1: Define the refreshed provenance/contract expectations for derived grouping artifacts

**Bead ID:** `ee-cg0a`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-09`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, define the exact provenance and contract expectations for the derived `speaker-grouping*.json` artifacts now that `dialogue-data.json` is traits-only source truth. Be explicit about what these derived artifacts may still contain (`speaker_group_key`, grouping assignments, alignment metadata, comparator projection info) versus what provenance language must no longer reference removed legacy source fields. Produce durable docs/notes as needed and update this plan with the result.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-20-cod-test-derived-speaker-grouping-provenance-contract.md`
- `.plans/2026-04-20-refresh-speaker-grouping-derived-artifacts-for-traits-clean-break.md`

**Status:** ✅ Complete

**Results:** Locked `REF-11` as the normative provenance contract for active derived grouping artifacts. The document explicitly preserves the source-truth vs deterministic-grouping boundary from `REF-01`/`REF-09`, allows derived grouping artifacts to keep comparator-usable fields such as `speaker_group_key`, assignments, compatibility `source_speaker_id`/`label`, runtime alignment bookkeeping, and projection metadata, and forbids any renewed provenance claims against removed legacy fields such as `dialogue_segments[*].speaker_id` or `speaker_profiles[*]...`. Confirmed this is a contract-definition step only; archived `benchmarks/fixtures/.archived/cod-test (legacy)/` remains untouched. Concrete handoff for `ee-bhhv`: refresh `truth/speaker-grouping.json` so `projection.derived_from_paths` and surrounding metadata point only at active truth-owned fields (index/text/traits if actually used), while any retained ids/labels are clearly framed as derived grouping compatibility outputs rather than source-truth ownership.

---

### Task 2: Refresh `speaker-grouping.json` to align with the new source-truth contract

**Bead ID:** `ee-bhhv`  
**SubAgent:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-06`, `REF-09`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, regenerate or revise `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` so its projection metadata and contents align with the active traits-only `dialogue-data.json` contract. Remove stale references to legacy source fields, preserve the artifact's derived/non-gold status, and keep the actual grouping surface truthful and comparator-usable.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- any minimal helper scripts/docs if truly needed

**Status:** ✅ Complete

**Results:** Refreshed `REF-03` with the smallest durable provenance-only change set. Kept the existing deterministic grouping payload (`speaker_groups`, `assignments`, counts, stable group keys) intact because the artifact is still comparator-usable, but rewrote the top-level metadata so it now honestly describes the file as `derived_non_gold`, restricts `projection.derived_from_paths` to active truth-owned inputs only (`dialogue_segments[*].index`, `dialogue_segments[*].text`, `dialogue_segments[*].traits`), and removes all legacy `speaker_profiles[*]...` / `dialogue_segments[*].speaker_id` provenance claims forbidden by `REF-11`. Retained compatibility fields `source_speaker_id` and `label`, but added explicit `projection.compatibility_fields` notes stating that both are derived grouping-lane outputs kept for comparator compatibility/readability rather than active `dialogue-data.json` source truth ownership. No runtime-aligned artifact or comparator report refresh was started in this task; concrete handoff for `ee-ss6p`: apply the same provenance posture to `REF-04` and any directly dependent comparator outputs while preserving honest runtime-alignment bookkeeping.

---

### Task 3: Refresh the runtime-aligned grouping surface and comparator outputs

**Bead ID:** `ee-ss6p`  
**SubAgent:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-04`, `REF-07`, `REF-08`, `REF-09`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, regenerate or revise `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json` and any directly dependent grouping comparator outputs so they no longer narrate legacy source-field ownership. Keep alignment metadata honest, preserve runtime-vs-truth separation, and record exactly what was refreshed.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `scripts/qa/run-cod-task8-speaker-grouping.cjs`

**Status:** ✅ Complete

**Results:** Refreshed `REF-04` with a provenance-only metadata correction while preserving the existing runtime alignment payload, grouping surface, and honest mismatch bookkeeping. The runtime-aligned artifact now explicitly marks itself as `derived_non_gold`, restricts `projection.derived_from_paths` to active truth-owned inputs actually allowed by `REF-11` (`dialogue_segments[*].index`, `dialogue_segments[*].text`, `dialogue_segments[*].traits`) plus the real runtime alignment inputs actually consumed (`runtime.dialogue_segments[*].index`, `runtime.dialogue_segments[*].text`), and adds `projection.compatibility_fields` notes clarifying that retained `source_speaker_id` / `label` fields are derived grouping-lane compatibility outputs rather than active `dialogue-data.json` source truth ownership. Preserved the explicit runtime alignment ledger unchanged: `matched_runtime_segment_count` stays `17`, `unmatched_runtime_segment_indexes` stays `[11]`, `unmatched_truth_segment_indexes` stays `[9, 10, 11]`, and the runtime extra lyric spillover remains honestly represented as `runtime_extra_segment_not_in_truth` rather than being hidden. Re-ran the directly dependent comparator refresh so `REF-07` / `REF-08` now point at the runtime-aligned truth artifact, record the actual runtime v3 grouping input surface (`dialogue-v3-source-truth.reconciled.json`), keep the live mismatch surface honest at `9` total mismatches (`5` `grouping_reuse_miss_after_source_truth_conversion`, `1` `runtime_extra_segment_not_in_truth`, `3` `grouping_assignment_mismatch`), and preserve the separation between source truth, derived grouping truth, and runtime evidence. Concrete handoff for `ee-ntb2`: QA should verify that no legacy source-field provenance remains in `REF-04` / `REF-07` / `REF-08`, confirm the compatibility-field framing is explicit, and then review the still-red grouping miss surface as a real residual runtime/grouping problem rather than a provenance artifact.

---

### Task 4: QA the refreshed derived grouping surface and hand off the exact human-review starting point

**Bead ID:** `ee-ntb2`  
**SubAgent:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, independently review the refreshed grouping artifacts and comparator outputs. Confirm the legacy provenance leakage is actually gone, summarize any remaining grouping-risk areas honestly, and identify the exact point where Derrick should switch into the `dialogue-data.json` human review pass.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/review/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/review/2026-04-20-speaker-grouping-derived-qa-handoff.md`
- `.plans/2026-04-20-refresh-speaker-grouping-derived-artifacts-for-traits-clean-break.md`

**Status:** ✅ Complete

**Results:** Independent QA review passed the provenance-cleanup objective and produced a durable handoff note at `benchmarks/fixtures/cod-test/review/2026-04-20-speaker-grouping-derived-qa-handoff.md`. Verified that `REF-03`, `REF-04`, `REF-07`, and `REF-08` no longer reference removed legacy provenance paths such as `dialogue_segments[*].speaker_id` or `speaker_profiles[*]...`; both grouping truth artifacts now limit provenance to active dialogue truth fields (plus explicit runtime alignment inputs in `REF-04` where appropriate). Confirmed `source_speaker_id` and `label` are framed only as derived compatibility/readability outputs, not active `dialogue-data.json` source truth. Confirmed runtime-vs-truth separation remains explicit in comparator evidence through distinct `grouping_input_surface`, `truth_grouping`, and `runtime_grouping` surfaces plus preserved alignment counts (`matched_runtime_segment_count: 17`, `unmatched_runtime_segment_indexes: [11]`, `unmatched_truth_segment_indexes: [9, 10, 11]`). QA verdict is intentionally mixed: provenance leakage appears gone, but the remaining `9` mismatches should still be treated as real residual candidate issues (`5` grouping reuse misses at runtime indexes `1, 2, 5, 8, 16`; `1` runtime extra segment at `11`; `3` grouping assignment mismatches at `13, 14, 17`) rather than dismissed as metadata contamination. Exact handoff boundary for Derrick: switch now into `REF-05`, beginning the `dialogue-data.json` human review packet at the high-priority watchlist (`2`, `9`, `16`, `17`, `19`) before any later rerun/recompare loop.

---

### Task 5: Audit the refresh lane and decide whether the repo is in a clean pre-review state

**Bead ID:** `ee-7v2t`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, audit whether the grouping refresh lane truly resolved the residual provenance gap identified in `REF-06`. Verify that derived grouping artifacts are now honest about their relationship to the traits-only source-truth file, and decide whether the repo is cleanly ready for Derrick's human review pass plus any follow-on reruns.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/`
- `benchmarks/fixtures/cod-test/review/`
- `docs/`

**Files Created/Deleted/Modified:**
- audit note(s)
- any living-plan updates

**Status:** ✅ Complete

**Results:** Independent audit passed the refresh lane for provenance honesty and produced a durable note at `benchmarks/fixtures/cod-test/review/2026-04-20-speaker-grouping-derived-audit-note.md`. Rechecked the exact residual gap called out in `REF-06` and confirmed it is resolved in the refreshed lane: `REF-03` and `REF-04` no longer advertise removed legacy provenance paths such as `dialogue_segments[*].speaker_id` or `speaker_profiles[*]...`; both artifacts now self-describe as `derived_non_gold`, constrain `projection.derived_from_paths` to active dialogue-truth inputs (plus explicit runtime alignment inputs in `REF-04` only where actually used), and keep `source_speaker_id` / `label` explicitly framed as comparator compatibility/readability outputs rather than source-truth ownership. Re-audited the refreshed comparator evidence and confirmed it still preserves runtime-vs-truth separation honestly via `evidence.posture.grouping_input_surface`, `evidence.artifacts.truth_grouping`, `evidence.artifacts.runtime_grouping`, plus explicit alignment bookkeeping (`matched_runtime_segment_count: 17`, `unmatched_runtime_segment_indexes: [11]`, `unmatched_truth_segment_indexes: [9, 10, 11]`). Audit conclusion: the remaining `9` mismatches should now be treated as real residual grouping/runtime issues (`5` reuse misses at `1, 2, 5, 8, 16`; `1` runtime extra segment at `11`; `3` assignment mismatches at `13, 14, 17`) rather than stale metadata drift. Readiness call: the repo is cleanly ready for Derrick's human `dialogue-data.json` review pass and any later reruns, but it is not honest to call grouping parity green yet.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Locked the clean-break provenance contract for derived speaker-grouping artifacts, refreshed both truth-side grouping projections plus their directly dependent comparator outputs to match that contract, produced QA and audit handoff notes, and left Derrick with a clean starting point for the next human review phase. The lane's real outcome is narrower than a full grouping fix: provenance honesty is repaired, comparator separation is honest, and the remaining red surface is now substantive residual grouping/runtime behavior rather than legacy metadata contamination.

**Reference Check:** `REF-01` / `REF-02` stayed the active traits-only source-truth baseline; `REF-03` / `REF-04` now satisfy the derived provenance contract from `REF-11`; `REF-07` / `REF-08` preserve honest runtime-vs-truth separation; `REF-06`'s residual provenance gap is resolved. Deliberate non-result: `REF-07` / `REF-08` remain red on 9 substantive mismatches, so grouping parity is not claimed complete.

**Commits:**
- Pending.

**Lessons Learned:** In this benchmark lane, provenance honesty and grouping correctness have to be audited separately. Cleaning the metadata/projection contract can make the benchmark trustworthy again without making the runtime behavior green; once the provenance layer is fixed, the remaining mismatches become more valuable because they reflect real grouping/runtime behavior instead of stale contract drift.

---

*Drafted on 2026-04-20*