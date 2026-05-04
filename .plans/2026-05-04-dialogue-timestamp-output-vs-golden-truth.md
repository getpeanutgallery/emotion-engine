# Peanut Gallery Emotion Engine

**Date:** 2026-05-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Compare the latest Phase-1 COD dialogue timestamp artifact against the dialogue golden truth, quantify exactly where it matches or drifts, and decide the narrowest next dialogue-only improvement lane before touching music-vocals again.

---

## Overview

The last completed slice proved the new Phase-1 timestamp validation config is structurally sound: reconciliation runs before timestamp derivation, both reconciled timestamp artifacts emit, and Phase 2/report do not run real work. That lane is done. What remains open is quality, starting with dialogue exactly as the handoff specified.

This plan keeps the scope intentionally tight. First we establish the comparison surface: the emitted dialogue timestamp artifact is timing the reconciled dialogue text, not the raw golden truth text directly, so the review needs to separate three different failure classes instead of blending them together: (1) transcript/text drift vs truth, (2) segmentation drift vs truth, and (3) timestamp/alignment drift on segments that are otherwise valid matches. That separation matters because the right next fix may live in reconciliation/dialogue capture, the timestamp alignment lane, or benchmark/comparator logic.

A newly discovered benchmark prerequisite now also shapes this slice: the current local `truth/dialogue-data.json` and `truth/dialogue-data.raw.json` no longer preserve the historical manual dialogue timestamps, while `truth/music-vocals-data.json` still preserves `start` / `end`. Git history confirms a last-known timed dialogue truth surface still existed at commit `1771225`, while later current-shape truth commits such as `5cc0b6b` and `5c7ecf4` do not. That means dialogue needs a recovered-and-adapted dedicated timestamp benchmark surface for the reconciled dialogue lane, and music-vocals should likewise get its own dedicated timestamp benchmark surface extracted from the current timed truth rather than overloading the existing text-truth files.

The practical output of this slice should be a grounded dialogue-only verdict with examples and counts, plus a recommendation for the next bead sequence. If the timestamp artifact is mostly fine but hamstrung by upstream text drift, the next implementation lane should target dialogue text/segmentation quality first. If the text matches enough but timing is still bad, then the next lane should target timestamp derivation/alignment directly. In parallel, the benchmark follow-on needs to recover dialogue timing truth from history and split both dialogue and music-vocals timing into explicit benchmark files purpose-built for direct comparison against the new timestamp artifacts.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Archived handoff plan for the completed Phase-1 timestamp validation lane | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/archive/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md` |
| `REF-02` | Latest emitted reconciled dialogue timestamp artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json` |
| `REF-03` | Latest emitted reconciled dialogue text artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-04` | COD reconciled dialogue golden truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-05` | COD raw dialogue golden truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-data.raw.json` |
| `REF-06` | Dialogue timestamp derivation implementation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue-timestamps.cjs` |
| `REF-07` | Prior dialogue scoring/reconciliation comparison plan likely relevant to drift classification | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md` |
| `REF-08` | Current music-vocals truth surface that still preserves timing | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/music-vocals-data.json` |
| `REF-09` | Last-known git commit where dialogue truth still preserved timing fields | `git commit 1771225` |
| `REF-10` | Later git commit showing current-shape dialogue truth without timing | `git commit 5cc0b6b` |

---

## Execution-Ready Dialogue-Only Comparison Method

### 1) Artifact integrity gate

Before comparing against golden truth, verify that the timestamp artifact is only adding timing and is not introducing new text drift.

- Candidate runtime timing surface: `REF-02`
- Candidate runtime text surface: `REF-03`
- Required gate: `REF-02.dialogue_segments` must match `REF-03.dialogue_segments` 1:1 by ordered index and normalized text.
- If any row differs in text/order/cardinality, classify that as `artifact_integrity_drift`, stop the timing review, and hand the defect to the timestamp-derivation lane before doing any golden-truth scoring.

### 2) Canonical truth surfaces by mismatch class

- **Transcript/text drift canonical truth:** `REF-04` (`truth/dialogue-data.json`)
  - Reason: this is the dialogue-only reconciled/spoken golden contract that the reconciled timestamp artifact is supposed to approximate.
- **Segmentation drift canonical truth:** `REF-04` (`truth/dialogue-data.json`)
  - Reason: segmentation should be judged against the reconciled dialogue truth surface, not against the emitted timestamp rows alone.
