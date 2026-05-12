# Peanut Gallery Emotion Engine

**Date:** 2026-05-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Recover the historical COD dialogue timing truth, then create dedicated timestamp benchmark files for both dialogue and music-vocals that directly match the new reconciled timestamp artifacts.

---

## Overview

The current repo state no longer preserves the historical manual dialogue timing fields inside the active dialogue truth files, but git history shows those timing fields still existed in commit `1771225`. At the same time, current `music-vocals-data.json` still carries timing fields. That means our benchmark surfaces are inconsistent: dialogue timing truth is historical-only, while music-vocals timing truth is still embedded inside the active text truth file.

This plan keeps the slice narrow and benchmark-focused. We are not repairing dialogue extraction, reconciliation, or timestamp alignment here. Instead, we are building the proper truth surfaces so future human review and future comparator work have stable anchors. The intended output is a pair of dedicated benchmark artifacts: one for dialogue timestamps and one for music-vocals timestamps, each shaped for direct comparison against the new timestamp-script outputs.

The dialogue benchmark work has an extra wrinkle: the recovered historical timed truth likely reflects an older dialogue surface shape, while the new runtime artifact is timing the reconciled dialogue surface. So the benchmark must not be copied blindly. We need to recover the old timed truth, compare its rowing/text shape against the current reconciled truth surface, then define the safest transformation into a reconciled-dialogue timestamp benchmark. Music-vocals should be simpler: extract the current timed truth into a dedicated benchmark artifact without changing its underlying text truth role.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Active dialogue-only timestamp review plan and findings | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md` |
| `REF-02` | Historical commit where dialogue truth still preserved timing | `git commit 1771225` |
| `REF-03` | Later commit showing current-shape no-timestamp dialogue truth | `git commit 5cc0b6b` |
| `REF-04` | Current dialogue truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-05` | Current raw dialogue truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-data.raw.json` |
| `REF-06` | Current music-vocals truth with timing | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/music-vocals-data.json` |
| `REF-07` | Current emitted reconciled dialogue timestamp artifact target shape | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json` |
| `REF-08` | Current emitted reconciled music-vocals timestamp artifact target shape | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/music-vocals-timestamps-data.reconciled.json` |
| `REF-09` | Current reconciled dialogue text surface | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json` |

---

## Execution-Ready Benchmark Contract

### File location decisions

- **Dialogue timestamp truth benchmark:** `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json`
- **Music-vocals timestamp truth benchmark:** `benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json`

These live beside the existing `truth/` artifacts because they are benchmark-owned gold surfaces, not runtime output captures. The filenames intentionally mirror the timestamp artifact family (`*-timestamps-data`) while staying honest about which truth surface they come from: dialogue uses the reconciled spoken-dialogue truth lane, while music-vocals is extracted directly from the current canonical music-vocals truth file rather than from a new reconciled-truth benchmark.

### Dialogue benchmark contract

**Goal:** recover the last-known timed dialogue truth from `REF-02`, but persist it in a dedicated benchmark file whose JSON family matches the reconciled dialogue timestamp artifact lane without copying current runtime drift into truth.

**Authoritative text/order surface:** `REF-04`, not the currently emitted 19-row runtime artifact.

Why: git inspection shows the current `truth/dialogue-data.json` still matches commit `1771225` text-for-text at all 20 dialogue indexes; only the timing/speaker/capture fields were stripped in later commits such as `5cc0b6b`. That means the safe recovery path is a deterministic join between the current 20-row spoken-dialogue truth and the historical timed 20-row truth. The current emitted runtime artifact is only 19 rows because of upstream dialogue drift (`split`, `merge`, missing row, and wording drift), so using runtime rowing as the benchmark authority would bake known defects into truth and would require inventing sub-row timing boundaries for the first split line.

**Persisted shape:**

```json
{
  "_benchmark": {
    "ignorePaths": [
      "$.analysisMode",
      "$.timingMode",
      "$.sourceStrategy",
      "$.coverage",
      "$.provenance",
      "$.qualityNotes",
      "$.dialogue_segments[*].timing"
    ]
  },
  "dialogue_segments": [
    {
      "index": 0,
      "text": "...",
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "start": 0,
      "end": 5
    }
  ],
  "summary": "...",
  "totalDuration": 140.042449
}
```

**Owned fields:**

- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- `dialogue_segments[*].speaker`
- `dialogue_segments[*].speaker_id`
- `dialogue_segments[*].start`
- `dialogue_segments[*].end`
- top-level `summary`
- top-level `totalDuration`

**Explicit non-owned/runtime-only fields:**

- `dialogue_segments[*].timing`
- `dialogue_segments[*].confidence`
- `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`, `qualityNotes`
- `speaker_profiles`, `handoffContext`, `cleanedTranscript`, and traits-mode fields

**Safe recovery / transform procedure:**

1. Load historical timed dialogue truth from `git show 1771225:benchmarks/fixtures/cod-test/truth/dialogue-data.json`.
2. Load current spoken-dialogue truth from `REF-04`.
3. Assert `20 == 20` rows and exact normalized text parity by index before copying any timing.
4. For each current truth row, carry over `speaker`, `speaker_id`, `start`, and `end` from the matching historical row at the same index.
5. Keep the current truth row text verbatim as the persisted benchmark text so the new benchmark remains anchored to today’s spoken-dialogue gold wording, not a blind historical snapshot.
6. If any row ever fails parity during implementation, fail loud and stop; do **not** infer timing from the current emitted runtime artifact and do **not** hand-split historical spans to mimic runtime splits.

**Comparator posture this benchmark enables:** the dedicated file is row-truth for the reconciled spoken-dialogue lane. When compared against `REF-07`, `1:1` rows can use direct row timing, while split/merge/missing runtime cases must still be handled by the split/merge-tolerant comparison-window method already documented in `REF-01`. That is acceptable and intentionally safer than inventing benchmark sub-row boundaries.

### Music-vocals benchmark contract

**Goal:** extract the timing-bearing fields from `REF-06` into a dedicated timestamp benchmark file without changing the current music-vocals truth’s wording/ordering contract.

**Authoritative source surface:** `REF-06` directly. No git-history recovery is needed.

**Persisted shape:**

```json
{
  "_benchmark": {
    "ignorePaths": [
      "$.analysisMode",
      "$.timingMode",
      "$.sourceStrategy",
      "$.coverage",
      "$.provenance",
      "$.qualityNotes",
      "$.recognitionNotes",
      "$.recognizedSong",
      "$.vocal_segments[*].timing"
    ]
  },
  "vocal_segments": [
    {
      "index": 0,
      "text": "Obey your master",
      "performer": "Metallica lead vocal",
      "performer_id": "voc_001",
      "delivery": "chant",
      "start": 64,
      "end": 65
    }
  ],
  "summary": "...",
  "hasVocals": true,
  "totalDuration": 140.042449
}
```

**Owned fields:**

- `vocal_segments[*].index` (newly synthesized from the current file order because `REF-06` has no persisted `index`)
- `vocal_segments[*].text`
- `vocal_segments[*].performer`
- `vocal_segments[*].performer_id`
- `vocal_segments[*].delivery`
- `vocal_segments[*].start`
- `vocal_segments[*].end`
- top-level `summary`
- top-level `hasVocals`
- top-level `totalDuration`

**Explicit non-owned/runtime-only fields:**

- `vocal_segments[*].timing`
- `vocal_segments[*].confidence`
- `recognizedSong`, `recognitionNotes`, `qualityNotes`
- runtime derivation metadata such as `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`

**Narrow extraction path:**

1. Read `REF-06` as the only source of truth.
2. Copy each `vocal_segments[*]` row in current order.
3. Synthesize `index` from that order (`0..n-1`).
4. Preserve the current truth text and timing exactly; do **not** rewrite lyrics toward the currently emitted reconciled runtime wording and do **not** consult the runtime timestamp artifact for benchmark generation.
5. Drop non-timestamp benchmark context (`recognizedSong`, notes, confidence) from the dedicated file so the benchmark stays narrowly about timed vocal-segment truth.

This keeps music-vocals benchmark creation execution-ready and bounded. Any later decision to add a second reconciled music-vocals timestamp benchmark surface should be treated as a separate planning slice, because the current task only requires a faithful extraction from the existing truth file.

---

## Tasks

### Task 1: Design the timestamp benchmark surfaces and recovery approach

**Bead ID:** `ee-g59f`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Claim bead ee-g59f on start with bd update ee-g59f --status in_progress --json. Audit the historical timed dialogue truth at commit 1771225, the current no-timestamp dialogue truth, the current timed music-vocals truth, and the current emitted timestamp artifacts. Define the exact benchmark file shapes and locations for dedicated dialogue and music-vocals timestamp benchmarks. For dialogue, specify how to safely transform the historical timed truth into a benchmark that matches the current reconciled dialogue timestamp artifact surface. For music-vocals, specify the narrow extraction path from current truth into a dedicated timestamp benchmark file. Update the active plan with the benchmark contract and close bead ee-g59f with bd close ee-g59f --reason "Execution-ready timestamp benchmark contract documented" --json only when the implementation lane is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/` (inspection / planned target)
- historical git-inspection surfaces as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md`
- planned new benchmark files under `benchmarks/fixtures/cod-test/truth/`

**Status:** ✅ Complete

**Results:** Execution-ready benchmark contract documented. Exact file decisions: `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json` for recovered spoken-dialogue timing truth and `benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json` for extracted music-vocals timing truth. Key recovery finding: dialogue can be reconstructed deterministically from commit `1771225` because the current 20-row spoken-dialogue truth still matches the historical timed rows exactly by index/text, but the benchmark must **not** be reshaped to the currently emitted 19-row runtime drift surface or it would require inventing split boundaries and would contaminate truth with known upstream defects. Key extraction finding: music-vocals needs no history walk; it should be a narrow projection of the current timed truth with synthesized stable indexes and without runtime-only derivation metadata. This leaves the coder lane ready to implement only the new truth files plus any minimal manifest/comparator wiring needed to consume them.

---

### Task 2: Implement dedicated dialogue and music-vocals timestamp benchmark files

**Bead ID:** `ee-dixd`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Claim bead ee-dixd on start with bd update ee-dixd --status in_progress --json. Implement the approved dedicated timestamp benchmark surfaces. Recover dialogue timing truth from commit 1771225, reshape it to the current reconciled dialogue surface, and write the new dialogue timestamp benchmark file. Extract the current music-vocals timing truth into its own dedicated benchmark file shaped for direct comparison against the emitted music-vocals timestamp artifact. Keep the change narrowly scoped to benchmark surfaces and any minimal helper/validation code required. Run repo-local validation, commit/push before QA handoff unless explicitly told otherwise, and close bead ee-dixd with bd close ee-dixd --reason "Dedicated timestamp benchmark files implemented" --json only when the new truth files are durable.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`
- `scripts/qa/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json`
- `scripts/qa/derive-cod-timestamp-benchmark-truth.cjs`
- `test/scripts/derive-cod-timestamp-benchmark-truth.test.js`

