# Peanut Gallery Emotion Engine

**Date:** 2026-05-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Run a benchmark-anchored human review of the COD dialogue timestamp output using the new dedicated dialogue timestamp truth surface, and convert that review into a precise next dialogue-only implementation recommendation.

---

## Overview

The repo now has a dedicated dialogue timestamp benchmark file that preserves the historical manual timing truth without collapsing to the current runtime drift surface. That gives us the right anchor for human review. The next slice should not try to fix anything yet; it should prepare the review surface, guide the human through split/merge-tolerant timing comparison, and record the verdict in a durable way.

This lane stays dialogue-only. We are not reviewing music-vocals here, and we are not broadening into generic dialogue repair unless the review outcome clearly points there. The core challenge is that truth and runtime are intentionally not 1:1 row-aligned in drifted regions, so the review packet must present exact rows where possible and grouped windows where necessary. That way, the human is reviewing timing quality against benchmark truth rather than accidentally reviewing row-shape drift as if it were timing drift.

The output of this plan should be a practical review artifact Derrick can use directly, plus a written post-review verdict that distinguishes: (1) timing looks good, (2) timing is questionable, (3) timing is blocked by upstream text drift, and (4) segmentation needs tolerant comparison rather than row-level judgment. Only after that should we decide whether the next coder lane is timestamp-specific or still upstream dialogue/reconciliation work.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Benchmark-surface creation and readiness plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md` |
| `REF-02` | Dialogue-only comparison findings against truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md` |
| `REF-03` | Dedicated dialogue timestamp benchmark truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json` |
| `REF-04` | Emitted dialogue timestamp artifact under review | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json` |
| `REF-05` | Emitted reconciled dialogue text surface | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-06` | Durable machine comparison artifact for split/merge-tolerant classification | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json` |
| `REF-07` | QA summary for timestamp benchmark surfaces | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md` |

---

## Execution-Ready Human Review Packet Contract

### Packet purpose and scope

The packet is a **dialogue-only, benchmark-anchored human review surface** for `cod-test`. It exists to let Derrick judge whether the emitted runtime dialogue timestamps are actually correct **for the benchmark text units they are supposed to represent**, without collapsing truth to the current runtime row shape.

Scope guardrails:

- Review **dialogue only**. Ignore music-vocals entirely in this packet.
- Review **packet design / review decisions only**. Do not change runtime output or benchmark truth in this lane.
- Treat `REF-03` as the authoritative text/order/timing benchmark surface.
- Treat `REF-04` and `REF-05` as the candidate runtime surfaces under review.
- Treat `REF-06` as the authoritative machine-generated alignment map that decides whether a unit is row-reviewable, window-reviewable, or blocked.

### Required packet artifact set

The coder lane should build the packet as a small, durable artifact bundle under a dedicated plan-artifact folder such as:

- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.md`
- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.json`
- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/review-decisions.json`

Contract for each artifact:

1. `packet.md`
   - Human-readable review worksheet.
   - Contains the summary, review instructions, verdict rubric, and one section per comparison unit in review order.
   - This is the file Derrick should read while reviewing.
2. `packet.json`
   - Exact machine-readable packet payload used to generate `packet.md`.
   - Must preserve every comparison unit, benchmark/runtime timing values, grouping metadata, and review instructions so the packet is reproducible.
3. `review-decisions.json`
   - Durable human-decision artifact Derrick fills in or that a follow-on helper writes from Derrick's selections.
   - Must store one review record per packet unit, with no dependence on chat history.

### Packet.json contract

`packet.json` must contain these top-level keys:

```json
{
  "packet_version": 1,
  "packet_kind": "dialogue_timestamp_human_review",
  "benchmark_path": "benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json",
  "runtime_timestamp_path": "output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json",
  "runtime_text_path": "output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json",
  "comparison_path": "output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json",
  "summary": {
    "artifact_integrity_drift_count": 0,
    "text_drift_count": 5,
    "segmentation_drift_count": 2,
    "timing_drift_count": 0,
    "timing_unresolved_count": 0,
    "timing_blocked_by_text_drift_count": 4,
    "clean_match_count": 12
  },
  "review_units": []
}
```

