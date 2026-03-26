# Truth benchmark comparator + scoring contract

**Status:** Active design contract  
**Established:** 2026-03-25

---

## Purpose

This document defines the comparator contract and truth-scoring semantics for the repo-local truth benchmark system in `emotion-engine`.

It extends the fixture/manifest contract established in:

- `docs/TRUTH-BENCHMARK-FIXTURE-MANIFEST-CONTRACT.md`

That earlier document defines how a benchmark fixture is discovered and wired together. This document defines how artifact pairs are validated, compared, scored, and reported once the runner has already resolved:

- the benchmark fixture
- the produced artifact path
- the truth artifact path
- the comparator declaration for that artifact

This contract is intentionally boring and implementation-first. It exists to remove ambiguity for the scaffold lane and for future comparator implementations.

---

## Scope

This contract defines:

- the comparator interface and registry contract
- the required validation and scoring pipeline order
- exact vs fuzzy vs tolerant comparison classes
- sentinel handling semantics
- temporal comparison rules and default tolerances
- per-artifact report shape
- aggregate report shape
- hard-error vs soft-failure conditions
- the recommended MVP comparator set for `cod-test`

This contract does **not** define:

- the benchmark YAML opt-in contract
- the benchmark fixture folder layout
- the benchmark runner CLI/API surface
- the code location of the comparator registry
- the authoring workflow for truth files beyond what is needed for scoring semantics

Those are defined elsewhere or left to later implementation lanes.

---

## Core design rules

1. **Schema/shape validation happens before scoring.**  
   Do not compare malformed or contract-invalid data.

2. **Truth files are contract-shaped artifacts, not annotation wrappers.**  
   The comparator must operate on the same JSON shape as the real artifact.

3. **Comparator rules live outside truth files.**  
   Truth JSON states expected values; comparator config states comparison behavior.

4. **Missing required truth fields are always hard errors.**  
   Omission is never treated as unknown.

5. **Explicit sentinels are score-skips, not passes.**  
   `unknown` and `ambiguous` reduce scoreable coverage and must remain visible in reporting.

6. **Scoring is field/path based.**  
   Reports must identify where comparisons passed, failed, skipped, or errored.

7. **The runner should prefer deterministic comparison semantics.**  
   For MVP, avoid AI judging, semantic embeddings, or loose prose similarity scoring.

---

## Comparator registry contract

Each artifact entry in `benchmark.json` chooses one comparator.

Example:

```json
{
  "artifactKey": "dialogueData",
  "comparator": {
    "kind": "json-structured",
    "profile": "dialogue-default",
    "options": {
      "timingToleranceSeconds": 2,
      "unknownSentinels": ["unknown", "ambiguous"]
    }
  }
}
```

### Required comparator declaration fields

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | string | Comparator family, resolved from the runner registry. |
| `profile` | string | Stable comparison profile within that comparator family. |
| `options` | object | Comparator-specific options. Optional in JSON shape, but treated as `{}` when absent. May include comparator-owned skip controls such as `ignorePaths` for volatile non-semantic fields. |

### Registry resolution rules

The runner must:

1. resolve `kind`
2. resolve `profile` within that kind
3. merge profile defaults with `options`
4. fail hard if the comparator cannot be resolved

### Comparator implementation interface

The scaffold lane should implement each comparator entry as a pure comparison unit with the following logical interface:

```ts
type BenchmarkComparator = {
  kind: string;
  profile: string;
  validateOptions(options: unknown): ValidatedOptions;
  compareArtifact(input: CompareArtifactInput): ArtifactComparisonResult;
};
```

### `CompareArtifactInput`

```ts
type CompareArtifactInput = {
  artifactKey: string;
  phase: string;
  script: string;
  truthData: unknown;
  outputData: unknown;
  truthSchemaRef?: string | null;
  outputSchemaRef?: string | null;
  options: ValidatedOptions;
  context: {
    fixtureId: string;
    benchmarkPath: string;
    truthPath: string;
    outputPath: string;
  };
};
```

