# Hardened Gemini Rerun: Dialogue-Line Fidelity vs MiMo and GPT Audio

Date: 2026-04-10  
Plan Task: `.plans/2026-04-10-gemini-dialogue-json-contract-hardening.md` Task 5 (`ee-0lsh`)  
Scope: Dialogue-line fidelity only vs human-verified truth (`benchmarks/fixtures/cod-test/truth/dialogue-data.json`).

Compared outputs:
- Gemini (hardened rerun): `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- MiMo: `output/cod-dialogue-compare-mimo/phase1-gather-context/dialogue-data.json`
- GPT Audio: `output/cod-dialogue-compare-gpt-audio/phase1-gather-context/dialogue-data.json`

Music/music-vocals were ignored except where they contaminate dialogue lines.

## Executive conclusions

1. **Gemini is now rankable.**  
   The hardened rerun produced a valid `dialogue-data.json` artifact (schema-valid) and can now be compared directly against truth.

2. **Prompt hardening solved the dominant prior failure mode.**  
   Earlier Gemini failure was tool-loop/schema-output instability (`invalid_output ... tool loop exhausted`). The rerun no longer fails there; remaining quality issues are transcript-content issues (mainly lyric contamination), not JSON-contract compliance.

3. **Line-for-line closeness ranking (truth dialogue fidelity):**
   - **#1 Gemini (hardened rerun)**
   - **#2 MiMo**
   - **#3 GPT Audio**

   This ranking is based on truth-line recovery and closeness to truth wording. Gemini recovered the largest portion of truth lines with high textual overlap.

## Evidence summary (text-similarity pass)

Using normalized string similarity across dialogue lines (punctuation/case-insensitive), with both coverage and contamination considered:

- **Gemini (32 predicted lines)**
  - Truth-line coverage: **19/20 >= 0.75**, **16/20 >= 0.90**
  - Avg best-match similarity over truth lines: **0.938**
  - Contamination lines (no close truth match, <0.45): **11** (mostly Metallica lyrics)
  - Main miss: **"You shall know fear."** not recovered as dialogue.

- **MiMo (20 predicted lines)**
  - Truth-line coverage: **17/20 >= 0.75**, **14/20 >= 0.90**
  - Avg best-match similarity over truth lines: **0.875**
  - Contamination lines: **2** (long lyric injections)
  - Misses include weaker recovery of **"Menendez is a terrorist."**, **"You shall know fear."**, and **"So eager to leave David."**

- **GPT Audio (21 predicted lines)**
  - Truth-line coverage: **16/20 >= 0.75**, **14/20 >= 0.90**
  - Avg best-match similarity over truth lines: **0.880**
  - Contamination lines: **0**
  - Misses include **"You shall know fear."**, reduced/full-line mismatch on **"Stop looking backwards... What matters..."**, split/partial **"No more games! This ends now."**, and missing final promo line.

## Interpretation

- If the question is strictly **"Which model is closest to the truth dialogue script line-by-line?"**, Gemini now lands first.
- If the question is **"Which output is cleanest dialogue-only with least music leakage?"**, GPT Audio is cleanest, MiMo next, Gemini worst (largest lyric bleed).
- For this task’s stated objective (dialogue-line fidelity against truth), Gemini is now both **eligible** and **top** on closeness/coverage, with an important caveat that lyric contamination remains a major quality defect.

## Notable Gemini deltas after hardening

- Positive:
  - Produced schema-valid artifact suitable for benchmarking/comparison.
  - Strong recovery of most truth dialogue lines, including late-trailer lines.
- Remaining defects:
  - Heavy lyric intrusions into `dialogue_segments`.
  - One persistent missed truth line: **"You shall know fear."**
  - Minor lexical variants (e.g., `the living` vs `David`, `an idea` vs `the idea`).

## Bottom line

**Yes, Gemini is now rankable. Yes, prompt hardening fixed the dominant JSON/tool-loop failure mode. On dialogue-line closeness to truth, Gemini now ranks above MiMo and GPT Audio, but with the worst dialogue contamination from music lyrics.**
