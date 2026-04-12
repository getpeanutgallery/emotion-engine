# COD Dialogue-Only Model Comparison (MiMo vs GPT Audio vs Gemini)

**Date:** 2026-04-10  
**Scope:** Dialogue fidelity only, compared to human-verified truth at `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

## Outcome Summary

1. **Gemini (hardened rerun) is now the best overall** for truth-line recovery / line-for-line closeness.
2. **MiMo is second** and remains strong on coverage, especially late-script lines.
3. **GPT Audio is third** — still good on some individual lines, but weaker overall on this truth comparison.
4. **Benchmark percentages are distorted** for this specific question due to schema/structure/segmentation effects that over-penalize otherwise intelligible dialogue hearing.
5. **Important caveat:** Gemini also has the worst lyric contamination leaking into dialogue, so “best truth-line recovery” does not automatically mean “cleanest usable dialogue artifact.”

## Why Gemini now leads

After the JSON-contract hardening, Gemini produced a valid `dialogue-data.json` and became rankable. On manual comparison against the human-verified truth, it recovered the strongest set of target dialogue lines overall.

That does **not** mean Gemini is cleanest. Its main remaining weakness is dialogue/lyrics separation: it tends to leak more song-vocal material into dialogue segments than the other two models.

## Why MiMo still beats GPT Audio

MiMo’s advantage over GPT Audio is still mostly **coverage at the tail of the script**:
- Truth: `Get the Reznov challenge pack when you preorder now!`
- MiMo: `Get the Reznov challenge pack when you pre-order now.` (near-exact)
- GPT Audio: **missing**

MiMo also preserved this as one full line:
- Truth: `No more games! This ends now.`
- MiMo: `No more games! This ends now.`
- GPT Audio: split into multiple segments.

## Examples by model (right/wrong)

### Gemini 3.1 Pro Preview (`google/gemini-3.1-pro-preview`)
**Got right (summary):**
- Best overall truth-line recovery after prompt/JSON contract hardening
- Now emits valid structured dialogue output and is rankable
- Strongest overall closeness to the human-verified dialogue truth in the hardened rerun

**Got wrong (summary):**
- Worst lyric contamination in dialogue segments
- Still needs dialogue-vs-lyrics separation cleanup before it becomes the cleanest practical artifact

### MiMo (`xiaomi/mimo-v2-omni`)
**Got right (examples):**
- `He refuses to let me go.`
- `A lot of people counting on us for answers.`
- Final promo line recovered (near-exact)

**Got wrong (examples):**
- `The hell it isn’t!` (truth is `The hell it ain’t!`)
- `Stop looking backwards, David. What matters is what you do next.` (`you` vs truth `we`)
- Injected non-dialogue lyric text (e.g., `Obey your master...`) into dialogue output

### GPT Audio (`openai/gpt-audio`)
**Got right (examples):**
- `The hell it ain’t!` (exact)
- `This isn’t real.` (exact)
- `Need a sit-rep.` (near-normalized from `Need a sitrep.`)

**Got wrong (examples):**
- Missing final promo line entirely
- `Lot of people counting on us for answers.` (drops leading `A`)
- `Killing the man is a hell of a lot easier than killing the idea.` (truth: `Killing a man...`)

## Benchmark Percentages: Why They Mislead Here

Observed run summaries were low for the earlier completed models, but those percentages are not a clean proxy for dialogue hearing quality in this comparison because:

- schema mismatches (for example missing expected fields like `cleanedTranscript`) cause hard failures unrelated to line hearing,
- comparator scoring includes non-line structures (e.g., speaker profile structure/traits), and
- segmentation/index alignment penalties cascade when lines are split or merged.

The hardened Gemini rerun also showed that once the JSON contract was fixed, the dominant failure moved downstream from schema/tool-loop invalidity to benchmark/config mismatch, which further confirms that raw benchmark status alone is not the right measure for pure dialogue fidelity.

## Final Ranking (dialogue-only fidelity)

1. **Gemini (hardened rerun)** — best truth-line recovery / line-for-line closeness
2. **MiMo** — strong second, especially on full-script coverage
3. **GPT Audio** — third overall, though still strong on some individual lines

## Sources

- Earlier comparison write-up: `docs/research/2026-04-10-dialogue-only-model-compare.md`
- Gemini rerun comparison write-up: `docs/research/2026-04-10-gemini-rerun-dialogue-vs-mimo-gpt-audio.md`
