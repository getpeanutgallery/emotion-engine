# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 3/8 passed, 4 failed, 1 errored
- Accuracy: 2849/3295 scoreable fields passed (86.5%)
- Coverage: 3295/3488 truth fields scoreable (94.5%)
- Skipped truth fields: 186
- Ignored differences surfaced outside score: 171

## Artifacts

- **dialogueData** — Phase 1 dialogue (primary spoken, reconciled) [primary spoken benchmark]; fail; accuracy=44.0%, coverage=95.5%, ignoredDiffs=0, outputSurface=reconciled, truthSurface=spoken_reconciled, reportSurface=primary
  - dialogue_text_full_transcript_pct=94.3%
  - dialogue_text_windowed_pct=94.3%
  - dialogue_boundary_pct=0.0%
  - splits=1, merges=3, missingTruthWindows=0, extraOutputWindows=0
- **dialogueDataRaw** — Phase 1 dialogue (diagnostic raw capture) [diagnostic raw capture]; fail; accuracy=82.8%, coverage=62.5%, ignoredDiffs=0, outputSurface=raw, truthSurface=raw_capture, reportSurface=diagnostic
  - dialogue_text_full_transcript_pct=67.7%
  - dialogue_text_windowed_pct=57.5%
  - dialogue_boundary_pct=42.9%
  - splits=2, merges=0, missingTruthWindows=1, extraOutputWindows=2
- **musicData** — Phase 1 music; error; accuracy=38.0%, coverage=87.7%, ignoredDiffs=5
  - music_segment_timeline_pct=44.4%
  - music_segment_content_pct=20.0%
  - music_summary_pct=0.0%
  - recognized_song_identity_pct=66.7%
  - recognized_song_support_pct=9.1%
- **musicVocalsData** — Phase 1 music vocals; fail; accuracy=50.0%, coverage=98.9%, ignoredDiffs=53
  - vocal_text_full_transcript_pct=58.0%
  - vocal_text_windowed_pct=60.0%
  - vocal_boundary_pct=50.0%
  - vocal_attribution_pct=55.6%
  - recognized_song_identity_pct=100.0%
  - recognized_song_support_pct=25.0%
  - splits=2, merges=0, missingTruthWindows=1, extraOutputWindows=2
- **chunkAnalysis** — Phase 2 chunk analysis; fail; accuracy=68.7%, coverage=94.9%, ignoredDiffs=113
  - chunk_timeline_pct=100.0%
  - chunk_summary_pct=0.0%
  - chunk_emotion_scores_pct=44.0%
  - chunk_dominant_emotion_pct=78.6%
  - chunk_persona_contract_pct=100.0%
- **recommendationData** — Phase 3 recommendation; pass; accuracy=100.0%, coverage=53.8%, ignoredDiffs=0
  - recommendation_text_pct=100.0%
  - recommendation_reasoning_pct=100.0%
  - recommendation_key_findings_pct=100.0%
  - recommendation_suggestions_pct=100.0%
  - recommendation_confidence_pct=100.0%
- **metricsData** — Phase 3 metrics; pass; accuracy=100.0%, coverage=97.2%, ignoredDiffs=0
  - metrics_summary_pct=100.0%
  - metrics_implementation_status_pct=100.0%
  - metrics_averages_pct=100.0%
  - metrics_peak_moments_pct=100.0%
  - metrics_trends_pct=100.0%
  - friction_index_pct=100.0%
- **emotionalAnalysisData** — Phase 3 emotional analysis; pass; accuracy=100.0%, coverage=99.5%, ignoredDiffs=0
  - emotional_summary_pct=100.0%
  - chunk_emotions_pct=100.0%
  - emotional_arc_pct=100.0%
  - scroll_risk_timeline_pct=0.0%
  - critical_moments_pct=0.0%
  - emotional_implementation_status_pct=100.0%

3/8 artifacts passed. 2849/3295 scoreable fields passed. Truth coverage was 3295/3488 fields.

