# Recent run error taxonomy: cod-test

- Generated at: 2026-03-13T15:51:28.586Z
- Run directory: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test`
- Capture files scanned: 49
- Logged error entries scanned: 7

## Executive summary

- Hard failure categories found: 5
- Top hard failure: **Provider returned no content** (11)
- Suspicious semantic anomalies: **13** capture(s)
- Most failure-prone model: **qwen/qwen3.5-397b-a17b** (11 error capture(s))

## Taxonomy categories

### Suspicious stock-assets / corporate-footage language — 13

- Taxonomy: `semantic_anomaly`
- Severity: `medium`
- Why it matters: Not necessarily a parser failure, but a suspicious semantic pattern worth grounding review.
- Phase breakdown: phase2-process=11, phase3-report=2
- Model breakdown: qwen/qwen3.5-397b-a17b=11, google/gemini-3.1-pro-preview=2
- Example paths:
  - `output/cod-test/phase2-process/raw/ai/chunk-0005/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0010/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0012/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0018/split-00/attempt-01/capture.json`

### Provider returned no content — 11

- Taxonomy: `provider_transport`
- Severity: `high`
- Why it matters: Provider call completed but delivered no usable content payload.
- Phase breakdown: phase2-process=11
- Model breakdown: qwen/qwen3.5-397b-a17b=11
- Example paths:
  - `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-02/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0002/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0011/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0013/split-00/attempt-01/capture.json`

### Parser fell back to placeholder output — 3

- Taxonomy: `structured_output`
- Severity: `high`
- Why it matters: Model returned something syntactically or semantically unusable, forcing placeholder fallback.
- Phase breakdown: phase2-process=3
- Model breakdown: google/gemini-3.1-pro-preview=2, z-ai/glm-4.6v=1
- Example paths:
  - `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-03/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-04/capture.json`
  - `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-05/capture.json`

### Strict JSON output was invalid — 3

- Taxonomy: `structured_output`
- Severity: `high`
- Why it matters: The model response could not be parsed as the required final JSON artifact.
- Phase breakdown: phase3-report=3
- Model breakdown: google/gemini-3.1-pro-preview=2, bytedance-seed/seed-2.0-mini=1
- Example paths:
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-04/capture.json`

### Generation hit max token limit — 2

- Taxonomy: `token_budget`
- Severity: `medium`
- Why it matters: Completion terminated for length before a complete structured answer was returned.
- Phase breakdown: phase3-report=2
- Model breakdown: google/gemini-3.1-pro-preview=2
- Example paths:
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`

### Reasoning token share crowded out final answer budget — 2

- Taxonomy: `thinking_budget`
- Severity: `medium`
- Why it matters: A large share of completion budget was consumed by reasoning instead of the final machine-readable answer.
- Phase breakdown: phase3-report=2
- Model breakdown: google/gemini-3.1-pro-preview=2
- Example paths:
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`

## Model stability snapshot

- `qwen/qwen3.5-397b-a17b`: 11/38 captures errored (provider_no_content=11)
- `google/gemini-3.1-pro-preview`: 4/6 captures errored (finish_length=2, high_reasoning_share=2, invalid_json=2, placeholder_fallback=2)
- `z-ai/glm-4.6v`: 1/2 captures errored (placeholder_fallback=1)
- `bytedance-seed/seed-2.0-mini`: 1/1 captures errored (invalid_json=1)
- `google/gemini-3.1-flash-lite-preview`: 0/2 captures errored

## Suspicious anomalies