Each `review_units[]` entry must include at least:

- `comparison_unit_id`
- `review_order`
- `review_mode` = `row`, `window`, or `blocked`
- `truth_indexes`
- `runtime_indexes`
- `boundary_class`
- `mismatch_class`
- `text_match`
- `truth_text`
- `runtime_text`
- `truth_start` / `truth_end`
- `runtime_start` / `runtime_end`
- `truth_duration` / `runtime_duration`
- `start_delta_seconds` / `end_delta_seconds` when both sides exist
- `runtime_timing_statuses`
- `source_clip_suggestion` with `start`, `end`, and `padding_seconds`
- `review_prompt` telling Derrick what to confirm for this specific unit
- `default_verdict_bucket` = `timing_review`, `windowed_timing_review`, or `blocked_non_timing`
- `notes` copied from the comparison artifact when present

### Review order and grouping rules

The packet must preserve the comparison order from `REF-06`. Derrick should review **all 19 comparison units**, but not all units are judged the same way.

#### Row-by-row timing review required

These `boundary_exact` + `exact_normalized` units are reviewed one row at a time:

- `dlg-0002` — truth `[1]` vs runtime `[2]`
- `dlg-0003` — truth `[2]` vs runtime `[3]`
- `dlg-0004` — truth `[3]` vs runtime `[4]`
- `dlg-0006` — truth `[6]` vs runtime `[6]`
- `dlg-0008` — truth `[8]` vs runtime `[8]`
- `dlg-0011` — truth `[11]` vs runtime `[10]`
- `dlg-0012` — truth `[12]` vs runtime `[11]`
- `dlg-0013` — truth `[13]` vs runtime `[12]`
- `dlg-0014` — truth `[14]` vs runtime `[13]`
- `dlg-0017` — truth `[17]` vs runtime `[16]`
- `dlg-0018` — truth `[18]` vs runtime `[17]`
- `dlg-0019` — truth `[19]` vs runtime `[18]`

For these units, Derrick reviews the single benchmark line against the single runtime line and the suggested source clip.

#### Grouped window timing review required

These units are **not** judged row-by-row. They must be displayed and reviewed as grouped windows:

- `dlg-0001` — `split` window: truth `[0]` vs runtime `[0, 1]`
  - benchmark text: `They want you afraid. Fear makes you easier to control.`
  - review as one spoken window, not two separate runtime rows
- `dlg-0005` — `merge` window: truth `[4, 5]` vs runtime `[5]`
  - benchmark text: `Menendez is a terrorist. We're bringing peace and security to the world.`
  - review as one spoken window, not as two independent benchmark rows

For grouped windows, the packet must show both the child rows and the aggregated window span:

- `truth_window_start = min(start)` across participating benchmark rows
- `truth_window_end = max(end)` across participating benchmark rows
- `runtime_window_start = min(start)` across participating runtime rows
- `runtime_window_end = max(end)` across participating runtime rows

The human verdict is about whether the **window span** captures the right spoken content cleanly; it is not a request to assign sub-row blame inside the split/merge.

#### Blocked units still require human classification, but not timing judgment

These units must still appear in the packet, but as **blocked / non-timing review rows**:

- `dlg-0007` — truth `[7]` vs runtime `[7]` (`we` vs `you`)
- `dlg-0009` — truth `[9]` vs runtime `[]` (missing runtime dialogue line)
- `dlg-0010` — truth `[10]` vs runtime `[9]` (`Specter` vs `Spectre`, plus punctuation/casing drift)
- `dlg-0015` — truth `[15]` vs runtime `[14]` (`So eager to leave David.` vs `So eager to leave, are we?`; runtime timing status unresolved)
- `dlg-0016` — truth `[16]` vs runtime `[15]` (`the idea` vs `an idea`)