**Status:** ✅ Complete

**Results:** Claimed `ee-dixd` and implemented a reproducible benchmark generator/validator at `scripts/qa/derive-cod-timestamp-benchmark-truth.cjs`, plus focused coverage at `test/scripts/derive-cod-timestamp-benchmark-truth.test.js`. Created `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json` by parity-checking the current 20-row spoken-dialogue truth against historical commit `1771225` and then joining only `speaker`, `speaker_id`, `start`, and `end` back onto the current text/index surface. Created `benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json` by projecting the current music-vocals truth into a stable timestamp benchmark with synthesized `index` and only the owned fields (`text`, `performer`, `performer_id`, `delivery`, `start`, `end`). Runtime-only fields such as `timing`, `confidence`, `provenance`, `coverage`, recognition notes, and quality notes were intentionally excluded from the segment surfaces.

**Validation run:**
- `node scripts/qa/derive-cod-timestamp-benchmark-truth.cjs write`
- `node scripts/qa/derive-cod-timestamp-benchmark-truth.cjs check`
- `node --test test/scripts/derive-cod-timestamp-benchmark-truth.test.js`

**Implementation caveats:** dialogue parity is intentionally loud/fatal if row count, index order, or normalized text changes from the current 20-row surface vs. commit `1771225`; the generator will refuse to invent timings for runtime split/merge drift. Dialogue `summary` is kept from current truth so the benchmark stays anchored to today’s spoken-dialogue lane, while `totalDuration` remains the historical timed-truth duration value (`140.042449`, matching current fixture duration). Music-vocals `summary`, `hasVocals`, and `totalDuration` are copied directly from the current truth surface.