### `ArtifactComparisonResult`

```ts
type ArtifactComparisonResult = {
  status: "pass" | "fail" | "error";
  comparator: {
    kind: string;
    profile: string;
    resolvedOptions: Record<string, unknown>;
  };
  counts: {
    totalTruthFields: number;
    scoreableFields: number;
    skippedFields: number;
    passedFields: number;
    failedFields: number;
    erroredFields: number;
  };
  accuracy: {
    passed: number;
    failed: number;
    rate: number | null;
  };
  coverage: {
    scoreable: number;
    skipped: number;
    totalTruthFields: number;
    rate: number | null;
  };
  fieldResults: FieldComparisonResult[];
  summary: string;
};
```

### `FieldComparisonResult`

```ts
type FieldComparisonResult = {
  path: string;
  status: "pass" | "fail" | "skip" | "error";
  rule: "exact" | "fuzzy-string" | "tolerant-number" | "tolerant-time" | "set-membership" | "structural";
  truthValue: unknown;
  outputValue: unknown;
  normalizedTruthValue?: unknown;
  normalizedOutputValue?: unknown;
  reason?: string | null;
  metrics?: Record<string, number | boolean | string | null>;
};
```

Notes:

- `status: "error"` at field level means comparison could not be executed for that field because comparator logic or data conditions were invalid.
- artifact-level `status` is:
  - `error` if any hard comparison error prevents a trustworthy artifact result
  - otherwise `fail` if one or more scoreable fields failed
  - otherwise `pass`

---

## Validation pipeline ordering

The benchmark runner must execute comparison in this order.

### Phase 1: benchmark manifest validation

Before any artifact comparison:

1. validate the YAML benchmark block
2. validate `benchmark.json`
3. validate `fixture.json`
4. resolve comparator registry entries
5. resolve all configured paths

Failures here are benchmark setup errors and stop execution before artifact scoring.

### Phase 2: artifact presence validation

For each declared artifact:

1. confirm the produced artifact file exists if `required: true`
2. confirm the truth artifact file exists
3. confirm both files are readable JSON

Failures here are artifact-level hard errors.

### Phase 3: schema/shape validation

For each artifact pair:

1. parse truth JSON
2. parse produced JSON
3. validate truth JSON against the same schema/shape contract expected from the real artifact
4. validate produced JSON against the same schema/shape contract expected from the real artifact
5. only proceed to scoring if both are valid

Important rules:

- invalid truth JSON is a fixture bug / hard error
- invalid produced JSON is a pipeline artifact bug / hard error
- scoring must **not** attempt to “best effort” compare malformed data

### Phase 4: comparator normalization

After schema validity is confirmed:

1. resolve profile defaults
2. validate comparator options
3. normalize values as required by the comparator
4. expand structured objects/arrays into field/path comparisons

Normalization is comparator-owned, but it must be deterministic and reportable.

### Phase 5: field comparison

For each scoreable field/path:

1. determine whether the truth value is a sentinel skip
2. select the comparison rule for that path
3. compare truth vs output
4. emit a field result

### Phase 6: artifact aggregation

For each artifact:

1. count total truth fields
2. count scoreable fields
3. count skipped sentinel fields
4. count passes/fails/errors among scoreable fields
5. derive artifact status
6. emit an artifact report record

### Phase 7: benchmark aggregation

Across all artifacts:

1. sum truth field totals
2. sum scoreable vs skipped coverage
3. sum passed/failed/errored comparisons
4. compute per-artifact and benchmark-wide rates
5. emit aggregate report(s)

---

## What counts as a “field” for scoring

The benchmark system uses **leaf field comparisons** by default.

A field is any truth-bearing leaf path after structured traversal.

Examples:

- `summary`
- `hasMusic`
- `segments[0].mood`
- `segments[0].start`
- `dialogue_segments[3].speaker`
- `dialogue_segments[3].text`
- `keyFindings[2]`