For these units, Derrick is **not** being asked to decide whether the timestamp is good. Derrick is being asked to confirm the blocking reason and whether the unit should stay blocked, be policy-normalized, or be escalated as an upstream dialogue-surface defect.

### What Derrick reviews for every packet row

Every unit, regardless of mode, must show these columns/fields in `packet.md` and `packet.json`:

- packet row id (`comparison_unit_id`)
- review mode (`row`, `window`, `blocked`)
- truth index set and runtime index set
- benchmark truth text
- runtime emitted text
- benchmark start/end
- runtime start/end
- benchmark/runtime duration and start/end deltas when available
- runtime timing status values
- boundary class and mismatch class
- a one-line instruction telling Derrick what to decide

Decision prompts by mode:

- `row`: “Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan?”
- `window`: “Does the aggregated runtime window cover the same spoken content as the benchmark window, despite split/merge segmentation drift?”
- `blocked`: “Is timing review legitimately blocked here, and if so is the blocker text drift, missing runtime coverage, unresolved timing, or normalization-policy ambiguity?”

### Human verdict rubric

`review-decisions.json` must use one primary `verdict` per unit from this exact enum:

- `timing_pass_row`
  - Use only for `review_mode = row`.
  - Meaning: benchmark and runtime are the same dialogue line, and the runtime span cleanly captures the spoken line.
- `timing_pass_window`
  - Use only for `review_mode = window`.
  - Meaning: split/merge drift exists, but the aggregated runtime window still captures the correct spoken content acceptably.
- `timing_fail_clipped_start`
  - Runtime starts too late and misses the start of the intended spoken content.
- `timing_fail_clipped_end`
  - Runtime ends too early and misses the end of the intended spoken content.
- `timing_fail_overspan`
  - Runtime captures extra neighboring speech beyond the intended benchmark unit/window.
- `timing_fail_misplaced`
  - Runtime is anchored to the wrong spoken occurrence or the wrong dialogue event.
- `timing_fail_order_defect`
  - Runtime ordering is impossible/non-monotonic for the reviewed unit(s).
- `blocked_text_drift`
  - Timing cannot be judged because emitted dialogue wording/content is not benchmark-equivalent.
- `blocked_missing_runtime`
  - Timing cannot be judged because the benchmark line/window has no corresponding runtime row/span.
- `blocked_unresolved_runtime`
  - Timing cannot be judged because runtime timing is unresolved or absent even though a candidate row exists.
- `needs_normalization_policy`
  - The blocker is primarily a comparator/review-policy ambiguity (for example `Specter` vs `Spectre`) rather than a clear timing defect.

Rubric notes:

- For text-clean `row` units, Derrick should prefer one of the `timing_pass_*` or `timing_fail_*` verdicts.
- For text-clean `window` units, Derrick should prefer `timing_pass_window` or a `timing_fail_*` verdict applied to the aggregated window.
- For blocked units, Derrick should **not** force a timing pass/fail. Use one of the `blocked_*` or `needs_normalization_policy` verdicts instead.
- `dlg-0010` should default to `needs_normalization_policy` unless source inspection clearly shows it must still be treated as a true text-drift blocker.
- `dlg-0015` should default to `blocked_text_drift`; if Derrick believes the text drift is tolerable but the missing timing is the real blocker, it may instead be marked `blocked_unresolved_runtime`.

### Durable human-decision artifact contract

`review-decisions.json` must contain one object per packet unit:

```json
{
  "packet_version": 1,
  "packet_kind": "dialogue_timestamp_human_review_decisions",
  "source_packet": ".plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.json",
  "decisions": [
    {
      "comparison_unit_id": "dlg-0001",
      "review_mode": "window",
      "truth_indexes": [0],
      "runtime_indexes": [0, 1],
      "verdict": "timing_pass_window",
      "reviewed_by": "Derrick",
      "reviewed_at": "YYYY-MM-DDTHH:MM:SSZ",
      "confidence": "high",
      "notes": "Optional human note",
      "source_clip_checked": {
        "start": 0,
        "end": 6
      },
      "follow_on_owner": "none"
    }
  ]
}
```

