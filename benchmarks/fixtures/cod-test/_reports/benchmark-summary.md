# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 0/7 passed, 3 failed, 4 errored
- Accuracy: 373/680 scoreable fields passed (54.9%)
- Coverage: 680/1182 truth fields scoreable (57.5%)
- Skipped truth fields: 149
- Ignored differences surfaced outside score: 44

## Artifacts

- **dialogueData** — Phase 1 dialogue (primary spoken, reconciled) [primary spoken benchmark]; fail; accuracy=51.2%, coverage=95.7%, ignoredDiffs=0, outputSurface=reconciled, truthSurface=spoken_reconciled, reportSurface=primary
  - dialogue_text_full_transcript_pct=92.9%
  - dialogue_text_windowed_pct=93.1%
  - dialogue_boundary_pct=0.0%
  - splits=2, merges=2, missingTruthWindows=0, extraOutputWindows=0
- **dialogueDataRaw** — Phase 1 dialogue (diagnostic raw capture) [diagnostic raw capture]; fail; accuracy=77.6%, coverage=62.8%, ignoredDiffs=0, outputSurface=raw, truthSurface=raw_capture, reportSurface=diagnostic
  - dialogue_text_full_transcript_pct=66.7%
  - dialogue_text_windowed_pct=58.2%
  - dialogue_boundary_pct=14.3%
  - splits=3, merges=0, missingTruthWindows=1, extraOutputWindows=3
- **musicData** — Phase 1 music; error; accuracy=33.3%, coverage=84.9%, ignoredDiffs=5
  - music_segment_timeline_pct=35.7%
  - music_segment_content_pct=25.0%
  - music_summary_pct=0.0%
  - recognized_song_identity_pct=66.7%
  - recognized_song_support_pct=0.0%
- **musicVocalsData** — Phase 1 music vocals; fail; accuracy=38.8%, coverage=98.5%, ignoredDiffs=33
  - vocal_text_full_transcript_pct=12.7%
  - vocal_text_windowed_pct=17.1%
  - vocal_boundary_pct=50.0%
  - vocal_attribution_pct=55.6%
  - recognized_song_identity_pct=100.0%
  - recognized_song_support_pct=25.0%
  - splits=0, merges=1, missingTruthWindows=8, extraOutputWindows=3
- **recommendationData** — Phase 3 recommendation; error; accuracy=11.8%, coverage=47.2%, ignoredDiffs=4
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

0/7 artifacts passed. 373/680 scoreable fields passed. Truth coverage was 680/1182 fields.

