# Benchmark Percentage Extension Plan

**Date:** 2026-04-24  
**Scope:** Remaining benchmark artifact surfaces after dialogue scoring landed

## Decision

Keep `accuracyRate` and `coverageRate` as low-level comparator/debug math, but stop treating them as the human-facing benchmark answer for each artifact. For every benchmarked artifact, add a dedicated `<artifact>Scoring` block with artifact-specific percentages out of 100 and no composite/master score.

The dialogue artifact is the precedent:

- `dialogue_text_full_transcript_pct`
- `dialogue_text_windowed_pct`
- `dialogue_boundary_pct`

Do the same pattern everywhere else: multiple independent percentages, each answering one semantic question, with existing `failures` / `errors` / `fieldResults` retained for debugging.

## Current artifact inventory audited

From `benchmarks/fixtures/cod-test/benchmark.json` and `server/lib/benchmark-runner.cjs`:

1. `dialogueData`
2. `musicData`
3. `musicVocalsData`
4. `recommendationData`
5. `metricsData`
6. `emotionalAnalysisData`

Also noted: `chunk-analysis-default` already exists in the runner/tests even though `chunkAnalysis` is not in the current cod manifest. It should use the same percentage-block model whenever it is benchmarked again.

## Artifact-by-artifact recommendation

### 1) `dialogueData`

**Recommendation:** keep the landed model unchanged as the reference implementation.

**Report fields:**

```json
{
  "dialogueScoring": {
    "dialogue_text_full_transcript_pct": 90.7,
    "dialogue_text_windowed_pct": 90.7,
    "dialogue_boundary_pct": 0.0,
    "truth_segment_count": 20,
    "output_segment_count": 17,
    "split_event_count": 1,
    "merge_event_count": 3,
    "missing_truth_window_count": 0,
    "extra_output_window_count": 0,
    "normalization_profile": "dialogue-text-v1",
    "window_alignments": []
  }
}
```

**Why:** this already matches Derrick's direction: separate text fidelity from segmentation fidelity, no composite.

**Required tests to keep:**

- split/merge drift preserves text percentages while boundary percentage drops
- missing-line case lowers text percentages without being mislabeled as split/merge
- provisional raw vs reconciled posture still classifies drift honestly

---

### 2) `musicData`

**Problem observed:** current `accuracyRate` blends timing, prose descriptions, mood/intensity labels, and recognized-song evidence into one opaque number.

**Recommendation:** split music into timeline, descriptive content, and song-identification support.

**Proposed fields:**

```json
{
  "musicScoring": {
    "music_segment_timeline_pct": 0.0,
    "music_segment_content_pct": 32.0,
    "music_summary_pct": 0.0,
    "recognized_song_identity_pct": 66.7,
    "recognized_song_support_pct": 40.0,
    "truth_segment_count": 5,
    "output_segment_count": 6,
    "missing_truth_segment_count": 0,
    "extra_output_segment_count": 1,
    "alignment_strategy": "time-aware-segments"
  }
}
```

**Definition notes:**

- `music_segment_timeline_pct`: percent of truth music segments whose matched output segment preserved authoritative structure fields (`start`, `end`, `type`) within tolerance.
- `music_segment_content_pct`: percent of matched segment content fields passed across `description`, `mood`, `intensity`.
- `music_summary_pct`: percent passed for top-level summary prose fields only.
- `recognized_song_identity_pct`: percent passed for `recognizedSong.status`, candidate identity (`title`, `artist`), `multipleSongsDetected`, and confidence fields.
- `recognized_song_support_pct`: percent passed for supporting evidence payloads like `evidence`, `matchedLyrics`, and `timeRanges`.

**Why:** the current cod failure shows music can be wrong in different ways: chronology drift, semantic labeling drift, and song-support drift. Those should not collapse into one number.

**Required tests:**

- segment timing drift lowers `music_segment_timeline_pct` without automatically crushing song-support percentages
- recognized song identity can pass while support time ranges fail
- extra output segment lowers timeline/structure surface and increments `extra_output_segment_count`

---

### 3) `musicVocalsData`

**Problem observed:** this is the most likely artifact family to be confused with dialogue contamination, but today it only exposes generic accuracy/coverage.

**Recommendation:** mirror dialogue for lyric text, then add separate attribution and recognition-support percentages.

**Proposed fields:**