Required per-decision fields:

- `comparison_unit_id`
- `review_mode`
- `truth_indexes`
- `runtime_indexes`
- `verdict`
- `reviewed_by`
- `reviewed_at`
- `confidence` = `high`, `medium`, or `low`
- `notes`
- `source_clip_checked.start` / `source_clip_checked.end`
- `follow_on_owner` = `none`, `dialogue_reconciliation`, `timestamp_alignment`, or `comparator_policy`

### Packet-level completion summary

After all rows are reviewed, the durable decision artifact should also record packet totals:

- `timing_pass_row_count`
- `timing_pass_window_count`
- `timing_fail_count`
- `blocked_text_drift_count`
- `blocked_missing_runtime_count`
- `blocked_unresolved_runtime_count`
- `needs_normalization_policy_count`

Interpretation rule for the next lane:

- If failures occur mostly on text-clean `row` / `window` units, the next lane is **timestamp alignment**.
- If blocked counts dominate, the next lane is **dialogue reconciliation / text cleanup**.
- If `needs_normalization_policy` is the only blocker class, the next lane is **comparator policy / normalization**, not timestamp repair.

---

## Tasks

### Task 1: Design the human review packet and review rubric

**Bead ID:** `ee-rdga`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Claim bead ee-rdga on start with bd update ee-rdga --status in_progress --json. Design the dialogue timestamp human-review packet and rubric using the dedicated benchmark truth, emitted artifact, and durable machine comparison artifact. Define exactly what Derrick should review row-by-row, where grouped windows are required, what verdict categories the review should use, and what durable artifact format should capture the human decisions. Keep the packet benchmark-anchored and split/merge-tolerant. Update the active plan and close bead ee-rdga with bd close ee-rdga --reason "Dialogue timestamp human-review packet contract documented" --json only when the human-review lane is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/` (planned output)
- `output/cod-test-phase1-timestamp-validation/phase1-gather-context/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md`
- planned review packet artifacts under `.plans/artifacts/`

**Status:** ✅ Complete

**Results:** Execution-ready packet contract documented in-plan. The design now fixes the packet bundle (`packet.md`, `packet.json`, `review-decisions.json`), the exact row-vs-window-vs-blocked review split for all `19` comparison units, the required grouped windows (`dlg-0001`, `dlg-0005`), the exact human verdict enum, and the durable decision-record schema that keeps the human review benchmark-anchored and split/merge-tolerant.

---

### Task 2: Build the dialogue timestamp human review packet

**Bead ID:** `ee-r2k1`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Claim bead ee-r2k1 on start with bd update ee-r2k1 --status in_progress --json. Build the approved dialogue timestamp human-review packet and any minimal helper artifacts needed so Derrick can review benchmark truth versus emitted dialogue timestamps cleanly. Prefer durable markdown/json artifacts in .plans/artifacts over ad-hoc chat formatting. Include exact rows/windows, benchmark timing, runtime timing, text alignment context, and the review rubric categories. Keep the scope to packet-building only; do not change runtime outputs or benchmark truth. Run repo-local validation on any helper scripts, commit/push before QA handoff unless explicitly blocked, and close bead ee-r2k1 with bd close ee-r2k1 --reason "Dialogue timestamp human-review packet built" --json only when the packet is ready for Derrick.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`
- helper/validation paths only if truly needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md`
- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.md`
- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.json`
- `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/review-decisions.json`
- `scripts/qa/generate-dialogue-timestamp-human-review-packet.py`

**Status:** ✅ Complete

**Results:** Claimed `ee-r2k1`, built the durable human-review packet bundle under `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/`, and kept scope strictly to packet generation. The helper script `scripts/qa/generate-dialogue-timestamp-human-review-packet.py` reads `REF-03` / `REF-04` / `REF-05` / `REF-06`, preserves the `19` comparison units in machine order, applies the locked review split (`12` `row`, `2` `window`, `5` `blocked`), and emits both the human worksheet and machine-readable packet plus a durable review-decision template.

Validation run for this coder lane:
- `python3 scripts/qa/generate-dialogue-timestamp-human-review-packet.py`
- ad-hoc Python assertion check confirming packet/review-decision JSON parse cleanly, preserve all `19` units, and match the exact required grouped-window ids (`dlg-0001`, `dlg-0005`) plus blocked ids (`dlg-0007`, `dlg-0009`, `dlg-0010`, `dlg-0015`, `dlg-0016`)

Packet-building caveats recorded for QA/audit:
- Benchmark truth timings and runtime timings are intentionally both shown even when they live on different absolute time surfaces; the packet is benchmark-anchored for comparison, not claiming those numeric spans already agree.
- `review-decisions.json` is delivered as a durable template with enum-valid default verdict placeholders and explicit `TEMPLATE DEFAULT ONLY` notes so Derrick can replace them during the human pass without depending on chat history.
- `dlg-0010` defaults to `needs_normalization_policy` per the documented contract, `dlg-0009` defaults to `blocked_missing_runtime`, and `dlg-0015` stays on the contract-default `blocked_text_drift` even though the paired runtime row is unresolved.

---

### Task 3: QA the review packet for correctness and usability

**Bead ID:** `ee-yw2z`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Claim bead ee-yw2z on start with bd update ee-yw2z --status in_progress --json. QA the dialogue timestamp human-review packet for correctness and practical usability. Confirm it uses benchmark truth as authority, preserves split/merge-tolerant review windows, clearly separates text-drift-blocked regions from timing-reviewable regions, and is something Derrick can actually use directly without extra interpretation. Update the active plan with exact findings and remaining caveats. Do not broaden into runtime repair. Close bead ee-yw2z with bd close ee-yw2z --reason "Dialogue timestamp human-review packet QA-complete" --json only when findings are fully documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/` (inspection)
- artifact/truth inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit readiness and hand off the packet for Derrick’s review

