# COD Test — “Golden Run” Acceptance Checklist (emotion-engine)

**Purpose:** This checklist is the acceptance gate for the `configs/cod-test.yaml` pipeline output written to `output/cod-test/`.

**Recommended location:** `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md` (this file). It’s close to `configs/cod-test.yaml` and other pipeline docs.

---

## 0) Run commands (replay / record)

### Replay (deterministic “golden cassette” run)

Use this when you want a deterministic run (no live network calls).

```bash
cd projects/peanut-gallery/emotion-engine

# Explicitly enable digital-twin replay mode (don’t rely on NODE_ENV defaults)
export DIGITAL_TWIN_MODE=replay

# Select the twin pack + cassette
# Prefer a relative path if your repos are laid out like:
#   projects/peanut-gallery/emotion-engine
#   projects/peanut-gallery/digital-twin-openrouter-emotion-engine
export DIGITAL_TWIN_PACK="$(pwd)/../digital-twin-openrouter-emotion-engine"

# Known-good cassette for this checklist:
export DIGITAL_TWIN_CASSETTE=cod-full-pipeline-20260308-172855

# NOTE: currently required even in replay mode (not used during replay).
# Any non-empty value is fine until we gate this in config validation.
export AI_API_KEY=dummy

# Run the pipeline
npm run pipeline -- --config configs/cod-test.yaml

# Output is expected at:
#   output/cod-test/

# Example known-good absolute twin pack path (machine-specific):
#   /home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine
```

### Record (optional; creates/updates a cassette)

Use this only when intentionally capturing a new cassette (requires real API access).

```bash
cd projects/peanut-gallery/emotion-engine

export DIGITAL_TWIN_MODE=record
export DIGITAL_TWIN_PACK="$(pwd)/../digital-twin-openrouter-emotion-engine"

# Recommended: record into a new cassette name first, then promote it to the golden
# name after verification.
export DIGITAL_TWIN_CASSETTE="cod-full-pipeline-$(date +%Y%m%d-%H%M%S)"

# To intentionally overwrite the current golden cassette, set:
# export DIGITAL_TWIN_CASSETTE=cod-full-pipeline-20260308-172855

# Required for record mode (real calls):
export AI_API_KEY=... # (or via .env)

npm run pipeline -- --config configs/cod-test.yaml

# The cassette should be written under:
#   $DIGITAL_TWIN_PACK/cassettes/$DIGITAL_TWIN_CASSETTE.json
# (exact location depends on twin pack layout)
```

---

## 1) Required files and locations

All of the following files must exist **and be non-empty**.

### Inputs mirrored into output assets

- [ ] `output/cod-test/assets/input/config.yaml`
- [ ] `output/cod-test/assets/input/cod.mp4`
- [ ] `output/cod-test/assets/input/personas/SOUL.md`
- [ ] `output/cod-test/assets/input/personas/GOAL.md`

### Phase 1 — gather-context

- [ ] `output/cod-test/phase1-gather-context/dialogue-data.json`
- [ ] `output/cod-test/phase1-gather-context/music-data.json`

### Phase 2 — process

- [ ] `output/cod-test/phase2-process/chunk-analysis.json`

### Phase 3 — report

