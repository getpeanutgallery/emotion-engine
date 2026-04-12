# COD Dialogue-Only Model Compare (Phase 1)

Date: 2026-04-10  
Scope: Compare dialogue-line fidelity vs human-verified truth (`benchmarks/fixtures/cod-test/truth/dialogue-data.json`) for:
- `output/cod-dialogue-compare-mimo/phase1-gather-context/dialogue-data.json`
- `output/cod-dialogue-compare-gpt-audio/phase1-gather-context/dialogue-data.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/*` (partial/failure artifacts only)

Music/music-vocals concerns are intentionally out of scope except where they intrude into dialogue line transcription itself.

## Recommendation (dialogue-line fidelity)

**Best overall among completed artifacts: _MiMo_ (narrow win over GPT Audio).**

Why:
- MiMo preserved more of the full dialogue script coverage, including the final promo line:
  - Truth: “Get the Reznov challenge pack when you preorder now!”
  - MiMo: “Get the Reznov challenge pack when you pre-order now.” (near-exact)
  - GPT Audio: promo line missing entirely.
- MiMo also kept “No more games! This ends now.” as a single full line (GPT split it into two segments).

Where GPT Audio was stronger:
- Cleaner line separation early/mid dialogue (e.g., keeps “Menendez is a terrorist.” and “We’re bringing peace...” separated, matching truth segmentation better than MiMo’s merge).
- Exact/near-exact on some lines MiMo degraded:
  - Truth: “The hell it ain’t!”
  - GPT Audio: “The hell it ain’t!” (exact)
  - MiMo: “The hell it isn’t!” (wrong word)

Common misses (both):
- “You shall know fear.” was not recovered as dialogue by either completed run.

## Notable right/wrong examples by model

### MiMo (xiaomi/mimo-v2-omni)
Notably right:
- “He refuses to let me go.” (exact)
- “A lot of people counting on us for answers.” (exact)
- “Pull it together, man.” (punctuation variant only)
- Final promo line recovered (near-exact)

Notably wrong:
- Injected non-dialogue lyric text (“Obey your master...”) into dialogue segments.
- “Stop looking backwards, David. What matters is what you do next.” (`you` vs truth `we`)
- “The hell it isn’t!” (`isn’t` vs truth `ain’t`)
- Merged lines that truth keeps separate (e.g., Menendez/peace lines; “So eager...” + “Killing a man...”)

### GPT Audio (openai/gpt-audio)
Notably right:
- Strong transcript quality across many core lines with light normalization differences:
  - “Spectre 1, report.” (truth “Specter one, report.”)
  - “Need a sit-rep.” (truth “Need a sitrep.”)
  - “This isn’t real.” (exact)
  - “The hell it ain’t!” (exact)

Notably wrong:
- Missing final promo line entirely.
- “Lot of people counting on us for answers.” (drops leading “A”)
- “Killing the man is a hell of a lot easier than killing the idea.” (truth “Killing a man...”)
- Split some truth single-lines into multiple segments (acceptable for hearing, but not exact structural match).

### Gemini 3.1 Pro Preview (google/gemini-3.1-pro-preview)
- **No valid `dialogue-data.json` artifact produced.**
- Runs ended with retryable/fatal output failures (including `invalid_output: dialogue transcription tool loop exhausted after 4 turns`).
- A raw capture contains partial candidate text that looks promising for several lines, but because the artifact failed schema/tool-loop validation and never emitted a valid benchmarkable output, **Gemini cannot be reliably ranked in this comparison.**

## Benchmark score distortion vs hearing quality

The benchmark headline rates understate dialogue hearing quality for both completed runs.

Observed benchmark end states:
- GPT Audio: `66/224` scoreable passed (0/1 artifacts passed)
- MiMo: `66/240` scoreable passed (0/1 artifacts passed)

Why these numbers are distorted for this specific question (dialogue line fidelity):
1. **Schema/manifest issues create hard errors unrelated to line hearing**
   - Both runs error due missing `cleanedTranscript` field expected by truth profile.
2. **Comparator includes many non-line fields (speaker_profiles etc.)**
   - Large portions of failures come from speaker profile structure/traits/descriptors, not just transcript line text.
3. **Index/segmentation sensitivity creates cascade penalties**
   - Splits/merges shift index-aligned comparisons, causing many downstream text mismatches despite substantial lexical overlap.

So for deciding “which model heard dialogue lines best,” these benchmark totals are **directionally noisy** and should be interpreted with manual line-level inspection.

## Bottom line

- **Rankable winner:** **MiMo (slight edge)** for complete dialogue coverage including late trailer promo lines.
- **Close second:** GPT Audio, with cleaner per-line phrasing in places but a critical missing ending line.
- **Gemini:** not rankable from produced artifacts due failure mode; raw partial text is insufficient for a fair official placement.