- **Timing drift canonical truth:** the actual spoken occurrence in the COD source media for the `REF-04` truth text window being evaluated.
  - Important constraint: there is **no** golden timing JSON in the required references, so timing truth is audio-backed, not fixture-JSON-backed.
  - `REF-02` provides the candidate hypothesis (`start`, `end`, `timing.status`); the source media is the final authority.
- **Diagnostic-only secondary truth:** `REF-05` (`truth/dialogue-data.raw.json`)
  - Use only to explain whether a boundary/text expectation came from raw spoken capture vs reconciled truth shaping. Do **not** use `REF-05` as the primary scoring surface for the reconciled timestamp artifact.

### 3) Comparison passes, in order

#### Pass A — transcript/text drift (ignore timing for now)

Use the split/merge-tolerant dialogue comparison posture established in `REF-07`.

- Compare the runtime dialogue text from `REF-03` against `REF-04`.
- Use normalized concatenated-text comparison first, with the same benchmark-style normalization posture already established for dialogue scoring (case/punctuation/quote/hyphenation-insensitive where the benchmark runner already is).
- Build many-to-many alignment windows so one truth row can align to multiple runtime rows and vice versa.
- For each aligned window, compare **concatenated normalized text**:
  - If concatenated normalized text is not equal, classify the window as **`text_drift`**.
  - If concatenated normalized text is equal, the window is text-clean and can proceed to segmentation classification.

This keeps wording drift separate from harmless split/merge drift.

#### Pass B — segmentation drift (only after text-clean windowing)

For every text-clean window from Pass A:

- If truth rows and runtime rows are both `1`, classify as **`boundary_exact`**.
- If truth rows `1` and runtime rows `>1`, classify as **`split`**.
- If truth rows `>1` and runtime rows `1`, classify as **`merge`**.
- If both sides have `>1` rows but the concatenated text still matches, classify as **`mixed_resegmentation`**.

Rule: when concatenated normalized text matches but row cardinality differs, the mismatch class is **`segmentation_drift`**, not `text_drift`.

#### Pass C — timing drift (only on windows not blocked by text drift)

Timing is evaluated only after Passes A and B have established what text the row/window is supposed to represent.

- **Eligible for row-level timing review:** `boundary_exact` windows only.
- **Eligible for window-level timing review:** `split`, `merge`, and `mixed_resegmentation` windows whose concatenated normalized text matches exactly.
- **Not eligible for timing blame:** any `text_drift` window. Mark these as **`timing_blocked_by_text_drift`**.

Timing evaluation rules:

- For `boundary_exact` rows, compare the `REF-02` segment (`start`, `end`, `timing.status`) to the actual spoken occurrence of the matched `REF-04` truth line in source media.
- For `split` / `merge` / `mixed_resegmentation` windows, do **not** judge each sub-row independently against truth boundaries. Instead, aggregate the runtime window span:
  - `window_start = min(start)` across matched runtime rows with timings
  - `window_end = max(end)` across matched runtime rows with timings
  - Compare that aggregate span to the actual spoken occurrence of the matched truth window in source media.

Timing outcome classes:

- `timing_ok`
- `timing_unresolved` (`timing.status != aligned`)
- `timing_misplaced` (matched text anchored to the wrong spoken occurrence)
- `timing_clipped_start`
- `timing_clipped_end`
- `timing_overspan` (captures neighboring speech beyond the matched line/window)
- `timing_order_defect` (non-monotonic or impossible ordering)
- `timing_blocked_by_text_drift`

### 4) Exact comparison row/table shape

Produce one detailed row per aligned comparison unit, where a unit is either a single exact row or a grouped split/merge window.

| Field | Meaning |
| --- | --- |
| `comparison_unit_id` | Stable row/window id, e.g. `dlg-0007` |
| `truth_indexes` | Truth row indexes from `REF-04` included in this unit |
| `runtime_indexes` | Runtime row indexes from `REF-02` / `REF-03` included in this unit |
| `truth_text` | Concatenated truth text |
| `runtime_text` | Concatenated runtime text |
| `text_match` | `exact_normalized` or `drift` |
| `boundary_class` | `boundary_exact` / `split` / `merge` / `mixed_resegmentation` / `missing_truth` / `extra_runtime` |
| `mismatch_class` | Primary owner: `text_drift`, `segmentation_drift`, `timing_drift`, `artifact_integrity_drift`, or `clean_match` |
| `timing_eligibility` | `row_level`, `window_level`, `blocked_by_text_drift`, `not_applicable` |
| `runtime_timing_statuses` | Raw timing statuses from `REF-02` rows |
| `runtime_start` | Row start for exact row, or `min(start)` for grouped window |
| `runtime_end` | Row end for exact row, or `max(end)` for grouped window |
| `timing_verdict` | `timing_ok`, `timing_unresolved`, `timing_misplaced`, etc. |
| `canonical_truth_source` | Usually `REF-04`; timing rows note `source media` |
| `diagnostic_secondary_source` | `REF-05` when raw-vs-reconciled explanation matters |
| `notes` | Short human-readable explanation |

