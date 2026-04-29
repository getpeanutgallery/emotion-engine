# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Phase 2 Chunk Benchmark Slice`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 0/8 passed, 5 failed, 3 errored
- Accuracy: 2072/3282 scoreable fields passed (63.1%)
- Coverage: 3282/3489 truth fields scoreable (94.1%)
- Skipped truth fields: 181
- Ignored differences surfaced outside score: 96

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
- **chunkAnalysis** — Phase 2 chunk analysis; fail; accuracy=66.9%, coverage=94.9%, ignoredDiffs=29
  - chunk_timeline_pct=100.0%
  - chunk_summary_pct=0.0%
  - chunk_emotion_scores_pct=31.0%
  - chunk_dominant_emotion_pct=78.6%
  - chunk_persona_contract_pct=100.0%
- **recommendationData** — Phase 3 recommendation; error; accuracy=15.0%, coverage=55.6%, ignoredDiffs=4
  - recommendation_text_pct=0.0%
  - recommendation_reasoning_pct=0.0%
  - recommendation_key_findings_pct=0.0%
  - recommendation_suggestions_pct=0.0%
  - recommendation_confidence_pct=100.0%
- **metricsData** — Phase 3 metrics; fail; accuracy=54.3%, coverage=97.2%, ignoredDiffs=1
  - metrics_summary_pct=100.0%
  - metrics_implementation_status_pct=100.0%
  - metrics_averages_pct=33.3%
  - metrics_peak_moments_pct=33.3%
  - metrics_trends_pct=58.3%
  - friction_index_pct=0.0%
- **emotionalAnalysisData** — Phase 3 emotional analysis; error; accuracy=65.9%, coverage=99.1%, ignoredDiffs=4
  - emotional_summary_pct=83.3%
  - chunk_emotions_pct=77.5%
  - emotional_arc_pct=56.4%
  - scroll_risk_timeline_pct=0.0%
  - critical_moments_pct=0.0%
  - emotional_implementation_status_pct=100.0%

0/8 artifacts passed. 2072/3282 scoreable fields passed. Truth coverage was 3282/3489 fields.

