# Dialogue Timestamp Human Review Packet

- Packet kind: `dialogue_timestamp_human_review`
- Packet version: `1`
- Benchmark truth: `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json`
- Runtime timestamps: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json`
- Runtime text surface: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json`
- Machine comparison map: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json`
- QA summary reference: `.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md`

## Review Instructions

1. Review all 19 comparison units in order.
2. Use `row` sections for exact one-line timing judgment.
3. Use `window` sections for grouped split/merge timing judgment; judge the full spoken window, not the child rows independently.
4. Use `blocked` sections to confirm why timing cannot yet be judged.
5. Record final human decisions in `review-decisions.json` by replacing the template defaults.

## Verdict Enum

- `timing_pass_row`
- `timing_pass_window`
- `timing_fail_clipped_start`
- `timing_fail_clipped_end`
- `timing_fail_overspan`
- `timing_fail_misplaced`
- `timing_fail_order_defect`
- `blocked_text_drift`
- `blocked_missing_runtime`
- `blocked_unresolved_runtime`
- `needs_normalization_policy`

## Packet Summary

- Comparison units: `19`
- Row review units: `12`
- Window review units: `2` (`dlg-0001`, `dlg-0005`)
- Blocked review units: `5` (`dlg-0007`, `dlg-0009`, `dlg-0010`, `dlg-0015`, `dlg-0016`)
- artifact_integrity_drift_count: `0`
- text_drift_count: `5`
- segmentation_drift_count: `2`
- timing_drift_count: `0`
- timing_unresolved_count: `0`
- timing_blocked_by_text_drift_count: `4`
- clean_match_count: `12`

## Review Units

### dlg-0001 — window

- Review order: `1`
- Truth indexes: `[0]`
- Runtime indexes: `[0, 1]`
- Boundary class: `split`
- Mismatch class: `segmentation_drift`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned', 'aligned']`
- Truth text: `They want you afraid. Fear makes you easier to control.`
- Runtime text: `They want you afraid. Fear makes you easier to control.`
- Truth span: `0.000s` → `5.000s` (duration `5.000s`)
- Runtime span: `0.000s` → `2.800s` (duration `2.800s`)
- Start delta: `0.000s`
- End delta: `-2.200s`
- Suggested source clip: `0.000s` → `3.800s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `windowed_timing_review`
- Review prompt: dlg-0001: Does the aggregated runtime window cover the same spoken content as the benchmark window, despite split segmentation drift? Judge the whole spoken window, not the child rows independently.
- Notes: `[none]`

Child rows for grouped window review:

**Benchmark truth rows**
- truth[array 0 | row 0] 0.000s → 5.000s (duration 5.000s) — `They want you afraid. Fear makes you easier to control.`

**Runtime rows**
- runtime[array 0 | row 0] 0.000s → 1.200s (duration 1.200s; timing `aligned` via `asr_alignment`) — `They want you afraid.`
- runtime[array 1 | row 1] 1.500s → 2.800s (duration 1.300s; timing `aligned` via `asr_alignment`) — `Fear makes you easier to control.`

---

### dlg-0002 — row

- Review order: `2`
- Truth indexes: `[1]`
- Runtime indexes: `[2]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `It's time to wake up.`
- Runtime text: `It's time to wake up.`
- Truth span: `8.000s` → `10.000s` (duration `2.000s`)
- Runtime span: `3.000s` → `4.000s` (duration `1.000s`)
- Start delta: `-5.000s`
- End delta: `-6.000s`
- Suggested source clip: `2.000s` → `5.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0002: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 1 | row 1] 8.000s → 10.000s (duration 2.000s) — `It's time to wake up.`

**Runtime rows**
- runtime[array 2 | row 2] 3.000s → 4.000s (duration 1.000s; timing `aligned` via `asr_alignment`) — `It's time to wake up.`

---

### dlg-0003 — row

