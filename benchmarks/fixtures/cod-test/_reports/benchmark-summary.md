# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 0/7 passed, 3 failed, 4 errored
- Accuracy: 362/699 scoreable fields passed (51.8%)
- Coverage: 699/1203 truth fields scoreable (58.1%)
- Skipped truth fields: 149
- Ignored differences surfaced outside score: 64

## Artifacts

- **dialogueData** — Phase 1 dialogue (primary spoken, reconciled) [primary spoken benchmark]; fail; accuracy=41.0%, coverage=95.5%, ignoredDiffs=0, outputSurface=reconciled, truthSurface=spoken_reconciled, reportSurface=primary
  - dialogue_text_full_transcript_pct=95.0%
  - dialogue_text_windowed_pct=95.0%
  - dialogue_boundary_pct=0.0%
  - splits=1, merges=2, missingTruthWindows=0, extraOutputWindows=0
- **dialogueDataRaw** — Phase 1 dialogue (diagnostic raw capture) [diagnostic raw capture]; fail; accuracy=82.8%, coverage=63.2%, ignoredDiffs=0, outputSurface=raw, truthSurface=raw_capture, reportSurface=diagnostic
  - dialogue_text_full_transcript_pct=71.0%
  - dialogue_text_windowed_pct=50.4%
  - dialogue_boundary_pct=0.0%
  - splits=5, merges=0, missingTruthWindows=1, extraOutputWindows=7
- **musicData** — Phase 1 music; error; accuracy=29.4%, coverage=86.4%, ignoredDiffs=5
  - music_segment_timeline_pct=35.3%
  - music_segment_content_pct=13.3%
  - music_summary_pct=0.0%
  - recognized_song_identity_pct=83.3%
  - recognized_song_support_pct=0.0%
- **musicVocalsData** — Phase 1 music vocals; fail; accuracy=44.7%, coverage=98.9%, ignoredDiffs=53
  - vocal_text_full_transcript_pct=55.4%
  - vocal_text_windowed_pct=53.0%
  - vocal_boundary_pct=60.0%
  - vocal_attribution_pct=55.6%
  - recognized_song_identity_pct=100.0%
  - recognized_song_support_pct=25.0%
  - splits=0, merges=1, missingTruthWindows=1, extraOutputWindows=3
- **recommendationData** — Phase 3 recommendation; error; accuracy=13.3%, coverage=41.7%, ignoredDiffs=4
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

0/7 artifacts passed. 362/699 scoreable fields passed. Truth coverage was 699/1203 fields.