---

### Task 3: Verify the new benchmark files match the emitted timestamp artifact surfaces

**Bead ID:** `ee-059j`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Claim bead ee-059j on start with bd update ee-059j --status in_progress --json. Verify that the new dedicated dialogue and music-vocals timestamp benchmark files are the right truth surfaces for direct comparison against the current emitted timestamp artifacts. Check shape, rowing, text alignment expectations, timing-field semantics, and any known tolerated split/merge posture that should be documented. Update the active plan with the exact validation evidence and any remaining limitations. Do not broaden into repairing runtime output; this is benchmark-surface QA only. Close bead ee-059j with bd close ee-059j --reason "Timestamp benchmark surfaces QA-validated" --json only when the validation is fully documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/`
- `benchmarks/fixtures/cod-test/truth/` (inspection)
- `output/cod-test-phase1-timestamp-validation/phase1-gather-context/` (inspection)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md`
- `.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md`

**Status:** ✅ Complete

**Results:** QA validated the new benchmark files as the correct truth surfaces for benchmark-anchored review and future comparator work. Durable evidence was recorded in `.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md`.

**Validation run:**
- `node scripts/qa/derive-cod-timestamp-benchmark-truth.cjs check`
- `node --test test/scripts/derive-cod-timestamp-benchmark-truth.test.js`
- ad-hoc JSON inspection comparing benchmark vs emitted artifact surfaces for row counts, field ownership, text alignment, and sequence drift