**Bead ID:** `ee-bsux`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `Claim bead ee-bsux on start with bd update ee-bsux --status in_progress --json. Audit the final dialogue timestamp human-review packet. Confirm it is benchmark-anchored, preserves the correct caveats about split/merge tolerance, and is ready to hand to Derrick as the authoritative human-review surface. Recommend the exact next move after human review: dialogue text/reconciliation fix lane, timestamp-specific fix lane, or no code changes if timing passes. Close bead ee-bsux with bd close ee-bsux --reason "Dialogue timestamp human-review handoff audited" --json only when the handoff is ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/` (inspection)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Built the first-pass durable dialogue timestamp human-review bundle for Derrick: `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.md`, `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.json`, `.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/review-decisions.json`, plus the generator helper `scripts/qa/generate-dialogue-timestamp-human-review-packet.py`. The packet preserves all `19` machine comparison units, exposes the locked `12`/`2`/`5` row-vs-window-vs-blocked split, includes benchmark/runtime text and timing fields for every unit, and carries a durable review-decision template with the documented verdict enum.

**Reference Check:** The generated packet is anchored to `REF-03` as the benchmark timing truth, `REF-04` / `REF-05` as the emitted runtime text/timestamp surfaces, `REF-06` as the authoritative split/merge-tolerant comparison map, and `REF-07` as the benchmark-surface QA posture reference. Validation confirmed the packet order exactly matches `REF-06`, the grouped windows stay `dlg-0001` and `dlg-0005`, and the blocked set stays `dlg-0007`, `dlg-0009`, `dlg-0010`, `dlg-0015`, `dlg-0016`.

**Commits:**
- `aee851f` - Build dialogue timestamp human review packet

**Lessons Learned:** The human review surface must preserve benchmark authority and comparison windows explicitly; otherwise a reviewer will accidentally judge segmentation/text drift as if it were pure timing drift. Also, the durable decision template needs enum-valid defaults without pretending the human review already happened, so the packet must clearly mark those defaults as placeholders.

---

*Completed on YYYY-MM-DD*