Also emit a small summary block with counts:

- `artifact_integrity_drift_count`
- `text_drift_count`
- `segmentation_drift_count`
- `timing_drift_count`
- `timing_unresolved_count`
- `timing_blocked_by_text_drift_count`
- `clean_match_count`

### 5) Narrowest evidence package for any coder follow-on

If a follow-on implementation lane is needed, do **not** hand over the entire run. Hand over only the failing comparison units plus immediate context.

For each failing unit, preserve:

- `truth_indexes` + `runtime_indexes`
- raw `REF-04` truth text and raw `REF-02` runtime text
- the unit’s normalized concatenated text on both sides
- boundary classification and primary mismatch owner
- `timing.status`, `start`, and `end` from every involved runtime row
- one neighbor unit before and after for context
- explicit source paths (`REF-02`, `REF-03`, `REF-04`, and `REF-05` only when needed)
- for timing-specific defects only: a short source-media review target covering the emitted runtime span with a small margin, because timing truth lives in the media rather than a golden JSON fixture

This keeps the coder lane narrow:

- `text_drift` → dialogue extraction/reconciliation lane
- `segmentation_drift` → reconciliation or comparator/windowing lane
- `timing_drift` / `timing_unresolved` on text-clean units → timestamp-alignment lane

---

## Tasks

### Task 1: Define the exact dialogue-only comparison method

**Bead ID:** `ee-uu41`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-07`  
**Prompt:** `Claim bead ee-uu41 on start with bd update ee-uu41 --status in_progress --json. Review the archived Phase-1 timestamp validation findings plus the latest dialogue timestamp artifact and dialogue golden-truth surfaces. Define the exact comparison method for this slice so we cleanly separate transcript/text drift, segmentation drift, and timing drift. Recommend the comparison table/fields, the canonical source of truth for each class of mismatch, and the narrowest evidence package needed for a follow-on coder lane if improvements are required. Update the active plan with the agreed method and close bead ee-uu41 with bd close ee-uu41 --reason "Execution-ready dialogue comparison method documented" --json only when the dialogue-only review approach is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/` (inspection only)
- `benchmarks/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md`

**Status:** ✅ Complete

**Results:** Documented an execution-ready comparison contract directly in the plan. Core decision: the dialogue timestamp artifact must be evaluated in three ordered passes, not one blended score. First, prove `REF-02` is text-identical to `REF-03` so the timestamp artifact is only adding timing. Second, compare runtime reconciled dialogue text against `REF-04` using the split/merge-tolerant windowing posture from `REF-07`, with concatenated normalized text deciding `text_drift` and boundary cardinality deciding `segmentation_drift`. Third, evaluate timing only on units that are already text-clean: exact `1:1` rows get row-level timing review, while split/merge windows get aggregate-span timing review. The plan now also locks the comparison table shape, summary counts, canonical truth source for each mismatch class, and the minimal failing-unit evidence package needed for any follow-on coder lane. `REF-05` is explicitly diagnostic-only raw-context support rather than the primary scoring surface for the reconciled timestamp artifact.

---

### Task 2: Compare emitted dialogue timestamps against golden truth and classify drift

**Bead ID:** `ee-dlnr`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Claim bead ee-dlnr on start with bd update ee-dlnr --status in_progress --json. Execute the approved dialogue-only comparison against the latest Phase-1 COD artifacts. Produce a grounded finding set that classifies every meaningful mismatch into transcript/text drift, segmentation drift, or timing drift, with concrete examples and counts. Call out which dialogue segments are good enough already, which are unresolved, and which are blocked by upstream text mismatch rather than timestamp alignment itself. Record exact artifact paths, any helper scripts/commands used, and the practical verdict in the active plan. Close bead ee-dlnr with bd close ee-dlnr --reason "Dialogue timestamp comparison completed and classified" --json only when the findings are fully documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/` (inspection only)
- `benchmarks/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md`
- `output/cod-test-phase1-timestamp-validation/phase1-gather-context/compare-dialogue-timestamps-vs-truth.py`
- `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json`

**Status:** ✅ Complete