**Exact findings:**
- Dialogue benchmark is correctly a `20`-row truth surface (`dialogue_segments`) while the current emitted dialogue timestamp artifact and reconciled dialogue output are still `19` rows. This is intentional and correct: truth stays pinned to the 20-row spoken-dialogue gold surface instead of absorbing runtime drift.
- Dialogue shape check passed. Benchmark rows own only `index`, `text`, `speaker`, `speaker_id`, `start`, `end`; emitted runtime rows additionally carry runtime-only fields such as `confidence` and `timing`.
- Dialogue drift posture was confirmed and documented: benchmark row 0 (`They want you afraid. Fear makes you easier to control.`) is emitted as two rows; benchmark rows 4-5 are merged into one emitted row; benchmark rows 9-10 are compressed into `Spectre One report.`; additional punctuation/wording drift remains elsewhere (`we` vs `you`, `the idea` vs `an idea`, `preorder` vs `pre-order`, etc.).
- Practical comparison consequence: direct `index -> index` timing comparison is only valid where text alignment still holds. Human review and future comparator wiring must keep the 20-row dialogue benchmark as authority and use split/merge-tolerant matching windows for drifted regions rather than forcing truth onto the 19-row runtime surface.
- Music-vocals benchmark is faithfully extracted from current truth: it stays at `12` rows while the current emitted runtime artifact is `11` rows, keeps stable synthesized `index`, preserves current truth text/timing semantics, and excludes runtime metadata such as `confidence`, `timing`, recognition notes, and provenance-style fields.
- Music-vocals top-level ownership is also correct: `summary`, `hasVocals`, and `totalDuration` in the benchmark match the current truth surface; `hasVocals` remains `true` in both benchmark and artifact.
- Remaining limitation: current emitted music-vocals runtime order/compression still drifts from the benchmark truth order, so comparison/review must treat the benchmark as truth and the emitted artifact as a candidate surface rather than as the row authority.

---

### Task 4: Audit benchmark truth readiness for future human review and comparator work