- Review order: `3`
- Truth indexes: `[2]`
- Runtime indexes: `[3]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Your streets, shall once again run red with your blood.`
- Runtime text: `Your streets shall once again run red with your blood.`
- Truth span: `12.000s` → `17.000s` (duration `5.000s`)
- Runtime span: `5.000s` → `8.000s` (duration `3.000s`)
- Start delta: `-7.000s`
- End delta: `-9.000s`
- Suggested source clip: `4.000s` → `9.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0003: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 2 | row 2] 12.000s → 17.000s (duration 5.000s) — `Your streets, shall once again run red with your blood.`

**Runtime rows**
- runtime[array 3 | row 3] 5.000s → 8.000s (duration 3.000s; timing `aligned` via `asr_alignment`) — `Your streets shall once again run red with your blood.`

---

### dlg-0004 — row

- Review order: `4`
- Truth indexes: `[3]`
- Runtime indexes: `[4]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Raul Menendez ignited global unrest on an unprecedented scale.`
- Runtime text: `Raul Menendez ignited global unrest on an unprecedented scale.`
- Truth span: `17.000s` → `21.000s` (duration `4.000s`)
- Runtime span: `9.000s` → `12.000s` (duration `3.000s`)
- Start delta: `-8.000s`
- End delta: `-9.000s`
- Suggested source clip: `8.000s` → `13.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0004: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 3 | row 3] 17.000s → 21.000s (duration 4.000s) — `Raul Menendez ignited global unrest on an unprecedented scale.`

**Runtime rows**
- runtime[array 4 | row 4] 9.000s → 12.000s (duration 3.000s; timing `aligned` via `asr_alignment`) — `Raul Menendez ignited global unrest on an unprecedented scale.`

---

### dlg-0005 — window

- Review order: `5`
- Truth indexes: `[4, 5]`
- Runtime indexes: `[5]`
- Boundary class: `merge`
- Mismatch class: `segmentation_drift`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Menendez is a terrorist. We're bringing peace and security to the world.`
- Runtime text: `Menendez is a terrorist. We're bringing peace and security to the world.`
- Truth span: `22.000s` → `26.000s` (duration `4.000s`)
- Runtime span: `12.500s` → `15.000s` (duration `2.500s`)
- Start delta: `-9.500s`
- End delta: `-11.000s`
- Suggested source clip: `11.500s` → `16.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `windowed_timing_review`
- Review prompt: dlg-0005: Does the aggregated runtime window cover the same spoken content as the benchmark window, despite merge segmentation drift? Judge the whole spoken window, not the child rows independently.
- Notes: `[none]`

Child rows for grouped window review:

**Benchmark truth rows**
- truth[array 4 | row 4] 22.000s → 24.000s (duration 2.000s) — `Menendez is a terrorist.`
- truth[array 5 | row 5] 24.000s → 26.000s (duration 2.000s) — `We're bringing peace and security to the world.`

**Runtime rows**
- runtime[array 5 | row 5] 12.500s → 15.000s (duration 2.500s; timing `aligned` via `asr_alignment`) — `Menendez is a terrorist. We're bringing peace and security to the world.`

---

### dlg-0006 — row

- Review order: `6`
- Truth indexes: `[6]`
- Runtime indexes: `[6]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `He refuses to let me go.`
- Runtime text: `He refuses to let me go.`
- Truth span: `28.000s` → `29.000s` (duration `1.000s`)
- Runtime span: `16.000s` → `17.500s` (duration `1.500s`)
- Start delta: `-12.000s`
- End delta: `-11.500s`
- Suggested source clip: `15.000s` → `18.500s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0006: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 6 | row 6] 28.000s → 29.000s (duration 1.000s) — `He refuses to let me go.`

**Runtime rows**
- runtime[array 6 | row 6] 16.000s → 17.500s (duration 1.500s; timing `aligned` via `asr_alignment`) — `He refuses to let me go.`

---

### dlg-0007 — blocked

- Review order: `7`
- Truth indexes: `[7]`
- Runtime indexes: `[7]`
- Boundary class: `boundary_exact`
- Mismatch class: `text_drift`
- Text match: `drift`
- Timing status: `timing_blocked_by_text_drift`
- Runtime timing statuses: `['aligned']`
- Truth text: `Stop looking backwards, David. What matters is what we do next.`
- Runtime text: `Stop looking backwards, David. What matters is what you do next.`
- Truth span: `30.000s` → `33.000s` (duration `3.000s`)
- Runtime span: `18.000s` → `21.000s` (duration `3.000s`)
- Start delta: `-12.000s`
- End delta: `-12.000s`
- Suggested source clip: `16.500s` → `22.500s` (surface `runtime`, padding `1.5s` )
- Default verdict bucket: `blocked_non_timing`
- Review prompt: dlg-0007: Timing review is currently blocked by text drift. Confirm whether this should stay blocked, be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. Boundary=boundary_exact; mismatch=text_drift.
- Notes: `similarity=0.959`

