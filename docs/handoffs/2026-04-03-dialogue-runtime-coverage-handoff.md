# April 3 next-session handoff: runtime isolation + dialogue coverage honesty

## What is now solved

### 1) Clean-live runtime isolation for the Xiaomi/OpenRouter verification lane is solved
- Added a narrow opt-in CLI flag: `--clean-live-digital-twin`.
- The clean-live path now removes only `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, and `DIGITAL_TWIN_CASSETTE` after normal dotenv loading, so repo secrets still load while stale record-mode state does not.
- This was live-verified successfully on the bounded rerun config.

Key code:
- `server/lib/cli-parser.cjs`
- `server/run-pipeline.cjs`

Primary evidence:
- Plan: `.plans/archive/2026-04-03-runtime-isolation-clean-live-xiaomi-verification.md`
- Successful clean-live log: `.logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log`
- Final clean-live success after the honesty fix: `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log`
- Events proof: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl`

What to remember:
- Do **not** go back to wrapper-level `unset` hacks for this lane.
- Use the actual supported entrypoint:
  - `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`

### 2) Dialogue coverage-span honesty is solved
- The old local bug that rewrote whole-asset dialogue coverage to the full asset duration is fixed.
- Persisted `coverage.start/end/duration` now preserve the recovered/model-supported span instead of being restamped to the full file.

### 3) `coverage.complete` honesty is also solved
- The remaining bug where a partial-reach artifact could still persist `coverage.complete: true` is fixed.
- Finalization now truth-checks `coverage.complete` against actual recovered reach versus requested whole-asset duration.
- The final saved artifact now correctly preserves partial span while flipping `complete` to `false` when the transcript does not cover the whole requested timeline.

Key code/tests:
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/lib/local-validator-tool-loop.test.js`
- `test/scripts/get-dialogue.test.js`

Primary evidence:
- Plan: `.plans/archive/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md`
- Plan: `.plans/archive/2026-04-03-coverage-complete-truth-check-fix.md`
- Focused/final rerun log: `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log`
- Fresh truthful artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- Script result wrapper: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-dialogue.success.json`
- Raw model capture showing upstream `complete: true` before local truth-check: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

Observed final truthful state on the successful clean-live rerun:
- `totalDuration: 140.042449`
- recovered/persisted coverage span: `0 -> 80s`
- persisted `coverage.complete: false`
- recovered segment reach matches the persisted partial span

## What remains open

### The remaining problem is no longer runtime isolation or coverage honesty
Those are done enough that they should **not** be reopened as the next lane unless a new regression appears.

### The real open question is upstream dialogue grounding / quality on the Xiaomi whole-asset lane
The current successful clean-live artifact is now honest, but it is still only a partial transcript of the full file. The pipeline is no longer lying about that fact; now the remaining question is whether Xiaomi/OpenRouter whole-asset dialogue is actually grounding on audio well enough to be useful.

What is still unresolved:
- Why the Xiaomi whole-asset response can produce COD-specific transcript content while also signaling weak/non-audio grounding.
- Whether the partial `0 -> 80s` reach is a provider/model grounding limit, a prompt/validator-loop interaction issue, or another upstream contract issue.
- Whether the right follow-up is Xiaomi-specific grounding work, or shifting effort toward the OpenRouter full-file benchmark lane where the next deterministic fix is late-suffix timestamp repair.

Primary open-plan context:
- `.plans/2026-04-03-xiaomi-dialogue-grounding-audit.md`
- `.plans/2026-04-03-openrouter-dialogue-loss-and-speaker-collapse-investigation.md`
- `.plans/2026-04-03-full-file-mimo-dialogue-benchmark-compare.md`

## Recommended next lane

### Recommended first next lane: Xiaomi dialogue grounding audit
Start with:
- `.plans/2026-04-03-xiaomi-dialogue-grounding-audit.md`

Why this is the right next lane:
- The repo-owned honesty bugs are fixed and live-verified.
- The next decision should be based on whether Xiaomi whole-asset dialogue is actually grounded on the attached audio, not on more metadata work.
- The audit already concluded this is **not primarily prompt leakage** and **not obviously broken transport**, which means the remaining issue is likely upstream grounding reliability under this provider/model path.

Key evidence set for that audit:
- Success artifact root: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`
- Prompt snapshot: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/ai/_prompts/d5e8ebc829bffa0a9b0b5d68decc5aedaf436fb78689372784cba8eb21a8bae4.json`
- Audio extraction evidence: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ffmpeg/dialogue/extract-audio.json`
- Raw provider capture: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Final honest artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`

If Derrick wants the next deterministic code-fix lane instead of another audit, the best alternate next lane is:
- `.plans/2026-04-03-openrouter-dialogue-loss-and-speaker-collapse-investigation.md`
- specifically its recommended late-suffix timestamp-repair fix before normalization drops overrun tail segments.

## Configs and commands worth reusing

Primary config for the solved lane:
- `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`

Relevant compare-lane config already updated separately:
- `configs/cod-test-mimo-openrouter-compare.yaml`

Focused regression command:
- `node --test test/scripts/get-dialogue.test.js test/lib/local-validator-tool-loop.test.js`

Canonical clean-live rerun command:
- `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`

## Repo state worth knowing
- Commit already created/pushed for this lane: `25dc9395aa5d0f2542d62732ba6a72f8256bc9d2`
- Commit message: `Fix clean-live dialogue coverage honesty lane`
- The April 3 runtime-isolation / coverage-honesty implementation plans are archived under `.plans/archive/`.

## Bottom line
- **Solved:** clean-live isolation, coverage span honesty, and `coverage.complete` honesty.
- **Not solved:** whether Xiaomi whole-asset dialogue is well-grounded enough to trust as a high-quality transcript of the full asset.
- **Recommended next lane:** `2026-04-03-xiaomi-dialogue-grounding-audit.md`, not another pass on runtime isolation or coverage metadata.