**Bead ID:** `ee-ew95`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-ew95 on start with bd update ee-ew95 --status in_progress --json. Independently audit the new dedicated timestamp benchmark surfaces. Confirm the dialogue benchmark legitimately preserves/reconstructs the historical timing truth in a shape appropriate for the current reconciled dialogue artifact, and confirm the music-vocals benchmark extraction is faithful to current truth. Decide whether the repo is then ready for benchmark-anchored human timing review and future comparator wiring. Close bead ee-ew95 with bd close ee-ew95 --reason "Timestamp benchmark truth readiness audited" --json only when the readiness verdict is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- benchmark and artifact inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md`

**Status:** ✅ Complete

**Results:** Independent audit completed against the plan contract, benchmark files, emitted artifact surfaces, generator, tests, and QA artifact. Evidence-backed verdict: the repo is now **ready for benchmark-anchored human timing review**, provided the review treats the new benchmark files as row authority and treats current emitted artifacts as candidate runtime surfaces that still require split/merge-tolerant alignment windows.

**Audit evidence:**
- Re-ran `node scripts/qa/derive-cod-timestamp-benchmark-truth.cjs check` and `node --test test/scripts/derive-cod-timestamp-benchmark-truth.test.js`; both passed.
- Independently verified the dialogue benchmark is a deterministic `20`-row join between current `truth/dialogue-data.json` and historical timed truth from commit `1771225`: all `20/20` rows still match exactly by index/text, and the persisted benchmark copies only `speaker`, `speaker_id`, `start`, and `end` from history while keeping the current truth text/index surface verbatim.
- Independently verified the music-vocals benchmark is a faithful `12`-row projection of current `truth/music-vocals-data.json`, with synthesized stable `index` and exact preservation of `text`, `performer`, `performer_id`, `delivery`, `start`, and `end` while excluding runtime-only metadata.
- Confirmed the benchmark files intentionally remain cleaner than the emitted runtime artifacts: dialogue benchmark `20` rows vs emitted dialogue artifact `19`, and music-vocals benchmark `12` rows vs emitted music-vocals artifact `11`. This is correct because truth must not absorb runtime split/merge/order drift.

**Readiness recommendation:** proceed with benchmark-anchored human review now, but anchor the review to the dedicated benchmark files and preserve the comparison posture already documented in `REF-01`: use direct row-level timing comparison only for text-clean `1:1` matches, and use aggregated split/merge window spans where runtime segmentation drifts from truth. Do **not** hand-split benchmark timing boundaries or collapse truth to the current emitted runtime rowing.

**Critical caveat to preserve for the next lane:** split/merge tolerance is not optional. The dialogue benchmark is intentionally a `20`-row truth surface even though the current emitted runtime artifact is `19` rows, and the music-vocals benchmark is intentionally `12` rows while the emitted artifact is `11`. Any next-lane comparator or human review that falls back to naïve `index -> index` timing judgment across drifted regions will produce false timing conclusions by blaming runtime segmentation/text drift as timing drift.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** The repo now has durable dedicated timestamp benchmark truth files for both dialogue and music-vocals, a reproducible generator/validator, targeted automated coverage, QA evidence, and an independent audit confirming those benchmark files are the correct anchors for benchmark-anchored human timing review. Dialogue truth now preserves historical timing without copying runtime drift into truth; music-vocals truth now has its own dedicated timestamp benchmark separated from runtime-only metadata.

**Reference Check:** `REF-02` and `REF-04` were used to lock the dialogue recovery contract and current dialogue truth anchoring; `REF-06` remained the direct music-vocals truth source; `REF-07` / `REF-08` kept the new benchmark file family aligned with the emitted runtime timestamp artifact lanes without copying runtime-only metadata into truth; `REF-09` remained the emitted reconciled dialogue text surface used for direct QA comparison against the 20-row dialogue benchmark posture. The audit also directly revalidated commit `1771225` as the historical dialogue timing source.

**Commits:**
- None in this slice (`do not commit` respected).

**Lessons Learned:** The scripted benchmark generator is the right long-term guardrail here. Dialogue timing truth must stay pinned to historical timing while text stays pinned to the current 20-row gold wording, and review/comparator work must stay split/merge tolerant instead of forcing truth onto the currently drifted runtime row shapes.

---

*Completed on 2026-05-04*
