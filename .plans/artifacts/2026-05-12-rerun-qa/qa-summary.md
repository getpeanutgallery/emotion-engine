# 2026-05-12 rerun QA summary

## Verdicts

- Golden-truth adequacy right now: **no**.
- Chunk-local dialogue/music-vocals context appropriateness: **dialogue yes, music-vocals mixed**.
- Residual music-vocals timestamp weakness: **present, but not the main blocker for downstream usefulness in this rerun**.

## Benchmark/truth reality check

- The repo truth surface for `chunk-analysis.json` is **not fully human-gold across all 28 chunks**.
- Fixture notes say chunk-analysis truth started as bootstrap from a live output.
- The 2026-04-30 maintenance note says only these windows are trusted/refreshed for bounded evaluation: `3-4, 8-15, 17, 22-27`.
- So the honest acceptance question is: does the fresh rerun stay good enough on the trusted windows, and does it avoid obvious local-context leakage elsewhere?

## Practical comparison vs truth

- Trusted windows: 4/17 practical passes (23.5%), dominant emotion exact on 17/17 (100.0%), average abs score diff 0.61, average summary token-F1 0.41.
- Excluded/frozen windows: 0/11 practical passes (0.0%), dominant emotion exact on 8/11 (72.7%), average abs score diff 1.36, average summary token-F1 0.25.
- Whole run: 4/28 practical passes (14.3%), dominant emotion exact on 25/28 (89.3%).

## Strong areas

- Trusted late-trailer windows `22-27` are solid. Chunks 23-27 all stay directionally aligned with truth, and chunk 24 correctly lands on boredom for the static pre-order card segment.
- Mid-action trusted window `8-15` is also directionally strong: dominant emotion stays excitement across all those chunks, matching truth, with low score drift.
- Dialogue timestamp selection is behaving correctly at the chunk-window level. In sampled chunks with dialogue (`5`, `6`, `19`, `24`, `25`), every selected dialogue segment overlaps the chunk window, and the prompt contains only those overlapping lines in the timestamp-grounded dialogue section.

## Weak or ambiguous areas

- Chunk `18` is the clearest practical miss. Truth says this is the Hawaii title-card / soldier-platform window with `patience` dominant; output instead summarizes wingsuit-city action and marks `excitement` dominant. That is not a minor wording drift; it is a semantic miss in a frozen/skeptical region.
- Chunk `5` flips the dominant emotion from truth `excitement` to output `patience`, although the score deltas are small and the dialogue context itself is correctly window-bounded.
- Chunk `6` is usable but summary-heavy on the dialogue line. The prompt gave one overlapping dialogue segment only, which is correct, but the model summary underweights the aircraft/city visuals present in truth.
- Because the benchmark truth is only partly trusted, failures in the excluded windows should be read as product risk signals, not as definitive gold-truth contract breaks.

## Chunk-local context audit

- **Dialogue:** good. The current selection code in `server/scripts/process/video-chunks.cjs` uses timestamp overlap (`segment.start < endTime && segment.end > startTime`) and the sampled prompt payloads confirm that only overlapping dialogue lines are inserted into `Timestamp-Grounded Dialogue Context`. I did not find evidence of cross-window dialogue leakage in the fresh rerun.
- **Music-vocals:** mixed. The grounding helper also uses overlap selection, but the timestamp artifact still has many unresolved lyric segments. In music-heavy chunks like `18`, the prompt therefore includes a `Global Music-Vocals Context` block with one timed overlapping lyric plus several untimed ordered entries (`index 2` through `index 8`). That is better than blind full-history dumping, but it still exposes non-local lyric continuity into the chunk prompt.
- The prompt instructions explicitly warn the model not to treat those global lyric entries as authoritative chunk evidence. In the sampled outputs, I did not see a blatant lyric-text hallucination contaminating summaries or dominant-emotion calls.

## Is the music-vocals timestamp weakness materially harming downstream usefulness?

- **Not materially, for this rerun’s practical Phase 2 usefulness.**
- It is still a real weakness: music-heavy prompts can carry untimed lyric entries beyond the chunk window, so leakage risk has not been fully eliminated.
- But the fresh output’s main practical misses are better explained by chunk interpretation / continuity drift in skeptical windows than by obvious lyric contamination. The strong performance on trusted windows, including the late trailer and promo-card stretch, suggests the residual vocals weakness is no longer the dominant blocker.

## Representative evidence

### Chunk 0 (0-5s, excluded_window)
- Truth dominant: boredom
- Output dominant: excitement
- Truth summary: The video opens with glitchy visuals and the text 'RISING TENSIONS', triggering immediate skepticism before transitioning to high-fidelity game cinematics of destruction and armored characters.
- Output summary: The video chunk opens with a glitchy 'RISING TENSIONS' interface and quick cuts to dark, action-oriented scenes, accompanied by ominous dialogue about fear and control.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=2
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0
- Dialogue lines: 0-1.94s Speaker 1: They want you afraid. | 3.82-5.48s Speaker 1: Fear makes you easier to control.