### Object/container handling

Objects and arrays are traversed structurally until leaf values are reached.

Container mismatches are still reportable and may create failure/error records at container paths such as:

- `segments`
- `dialogue_segments[4]`
- `suggestions`

The implementation may emit both:

- a structural failure at the container path, and/or
- leaf-level failures underneath it

For MVP, prefer one deterministic approach and keep it consistent. The recommended default is:

- emit a structural failure when array/object alignment is impossible
- otherwise traverse to leaf paths and score at the leaf level

---

## Array comparison contract

Arrays require explicit handling because leaf-path comparison depends on alignment.

### Default MVP array alignment rules

#### 1) Positional arrays

Use positional alignment when array order is part of the real artifact meaning.

Examples:

- `dialogue_segments`
- `segments`
- `chunks`
- `keyFindings`
- `suggestions`

Rule:

- compare `truth[i]` with `output[i]`
- if lengths differ, emit structural failure at the array path and mark unmatched items as failed

#### 2) Keyed arrays

A later comparator profile may align items by stable keys such as `chunkIndex` or another declared identity field.

For MVP:

- `chunk-analysis` may use keyed alignment later
- it is not required for the initial comparator set

#### 3) Set-like arrays

Only use order-insensitive set comparison when the field meaning is explicitly unordered.

For MVP, avoid set-like comparison unless a profile declares it explicitly.

---

## Comparison rule classes

Every scoreable field/path must use one rule class.

### 1) `exact`

Use exact equality after any allowed normalization.

Appropriate for:

- booleans
- enums
- stable labels
- exact text fields where wording matters
- integer/score fields where no tolerance is allowed

Examples:

- `hasMusic`
- `segments[0].type`
- `dialogue_segments[2].speaker`
- `dominant_emotion`

### 2) `fuzzy-string`

Use deterministic text normalization before equality.

Allowed MVP normalization:

- trim leading/trailing whitespace
- collapse internal repeated whitespace to single spaces
- optional case folding only when profile says so

Important:

- fuzzy-string in MVP is **not** semantic similarity
- do not use embeddings or LLM judging
- punctuation stripping should be profile-specific, not global

Appropriate for:

- transcript text when whitespace or capitalization noise should not fail the benchmark
- freeform summaries if the profile intentionally allows normalized exact match

### 3) `tolerant-number`

Use numeric comparison with an absolute tolerance.

Pass rule:

```text
abs(output - truth) <= tolerance
```

Appropriate for:

- confidence values when the profile explicitly allows tolerance
- scalar metrics where small drift is acceptable

### 4) `tolerant-time`

Use numeric comparison with a time tolerance in seconds.

Pass rule:

```text
abs(outputSeconds - truthSeconds) <= timingToleranceSeconds
```

Default initial value:

- `timingToleranceSeconds = 2`

Appropriate for:

- `start`
- `end`
- `startTime`
- `endTime`
- duration-like leaf fields

### 5) `set-membership`

Use only for explicitly unordered collections.

Not required for the initial `cod-test` MVP comparator set.

### 6) `structural`

Use for container-level pass/fail when the comparison cannot safely descend.

Examples:

- array length mismatch
- object-vs-array mismatch
- missing item alignment for a profile that requires positional comparison

---

## Sentinel handling semantics

### Supported MVP sentinel values

The initial default sentinel set is:

- `"unknown"`
- `"ambiguous"`

These are configured per comparator/profile, not hardcoded globally.

Example:

```json
{
  "unknownSentinels": ["unknown", "ambiguous"]
}
```

### Sentinel rules

If the truth value at a field/path equals a configured sentinel value:

1. the field is counted in `totalTruthFields`
2. the field is **not** counted in `scoreableFields`
3. the field is counted in `skippedFields`
4. the field emits `status: "skip"`
5. the field does not count as pass or fail

### Output-side sentinel behavior