Unit rows:

**Benchmark truth rows**
- truth[array 7 | row 7] 30.000s → 33.000s (duration 3.000s) — `Stop looking backwards, David. What matters is what we do next.`

**Runtime rows**
- runtime[array 7 | row 7] 18.000s → 21.000s (duration 3.000s; timing `aligned` via `asr_alignment`) — `Stop looking backwards, David. What matters is what you do next.`

---

### dlg-0008 — row

- Review order: `8`
- Truth indexes: `[8]`
- Runtime indexes: `[8]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `A lot of people counting on us for answers.`
- Runtime text: `A lot of people counting on us for answers.`
- Truth span: `35.000s` → `36.000s` (duration `1.000s`)
- Runtime span: `21.500s` → `23.000s` (duration `1.500s`)
- Start delta: `-13.500s`
- End delta: `-13.000s`
- Suggested source clip: `20.500s` → `24.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0008: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 8 | row 8] 35.000s → 36.000s (duration 1.000s) — `A lot of people counting on us for answers.`

**Runtime rows**
- runtime[array 8 | row 8] 21.500s → 23.000s (duration 1.500s; timing `aligned` via `asr_alignment`) — `A lot of people counting on us for answers.`

---

### dlg-0009 — blocked

- Review order: `9`
- Truth indexes: `[9]`
- Runtime indexes: `[]`
- Boundary class: `missing_truth`
- Mismatch class: `text_drift`
- Text match: `drift`
- Timing status: `not_applicable`
- Runtime timing statuses: `[]`
- Truth text: `You shall know fear.`
- Runtime text: `[none]`
- Truth span: `45.000s` → `47.000s` (duration `2.000s`)
- Runtime span: `n/a` → `n/a` (duration `n/a`)
- Start delta: `n/a`
- End delta: `n/a`
- Suggested source clip: `43.500s` → `48.500s` (surface `truth`, padding `1.5s` )
- Default verdict bucket: `blocked_non_timing`
- Review prompt: dlg-0009: Timing review is currently blocked by missing runtime coverage. Confirm whether this should stay blocked, be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. Boundary=missing_truth; mismatch=text_drift.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 9 | row 9] 45.000s → 47.000s (duration 2.000s) — `You shall know fear.`

**Runtime rows**
- `[none]`

---

### dlg-0010 — blocked

- Review order: `10`
- Truth indexes: `[10]`
- Runtime indexes: `[9]`
- Boundary class: `boundary_exact`
- Mismatch class: `text_drift`
- Text match: `drift`
- Timing status: `timing_blocked_by_text_drift`
- Runtime timing statuses: `['aligned']`
- Truth text: `Specter one, report.`
- Runtime text: `Spectre One report.`
- Truth span: `51.000s` → `52.000s` (duration `1.000s`)
- Runtime span: `24.000s` → `25.000s` (duration `1.000s`)
- Start delta: `-27.000s`
- End delta: `-27.000s`
- Suggested source clip: `22.500s` → `26.500s` (surface `runtime`, padding `1.5s` )
- Default verdict bucket: `blocked_non_timing`
- Review prompt: dlg-0010: Timing review is currently blocked by normalization-policy ambiguity around Specter/Spectre plus punctuation/casing drift. Confirm whether this should stay blocked, be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. Boundary=boundary_exact; mismatch=text_drift.
- Notes: `similarity=0.944`

Unit rows:

**Benchmark truth rows**
- truth[array 10 | row 10] 51.000s → 52.000s (duration 1.000s) — `Specter one, report.`

**Runtime rows**
- runtime[array 9 | row 9] 24.000s → 25.000s (duration 1.000s; timing `aligned` via `asr_alignment`) — `Spectre One report.`

---

### dlg-0011 — row