### Chunk 5 (25-30s, excluded_window)
- Truth dominant: excitement
- Output dominant: patience
- Truth summary: Massive 'GUILD' robots activate in formation, cutting to a serious conversation between two men outdoors.
- Output summary: The video chunk transitions from a display of robotic soldiers to an intense dialogue between two characters, highlighting themes of control and conflict.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=2
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0
- Dialogue lines: 23.22-27.02s Speaker 1: Menendez is a terrorist. We're bringing peace and security to the world. | 27.88-29.88s Speaker 4: He refuses to let me go.

### Chunk 6 (30-35s, excluded_window)
- Truth dominant: excitement
- Output dominant: excitement
- Truth summary: The video cuts rapidly from soldiers on an airfield to a brief dialogue scene, then to a futuristic aircraft flying over a city, all driven by intense music.
- Output summary: This 5-second chunk features an intense dialogue where one character urges another to stop dwelling on the past and focus on future actions, accompanied by tense background music.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=1
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0
- Dialogue lines: 30.4-33.1s Speaker 5: Stop looking backwards, David. What matters is what you do next.

### Chunk 16 (80-85s, excluded_window)
- Truth dominant: excitement
- Output dominant: excitement
- Truth summary: Rooftop parkour into pink smoke transitions instantly to futuristic aircraft combat over water, ending on a snowy location title card.
- Output summary: A high-energy action chunk with rapid cuts from a neon-lit city scene featuring a character and large screen, to an aircraft causing explosions on water, ending with a serene Alaskan landscape with aurora.
- Dialogue grounding strategy: empty; selected=0
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0

### Chunk 18 (90-95s, excluded_window)
- Truth dominant: patience
- Output dominant: excitement
- Truth summary: Hawaii location title card transitions from Alaska with futuristic cityscape and combat-ready soldiers on circular platform, maintaining trailer intensity.
- Output summary: A fast-paced action sequence with characters wingsuit flying through a city and engaging in indoor shooting, accompanied by intense heavy metal music.
- Dialogue grounding strategy: empty; selected=0
- Music-vocals grounding strategy: phase1_timestamp_overlap; selected=9; unresolvedSelected=7
- Prompt music-vocals support entries: - Relevant global support entries: | - 89.8s-91.7s: Vocalist 1: Master! Master! | - index 2: Vocalist 1: Come crawling faster | - index 3: Vocalist 1: Obey your master! | - index 4: Vocalist 1: Master of puppets I pull your strings | - index 5: Vocalist 1: Obey your master! | - index 6: Vocalist 1: Twisting your mind and smashing your dreams | - index 7: Vocalist 1: Blinded by me you can't see a thing | - index 8: Vocalist 1: Just call my name 'cause I'll hear you scream | - 92.2s-96.4s: Vocalist 1: Master, master

### Chunk 19 (95-100s, excluded_window)
- Truth dominant: excitement
- Output dominant: excitement
- Truth summary: High-intensity action sequence with combat mechs and soldiers featuring rapid cuts and dramatic audio cues.
- Output summary: A rapid sequence of action shots with futuristic combat, intense character moments, and urgent dialogue, sustaining high energy without lulls.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=1
- Music-vocals grounding strategy: phase1_timestamp_overlap; selected=1; unresolvedSelected=0
- Dialogue lines: 96.96-99.16s Speaker 5: Pull it together, man!
- Prompt music-vocals support entries: - Relevant global support entries: | - 92.2s-96.4s: Vocalist 1: Master, master

### Chunk 24 (120-125s, trusted_window)
- Truth dominant: boredom
- Output dominant: boredom
- Truth summary: This chunk displays promotional screens for Call of Duty Black Ops 7 pre-order and the Reznov Challenge Pack, featuring static images and text overlays.
- Output summary: Promotional segment displaying pre-order incentives and character packs for Call of Duty Black Ops 7, with static title cards and text overlays.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=1
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0
- Dialogue lines: 121.72-125.3s Speaker 9: Get the Reznov challenge pack when you pre-order now.

### Chunk 25 (125-130s, trusted_window)
- Truth dominant: excitement
- Output dominant: excitement
- Truth summary: This chunk displays promotional screens for Call of Duty Black Ops 7 pre-order, followed by brief action sequences with characters and robotic combat.
- Output summary: The video chunk begins with static promotional images for the Vault Edition, then shifts to fast-paced action sequences featuring characters and a robot dog in combat.
- Dialogue grounding strategy: phase1_timestamp_overlap; selected=1
- Music-vocals grounding strategy: empty; selected=0; unresolvedSelected=0
- Dialogue lines: 121.72-125.3s Speaker 9: Get the Reznov challenge pack when you pre-order now.