Configured sentinels are a **truth-side authoring mechanism**, not a general output-side escape hatch.

Rules:

- if truth is scoreable and output says `unknown`, that is compared literally unless the profile explicitly declares otherwise
- output does **not** get automatic skip treatment just because it used a sentinel-like string
- the runner must not reward output for being vague when truth is specific

### `unknown` vs `ambiguous`

For MVP scoring, `unknown` and `ambiguous` have the same score effect:

- both are skipped coverage
- both reduce scoreable surface
- neither counts as pass or fail

Recommended authoring guidance:

- use `unknown` when the truth author genuinely cannot determine the value from the source evidence
- use `ambiguous` when multiple plausible labels/timestamps/values exist and the truth author cannot defend one exact choice

Recommended reporting guidance:

- preserve which sentinel was used in `truthValue`
- optionally provide sentinel-specific skip counts later
- do not create different scoring math for them in MVP

### Missing fields are not sentinels

This is a hard rule.

- missing required truth fields => hard error
- `null` is not automatically a sentinel
- empty string is not automatically a sentinel
- empty array is not automatically a sentinel

Only explicitly configured sentinel values receive skip semantics.

---

## Temporal comparison rules

Time values must use tolerant comparison when the comparator profile declares them temporal.

### Default temporal field names

The initial profiles should treat these leaf names as temporal unless overridden:

- `start`
- `end`
- `startTime`
- `endTime`
- `duration`
- `totalDuration`
- `videoDuration`

### Default tolerance

Initial default:

- `timingToleranceSeconds = 2`

### Temporal pass/fail examples

Given `timingToleranceSeconds = 2`:

- truth `start = 8.5`, output `start = 9.9` => pass
- truth `end = 16.5`, output `end = 18.7` => fail

### Temporal normalization rules

For MVP:

- compare numeric seconds only
- do not parse human-readable timecodes unless a later profile explicitly supports them
- do not use relative percentage tolerances for time in MVP

### Temporal edge handling

If a temporal field is present but non-numeric after schema validation would normally allow numeric data, treat that as a hard error or field error depending on where validation should have caught it.

Recommended implementation stance:

- schema validation should catch this before comparator execution
- comparator should still guard and emit a field error if the value is unexpectedly non-numeric

---

## Exact vs fuzzy vs tolerant defaults for MVP artifacts

### Dialogue artifact (`dialogue-default`)

Representative artifact shape:

- `dialogue_segments[*].start` → `tolerant-time`
- `dialogue_segments[*].end` → `tolerant-time`
- `dialogue_segments[*].speaker` → `exact`
- `dialogue_segments[*].text` → `fuzzy-string`
- `dialogue_segments[*].confidence` → recommended `exact` for MVP unless a later profile chooses tolerance
- `summary` → `fuzzy-string`
- `totalDuration` → `tolerant-time`
- `handoffContext` → `exact`

Rationale:

- timing drift should not fail on sub-scene alignment noise
- transcript text often needs whitespace-tolerant matching
- speaker labels are categorical and should stay exact
- confidence is model-generated and may not be a good benchmark target, but if included it should start strict rather than vague

### Music artifact (`music-default`)

Representative artifact shape:

- `segments[*].start` → `tolerant-time`
- `segments[*].end` → `tolerant-time`
- `segments[*].type` → `exact`
- `segments[*].description` → `fuzzy-string`
- `segments[*].mood` → `exact`
- `segments[*].intensity` → `exact`
- `summary` → `fuzzy-string`
- `hasMusic` → `exact`

Rationale:

- start/end need timing tolerance
- mood/type/intensity are category-like outputs and should remain exact in MVP
- descriptions and summary may need whitespace normalization but should not use semantic judging yet

### Recommendation artifact (`recommendation-default`)

Representative artifact shape from `recommendation.json` / `recommendationData`:

- `text` → `fuzzy-string`
- `reasoning` → `fuzzy-string`
- `confidence` → `tolerant-number` only if a profile explicitly sets tolerance; otherwise exact
- `keyFindings[*]` → `fuzzy-string`
- `suggestions[*]` → `fuzzy-string`
- `failedChunks` → `exact`
- `summary.hasRecommendation` → `exact`
- `summary.confidence` → `tolerant-number` only if enabled by profile

Important MVP guidance:

- recommendation benchmarking is reasonable for contract completeness, but it is likely high-churn and may produce noisier results than dialogue/music
- recommendation comparators may need comparator-owned skips for volatile run metadata such as `generatedAt` and deeply nested `ai` debug/usage payloads; those skips should be declared in comparator options (for example `ignorePaths`) rather than faked as truth-side `unknown`
- recommendation should be part of the comparator contract now, even if the first runnable fixture starts with dialogue + music only

### Chunk analysis artifact (`chunk-analysis-default`)

Representative artifact shape:

- `chunks[*].startTime` / `endTime` → `tolerant-time`
- `chunks[*].status` → `exact`
- `chunks[*].summary` → `fuzzy-string`
- `chunks[*].dominant_emotion` → `exact`
- `chunks[*].emotions.<lens>.score` → `exact`
- `chunks[*].emotions.<lens>.reasoning` → `fuzzy-string`
- `chunks[*].confidence` → exact or tolerant-number depending on future profile
- `statusSummary.*` → exact
- `videoDuration` → `tolerant-time`

Chunk analysis needs slightly stronger comparator semantics than the smaller Phase 1 artifacts:

- it is larger and noisier
- keyed alignment by `chunkIndex`/`splitIndex` is preferable to pure positional comparison
- volatile token-usage fields (`chunks[*].tokens`, `totalTokens`) should be skipped via comparator-owned ignore paths rather than treated as reviewed gold truth


### Metrics artifact (`metrics-default`)

Representative artifact shape:

- `generatedAt` → comparator-owned ignore path
- `pipelineVersion` → `exact`
- `summary.totalChunks` / `failedChunks` / `totalSeconds` → `exact`
- `summary.videoDuration` → `tolerant-time`
- `implementationStatus.*` → `exact`
- `averages.<lens>` → `tolerant-number`
- `peakMoments.<lens>.(highest|lowest).timestamp` → `tolerant-time`
- `peakMoments.<lens>.(highest|lowest).score` → `tolerant-number`
- `trends.<lens>.direction` → `exact`
- `trends.<lens>.change` / `firstHalfAverage` / `secondHalfAverage` → `tolerant-number`
- `frictionIndex` → `tolerant-number`

Metrics is a good structured benchmark target because it is a first-class product artifact, but it still carries one obviously volatile field:

- `generatedAt` should be skipped via comparator-owned ignore paths rather than baked into truth as if timestamp drift were semantic signal
- the remaining numeric aggregates should stay benchmarked so Phase 2 → Phase 3 derivation drift remains visible

### Emotional analysis artifact (`emotional-analysis-default`)

Representative artifact shape:

- `generatedAt` → comparator-owned ignore path
- `pipelineVersion` / `implementationStatus.*` → `exact`
- `summary.totalChunks` / `failedChunks` / `totalSeconds` / `criticalMomentsCount` → `exact`
- `summary.videoDuration` → `tolerant-time`
- `summary.averageScrollRisk` → `tolerant-number`
- `chunkAnalysis[*]` → keyed alignment by `chunkIndex`
- `chunkAnalysis[*].startTime` / `endTime` / `duration` → `tolerant-time`
- `chunkAnalysis[*].emotions.*` / `emotionalVelocity.*` / `scrollRisk` / `dominantEmotion.score` → `tolerant-number`
- `chunkAnalysis[*].scrollRiskLevel` / `dominantEmotion.emotion` / `emotionalSignature` / `dataPoints` → `exact`
- `emotionalArc.timestamps[*]` / `windowSize` → `exact`
- `emotionalArc.emotions.*[*]` / `smoothedEmotions.*[*]` → `tolerant-number`
- `scrollRiskTimeline[*]` → keyed alignment by `timestamp`
- `scrollRiskTimeline[*].timestamp` → `tolerant-time`
- `scrollRiskTimeline[*].scrollRisk` → `tolerant-number`
- `scrollRiskTimeline[*].scrollRiskLevel` / `dominantEmotion` → `exact`
- `criticalMoments[*]` → keyed alignment by `timestamp` + `emotion` + `type` + `chunkIndex`
- `criticalMoments[*].timestamp` → `tolerant-time`
- `criticalMoments[*].score` / `previousScore` / `threshold` / `severity` → `tolerant-number`
- `criticalMoments[*].emotion` / `type` / `chunkIndex` → `exact`
- `criticalMoments[*].context` → comparator-owned ignore path

