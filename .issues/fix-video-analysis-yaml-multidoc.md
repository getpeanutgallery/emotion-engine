# Fix config loader + `configs/video-analysis.yaml` multi-document parse issue

## Context / why it matters
The orchestrator currently expects a single YAML document for config loading. `configs/video-analysis.yaml` contains an additional `---` alternative block in the same file, which breaks loading. This blocks a documented config from running and creates confusion around supported YAML structure.

## Current symptoms (exact errors if known)
Running:

```bash
npm run pipeline -- --config configs/video-analysis.yaml --dry-run
```

fails with:

```text
❌ Pipeline failed: Failed to parse config file: expected a single document in the stream, but found more
```

The file currently includes a second document (`---`) labeled as an alternative parallel swarm example.

## Proposed fix approach
1. Decide desired behavior:
   - **Option A (strict single-doc):** keep loader strict; move alternative config into a separate file (e.g., `configs/video-analysis-parallel.yaml`).
   - **Option B (support multi-doc):** update loader to parse all YAML documents and select one explicitly (index/name/flag).
2. Update README and config docs to match chosen behavior.
3. Add regression tests for:
   - single-doc config success
   - multi-doc handling behavior (either explicit rejection with guidance, or supported selection logic)

## Acceptance criteria
- `configs/video-analysis.yaml` (or its replacement files) runs without parse failure in dry-run.
- Loader behavior for multi-document YAML is explicit, documented, and tested.
- Error message (if multi-doc remains unsupported) tells users exactly how to resolve (split docs into separate files).
- Config examples in `configs/` and README are internally consistent.