**Results:** Claimed `ee-dlnr`, verified artifact integrity first, then ran a dialogue-only split/merge-tolerant comparison against `REF-04` and persisted the result at `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json`. Helper used: `python3 output/cod-test-phase1-timestamp-validation/phase1-gather-context/compare-dialogue-timestamps-vs-truth.py`, which compares `REF-02` vs `REF-03` for 1:1 text/order integrity and then classifies reconciled timestamp windows against `REF-04`.

Grounded findings from the persisted comparison artifact:
- **Artifact integrity:** `0` integrity drifts. `REF-02` and `REF-03` are text/order-identical at `19/19` rows, so the timestamp artifact is not introducing transcript corruption on top of reconciled dialogue.
- **Comparison-unit totals:** `19` dialogue-only units/windows.
- **Already good enough:** `12` clean `1:1` truth/runtime units plus `2` text-clean resegmentation units (`dlg-0001` split, `dlg-0005` merge). On all `15` text-clean runtime rows/windows, runtime timing status is currently `aligned` and this QA pass found **no positive timing drift** to escalate.
- **Segmentation drift:** `2` units, both text-clean and timing-eligible at the window level.
  - `dlg-0001`: truth `0` (“They want you afraid. Fear makes you easier to control.”) is emitted as runtime rows `0-1` with identical normalized text, span `0.0-2.8`.
  - `dlg-0005`: truth `4-5` (“Menendez is a terrorist. We're bringing peace and security to the world.”) is emitted as runtime row `5` with identical normalized text, span `12.5-15.0`.
- **Transcript/text drift:** `5` units.
  - `dlg-0007`: truth `7` has **we/you** wording drift — truth “what **we** do next” vs runtime “what **you** do next” — so timing is blocked by upstream text mismatch even though runtime timing status is aligned (`18.0-21.0`).
  - `dlg-0009`: truth `9` (“You shall know fear.”) is **missing** from the reconciled runtime dialogue surface entirely, so this is an upstream dialogue-surface miss, not a timestamp-placement problem.
  - `dlg-0010`: truth `10` vs runtime `9` is minor but still real text drift — “**Specter** one, report.” vs “**Spectre** One report.” — so timing is blocked by text mismatch despite aligned runtime timing (`24.0-25.0`).
  - `dlg-0015`: truth `15` vs runtime `14` is substantive wording drift — truth “So eager to leave David.” vs runtime “So eager to leave, are we?” — and this is the only involved runtime row whose timing status is explicitly `unresolved`; that unresolved timing remains **blocked by upstream text drift** rather than standing as a clean timestamp-only defect.
  - `dlg-0016`: truth `16` vs runtime `15` differs on **the/an** (“killing **the** idea” vs “killing **an** idea”); timing is blocked by text mismatch even though runtime timing is aligned (`93.0-98.0`).
- **Timing verdict:** For this dialogue-only slice, the evidence supports `0` confirmed timing drifts on text-clean units, `0` timing-unresolved text-clean units, and `4` paired units where timing review is blocked by text drift. The only unresolved runtime timing status present in `REF-02` is attached to `dlg-0015`, which is already a text-drift failure.

Practical verdict: the current reconciled dialogue timestamp output is **not ready as a clean human-review timestamp truth pass** because `5/19` comparison units are still upstream dialogue-text failures and one of those carries the only unresolved timing row. It **is** good enough to show that timestamp alignment is largely behaving on the text-clean portion: the remaining blockers are dominated by dialogue extraction/reconciliation drift, not by proven timestamp-placement drift.

---

### Task 3: Audit the dialogue-only verdict and recommend the next implementation lane

**Bead ID:** `ee-4vit`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `Claim bead ee-4vit on start with bd update ee-4vit --status in_progress --json. Independently audit the dialogue-only comparison findings. Verify the classification between text drift, segmentation drift, and true timing drift is supported by the artifacts, and recommend the narrowest next lane: upstream dialogue/reconciliation improvement, timestamp-alignment improvement, comparator/scoring improvement, or a justified mix. Close bead ee-4vit with bd close ee-4vit --reason "Dialogue-only verdict audited with next lane recommendation" --json only if the recommendation is evidence-backed and specific enough to plan the next coder task without broadening back into music-vocals.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- artifact/truth inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md`

**Status:** ✅ Complete

**Results:** Independently re-audited the source artifacts rather than relying only on the persisted comparison JSON. Confirmed `REF-02` and `REF-03` are still text/order-identical at `19/19` rows, so the timestamp artifact is not adding new transcript corruption. Confirmed the two segmentation cases are real text-clean resegmentations supported directly by source rows: truth `0` vs runtime `0-1` is a split, and truth `4-5` vs runtime `5` is a merge. Confirmed there is no source-backed evidence here for a clean timing-only defect: every text-clean runtime row/window in `REF-02` is currently `timing.status = aligned`, and the only `unresolved` row is runtime `14` / truth `15` (`"So eager to leave…"`), which is already blocked by substantive wording drift.

Audit nuance: the QA conclusion is directionally correct, but one classification edge should be called out explicitly. `dlg-0010` (`"Specter one, report."` vs `"Spectre One report."`) is policy-sensitive: under the current comparator it remains `text_drift`, but under a looser pronunciation/spelling normalization it could be treated as text-clean. Either way, it is still **not** evidence of timing drift. So the auditor verdict is: QA's `no confirmed timing drift on text-clean dialogue units` conclusion holds.

Narrowest next lane recommendation: **do not spend the next coder bead on dialogue timestamp alignment.** The next implementation lane should stay dialogue-only and target the benchmark/review surface first, then upstream dialogue text cleanup. Specifically:
1. Recover a dedicated dialogue timestamp benchmark from commit `1771225`, reshape it to the current reconciled dialogue-only surface, and keep it separate from the current traits-only `truth/dialogue-data*.json` files.
2. Split music-vocals timing into its own dedicated benchmark file derived from the current timed `truth/music-vocals-data.json`, without mixing that work into dialogue behavior changes.
3. After that benchmark surface exists, hand the next coder bead the concrete dialogue text misses only (`we/you`, missing `"You shall know fear."`, `So eager to leave…`, `killing the/an idea`, plus the comparator-policy decision for `Specter/Spectre`).

Human-review readiness verdict: the current reconciled dialogue timestamp output is useful as a **diagnostic** artifact, but not yet ready for a full human timing review pass because the review surface is still contaminated by upstream dialogue text drift and the repo no longer has a dedicated dialogue timing truth file to anchor that review.
---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Completed the dialogue-only QA comparison slice, persisted a durable comparison artifact plus helper script under `output/cod-test-phase1-timestamp-validation/phase1-gather-context/`, and finished an independent audit of the verdict. The audited evidence shows the timestamp artifact is internally consistent with reconciled dialogue text, contains `2` text-clean segmentation drifts, `4` clearly substantive transcript/text drifts plus `1` comparator-policy-sensitive wording/spelling drift (`Specter`/`Spectre`), and no confirmed timing-only drifts on the text-clean portion.

**Reference Check:** `REF-02` and `REF-03` match 1:1 for text/order integrity. `REF-04` remains the canonical comparison surface for dialogue truth. `REF-05` was used only as a diagnostic secondary surface when raw vs reconciled wording context helped explain drift shape. `REF-06` supports the audit conclusion that the current artifact preserves upstream dialogue text verbatim and derives timing downstream, which is why the present defects point upstream before they point at timestamp alignment.

**Commits:**
- None in this QA slice (`do not commit` respected).

**Lessons Learned:** On the current COD Phase-1 output, timestamp alignment is not the dominant dialogue blocker. The narrowest next lane is upstream dialogue extraction/reconciliation cleanup for the `5` text-drift units; only after those are corrected does it make sense to spend dedicated timestamp-audit effort on the blocked rows.

---

## Follow-on Benchmark Surface Requirements

These are now explicit outputs of the broader timestamp-comparison lane, even if their implementation lands in the next execution slice after the current dialogue-only verdict:

1. **Dialogue timestamp benchmark recovery**
   - Recover the last known timed dialogue truth from `REF-09` and verify when/why timing was removed by comparing with `REF-10` and current truth files.
   - Build a dedicated `cod-test` dialogue timestamp benchmark file shaped for direct comparison against `dialogue-timestamps-data.reconciled.json`.
   - This benchmark must match the **reconciled dialogue comparison surface**, not the older raw/speaker/confidence-rich truth shape.

2. **Music-vocals timestamp benchmark extraction**
   - Extract the timed truth already preserved in `REF-08` into a dedicated timestamp benchmark file shaped for direct comparison against `music-vocals-timestamps-data.reconciled.json`.
   - Keep this as a separate benchmark artifact rather than overloading the current text-truth file.

3. **Human-review readiness decision**
   - Audit verdict: benchmark-surface creation should happen **before** any full human dialogue timestamp review.
   - Reason: the current repo-local dialogue truth files no longer preserve timing, and the current artifact still mixes text-clean units with upstream text-drift failures, which would force a human reviewer to do benchmark reconstruction and defect triage at the same time.
   - After the dedicated dialogue timestamp benchmark exists, human review can focus narrowly on true timing questions instead of re-litigating text/segmentation ownership.

---

*Completed on YYYY-MM-DD*