Emotional analysis is benchmarkable, but only if we stay honest about which parts are deterministic signal versus synthetic prose:

- generated explanatory prose like `criticalMoments[*].context` should be skipped via comparator-owned ignore paths instead of pretending it is stable reviewed truth
- structural/category/numeric derivations should stay benchmarked so Phase 2 → Phase 3 emotional aggregation drift remains visible
- bootstrap truth for this artifact should be labeled explicitly as bootstrap until a human tightens and reviews it

---

## Per-field comparison semantics

### Pass

A field/path is a pass when:

- it is scoreable, and
- the active comparison rule evaluates to true

### Fail

A field/path is a fail when:

- it is scoreable, and
- the active comparison rule evaluates to false

### Skip

A field/path is a skip when:

- truth contains an explicit configured sentinel value

### Error

A field/path is an error when:

- the comparator cannot determine a trustworthy result due to invalid comparison state

Examples:

- comparator expected numbers but encountered an impossible non-numeric value after validation
- array alignment rule could not be applied safely
- comparator profile references a missing path rule

For MVP, the implementation should prefer earlier validation hard-fails over producing many per-field errors.

---

## Artifact-level status semantics

Each artifact comparison must produce exactly one artifact status.

### `pass`

Artifact status is `pass` when:

- there are no hard validation/setup errors
- there are no field errors
- all scoreable fields passed

An artifact with only skipped fields and zero scoreable fields should **not** automatically count as `pass`.

Recommended MVP rule:

- if `scoreableFields === 0` and there are no hard errors, artifact status is `pass` only if the benchmark runner also clearly reports `accuracy.rate = null` and `coverage.rate = 0`
- the summary must explicitly say that the artifact had zero scoreable truth coverage

### `fail`

Artifact status is `fail` when:

- validation/setup succeeded enough to compare the artifact, and
- at least one scoreable field failed, and
- no hard error invalidated the artifact result

### `error`

Artifact status is `error` when:

- a hard artifact-level validation/setup failure occurred, or
- comparison could not produce a trustworthy artifact score

Examples:

- truth file missing
- produced artifact missing
- invalid truth schema
- invalid produced schema
- unresolved comparator

---

## Accuracy and coverage math

### Accuracy

Accuracy is computed only over scoreable fields.

```text
accuracy.passed = passedFields
accuracy.failed = failedFields
accuracy.rate = passedFields / scoreableFields
```

If `scoreableFields === 0`:

- `accuracy.rate = null`
- do not coerce to `0` or `1`

### Coverage

Coverage reports how much of the truth surface was eligible for scoring.

```text
coverage.scoreable = scoreableFields
coverage.skipped = skippedFields
coverage.totalTruthFields = totalTruthFields
coverage.rate = scoreableFields / totalTruthFields
```

If `totalTruthFields === 0`:

- `coverage.rate = null`
- this should normally indicate an invalid or useless truth artifact and should likely already have failed earlier

### Important distinction

Accuracy and coverage answer different questions:

- **accuracy**: “how often did the output match scoreable truth?”
- **coverage**: “how much of the truth artifact was specific enough to score?”