```json
{
  "musicVocalsScoring": {
    "vocal_text_full_transcript_pct": 78.4,
    "vocal_text_windowed_pct": 74.1,
    "vocal_boundary_pct": 61.5,
    "vocal_attribution_pct": 58.3,
    "recognized_song_identity_pct": 100.0,
    "recognized_song_support_pct": 66.7,
    "truth_segment_count": 12,
    "output_segment_count": 14,
    "split_event_count": 0,
    "merge_event_count": 0,
    "missing_truth_window_count": 0,
    "extra_output_window_count": 2,
    "normalization_profile": "lyrics-text-v1",
    "window_alignments": []
  }
}
```

**Definition notes:**

- `vocal_text_full_transcript_pct`: whole-lane normalized lyric transcript accuracy.
- `vocal_text_windowed_pct`: local matched lyric-window accuracy across time-aware aligned vocal windows.
- `vocal_boundary_pct`: segmentation fidelity for `vocal_segments`.
- `vocal_attribution_pct`: percent passed for matched-window non-text identity fields such as `performer`, `performer_id`, and `delivery`.
- `recognized_song_identity_pct`: song candidate identity correctness.
- `recognized_song_support_pct`: evidence, lyric fragments, and support time ranges.

**Why:** music-vocals has the same split/merge problem class as dialogue, but also an extra attribution question that deserves its own percentage.

**Required tests:**

- split/merge lyric drift preserves transcript percentages while boundary percentage drops
- wrong `performer` / `delivery` lowers `vocal_attribution_pct` without pretending the lyric transcript itself is equally wrong
- recognized-song support time-range miss lowers `recognized_song_support_pct` while identity can still pass

---

### 4) `recommendationData`

**Problem observed:** recommendation outputs are prose-heavy, so one generic accuracy rate hides whether the failure is in the headline recommendation, the reasoning, or the structured lists.

**Recommendation:** split recommendation scoring by narrative surface.

**Proposed fields:**

```json
{
  "recommendationScoring": {
    "recommendation_text_pct": 0.0,
    "recommendation_reasoning_pct": 0.0,
    "recommendation_key_findings_pct": 0.0,
    "recommendation_suggestions_pct": 0.0,
    "recommendation_confidence_pct": 0.0,
    "key_findings_truth_count": 6,
    "key_findings_output_count": 4,
    "suggestions_truth_count": 11,
    "suggestions_output_count": 8,
    "list_alignment_strategy": "index-or-fuzzy-item"
  }
}
```

**Definition notes:**

- `recommendation_text_pct`: headline `text` field only.
- `recommendation_reasoning_pct`: `reasoning` field only.
- `recommendation_key_findings_pct`: percent passed across the `keyFindings` list using current fuzzy-string semantics.
- `recommendation_suggestions_pct`: percent passed across the `suggestions` list.
- `recommendation_confidence_pct`: confidence field pass/fail under tolerant-number rules, reported as 100 or 0.

**Why:** recommendation truth is editorial. Consumers need to know whether the system missed the main recommendation, the explanation, or just some list completeness.

**Required tests:**

- ignored AI metadata still stays outside the score block
- list truncation lowers `recommendation_key_findings_pct` / `recommendation_suggestions_pct`
- fuzzy prose drift can pass the text/reasoning surfaces when wording is materially equivalent

---

### 5) `metricsData`

**Problem observed:** current cod output demonstrates a whole derived family can be absent while generic coverage/accuracy obscure which metric families failed.

**Recommendation:** split by derived metric family.

**Proposed fields:**

```json
{
  "metricsScoring": {
    "metrics_summary_pct": 50.0,
    "metrics_implementation_status_pct": 0.0,
    "metrics_averages_pct": 0.0,
    "metrics_peak_moments_pct": 0.0,
    "metrics_trends_pct": 0.0,
    "friction_index_pct": 0.0,
    "missing_metric_family_count": 3
  }
}
```

**Definition notes:**

- `metrics_summary_pct`: `summary.*` fields.
- `metrics_implementation_status_pct`: `implementationStatus.*` only.
- `metrics_averages_pct`: `averages.*` fields.
- `metrics_peak_moments_pct`: `peakMoments.*` fields.
- `metrics_trends_pct`: `trends.*` fields.
- `friction_index_pct`: `frictionIndex` only, reported as 100 or 0 under tolerant-number pass/fail.
- `missing_metric_family_count`: count of expected top-level families absent from output (`averages`, `peakMoments`, `trends`, etc.).

**Why:** this artifact is conceptually several derived reports in one JSON file; each family should reveal its own health.

**Required tests:**

- missing derived families produce `0.0` for their own percentage, not just a vague global accuracy drop
- tolerant numeric drift still passes `metrics_averages_pct`, `metrics_peak_moments_pct`, and `metrics_trends_pct`
- wrong `implementationStatus` lowers only that dedicated surface