- [ ] `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- [ ] `output/cod-test/phase3-report/metrics/metrics.json`
- [ ] `output/cod-test/phase3-report/recommendation/recommendation.json`
- [ ] `output/cod-test/phase3-report/summary/analysis-data.json`
- [ ] `output/cod-test/phase3-report/summary/summary.json`
- [ ] `output/cod-test/phase3-report/summary/FINAL-REPORT.md`

### Aggregated “all artifacts” bundle

- [ ] `output/cod-test/artifacts-complete.json`

---

## 2) Required non-empty / non-placeholder fields

> Tip: these checks are intentionally **semantic**, not byte-for-byte.

### Phase 1: `dialogue-data.json`

- [ ] `dialogue_segments` is an array and **length > 0**
- [ ] Each segment has:
  - [ ] numeric `start`, numeric `end`, and `end > start`
  - [ ] non-empty `speaker`
  - [ ] non-empty `text`
  - [ ] numeric `confidence` in **[0, 1]**
- [ ] `summary` is non-empty and not a placeholder (no `TODO`, `TBD`, etc.)
- [ ] `totalDuration > 0`

### Phase 1: `music-data.json`

- [ ] `segments` is an array and **length > 0**
- [ ] Each segment has:
  - [ ] numeric `start`, numeric `end`, and `end > start`
  - [ ] non-empty `type` (e.g., `music`, `speech`)
  - [ ] non-empty `mood`
  - [ ] numeric `intensity` in **[0, 10]**
- [ ] `summary` is non-empty and not a placeholder
- [ ] `hasMusic` is boolean

### Phase 2: `chunk-analysis.json`

- [ ] `chunks` is an array and **length > 0**
- [ ] `statusSummary.total === chunks.length`
- [ ] `statusSummary.successful + statusSummary.failed === statusSummary.total`
- [ ] `statusSummary.failedChunkIndexes.length === statusSummary.failed`
- [ ] Each chunk has:
  - [ ] numeric `chunkIndex` (unique)
  - [ ] numeric `startTime`, numeric `endTime`, and `endTime > startTime`
  - [ ] non-empty `summary`
  - [ ] `status` is `success` or `failed`
  - [ ] `persona.soulPath` and `persona.goalPath` are present
  - [ ] `persona.lenses` is an array and **length > 0**
- [ ] For **successful** chunks:
  - [ ] `tokens > 0`
  - [ ] `emotions` contains **all configured lenses** (cod-test: `patience`, `boredom`, `excitement`)
  - [ ] For each emotion: numeric `score` in **[1, 10]** and non-empty `reasoning`
  - [ ] `dominant_emotion` is one of the lens names
  - [ ] `summary` is not a known placeholder (e.g., not just `"Analysis completed"`)
- [ ] For **failed** chunks:
  - [ ] `errorReason` exists and is non-empty
  - [ ] `chunkIndex` is listed in `statusSummary.failedChunkIndexes`

### Phase 3: `phase3-report/metrics/metrics.json`

- [ ] `implementationStatus.state === "computed"`
- [ ] `summary.totalSeconds > 0`
- [ ] `summary.videoDuration > 0`
- [ ] `summary.totalChunks > 0`
- [ ] `summary.failedChunks >= 0`
- [ ] `averages` has all lenses and values are numeric in **[0, 1]**
- [ ] `peakMoments.<lens>.highest.timestamp` and `.score` exist
- [ ] `trends.<lens>.direction` is non-empty

### Phase 3: `phase3-report/emotional-analysis/emotional-data.json`

- [ ] `implementationStatus.state === "computed"`
- [ ] `summary.totalSeconds > 0`
- [ ] `summary.totalChunks > 0`
- [ ] `summary.videoDuration > 0`
- [ ] `summary.criticalMomentsCount >= 0`
- [ ] `chunkAnalysis` is an array and **length === summary.totalChunks**
- [ ] Each entry has:
  - [ ] numeric `startTime`, `endTime`, `duration` with `duration > 0` (except possibly final fractional tail)
  - [ ] `emotions` contains all lenses with numeric values in **[0, 1]**
  - [ ] `scrollRisk` numeric in **[0, 1]**
  - [ ] `scrollRiskLevel` in {`low`,`medium`,`high`,`critical`}
- [ ] If any chunks failed in Phase 2, then `failedChunkDetails` exists and **length > 0**

### Phase 3: `phase3-report/recommendation/recommendation.json`

- [ ] `text` is non-empty
- [ ] `reasoning` is non-empty
- [ ] numeric `confidence` in **[0, 1]**
- [ ] `keyFindings` array length > 0
- [ ] `suggestions` array length > 0

### Phase 3: `phase3-report/summary/summary.json`

- [ ] `metadata.totalSeconds > 0`
- [ ] `metadata.videoDuration > 0`
- [ ] `metadata.chunksAnalyzed > 0`
- [ ] `metadata.totalTokens > 0`
- [ ] `keyMetrics.averages`, `keyMetrics.peakMoments`, `keyMetrics.trends`, and `keyMetrics.frictionIndex` all exist
- [ ] `recommendation.text` and `recommendation.reasoning` are non-empty
- [ ] `reportPaths.metrics`, `reportPaths.recommendation`, `reportPaths.emotionalAnalysis`, `reportPaths.summary` exist and point to files that exist

### Phase 3: `phase3-report/summary/FINAL-REPORT.md`

- [ ] Contains a non-empty **Executive Summary** section
- [ ] Contains a non-empty **AI Recommendation** section
- [ ] Contains **Chunk-by-Chunk Analysis** with at least 1 chunk
- [ ] Persona section is present and not blank:
  - [ ] includes persona ID/display name
  - [ ] includes SOUL/GOAL sources
- [ ] “Output Files” section exists and names the report artifacts (at least `FINAL-REPORT.md` and `summary.json`)
- [ ] Report contains references/links to the other Phase 3 artifacts (metrics, recommendation, raw/analysis data), and the referenced paths exist on disk

### Aggregated: `artifacts-complete.json`

- [ ] Contains the expected top-level keys:
  - [ ] `assetsDir`
  - [ ] `dialogueData`
  - [ ] `musicData`
  - [ ] `chunkAnalysis`
  - [ ] `metricsData`
  - [ ] `recommendationData`
  - [ ] `emotionalAnalysis`
  - [ ] `summary`
  - [ ] `finalReport`
- [ ] `finalReport.path` points to an existing file (`FINAL-REPORT.md`)
- [ ] `summary.reportPaths.*` all exist and each path resolves to an existing file

---

## 3) Consistency checks across artifacts

### Cross-check counts and durations

- [ ] Phase 2 `statusSummary.total === summary.metadata.chunksAnalyzed + summary.metadata.failedChunks`
  - Rationale: Phase 3 summaries often count only successful chunks; Phase 2 counts total.
- [ ] Phase 2 `totalTokens === summary.metadata.totalTokens`
- [ ] Phase 2 `videoDuration === summary.metadata.videoDuration`

### artifacts-complete counts match phase artifacts

- [ ] `artifacts-complete.chunkAnalysis.statusSummary.total === phase2-process/chunk-analysis.json.statusSummary.total`
- [ ] `artifacts-complete.chunkAnalysis.statusSummary.failed === phase2-process/chunk-analysis.json.statusSummary.failed`
- [ ] `artifacts-complete.chunkAnalysis.totalTokens === phase2-process/chunk-analysis.json.totalTokens`

### Failed chunk propagation

- [ ] If Phase 2 has `statusSummary.failed > 0`, then:
  - [ ] `emotional-data.json.summary.failedChunks === phase2.statusSummary.failed`
  - [ ] `metrics.json.summary.failedChunks === phase2.statusSummary.failed`
  - [ ] `summary.json.metadata.failedChunks === phase2.statusSummary.failed`
  - [ ] `emotional-data.json.failedChunkDetails[*].chunkIndex` matches Phase 2 `statusSummary.failedChunkIndexes` (same set)

### Report path coherence

- [ ] `summary.json.reportPaths.*` match the actual on-disk file layout under `output/cod-test/phase3-report/`
- [ ] `artifacts-complete.summary.reportPaths.*` match `summary.json.reportPaths.*`

---

## 4) Determinism + safe comparison notes

### Expected-to-vary fields (safe to ignore in comparisons)

When comparing two *replays* of the same cassette with the same code/config, the following fields may legitimately differ:

- Timestamps:
  - any `generatedAt` fields
  - `metadata.generatedAt` fields
  - the **Generated:** line in `FINAL-REPORT.md`
- Absolute paths (machine-specific):
  - `artifacts-complete.assetsDir`
  - `artifacts-complete.finalReport.path`

Everything else should normally be stable under replay mode.

### Comparing runs safely (suggested approach)

1) **Normalize JSON** by removing volatile fields before diffing.

Example (normalize `summary.json`):

```bash
cd projects/peanut-gallery/emotion-engine