The runner must report both.

---

## Hard-error vs soft-failure conditions

### Hard errors

Hard errors mean benchmark setup or artifact validation failed and scoring should not proceed for that artifact.

#### Benchmark/setup hard errors

- invalid benchmark YAML block
- missing/unreadable `benchmark.json`
- missing/unreadable `fixture.json`
- invalid manifest contract version
- unresolved comparator `kind`
- unresolved comparator `profile`
- invalid comparator options

#### Artifact hard errors

- missing truth artifact
- missing required produced artifact
- truth JSON parse failure
- produced JSON parse failure
- truth artifact fails the expected real-output schema/shape
- produced artifact fails the expected real-output schema/shape
- array/container alignment is impossible in a way the comparator profile declares fatal

### Soft failures

Soft failures mean the benchmark successfully ran comparison but the output did not match truth.

Examples:

- scoreable transcript text mismatch
- mood mismatch
- boolean mismatch
- timing outside tolerance
- array length mismatch when the comparator chooses to represent it as a structural fail rather than a hard error

### Non-failure skips

These are valid and expected:

- truth field uses `unknown`
- truth field uses `ambiguous`

These reduce coverage but do not fail the benchmark by themselves.

---

## Per-artifact report contract

Each artifact must emit one report object.

### Required shape

```json
{
  "artifactKey": "dialogueData",
  "label": "Phase 1 dialogue",
  "phase": "phase1-gather-context",
  "script": "get-dialogue",
  "status": "fail",
  "truth": {
    "path": "benchmarks/fixtures/cod-test/truth/dialogue-data.json"
  },
  "output": {
    "path": "output/cod-test/phase1-gather-context/dialogue-data.json"
  },
  "comparator": {
    "kind": "json-structured",
    "profile": "dialogue-default",
    "resolvedOptions": {
      "timingToleranceSeconds": 2,
      "unknownSentinels": ["unknown", "ambiguous"]
    }
  },
  "counts": {
    "totalTruthFields": 120,
    "scoreableFields": 100,
    "skippedFields": 20,
    "passedFields": 92,
    "failedFields": 8,
    "erroredFields": 0
  },
  "accuracy": {
    "passed": 92,
    "failed": 8,
    "rate": 0.92
  },
  "coverage": {
    "scoreable": 100,
    "skipped": 20,
    "totalTruthFields": 120,
    "rate": 0.8333333333
  },
  "failures": [
    {
      "path": "dialogue_segments[2].text",
      "rule": "fuzzy-string",
      "truthValue": "The hell it ain't!",
      "outputValue": "The hell it aint!",
      "reason": "Normalized strings differed"
    }
  ],
  "skips": [
    {
      "path": "dialogue_segments[6].speaker",
      "truthValue": "ambiguous",
      "reason": "Explicit truth sentinel"
    }
  ],
  "errors": [],
  "summary": "92/100 scoreable fields passed; 20/120 truth fields were skipped due to explicit sentinels."
}
```

### Required semantics

Each artifact report must include:

- artifact identity (`artifactKey`, `phase`, `script`)
- truth path
- output path
- comparator identity and resolved options
- counts
- accuracy block
- coverage block
- details for failures/skips/errors
- a one-line summary string

### Detail payload rules

- `failures`, `skips`, and `errors` may be abbreviated subsets in the human report
- the JSON report should preserve enough detail for debugging and reruns
- the implementation may include full `fieldResults` in the JSON artifact report even if the markdown report is shorter

---

## Aggregate report contract

The benchmark runner must also emit one aggregate benchmark summary.

### Required shape

