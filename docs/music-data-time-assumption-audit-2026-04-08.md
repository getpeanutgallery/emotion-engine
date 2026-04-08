# Music-data time-assumption audit

**Date:** 2026-04-08  
**Scope:** `musicData` lane only, audited against the approved index-first / non-authoritative-timing direction now used for dialogue and music-vocals.

---

## Bottom line

`musicData` is still a **timeline-first artifact** in both its live AI contract and several direct readers. That is now out of step with the approved direction where dialogue/music/music-vocals should not ask the model to invent authoritative timing metadata unless a grounded aligner owns it.

The highest-risk leftovers are:

1. the live `get-music` prompt + validator still **require** timeline ranges for `segments` and `globalArc.notableTransitions`,
2. `video-chunks` still **reads music context by time overlap only**, and
3. benchmark truth/comparison still treats `musicData` timing as **authoritative benchmark surface**, unlike the already-relaxed dialogue/music-vocals profiles.

Those three together mean the system can keep reifying guessed music timings as if they are trustworthy, then use those guesses to decide what downstream chunk sees for supporting music context and how benchmark pass/fail is judged.

---

## Files reviewed

- `server/scripts/get-context/get-music.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/benchmark-runner.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `test/scripts/get-music.test.js`
- `test/lib/phase1-validator-tools.test.js`

---

## Must fix before next run

### 1) Live `get-music` whole-asset contract still demands authored timeline segments

**Files:**
- `server/scripts/get-context/get-music.cjs:1333-1399`
- `server/scripts/get-context/get-music.cjs:1177-1230`

**What is still timing-dependent:**
- Whole-asset prompt says to emit "coarse timeline-aware segments".
- Example JSON still requires per-segment `start` / `end`.
- Rules explicitly say to use the original full timeline in seconds for every segment and transition.
- Whole-asset validator rejects segments unless `start` and `end` are finite numbers within the asset timeline.

**Why this poisons downstream behavior:**
- It keeps telling the model that music-data timing is part of the truth contract, not optional support metadata.
- If the model is weak on timing but strong on coarse musical structure, it must still guess exact boundaries to be accepted.
- Those guessed boundaries are then persisted into `music-data.json` and can be mistaken downstream for grounded timing, even though the lane has no separate aligner.

**Why this matters now:**
- Dialogue and music-vocals were already moved to index-first chronology because model-authored timing is not trustworthy enough.
- Leaving music-data as required-timing creates a split-brain contract where one lane is still allowed to fabricate “authoritative” times that other lanes or reports may privilege.

---

### 2) Live `get-music` chunk contract still anchors `recognizedSong.timeRanges` to chunk windows

**Files:**
- `server/scripts/get-context/get-music.cjs:1469-1504`
- `server/lib/phase1-validator-tools.cjs:220-247`

**What is still timing-dependent:**
- Chunk prompt example includes `recognizedSong.candidates[*].timeRanges`.
- Example literally uses the current chunk’s `startTime` / `endTime` as the candidate range.
- Validator-tool example for music analysis still advertises `timeRanges` as part of the expected candidate shape.

**Why this poisons downstream behavior:**
- It strongly nudges the model to convert “I think this sounds like song X in this chunk” into a time-ranged song claim.
- Because the example range is the full chunk window, the lane is biased toward broad, low-precision ranges that look authoritative in artifacts.
- Those ranges are not currently required for supporting-song reconciliation, so their main effect is to create false confidence in timing and to enlarge the benchmark surface unnecessarily.

**Why this matters now:**
- The approved direction was to stop requesting authoritative time metadata from model-only lanes.
- `recognizedSong.timeRanges` in music-data still does exactly that.

---

### 3) `video-chunks` still requires music-data timing to deliver relevant context to chunk analysis

**Files:**
- `server/scripts/process/video-chunks.cjs:651-674`
- `server/scripts/process/video-chunks.cjs:1145-1152`

**What is still timing-dependent:**
- `getRelevantMusic(musicData, startTime, endTime)` filters `musicData.segments` by overlap: `seg.start < endTime && seg.end > startTime`.
- The process lane then passes only that time-overlapping subset as `musicContext.segments` into chunk analysis.

**Why this poisons downstream behavior:**
- If music-data boundaries are guessed or slightly wrong, a chunk can get the wrong supporting music context or no context at all.
- Under an index-first world, music-data should not be the authority for exact chunk overlap unless a grounded aligner owns those boundaries.
- This means the process phase is currently treating model-authored music timings as routing metadata, not just descriptive metadata.

**Why this matters before next run:**
- This is the clearest direct reader where guessed music timing can change actual downstream AI input selection.
- Even if the music lane itself remains coarse, this reader turns timing guesses into behavior.

---

### 4) Benchmark comparison still keeps music-data timing authoritative

**Files:**
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `server/lib/benchmark-runner.cjs:11-16`
- `server/lib/benchmark-runner.cjs:397-409`
- `server/lib/benchmark-runner.cjs:625-652`

**What is still timing-dependent:**
- `musicData` uses comparator profile `music-default`.
- Unlike `dialogue-default` and `music-vocals-default`, there are **no default ignore paths** for `$.segments[*].start`, `$.segments[*].end`, or any music-data duration fields.
- `DEFAULT_TEMPORAL_FIELD_NAMES` still makes `start`, `end`, `duration`, `totalDuration`, etc. temporal comparison fields globally.
- The current cod-test truth fixture for `music-data.json` is fully timeline-authored.

**Why this poisons downstream behavior:**
- It rewards the lane for matching benchmark timing guesses instead of staying truthful about chronology uncertainty.
- It creates pressure to keep the live prompt/validator timeline-first, because otherwise the benchmark will fail structurally or temporally.
- In practice it locks music-data into the old world even while dialogue/music-vocals moved on.

**Why this matters before next run:**
- If the next rerun is supposed to reflect the approved truthful contract direction across these lanes, music-data benchmark expectations still resist that change.
- This is not just doc drift; it affects whether the rerun will be interpreted as success or regression.

---

## Can defer

### 5) Music-vocals helper context still privileges timed music transitions

**Files:**
- `server/scripts/get-context/get-music-vocals.cjs:1326-1365`

**What is still timing-dependent:**
- `formatMusicLaneContext()` injects music summary plus `globalArc.notableTransitions` as `start-end` ranges.

**Why it matters:**
- It can encourage the music-vocals lane to treat music-data timings as trustworthy scaffolding.
- But it is only helper context; it is not currently used as a hard filter like `video-chunks` does.

**Why defer is acceptable:**
- If the higher-priority contract/reader/benchmark changes land first, this becomes a prompt-quality cleanup rather than a hard blocker.

---

### 6) Whole-video MIMO report context still renders music cues with timestamps

**Files:**
- `server/scripts/process/whole-video-mimo.cjs:170-197`

**What is still timing-dependent:**
- `formatMusicContext()` prints each music cue as `start-end: description`.

**Why it matters:**
- This preserves the visual/reporting assumption that music-data timing is meaningful.
- It could overstate timing confidence in later prompts or reports.

**Why defer is acceptable:**
- This is formatting/context presentation, not a routing gate.
- It becomes more important after the live contract and chunk-reader behavior are corrected.

---

### 7) Supporting-song reconciliation does not currently require music-data timing, but music-data examples still encourage fabricated timed support

**Files:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:405-455`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:645-681`
- `server/scripts/get-context/get-music.cjs:1356-1368`
- `server/scripts/get-context/get-music.cjs:1469-1481`

**What is still timing-dependent:**
- Reconciliation currently uses `musicData.recognizedSong` only as supporting consensus (`status` / `confidence`), not by `timeRanges`.
- But the music-data prompt/examples still encourage the model to emit timed recognized-song ranges.

**Why it matters:**
- Today this does **not** appear to be the main place where music-data timing drives decisions.
- The danger is indirect: timed recognized-song output looks more grounded than it is and may invite future coupling.

**Why defer is acceptable:**
- The current reconciliation gate is more exposed to recognition status/confidence than to music-data ranges themselves.
- Fixing the live prompt/validator/reader/benchmark first gives the bigger payoff.

---

### 8) Tests and fixtures are still teaching the old music-data timing contract

**Files:**
- `test/scripts/get-music.test.js`
- `test/lib/phase1-validator-tools.test.js`
- `benchmarks/fixtures/cod-test/truth/music-data.json`

**What is still timing-dependent:**
- Tests assert timeline-shaped music-data outputs.
- Fixture truth remains range-heavy and transition-heavy.

**Why it matters:**
- Even after runtime changes, these files will keep dragging the implementation back toward authored timing.

**Why defer is acceptable:**
- They should move with the contract/benchmark work, not before it.
- They are blockers for landing the code change, but not separately dangerous while the current runtime is unchanged.

---

## Net assessment

### Must-fix-before-next-run

1. `server/scripts/get-context/get-music.cjs` whole-asset prompt + validator still requiring timed `segments`.
2. `server/scripts/get-context/get-music.cjs` chunk prompt / validator-tool examples still advertising timed `recognizedSong.timeRanges` as normal output.
3. `server/scripts/process/video-chunks.cjs` using `musicData.segments.start/end` as the sole selector for chunk-local music context.
4. `benchmarks/fixtures/cod-test/benchmark.json` + `benchmarks/fixtures/cod-test/truth/music-data.json` + `server/lib/benchmark-runner.cjs` still treating music-data timing as benchmark-authoritative.

### Can defer

1. `server/scripts/get-context/get-music-vocals.cjs` helper context rendering timed music transitions.
2. `server/scripts/process/whole-video-mimo.cjs` timing-heavy music context formatting.
3. Any future use of music-data `recognizedSong.timeRanges` in reconciliation/support logic; not the primary driver today.
4. Tests/fixtures that encode the old contract, as long as they are updated together with the runtime/benchmark change.

---

## Recommended next-step shape

Without making changes in this audit task, the narrowest truthful next implementation would be:

- make `musicData.segments` index/order-first with `start/end` optional or non-authoritative,
- stop exemplifying chunk-wide `recognizedSong.timeRanges` as default music-lane output,
- change `video-chunks` to consume music context in a way that does not depend entirely on model-authored overlap boundaries, and
- relax the benchmark profile/truth for `musicData` the same way dialogue/music-vocals were already relaxed.

That would remove the main paths where invented music timing can still masquerade as grounded system truth.