---

### 6) `emotionalAnalysisData`

**Problem observed:** this artifact currently explodes into massive structural error counts when the timeseries families are absent. That is honest, but unreadable.

**Recommendation:** split emotional-analysis reporting by major derived surface.

**Proposed fields:**

```json
{
  "emotionalAnalysisScoring": {
    "emotional_summary_pct": 0.0,
    "chunk_emotions_pct": 0.0,
    "emotional_arc_pct": 0.0,
    "scroll_risk_timeline_pct": 0.0,
    "critical_moments_pct": 0.0,
    "emotional_implementation_status_pct": 0.0,
    "missing_family_count": 4,
    "truth_chunk_count": 28,
    "output_chunk_count": 0,
    "truth_critical_moment_count": 13,
    "output_critical_moment_count": 0
  }
}
```

**Definition notes:**

- `emotional_summary_pct`: `summary.*` fields.
- `chunk_emotions_pct`: `chunkAnalysis[*]` fields including emotion values, velocity, dominant emotion, signature, and per-chunk structure.
- `emotional_arc_pct`: `emotionalArc.timestamps`, `emotionalArc.emotions`, `emotionalArc.smoothedEmotions`, `windowSize`.
- `scroll_risk_timeline_pct`: `scrollRiskTimeline[*]` fields.
- `critical_moments_pct`: `criticalMoments[*]` structure and scalar fields except ignored prose context.
- `emotional_implementation_status_pct`: `implementationStatus.*` only.

**Why:** when this artifact is empty, we want a crisp answer: summary missing, chunk layer missing, timeline missing, critical moments missing. No master score needed.

**Required tests:**

- empty-output fallback yields `0.0` on the missing families with correct missing counts
- tolerant numeric drift on timeline values still passes the relevant family percentages
- ignored `criticalMoments[*].context` stays outside the family score math

---

### 7) `chunkAnalysis` (supported profile, not in current cod manifest)

**Recommendation:** if reintroduced into a benchmark manifest, give it its own block instead of relying on generic accuracy/coverage.

**Proposed fields:**

```json
{
  "chunkAnalysisScoring": {
    "chunk_timeline_pct": 100.0,
    "chunk_summary_pct": 95.0,
    "chunk_emotion_scores_pct": 93.3,
    "chunk_dominant_emotion_pct": 100.0,
    "chunk_persona_contract_pct": 100.0,
    "truth_chunk_count": 2,
    "output_chunk_count": 2,
    "alignment_strategy": "chunkIndex+splitIndex"
  }
}
```

**Required tests:**

- keyed chunk alignment survives reordering
- ignored token counts stay outside score math
- numeric drift affects only `chunk_emotion_scores_pct`

## Shared implementation rule

For every artifact:

- keep current `counts`, `accuracy`, `coverage`, `failures`, `errors`, `skips`, `ignoredDifferences`, `fieldResults`
- add one artifact-specific scoring block
- render artifact-specific percentages in `benchmark-summary.md`
- do **not** add any artifact-level or run-level weighted/composite/master percentage
- keep aggregate benchmark summary focused on pass/fail counts plus low-level totals; do not invent a master benchmark score

## Lyric-leakage regression fixture/test design

## Goal

Isolate the known failure mode where sung lyric text leaks into the dialogue lane instead of staying in `musicVocalsData`.

## Fixture shape

Add a dedicated temp benchmark test fixture inside `test/lib/benchmark-runner.test.js` with **two artifacts in the same manifest**:

1. `dialogueData`
2. `musicVocalsData`

### Truth payloads

**Dialogue truth**

- contains only spoken lines
- has **no** lyric lines during the song section

Example:

```json
{
  "dialogue_segments": [
    { "start": 0, "end": 2, "speaker": "Speaker 1", "text": "Wake up, Mason.", "confidence": 0.98 },
    { "start": 4, "end": 6, "speaker": "Speaker 2", "text": "This is not a victory.", "confidence": 0.98 }
  ],
  "summary": "Spoken dialogue only.",
  "totalDuration": 30,
  "handoffContext": null
}
```

**Music vocals truth**

- contains lyric lines in a later song region

Example:

```json
{
  "vocal_segments": [
    { "start": 20, "end": 22, "text": "Master, master", "confidence": 0.95, "performer": "Metallica", "performer_id": "voc_001", "delivery": "chant" },
    { "start": 22, "end": 24, "text": "Obey your master", "confidence": 0.95, "performer": "Metallica", "performer_id": "voc_001", "delivery": "chant" }
  ],
  "summary": "Sung vocals only.",
  "hasVocals": true,
  "totalDuration": 30,
  "recognizedSong": {
    "status": "recognized",
    "confidence": 0.95,
    "candidates": [
      {
        "title": "Master of Puppets",
        "artist": "Metallica",
        "confidence": 0.95,
        "evidence": ["Literal lyric fragments are audible."],
        "matchedLyrics": ["Master, master", "Obey your master"],
        "timeRanges": [{ "start": 20, "end": 24 }]
      }
    ],
    "primaryEvidence": "Literal lyric evidence grounds one specific song.",
    "multipleSongsDetected": false
  },
  "recognitionNotes": ["Dialogue is excluded from lyric evidence."]
}
```

### Contaminated runtime outputs

**Dialogue output under test**

Inject lyric leakage into the dialogue lane, either as:

- a substituted spoken line (`"This is not a victory."` -> `"Obey your master"`), or
- an extra dialogue segment at the vocal timestamps (`20-24s`) carrying lyric text

Use the extra-segment version first because it proves lane contamination most directly.

Example:

```json
{
  "dialogue_segments": [
    { "start": 0, "end": 2, "speaker": "Speaker 1", "text": "Wake up, Mason.", "confidence": 0.98 },
    { "start": 4, "end": 6, "speaker": "Speaker 2", "text": "This is not a victory.", "confidence": 0.98 },
    { "start": 20, "end": 24, "speaker": "Speaker 3", "text": "Master, master. Obey your master.", "confidence": 0.98 }
  ],
  "summary": "Dialogue contaminated by sung lyrics.",
  "totalDuration": 30,
  "handoffContext": null
}
```

**Music vocals output under test**

Keep this correct so the test proves the lyrics belonged in the music-vocals lane and only the dialogue lane is contaminated.

## Exact assertions

Add one dedicated test with assertions equivalent to:

- `result.status === 'fail'`
- `dialogueArtifact.status === 'fail'`
- `musicVocalsArtifact.status === 'pass'`
- `dialogueArtifact.dialogueScoring.dialogue_text_full_transcript_pct < 100`
- `dialogueArtifact.dialogueScoring.dialogue_text_windowed_pct < 100`
- `dialogueArtifact.dialogueScoring.extra_output_window_count >= 1`
- `dialogueArtifact.dialogueScoring.window_alignments.some((entry) => entry.boundary_status === 'extra_output')`
- `dialogueArtifact.failures.some((failure) => failure.path.includes('dialogue_segments[output='))`
- summary markdown includes the dialogue percentages, but no composite/master score

If the current dialogue windowing implementation does not yet emit `extra_output` alignments for this case, the fallback acceptable assertion is:

- transcript percentages drop below 100, and
- the dialogue artifact surfaces an unmatched extra output segment / structural failure at the leaked lyric path

## Why this fixture matters

The live cod fixture already shows lyric contamination pressure, but not as a named isolated regression. This dedicated fixture makes future regressions obvious:

- lyrics correctly present in `musicVocalsData` can still pass
- the same lyric text appearing in `dialogueData` must reduce dialogue percentages
- no composite score can hide which lane was contaminated

## Implementation order

1. Extend artifact result shaping to allow artifact-specific scoring blocks beyond dialogue.
2. Add `musicVocalsScoring`, `musicScoring`, `recommendationScoring`, `metricsScoring`, and `emotionalAnalysisScoring`.
3. Render those fields in `benchmark-summary.md` using artifact-specific bullet lines.
4. Add the dedicated lyric-leakage regression fixture/test.
5. Add focused artifact-family tests for each new scoring block.

## Bottom line

Recommended percentage model:

- **Dialogue:** transcript %, windowed text %, boundary %
- **Music:** segment timeline %, segment content %, summary %, recognized-song identity %, recognized-song support %
- **Music vocals:** transcript %, windowed lyric %, boundary %, attribution %, recognized-song identity %, recognized-song support %
- **Recommendation:** text %, reasoning %, key findings %, suggestions %, confidence %
- **Metrics:** summary %, implementation-status %, averages %, peak moments %, trends %, friction index %
- **Emotional analysis:** summary %, chunk emotions %, emotional arc %, scroll-risk timeline %, critical moments %, implementation-status %
- **Chunk analysis when benchmarked:** timeline %, summary %, emotion scores %, dominant-emotion %, persona-contract %

No composites. Keep the percentages independent, keep the raw comparator diagnostics, and make lyric leakage a first-class regression instead of a real-fixture surprise.