- Review order: `11`
- Truth indexes: `[11]`
- Runtime indexes: `[10]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Need a sitrep.`
- Runtime text: `Need a sitrep.`
- Truth span: `54.000s` → `55.000s` (duration `1.000s`)
- Runtime span: `25.500s` → `26.500s` (duration `1.000s`)
- Start delta: `-28.500s`
- End delta: `-28.500s`
- Suggested source clip: `24.500s` → `27.500s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0011: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 11 | row 11] 54.000s → 55.000s (duration 1.000s) — `Need a sitrep.`

**Runtime rows**
- runtime[array 10 | row 10] 25.500s → 26.500s (duration 1.000s; timing `aligned` via `asr_alignment`) — `Need a sitrep.`

---

### dlg-0012 — row

- Review order: `12`
- Truth indexes: `[12]`
- Runtime indexes: `[11]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `This isn't real.`
- Runtime text: `This isn't real.`
- Truth span: `61.000s` → `62.000s` (duration `1.000s`)
- Runtime span: `27.000s` → `28.000s` (duration `1.000s`)
- Start delta: `-34.000s`
- End delta: `-34.000s`
- Suggested source clip: `26.000s` → `29.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0012: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 12 | row 12] 61.000s → 62.000s (duration 1.000s) — `This isn't real.`

**Runtime rows**
- runtime[array 11 | row 11] 27.000s → 28.000s (duration 1.000s; timing `aligned` via `asr_alignment`) — `This isn't real.`

---

### dlg-0013 — row

- Review order: `13`
- Truth indexes: `[13]`
- Runtime indexes: `[12]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `The hell it ain't!`
- Runtime text: `The hell it ain't!`
- Truth span: `63.000s` → `64.000s` (duration `1.000s`)
- Runtime span: `28.500s` → `29.500s` (duration `1.000s`)
- Start delta: `-34.500s`
- End delta: `-34.500s`
- Suggested source clip: `27.500s` → `30.500s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0013: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 13 | row 13] 63.000s → 64.000s (duration 1.000s) — `The hell it ain't!`

**Runtime rows**
- runtime[array 12 | row 12] 28.500s → 29.500s (duration 1.000s; timing `aligned` via `asr_alignment`) — `The hell it ain't!`

---

### dlg-0014 — row