```json
{
  "contractVersion": "ee.benchmark-report/v1",
  "fixtureId": "cod-test",
  "benchmark": {
    "path": "benchmarks/fixtures/cod-test/benchmark.json"
  },
  "fixture": {
    "path": "benchmarks/fixtures/cod-test/fixture.json"
  },
  "run": {
    "configName": "cod-test",
    "outputDir": "output/cod-test"
  },
  "status": "fail",
  "artifacts": [
    {
      "artifactKey": "dialogueData",
      "status": "fail",
      "accuracyRate": 0.92,
      "coverageRate": 0.8333333333
    },
    {
      "artifactKey": "musicData",
      "status": "pass",
      "accuracyRate": 1,
      "coverageRate": 0.95
    }
  ],
  "totals": {
    "artifactsTotal": 2,
    "artifactsPassed": 1,
    "artifactsFailed": 1,
    "artifactsErrored": 0,
    "totalTruthFields": 140,
    "scoreableFields": 118,
    "skippedFields": 22,
    "passedFields": 110,
    "failedFields": 8,
    "erroredFields": 0
  },
  "accuracy": {
    "passed": 110,
    "failed": 8,
    "rate": 0.9322033898
  },
  "coverage": {
    "scoreable": 118,
    "skipped": 22,
    "totalTruthFields": 140,
    "rate": 0.8428571429
  },
  "errors": [],
  "summary": "1/2 artifacts passed. 110/118 scoreable fields passed. Truth coverage was 118/140 fields."
}
```

### Aggregate status rules

Benchmark status is:

- `error` if any required artifact is in `error`
- else `fail` if any artifact is in `fail`
- else `pass`

### Aggregate math rules

- total accuracy is computed from summed field counts, not by averaging artifact rates unless a second artifact-average metric is added later
- total coverage is computed from summed field counts, not by averaging artifact coverage rates

---

## Recommended MVP comparator set for `cod-test`

### Required first-wave comparator profiles

Implement these first:

1. `json-structured/dialogue-default`
2. `json-structured/music-default`
3. `json-structured/recommendation-default`

### First runnable fixture recommendation

For the first scaffold/runnable fixture, the recommended benchmarked artifacts are:

1. `dialogueData`
2. `musicData`

Rationale:

- both already exist in `cod-test`
- both have relatively compact, human-authorable JSON truth shapes
- both strongly exercise the comparator contract
- they validate timing tolerance, exact fields, fuzzy string fields, sentinel coverage, and reporting

### Recommendation profile status

`recommendation-default` should be defined in the contract now, but it can be staged behind the first runnable fixture if Derrick wants the initial corpus to stay tighter and less noisy.

### Chunk analysis follow-on

Add later:

4. `json-structured/chunk-analysis-default`

Rationale:

- larger artifact
- noisier text fields
- likely needs stronger alignment rules and more careful report truncation
- better as a follow-on once the scaffold lane lands the core pipeline

---

## Implementation guidance for the scaffold lane (`ee-siay`)

The scaffold lane should implement the following minimum behavior, no more:

1. load `benchmark.json`
2. load `fixture.json`
3. resolve `dialogue-default` and `music-default`
4. validate truth/output JSON before comparison
5. compare leaf paths deterministically
6. apply `unknown` / `ambiguous` skip semantics from truth only
7. apply 2-second default temporal tolerance
8. write:
   - one aggregate JSON summary
   - one per-artifact JSON result
   - optional markdown summary

The scaffold lane should **not**:

- invent AI-based scoring
- add semantic similarity judging
- relax missing required truth fields into skips
- move comparator rules into truth files
- start with chunk-analysis unless needed after the basic scaffold is stable

---

## Bottom line

The durable comparator/scoring contract for `emotion-engine` is:

- validate manifest and schemas before scoring
- compare truth and output as the same artifact-shaped JSON contract
- score at deterministic field/path granularity
- treat explicit truth sentinels like `unknown` and `ambiguous` as skipped coverage
- treat missing required truth fields as hard errors
- use tolerant temporal comparison with a 2-second default
- report both accuracy and truth coverage at artifact and aggregate levels
- start MVP comparator implementation with dialogue and music, define recommendation now, and leave chunk-analysis as the next follow-on

That is the contract the scaffold lane should implement against.
