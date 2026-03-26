# Truth benchmark fixture + manifest contract

**Status:** Active design contract  
**Established:** 2026-03-25

---

## Purpose

This document defines the first concrete contract for the repo-local truth benchmark system in `emotion-engine`.

The benchmark system exists to compare normal pipeline artifacts against human-authored truth artifacts **after** a normal run finishes. It is not a prompt-time annotation format and it is not a replacement for the existing script output contracts. Truth artifacts must use the same JSON schema and field shape that the real script outputs use.

This contract covers:

- the test YAML `benchmark` block
- the repo-local benchmark entry file `benchmark.json`
- the fixture metadata file `fixture.json`
- the relationship between benchmark entrypoint, fixture metadata, truth artifacts, comparators, and reports
- explicit trigger, skip, and hard-error behavior

---

## Chosen repo location

### Contract docs

The canonical written contract lives in:

- `docs/TRUTH-BENCHMARK-FIXTURE-MANIFEST-CONTRACT.md`

Rationale:

- `docs/` is already where this repo keeps durable contract documents
- there is not yet a committed benchmark runner/scaffold, so creating a partially-real runtime tree now would imply more implementation than this lane is supposed to do
- the benchmark fixture folder shape can be documented now and created later by the scaffold lane once the contract is implemented

### Proposed future benchmark data location

When the scaffold lane starts, the benchmark corpus should live under:

- `benchmarks/fixtures/<fixture-id>/fixture.json`
- `benchmarks/fixtures/<fixture-id>/benchmark.json`
- `benchmarks/fixtures/<fixture-id>/truth/<artifact-key>.json`

Rationale:

- keeps human-edited fixture/truth assets out of `docs/`
- keeps benchmark assets repo-local to `emotion-engine`, which is the decided owner of this test infrastructure
- allows multiple fixtures over time without coupling them to transient run output folders
- makes fixture IDs stable and source-controlled even when output directories change

This lane does **not** create the scaffold yet; it establishes the contract for that future folder shape.

---

## Core design principles

1. **Benchmarking is opt-in from test YAML.** No benchmark block means no benchmark step.
2. **Benchmarking runs after normal artifact generation.** If the pipeline run itself fails, benchmarking does not start.
3. **The YAML points to `benchmark.json`, not directly to truth files.**
4. **Truth files are per artifact/script/modality.** No giant mixed truth blob.
5. **Truth files must match the real artifact schema/shape.** They are not an annotation side format.
6. **Missing truth fields are bugs.** Omission is never used to mean unknown.
7. **Unknown or ambiguous values must be explicit sentinels.** They remain visible as skipped coverage in benchmark reports.
8. **Comparator rules live in benchmark metadata and runner logic, not inside truth payloads.**

---

## Glossary

### Fixture

A stable benchmark case representing one source asset + one config under test + one set of expected truth artifacts.

Example: `cod-test`

### Benchmark entry file

The `benchmark.json` file referenced by the YAML. It is the benchmark runner's entrypoint for one fixture.

### Fixture metadata file

The `fixture.json` file containing durable human-owned metadata about the fixture itself.

### Truth artifact

A JSON file under `truth/` that mirrors the exact expected shape of one real pipeline artifact, such as `dialogue-data.json` or `music-data.json`.

### Comparator

A named comparison strategy chosen by the benchmark manifest for one artifact. Comparators interpret equality/tolerance/skip behavior, but do not redefine the truth file shape.

### Coverage

The portion of truth fields that were eligible to be scored. Explicit unknown/ambiguous sentinel values reduce scoreable coverage but remain reportable.

---

## YAML contract

## Top-level benchmark block

The test YAML may include a top-level `benchmark` block.

### Minimum supported shape

```yaml
benchmark:
  enabled: true
  path: benchmarks/fixtures/cod-test/benchmark.json
```

### Fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | yes, if `benchmark` block exists | Explicitly turns benchmark execution on/off for this config. |
| `path` | string | yes, if `benchmark.enabled: true` | Path to the benchmark entry file (`benchmark.json`), relative to the YAML file or repo root once implemented. |

### Current contract rules

#### 1) `benchmark` block missing

Behavior:

- benchmark step is skipped
- normal pipeline run continues unchanged
- this is **not** an error

#### 2) `benchmark` block present with `enabled: false`

Example:

```yaml
benchmark:
  enabled: false
  path: benchmarks/fixtures/cod-test/benchmark.json
```

Behavior:

- benchmark step is skipped
- configured path is retained as inert metadata
- runner must **not** require the path to be deleted just because the benchmark is disabled
- this is **not** an error

#### 3) `benchmark` block present with `enabled: true`

Behavior:

- benchmark step must run after normal artifact generation finishes successfully
- `path` is required
- the path must resolve to a readable benchmark entry file
- invalid/missing/unreadable path is a **hard config error**

#### 4) `benchmark` block present with invalid shape

Examples:

- `enabled` missing
- `enabled` is not boolean
- `enabled: true` with missing `path`
- `path` not a string

Behavior:

- fail config validation hard before or at pipeline start
- do not silently coerce invalid values

### Non-goals for this first contract

The YAML contract intentionally does **not** yet require extra knobs like report destinations, comparator overrides, or fixture selectors. Those can be added later only if the benchmark runner needs them.

---

## `benchmark.json` contract

## Responsibility

`benchmark.json` is the single benchmark entrypoint referenced by the YAML.

It is responsible for telling the benchmark runner:

- which fixture is being benchmarked
- where the fixture metadata lives
- which output artifacts are expected to exist after the run
- which truth file corresponds to each artifact
- which comparator to use for each artifact
- where reports should be written

It is **not** responsible for holding the truth payloads themselves.

## Proposed shape

```json
{
  "contractVersion": "ee.benchmark-manifest/v1",
  "fixtureId": "cod-test",
  "fixture": {
    "path": "fixture.json"
  },
  "reports": {
    "outputDir": "_reports"
  },
  "artifacts": [
    {
      "artifactKey": "dialogueData",
      "label": "Phase 1 dialogue",
      "phase": "phase1-gather-context",
      "script": "get-dialogue",
      "output": {
        "path": "phase1-gather-context/dialogue-data.json"
      },
      "truth": {
        "path": "truth/dialogue-data.json"
      },
      "comparator": {
        "kind": "json-structured",
        "profile": "dialogue-default",
        "options": {
          "timingToleranceSeconds": 2,
          "unknownSentinels": ["unknown", "ambiguous"]
        }
      },
      "required": true
    },
    {
      "artifactKey": "musicData",
      "label": "Phase 1 music",
      "phase": "phase1-gather-context",
      "script": "get-music",
      "output": {
        "path": "phase1-gather-context/music-data.json"
      },
      "truth": {
        "path": "truth/music-data.json"
      },
      "comparator": {
        "kind": "json-structured",
        "profile": "music-default",
        "options": {
          "timingToleranceSeconds": 2,
          "unknownSentinels": ["unknown", "ambiguous"]
        }
      },
      "required": true
    }
  ]
}
```

## Required fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.benchmark-manifest/v1` for this contract version. |
| `fixtureId` | string | Stable fixture identifier. |
| `fixture.path` | string | Relative path from `benchmark.json` to `fixture.json`. |
| `artifacts` | array | Non-empty list of benchmarked artifacts. |
| `reports.outputDir` | string | Relative directory for benchmark outputs owned by the benchmark runner. |

## Artifact entry required fields

| Field | Type | Meaning |
| --- | --- | --- |
| `artifactKey` | string | Canonical artifact key aligned with the normal script result contract / artifact context. |
| `phase` | string | Owning pipeline phase, e.g. `phase1-gather-context`. |
| `script` | string | Stable script ID, e.g. `get-dialogue`. |
| `output.path` | string | Expected run-relative path to the produced artifact file. |
| `truth.path` | string | Relative path from `benchmark.json` to the truth JSON file. |
| `comparator.kind` | string | Named comparator family. |
| `required` | boolean | Whether the produced artifact is mandatory for benchmark execution. |

## Path resolution rules

Unless a later implementation doc overrides this with stronger normalization, use these rules:

- `benchmark.path` in YAML resolves to a concrete `benchmark.json`
- paths inside `benchmark.json` are resolved relative to the directory containing `benchmark.json`
- `output.path` is run-output-relative, not repo-root-relative
- the benchmark runner combines `asset.outputDir` from the executed config with each artifact `output.path` to locate actual outputs

That means `benchmark.json` stays fixture-owned and portable even when run folders move.

## What belongs in `benchmark.json`

Belongs here:

- artifact-to-truth mapping
- comparator selection
- report destination
- artifact requiredness
- stable benchmark manifest versioning

Does **not** belong here:

- raw truth payloads
- full fixture editorial notes
- generated scores/reports
- comparator implementation code

---

## `fixture.json` contract

## Responsibility

`fixture.json` is the durable human-owned metadata record for a benchmark fixture.

It describes:

- what the fixture is
- which source asset/config it is anchored to
- what benchmark manifest version it expects
- human-maintained notes about provenance, scope, and ownership

It does **not** enumerate all comparison rules for every artifact; that stays in `benchmark.json`.

## Proposed shape