node -e '
  const fs=require("fs");
  const p="output/cod-test/phase3-report/summary/summary.json";
  const d=JSON.parse(fs.readFileSync(p,"utf8"));
  delete d.generatedAt;
  if (d.metadata) delete d.metadata.generatedAt;
  console.log(JSON.stringify(d, null, 2));
' > /tmp/summary.normalized.json
```

2) **Diff normalized outputs** (example using git’s no-index diff):

```bash
git diff --no-index /path/to/baseline.summary.normalized.json /tmp/summary.normalized.json
```

3) For `FINAL-REPORT.md`, ignore the `**Generated:** ...` line and compare the remaining content.

---

## 5) Optional extra gates (recommended)

- [ ] Run JSON structure validation:

```bash
cd projects/peanut-gallery/emotion-engine
npm run test:validate-json
```

- [ ] (If tests are intended to run offline) run full test suite with digital twin enabled:

```bash
cd projects/peanut-gallery/emotion-engine

export DIGITAL_TWIN_MODE=replay
export DIGITAL_TWIN_PACK="$(pwd)/../digital-twin-openrouter-emotion-engine"
export DIGITAL_TWIN_CASSETTE=cod-full-pipeline-20260308-172855

# NOTE: currently required even in replay mode (not used during replay).
export AI_API_KEY=dummy

npm test
```
