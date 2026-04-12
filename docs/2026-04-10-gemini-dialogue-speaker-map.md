# Gemini Dialogue Speaker Map (Latest Rerun)

Source: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`  
Run evidence: `.logs/20260410-151350-cod-dialogue-compare-gemini-3.1-pro-preview-ee-r261.log`  
Comparison target: `docs/cod-benchmark-truth-dialogue-speaker-map.md`

This format is intentionally aligned with the truth speaker-map doc for head-to-head review.

## Speaker Profile Key

- `spk_001` — female voice, intense close-mic delivery; inferred narrator/instigator tone.
- `spk_002` — deep raspy accented male voice; inferred villainous antagonist.
- `spk_003` — authoritative clear male delivery; inferred briefing/news-anchor role.
- `spk_004` — mid-pitch male voice (single-line speaker in this run).
- `spk_005` — older male voice with political-style delivery.
- `spk_006` — distressed male voice (single-line speaker in this run).
- `spk_007` — older gruff male delivery; inferred mentor/veteran cadence.
- `spk_008` — mid-pitch determined male delivery; inferred protagonist-like role.
- `spk_009` — male comms voice with radio filter.
- `spk_010` — male comms voice with radio filter (terse/brief).
- `spk_011` — aggressive male vocalist delivery; inferred lead singer.
- `spk_012` — distant shouting male command voice.
- `spk_013` — deep announcer-style male voice; inferred promo announcer.

## Ordered Dialogue Map

| # | Timestamp (start–end) | Dialogue text | speaker_id | Speaker traits/profile summary |
|---:|---|---|---|---|
| 0 | N/A | They want you afraid. | `spk_001` | female voice, intense close-mic delivery; inferred narrator/instigator tone |
| 1 | N/A | Fear makes you easier to control. | `spk_001` | female voice, intense close-mic delivery; inferred narrator/instigator tone |
| 2 | N/A | It's time to wake up. | `spk_001` | female voice, intense close-mic delivery; inferred narrator/instigator tone |
| 3 | N/A | Your streets shall once again run red with your blood. | `spk_002` | deep raspy accented male voice; inferred villainous antagonist |
| 4 | N/A | Raul Menendez ignited global unrest on an unprecedented scale. | `spk_003` | authoritative clear male delivery; inferred briefing/news-anchor role |
| 5 | N/A | Menendez is a terrorist. | `spk_004` | mid-pitch male voice (single-line speaker in this run) |
| 6 | N/A | We're bringing peace and security to the world. | `spk_005` | older male voice with political-style delivery |
| 7 | N/A | He refuses to let me go. | `spk_006` | distressed male voice (single-line speaker in this run) |
| 8 | N/A | Stop looking backwards, David. What matters is what we do next. | `spk_007` | older gruff male delivery; inferred mentor/veteran cadence |
| 9 | N/A | A lot of people counting on us for answers. | `spk_008` | mid-pitch determined male delivery; inferred protagonist-like role |
| 10 | N/A | Spectre 1 reporting. | `spk_009` | male comms voice with radio filter |
| 11 | N/A | Need a sitrep. | `spk_010` | male comms voice with radio filter (terse/brief) |
| 12 | N/A | This isn't real. | `spk_008` | mid-pitch determined male delivery; inferred protagonist-like role |
| 13 | N/A | The hell it ain't! | `spk_007` | older gruff male delivery; inferred mentor/veteran cadence |
| 14 | N/A | Obey your master | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 15 | N/A | Master | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 16 | N/A | Master of puppets, I'm pulling your strings | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 17 | N/A | Twisting your mind and smashing your dreams | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 18 | N/A | Blinded by me, you can't see a thing | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 19 | N/A | Just call my name, 'cause I'll hear you scream | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 20 | N/A | Master | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 21 | N/A | Master | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 22 | N/A | Pull it together, man! | `spk_012` | distant shouting male command voice |
| 23 | N/A | So eager to leave this world. | `spk_002` | deep raspy accented male voice; inferred villainous antagonist |
| 24 | N/A | Killing a man is a hell of a lot easier than killing an idea. | `spk_002` | deep raspy accented male voice; inferred villainous antagonist |
| 25 | N/A | You were never cut out to be a Mason. | `spk_002` | deep raspy accented male voice; inferred villainous antagonist |
| 26 | N/A | No more games. This ends now. | `spk_008` | mid-pitch determined male delivery; inferred protagonist-like role |
| 27 | N/A | Obey your master | `spk_011` | aggressive male vocalist delivery; inferred lead singer |
| 28 | N/A | Get the Reznov Challenge Pack when you pre-order now. | `spk_013` | deep announcer-style male voice; inferred promo announcer |

## Notes for Truth Comparison

- This latest Gemini rerun has 29 dialogue segments and 13 distinct speaker IDs (`spk_001`–`spk_013`).
- Per-segment timestamps are not present in the source artifact; all timestamp cells are `N/A`.
- Speaker summaries above are concise reductions of `speaker_profiles.grounded.acoustic_descriptors` plus `inferred_traits` where provided.