```json
{
  "contractVersion": "ee.benchmark-fixture/v1",
  "fixtureId": "cod-test",
  "displayName": "Call of Duty trailer benchmark fixture",
  "description": "Canonical benchmark fixture for the cod.mp4 acceptance asset.",
  "asset": {
    "repoPath": "examples/videos/emotion-tests/cod.mp4"
  },
  "config": {
    "repoPath": "configs/cod-test.yaml"
  },
  "benchmark": {
    "entryPath": "benchmark.json"
  },
  "owners": [
    "emotion-engine"
  ],
  "tags": [
    "video",
    "dialogue",
    "music",
    "acceptance"
  ],
  "notes": [
    "Truth artifacts are per-script and must match real output schema.",
    "Unknown or ambiguous labels must remain explicit sentinels in truth JSON."
  ]
}
```

## Required fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.benchmark-fixture/v1`. |
| `fixtureId` | string | Stable fixture identifier. Must match `benchmark.json`. |
| `asset.repoPath` | string | Repo-relative source asset path. |
| `config.repoPath` | string | Repo-relative config path for the normal pipeline run that this fixture benchmarks. |
| `benchmark.entryPath` | string | Relative pointer back to the fixture's `benchmark.json`. |

## Allowed but optional fields

- `displayName`
- `description`
- `owners`
- `tags`
- `notes`
- future provenance fields such as authoring date, review status, or source clip hashes

## Why split `fixture.json` from `benchmark.json`

This split is intentional:

- `fixture.json` is the stable identity/provenance record for the fixture
- `benchmark.json` is the executable manifest for artifact comparison

That separation keeps simple fixture metadata human-readable and durable while allowing benchmark execution details to evolve independently.

---

## Truth artifact contract

Each truth artifact:

- lives under `truth/`
- is one file per benchmarked script/artifact
- uses the same JSON shape expected from the real output artifact
- may contain explicit sentinel values like `"unknown"` or `"ambiguous"` only where that schema allows such values

Examples:

- `truth/dialogue-data.json`
- `truth/music-data.json`
- later: `truth/chunk-analysis.json`, `truth/recommendation-data.json`, etc.

### Hard rules

#### 1) Shape parity is required

If the real artifact contract requires a field, the truth file must include it too.

#### 2) Omission is not a sentinel

Missing fields are treated as truth-data bugs.

#### 3) Unknown/ambiguous must be explicit

If a human cannot label something confidently, the truth file must say so with an explicit sentinel value. The benchmark runner then marks those fields as skipped coverage, not silent passes and not silent drops.

#### 4) Comparator semantics do not live inside the truth payload

Truth files should remain artifact-shaped source-of-truth data. Scoring/tolerance rules live in comparators and manifest metadata.

---

## Comparator contract

## Responsibility split

- truth file says **what the expected artifact data is**
- comparator says **how to compare produced data against truth**

## Initial comparator model

The first runner should assume a comparator registry keyed by `comparator.kind` and optional `profile`.

Initial proposed comparator shape inside `benchmark.json`:

```json
{
  "kind": "json-structured",
  "profile": "dialogue-default",
  "options": {
    "timingToleranceSeconds": 2,
    "unknownSentinels": ["unknown", "ambiguous"]
  }
}
```

## Initial comparator expectations

### Exact-match default

Use exact structured equality unless a comparator option explicitly permits tolerance.

### Timing tolerance

Initial default temporal tolerance may be `2` seconds for timing-based fields.

### Unknown sentinel handling

When truth contains an explicit sentinel such as `"unknown"` or `"ambiguous"`:

- that field is excluded from scored accuracy
- that field is counted in truth coverage / skipped coverage reporting
- the output should never be rewarded for matching omission

### Missing fields in produced artifact

If the produced artifact is missing a required field that the schema expects, that is a benchmark failure and likely a production bug.

### Missing fields in truth artifact

If the truth artifact is missing a required field, that is a truth-data validation error and the benchmark should hard-fail rather than pretending the field is unknown.

---

## Relationship between files and runtime

### 1) Normal pipeline config

The YAML config runs the ordinary pipeline and optionally opts into benchmarking.

### 2) `benchmark` block

If enabled, the YAML points to `benchmark.json`.

### 3) `benchmark.json`

The benchmark runner reads `benchmark.json` to discover:

- fixture metadata location
- artifact-to-truth mappings
- comparator selections
- report destination

### 4) `fixture.json`

The runner reads `fixture.json` for stable fixture identity and provenance.

### 5) Produced run artifacts

After the normal run finishes, the benchmark runner locates the real artifact files inside the run output directory.

### 6) Truth artifacts

The benchmark runner loads the corresponding truth JSON files from the fixture folder.

### 7) Comparator execution

Each artifact pair is validated and compared using the comparator declared in `benchmark.json`.

### 8) Benchmark reports

The benchmark runner emits both:

- **accuracy reports** — what matched, drifted, or failed
- **truth coverage reports** — what truth surface was scoreable vs skipped due to explicit unknown/ambiguous sentinels

---

## Report contract

The first implementation should write benchmark-owned outputs under the benchmark manifest's `reports.outputDir` inside the fixture tree and/or under the run output tree, but the minimum required report semantics are already defined here.

## Required report semantics

Every benchmark execution must expose:

1. **fixture identity**
   - fixture ID
   - config path
   - run output dir
   - benchmark manifest version

2. **artifact-level results**
   - artifact key
   - script
   - phase
   - truth file path
   - produced file path
   - comparator used
   - pass/fail/error/skip summary

3. **accuracy totals**
   - total scoreable checks
   - passed checks
   - failed checks

4. **truth coverage totals**
   - total truth fields encountered
   - scoreable fields
   - skipped fields due to explicit unknown/ambiguous sentinels
   - coverage percentage

5. **validation/config errors**
   - missing benchmark file
   - missing fixture file
   - missing truth file
   - invalid truth shape
   - missing produced artifact
   - comparator resolution failure

## Recommended initial report files

Recommended future output names:

- `benchmark-summary.json`
- `benchmark-summary.md`
- `artifact-results/<artifact-key>.json`

Those filenames are recommended, not yet mandatory. The semantic contents above are the contract that matters first.

---

## Trigger / skip / error behavior

## Trigger sequence

Benchmarking runs only when all of the following are true:

1. the YAML contains `benchmark`
2. `benchmark.enabled` is `true`
3. the normal pipeline run completes successfully enough to produce the targeted outputs
4. `benchmark.path` resolves to a valid `benchmark.json`

## Skip behavior

### Skip case A: benchmark block absent

Result:

- benchmark not attempted
- normal run result stands on its own

### Skip case B: benchmark block present but disabled

Result:

- benchmark not attempted
- benchmark path may remain in YAML without causing failure

### Skip case C: truth field marked unknown/ambiguous

Result:

- that specific field is skipped for scoring
- it still appears in coverage accounting
- it is not treated as pass or fail

## Hard config/runtime error behavior

### Hard error A: enabled benchmark with missing `path`

Result:

- config validation failure

### Hard error B: enabled benchmark with unreadable/missing `benchmark.json`

Result:

- config/runtime setup failure

### Hard error C: `benchmark.json` missing required fields or invalid contract version

Result:

- benchmark setup failure

### Hard error D: `fixture.json` missing or invalid

Result:

- benchmark setup failure

### Hard error E: truth artifact missing

Result:

- artifact benchmark error
- fixture is misconfigured/incomplete

### Hard error F: truth artifact fails its expected real schema/shape

Result:

- artifact benchmark error
- treat as a truth-data bug to fix, not as unknown coverage

### Hard error G: required produced artifact missing after a successful run

Result:

- artifact benchmark failure
- this is either pipeline output drift or benchmark manifest drift

### Hard error H: comparator cannot be resolved

Result:

- benchmark setup failure

## Important non-error case

A benchmark may complete successfully even when some fields are unscored because truth explicitly used `unknown` / `ambiguous`. That is a valid partial-coverage result, not a broken benchmark.

---

## MVP fixture layout recommendation

For the first real fixture (expected to be `cod-test`), use this shape when the scaffold lane begins:

```text
benchmarks/
  fixtures/
    cod-test/
      fixture.json
      benchmark.json
      truth/
        dialogue-data.json
        music-data.json
```

Expand later only as new scripts/artifacts are benchmarked.

Why this layout is preferred over a flatter approach:

- keeps a fixture self-contained
- makes the YAML point at one file only
- avoids mixing truth data with transient output folders
- scales cleanly to multiple fixtures and artifact types

---

## Deferred implementation decisions

These are intentionally left for later lanes, but this contract constrains them:

- exact benchmark runner CLI/API surface
- exact config-loader validation implementation details
- exact report output destination under `output/<run>/...` vs fixture-owned `_reports/`
- comparator registry code location
- whether benchmark reports should also emit a universal result envelope

Any later implementation must preserve the semantics in this document even if the code surface differs.

---

## Bottom line

The first durable benchmark contract for `emotion-engine` is:

- test YAML opt-in uses `benchmark.enabled` + `benchmark.path`
- the YAML points to `benchmark.json`
- `benchmark.json` maps produced artifacts to truth files and comparators
- `fixture.json` carries stable fixture identity and provenance
- truth files are one-per-artifact JSON files matching the real output schema
- missing truth fields are bugs
- explicit `unknown` / `ambiguous` sentinels produce skipped coverage, not silent omission
- benchmarking happens only after normal artifact generation
- missing/invalid enabled benchmark inputs fail hard

That is the contract the scaffold lane should now implement against.