- Review order: `14`
- Truth indexes: `[14]`
- Runtime indexes: `[13]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Pull it together, man!`
- Runtime text: `Pull it together, man.`
- Truth span: `98.000s` → `99.000s` (duration `1.000s`)
- Runtime span: `90.000s` → `92.000s` (duration `2.000s`)
- Start delta: `-8.000s`
- End delta: `-7.000s`
- Suggested source clip: `89.000s` → `93.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0014: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 14 | row 14] 98.000s → 99.000s (duration 1.000s) — `Pull it together, man!`

**Runtime rows**
- runtime[array 13 | row 16] 90.000s → 92.000s (duration 2.000s; timing `aligned` via `asr_alignment`) — `Pull it together, man.`

---

### dlg-0015 — blocked

- Review order: `15`
- Truth indexes: `[15]`
- Runtime indexes: `[14]`
- Boundary class: `boundary_exact`
- Mismatch class: `text_drift`
- Text match: `drift`
- Timing status: `timing_blocked_by_text_drift`
- Runtime timing statuses: `['unresolved']`
- Truth text: `So eager to leave David.`
- Runtime text: `So eager to leave, are we?`
- Truth span: `100.000s` → `102.000s` (duration `2.000s`)
- Runtime span: `n/a` → `n/a` (duration `n/a`)
- Start delta: `n/a`
- End delta: `n/a`
- Suggested source clip: `98.500s` → `103.500s` (surface `truth`, padding `1.5s` )
- Default verdict bucket: `blocked_non_timing`
- Review prompt: dlg-0015: Timing review is currently blocked by text drift with unresolved runtime timing. Confirm whether this should stay blocked, be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. Boundary=boundary_exact; mismatch=text_drift.
- Notes: `similarity=0.809; runtime includes unresolved timing status`

Unit rows:

**Benchmark truth rows**
- truth[array 15 | row 15] 100.000s → 102.000s (duration 2.000s) — `So eager to leave David.`

**Runtime rows**
- runtime[array 14 | row 17] n/a → n/a (duration n/a; timing `unresolved` via `asr_alignment`) — `So eager to leave, are we?`

---

### dlg-0016 — blocked

- Review order: `16`
- Truth indexes: `[16]`
- Runtime indexes: `[15]`
- Boundary class: `boundary_exact`
- Mismatch class: `text_drift`
- Text match: `drift`
- Timing status: `timing_blocked_by_text_drift`
- Runtime timing statuses: `['aligned']`
- Truth text: `Killing a man is a hell of a lot easier than killing the idea.`
- Runtime text: `Killing a man is a hell of a lot easier than killing an idea.`
- Truth span: `103.000s` → `105.000s` (duration `2.000s`)
- Runtime span: `93.000s` → `98.000s` (duration `5.000s`)
- Start delta: `-10.000s`
- End delta: `-7.000s`
- Suggested source clip: `91.500s` → `99.500s` (surface `runtime`, padding `1.5s` )
- Default verdict bucket: `blocked_non_timing`
- Review prompt: dlg-0016: Timing review is currently blocked by text drift. Confirm whether this should stay blocked, be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. Boundary=boundary_exact; mismatch=text_drift.
- Notes: `similarity=0.959`

Unit rows:

**Benchmark truth rows**
- truth[array 16 | row 16] 103.000s → 105.000s (duration 2.000s) — `Killing a man is a hell of a lot easier than killing the idea.`

**Runtime rows**
- runtime[array 15 | row 18] 93.000s → 98.000s (duration 5.000s; timing `aligned` via `asr_alignment`) — `Killing a man is a hell of a lot easier than killing an idea.`

---

### dlg-0017 — row

- Review order: `17`
- Truth indexes: `[17]`
- Runtime indexes: `[16]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `You were never cut out to be a Mason.`
- Runtime text: `You were never cut out to be a Mason.`
- Truth span: `108.000s` → `110.000s` (duration `2.000s`)
- Runtime span: `99.000s` → `101.000s` (duration `2.000s`)
- Start delta: `-9.000s`
- End delta: `-9.000s`
- Suggested source clip: `98.000s` → `102.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0017: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 17 | row 17] 108.000s → 110.000s (duration 2.000s) — `You were never cut out to be a Mason.`

**Runtime rows**
- runtime[array 16 | row 19] 99.000s → 101.000s (duration 2.000s; timing `aligned` via `asr_alignment`) — `You were never cut out to be a Mason.`

---

### dlg-0018 — row

- Review order: `18`
- Truth indexes: `[18]`
- Runtime indexes: `[17]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `No more games! This ends now.`
- Runtime text: `No more games. This ends now.`
- Truth span: `112.000s` → `114.000s` (duration `2.000s`)
- Runtime span: `102.000s` → `104.000s` (duration `2.000s`)
- Start delta: `-10.000s`
- End delta: `-10.000s`
- Suggested source clip: `101.000s` → `105.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0018: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 18 | row 18] 112.000s → 114.000s (duration 2.000s) — `No more games! This ends now.`

**Runtime rows**
- runtime[array 17 | row 20] 102.000s → 104.000s (duration 2.000s; timing `aligned` via `asr_alignment`) — `No more games. This ends now.`

---

### dlg-0019 — row

- Review order: `19`
- Truth indexes: `[19]`
- Runtime indexes: `[18]`
- Boundary class: `boundary_exact`
- Mismatch class: `clean_match`
- Text match: `exact_normalized`
- Timing status: `timing_ok`
- Runtime timing statuses: `['aligned']`
- Truth text: `Get the Reznov challenge pack when you preorder now!`
- Runtime text: `Get the Reznov challenge pack when you pre-order now.`
- Truth span: `122.000s` → `124.000s` (duration `2.000s`)
- Runtime span: `108.000s` → `112.000s` (duration `4.000s`)
- Start delta: `-14.000s`
- End delta: `-12.000s`
- Suggested source clip: `107.000s` → `113.000s` (surface `runtime`, padding `1.0s` )
- Default verdict bucket: `timing_review`
- Review prompt: dlg-0019: Does the runtime span for this exact matched line start and end on the correct spoken line without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.
- Notes: `[none]`

Unit rows:

**Benchmark truth rows**
- truth[array 19 | row 19] 122.000s → 124.000s (duration 2.000s) — `Get the Reznov challenge pack when you preorder now!`

**Runtime rows**
- runtime[array 18 | row 22] 108.000s → 112.000s (duration 4.000s; timing `aligned` via `asr_alignment`) — `Get the Reznov challenge pack when you pre-order now.`

---
