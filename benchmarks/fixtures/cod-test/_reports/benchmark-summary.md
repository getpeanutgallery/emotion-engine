# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 1/7 passed, 2 failed, 4 errored
- Accuracy: 364/656 scoreable fields passed (55.5%)
- Coverage: 656/1149 truth fields scoreable (57.1%)
- Skipped truth fields: 144
- Ignored differences surfaced outside score: 62

## Artifacts

- **dialogueData** — Phase 1 dialogue (primary spoken, reconciled) [primary spoken benchmark]; fail; accuracy=36.1%, coverage=96.6%, ignoredDiffs=0, outputSurface=reconciled, truthSurface=spoken_reconciled, reportSurface=primary
  - dialogue_text_full_transcript_pct=90.7%
  - dialogue_text_windowed_pct=90.7%
  - dialogue_boundary_pct=0.0%
  - splits=1, merges=3, missingTruthWindows=0, extraOutputWindows=0
- **dialogueDataRaw** — Phase 1 dialogue (diagnostic raw capture) [diagnostic raw capture]; pass; accuracy=100.0%, coverage=61.7%, ignoredDiffs=0, outputSurface=raw, truthSurface=raw_capture, reportSurface=diagnostic
  - dialogue_text_full_transcript_pct=100.0%
  - dialogue_text_windowed_pct=100.0%
  - dialogue_boundary_pct=100.0%
  - splits=0, merges=0, missingTruthWindows=0, extraOutputWindows=0
- **musicData** — Phase 1 music; error; accuracy=32.0%, coverage=89.3%, ignoredDiffs=5
  - music_segment_timeline_pct=35.3%
  - music_segment_content_pct=13.3%
  - music_summary_pct=0.0%
  - recognized_song_identity_pct=66.7%
  - recognized_song_support_pct=9.1%
- **musicVocalsData** — Phase 1 music vocals; fail; accuracy=51.7%, coverage=98.9%, ignoredDiffs=51
  - vocal_text_full_transcript_pct=46.2%
  - vocal_text_windowed_pct=46.0%
  - vocal_boundary_pct=57.1%
  - vocal_attribution_pct=55.6%
  - recognized_song_identity_pct=100.0%
  - recognized_song_support_pct=25.0%
  - splits=2, merges=0, missingTruthWindows=3, extraOutputWindows=2
- **recommendationData** — Phase 3 recommendation; error; accuracy=10.5%, coverage=52.8%, ignoredDiffs=4
  - recommendation_text_pct=0.0%
  - recommendation_reasoning_pct=0.0%
  - recommendation_key_findings_pct=0.0%
  - recommendation_suggestions_pct=0.0%
  - recommendation_confidence_pct=0.0%
- **metricsData** — Phase 3 metrics; error; accuracy=37.5%, coverage=42.1%, ignoredDiffs=1
  - metrics_summary_pct=50.0%
  - metrics_implementation_status_pct=0.0%
  - metrics_averages_pct=0.0%
  - metrics_peak_moments_pct=0.0%
  - metrics_trends_pct=0.0%
  - friction_index_pct=0.0%
- **emotionalAnalysisData** — Phase 3 emotional analysis; error; accuracy=16.7%, coverage=3.5%, ignoredDiffs=1
  - emotional_summary_pct=16.7%
  - chunk_emotions_pct=0.0%
  - emotional_arc_pct=0.0%
  - scroll_risk_timeline_pct=0.0%
  - critical_moments_pct=0.0%
  - emotional_implementation_status_pct=0.0%

1/7 artifacts passed. 364/656 scoreable fields passed. Truth coverage was 656/1149 fields.