- The following captures used suspicious “stock footage / corporate ad / training video” style language:
  - chunk 5: `output/cod-test/phase2-process/raw/ai/chunk-0005/split-00/attempt-01/capture.json`
    - summary: Generic villain exposition with buzzwords ('peace and security') over loud music feels like a corporate ad, not content.
  - chunk 6: `output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-01/capture.json`
    - summary: 30 seconds in and still hearing corporate platitudes? I should've scrolled at 3s.
  - chunk 10: `output/cod-test/phase2-process/raw/ai/chunk-0010/split-00/attempt-01/capture.json`
    - summary: Still drowning in generic military jargon while loud music screams for attention; zero visual payoff after 50 seconds.
  - chunk 12: `output/cod-test/phase2-process/raw/ai/chunk-0012/split-00/attempt-01/capture.json`
    - summary: Still stuck in the same generic military loop with deafening music and zero payoff; I should have scrolled ages ago.
  - chunk 18: `output/cod-test/phase2-process/raw/ai/chunk-0018/split-00/attempt-01/capture.json`
    - summary: Looping generic footage confirms the scroll decision; high-energy music feels wasted on dead visuals.
  - chunk 19: `output/cod-test/phase2-process/raw/ai/chunk-0019/split-00/attempt-01/capture.json`
    - summary: Generic looping visuals clash with high-energy music, confirming an instant scroll within the first 3 seconds.
  - chunk 24: `output/cod-test/phase2-process/raw/ai/chunk-0024/split-00/attempt-02/capture.json`
    - summary: High-energy music can't save generic stock visuals. I'm thumbing away before the 3-second mark because this looks like every other ad I skip.
  - chunk 25: `output/cod-test/phase2-process/raw/ai/chunk-0025/split-00/attempt-01/capture.json`
    - summary: Energetic track is screaming 'pay attention' but the stock footage is screaming 'ignore me'. I'm out before the beat drops.
  - chunk 26: `output/cod-test/phase2-process/raw/ai/chunk-0026/split-00/attempt-02/capture.json`
    - summary: The beat is loud but the visuals are generic stock trash, confirming this is just another corporate ad trying too hard.
  - chunk 27: `output/cod-test/phase2-process/raw/ai/chunk-0027/split-00/attempt-01/capture.json`
    - summary: 137 seconds into this corporate cringe fest and still pushing generic stock footage with cliché dialogue.
  - chunk 28: `output/cod-test/phase2-process/raw/ai/chunk-0028/split-00/attempt-01/capture.json`
    - summary: I scrolled away 134 seconds ago. This 0.01s blip is just more generic stock footage noise I never saw.
  - chunk undefined: `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`

## Derrick hypothesis: what should be generalized?

### tokenBudgets

- Verdict: **generalize_now**
- 2 attempt(s) hit explicit max-token truncation.
- 2 attempt(s) spent at least half of completion budget on reasoning.
- 3 invalid JSON failure(s) happened in the same lane where truncation showed up.

### thinkingControls

- Verdict: **generalize_now**
- Low thinking still consumed most of the completion budget in recommendation retries.
- Strict JSON / tool-loop turns are poor places to pay a large reasoning-token tax.

### validationTooling

- Verdict: **generalize_now**
- 3 placeholder-fallback parse failures already prove non-recommendation lanes need structured validation too.
- 3 recommendation failures show validator-aware loops help, but only if the lane also has enough output budget to finish.

### groundingRisk

- Verdict: **investigate**
- 13 output artifact(s) used stock-assets / corporate-footage language.
- This might be accurate criticism, but it is also the exact kind of stylistic overreach Derrick flagged for review.

### providerStability

- Verdict: **generalize_failover_and_capture**
- 11 provider-empty responses clustered in Phase 2 before failover recovered some chunks.
- That argues for keeping adapter-normalized error capture and consistent retry/failover policy across all AI lanes.

## Recommended next actions

- Generalize **explicit output budgets** for every strict-JSON lane, especially repair/tool-loop turns.
- Default **thinking off or minimal** for schema-only responses unless a lane proves it benefits from extra reasoning.
- Reuse **validator + parse-class capture** across Phase 2 and other JSON-producing calls, not just recommendation.
- Keep **normalized provider debug capture + failover metadata** because empty-provider responses were a dominant real failure mode.
- Treat the stock-assets phrasing as a **grounding-review input**, not automatic truth.

