# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 0/6 passed, 1 failed, 5 errored
- Accuracy: 171/466 scoreable fields passed (36.7%)
- Coverage: 466/860 truth fields scoreable (54.2%)
- Skipped truth fields: 25
- Ignored differences surfaced outside score: 40
- Reconciled/post-processing contract mismatch fields: 184

## Artifacts

- **dialogueData** — fail; accuracy=36.1%, coverage=96.6%, ignoredDiffs=0, posture=reconciled/post-processing contract, reconciledContractMismatch=184
  - dialogue_text_full_transcript_pct=90.7%
  - dialogue_text_windowed_pct=90.7%
  - dialogue_boundary_pct=0.0%
  - splits=1, merges=3, missingTruthWindows=0, extraOutputWindows=0
- **musicData** — error; accuracy=32.0%, coverage=89.3%, ignoredDiffs=5
  - music_segment_timeline_pct=35.3%
  - music_segment_content_pct=13.3%
  - music_summary_pct=0.0%
  - recognized_song_identity_pct=66.7%
  - recognized_song_support_pct=9.1%
- **musicVocalsData** — error; accuracy=49.4%, coverage=80.9%, ignoredDiffs=29
  - vocal_text_full_transcript_pct=45.0%
  - vocal_text_windowed_pct=44.9%
  - vocal_boundary_pct=57.1%
  - vocal_attribution_pct=55.6%
  - recognized_song_identity_pct=100.0%
  - recognized_song_support_pct=0.0%
  - splits=2, merges=0, missingTruthWindows=3, extraOutputWindows=2
- **recommendationData** — error; accuracy=10.5%, coverage=52.8%, ignoredDiffs=4
  - recommendation_text_pct=0.0%
  - recommendation_reasoning_pct=0.0%
  - recommendation_key_findings_pct=0.0%
  - recommendation_suggestions_pct=0.0%
  - recommendation_confidence_pct=0.0%
- **metricsData** — error; accuracy=37.5%, coverage=42.1%, ignoredDiffs=1
  - metrics_summary_pct=50.0%
  - metrics_implementation_status_pct=0.0%
  - metrics_averages_pct=0.0%
  - metrics_peak_moments_pct=0.0%
  - metrics_trends_pct=0.0%
  - friction_index_pct=0.0%
- **emotionalAnalysisData** — error; accuracy=16.7%, coverage=3.5%, ignoredDiffs=1
  - emotional_summary_pct=16.7%
  - chunk_emotions_pct=0.0%
  - emotional_arc_pct=0.0%
  - scroll_risk_timeline_pct=0.0%
  - critical_moments_pct=0.0%
  - emotional_implementation_status_pct=0.0%

0/6 artifacts passed. 171/466 scoreable fields passed. Truth coverage was 466/860 fields. reconciled contract mismatch=184.

