# Timestamp grounding options for OpenRouter-backed dialogue and music-vocals lanes

**Date:** 2026-04-08  
**Scope:** practical timing strategies we can actually implement in `emotion-engine` / OpenClaw for Phase 1 dialogue + music-vocals

## Bottom line

**Do not trust per-line timestamps generated directly by the LLM.** In the current architecture, the model is estimating time from memory of the audio stream, not reading a grounded clock.

**Recommendation:**
1. **Stop treating model-authored `start`/`end` as trustworthy truth.**
2. **Keep chronological order/indexes in the model JSON.**
3. **Move trustworthy timing into a separate grounding stage** that uses ASR/forced-alignment artifacts or chunk/window provenance.
4. For now, if we need an immediate safe change, **remove required timestamps from the requested JSON for dialogue + music-vocals and keep ordering/index-based chronology only** until a real aligner exists.

## What the repo is doing today

### 1) The current “tool loop” is local validation, not grounded timing

Both dialogue and music-vocals are calling `executeLocalValidatorToolLoop(...)`, which asks the model to emit a JSON envelope that *looks* like a tool call, then validates it locally.

Relevant code:
- `server/scripts/get-context/get-dialogue.cjs:2323-2360`
- `server/scripts/get-context/get-music-vocals.cjs:1616-1655`
- `server/lib/local-validator-tool-loop.cjs:143-245`

That loop is useful for schema correction, but it **does not expose a real timing/alignment tool to the model**. It only validates the JSON candidate after the model has already guessed the timestamps.

### 2) The OpenRouter provider wrapper is not wired for tool calling today

`node_modules/ai-providers/providers/openrouter.cjs` builds a `/chat/completions` request with:
- `model`
- `messages`
- some common options like `temperature`, `max_tokens`, `reasoning`, `site_url`, `site_name`

But it does **not** currently pass:
- `tools`
- `tool_choice`
- `parallel_tool_calls`
- structured output controls such as `response_format`

And `transformResponse(...)` extracts text from `message.content` / `message.audio.transcript`, but does **not** surface `tool_calls` back to the caller.

Relevant code:
- `node_modules/ai-providers/providers/openrouter.cjs:72-180`
- `node_modules/ai-providers/providers/openrouter.cjs:231-250`
- `node_modules/ai-providers/providers/openrouter.cjs:304-345`

### 3) Current schemas force timestamps even though the model is not grounded

The normalized output contracts still require `start` and `end` for:
- dialogue segments (`server/lib/structured-output.cjs:239-274`)
- music vocal segments (`server/lib/structured-output.cjs:733-778`)

So today we are structurally rewarding confident-looking guessed times.

### 4) Existing repo evidence already points toward grounded artifacts > model intuition

The recent handoff explicitly says the runtime-anchor lane was a real improvement and exposed the remaining grounded-content seam more clearly:
- `docs/handoffs/2026-04-04-closeout-handoff.md:10-16`

That is directionally consistent with this research: **grounded runtime artifacts help; freehand timestamps do not**.

## Answers to the research questions

## 1) Does OpenRouter support tool/function calling in a way that could help this workflow?

**Yes, in principle. Not in our current implementation.**

OpenRouter’s docs explicitly describe standardized tool/function calling and show the normal three-step flow:
1. send a request with `tools`
2. receive `tool_calls`
3. execute the tool client-side and send tool results back in a follow-up turn

Sources:
- OpenRouter tool/function-calling guide: <https://openrouter.ai/docs/guides/features/tool-calling>
- OpenRouter Responses API beta tool-calling reference: <https://openrouter.ai/docs/api/reference/responses/tool-calling>
- OpenRouter models docs note that models can be filtered by `supported_parameters=tools`: <https://openrouter.ai/docs/guides/overview/models>

Important caveats:
- Tool calling is **model-dependent**.
- Audio input is also **model-dependent**.
- We should **not assume** that every audio-capable model we route through OpenRouter also supports robust tool calling in the same path.
- Our current wrapper uses `/api/v1/chat/completions` for audio input, and the repo code does not yet expose real tool-call plumbing.

So: **OpenRouter can help only after we add real tool-call support and only on models that support both the needed modalities and tools.**

## 2) Could a model call a local timing/alignment tool during generation inside our current architecture? What would have to change?

**Not today. In a reworked architecture, yes — but the trust would come from the aligner, not from the model.**

### Why not today

Today the model gets audio + prompt, then returns text. The “tool loop” is just a local validator wrapper. There is no actual runtime where:
- the provider returns `tool_calls`
- the engine executes a local aligner
- the tool result is fed back into the model in a follow-up assistant/tool exchange

### What would have to change

At minimum:
1. **Provider layer changes**
   - Extend the OpenRouter provider wrapper to send `tools` / `tool_choice`.
   - Return `tool_calls` in the normalized provider response.
   - Support assistant/tool message replay across turns.

2. **Execution-loop changes**
   - Replace the current pseudo-tool loop with a real multi-turn tool executor.
   - Allow the dialogue/music-vocals lanes to pause after a tool request, run a local aligner, then resume the same model turn sequence.

3. **Local aligner/tool changes**
   - Add a deterministic local tool with inputs like:
     - audio chunk path or extracted WAV path
     - candidate text lines / line list
     - optional known chunk boundaries or whole-asset offsets
   - Return grounded timing artifacts such as word spans, line spans, confidences, uncovered words, and alignment failure reasons.

4. **Prompt / contract changes**
   - The model would need to produce **text first**, then request alignment, then produce final JSON using the aligner output.
   - That means timing becomes a second sub-step, not part of the first raw transcription guess.

### Important architectural truth

Even if we built this, **tool calling is not the core solution**. It is just an orchestration mechanism. The trustworthy part would still be the external aligner or ASR artifact.

## 3) Are precomputed timing anchors/alignment artifacts a better design than tool-calling during generation?

**Yes, probably.** For this repo, precomputed or separately-computed timing artifacts are the better default design.

Why:
- simpler to implement and debug
- deterministic / auditable
- reusable across multiple lanes
- can be cached per asset or per chunk
- avoids model/tool-call support matrix problems on OpenRouter
- lets us compare model text vs alignment text instead of asking the model to estimate time from memory

### Best practical design for emotion-engine

Treat timing as a **grounding artifact**, not a field the model invents.

A good two-stage design would be:

1. **Recognition/transcription stage**
   - LLM or ASR extracts ordered dialogue lines / lyric fragments
   - no authoritative timestamps required here

2. **Alignment stage**
   - separate local aligner maps those lines onto audio
   - outputs grounded timing spans + confidence + failure notes

3. **Reconciliation stage**
   - if alignment confidence is low, keep the line but mark timing unresolved
   - downstream consumers can still use ordering/index chronology safely

### When precomputed anchors are especially strong

- **Dialogue:** when we have ASR word timestamps or chunk-local timing windows
- **Recognized songs:** when we have a canonical lyric line list from a trusted source and can forced-align it to the actual excerpt

### When precomputed anchors are weaker

- heavily masked music
- trailers with remix edits / overlapping SFX / layered voices
- chopped or montage audio where no single transcript source exactly matches the heard excerpt

Still, even then, **precomputed grounding is usually better than LLM time guessing**.

## 4) What established architectures exist for aligning transcript lines to audio/video when the LLM is bad at time estimation?

These are the practical, established patterns.

### A) ASR with word timestamps, then regroup into lines

Examples:
- Whisper + word timestamps / stable-ts style timestamp stabilization
- WhisperX: Whisper transcription + wav2vec2 forced alignment + diarization

What it does well:
- produces grounded word timings
- line timings can be derived by grouping words
- works well for dialogue

Likely fit here:
- **strongest practical option for dialogue**
- likely also useful for music-vocals as a first pass, though lyrics under score will still be much noisier

References:
- WhisperX README: word-level timestamps, wav2vec2 alignment, diarization
- stable-ts README: timestamp stabilization, VAD/silence-aware timestamp adjustment

### B) Forced alignment against a known transcript / lyric sheet

Examples:
- Montreal Forced Aligner
- Gentle
- aeneas

What it does well:
- if the text is already known, alignment is more trustworthy than asking an LLM to invent times
- especially good for clean speech or read/known text

Likely fit here:
- **great for recognized songs when we have a vetted lyric text**
- also useful for dialogue if a draft transcript already exists from another stage

Tradeoff:
- forced aligners expect the text to be mostly correct; if the text is wrong, timings will drift or fail

References:
- MFA docs: <https://montreal-forced-aligner.readthedocs.io/en/latest/index.html>
- Gentle README: <https://raw.githubusercontent.com/strob/gentle/master/README.md>
- aeneas README: <https://raw.githubusercontent.com/readbeyond/aeneas/master/README.md>

### C) Chunk/window anchoring + local refinement

This is already close to the repo’s current shape:
- split into chunk windows
- know each chunk’s absolute time bounds
- make the model responsible only for ordering *within* the chunk
- refine timing later from local evidence

What it does well:
- bounded error
- easier than whole-asset freehand timing
- consistent with existing `coverage`, `timingMode`, and chunk-plan metadata

Likely fit here:
- good short-term fallback even before a full aligner lands

### D) Hybrid architecture: ASR/aligner owns times, LLM owns semantics

This is the architecture I would recommend.

- ASR / forced aligner: word timing, segment timing, maybe diarization
- LLM: speaker labeling, semantic cleanup, dialogue-vs-lyric separation, summaries, handoff context, reconciliation

That keeps each component doing the thing it is actually good at.

## 5) What are the likely failure modes, accuracy limits, and implementation tradeoffs?

## Dialogue

### Likely failure modes
- overlapping speakers
- radio/comms filters
- montage cuts that interrupt words
- dramatic VO mixed under score
- speaker diarization disagreements even when word timing is good
- short exclamations that ASR drops or merges

### Accuracy reality
- word timing from a good aligner can be quite usable
- exact sentence/line boundaries still require heuristics
- speaker identity and timing are different problems; one can be right while the other is wrong

### Tradeoff
- best results come from **ASR/alignment + LLM cleanup**, not pure LLM

## Music-vocals

### Likely failure modes
- music masking
- doubled vocals / backing vocals / crowd chants
- partial lyric audibility
- remix/edit differences from canonical lyrics
- repeated chorus lines that are easy to place on the wrong repetition
- known-song recognition is correct but line-level timing is shifted

The current human review already shows this exact pattern for COD: song ID was right while lyric windows were incomplete or mis-anchored (`docs/2026-04-07-human-delta-review-cod-test-vs-truth.md:224-268`).

### Accuracy reality
- lyric timing is materially harder than dialogue timing
- forced alignment works best only when the lyric text is already very close to the heard excerpt
- a good aligner can still fail on masked or fragmentary lyric phrases

### Tradeoff
- for music-vocals, we should expect **more unresolved timings** and preserve uncertainty explicitly

## Tool-calling specific failure modes

If we go the real tool-calling route:
- model support matrix is messy across OpenRouter models
- audio+tools compatibility may vary
- multi-turn latency and cost rise
- prompt/tool orchestration becomes more fragile
- failure handling gets more complex (bad arguments, repeated tool loops, partial alignment results)

That is a lot of architecture for something that still depends on an external aligner.

## 6) If no trustworthy solution exists, should we remove timestamps from the requested JSON and keep only ordering/index-based chronology?

**Yes. That is the correct short-term fallback.**

More specifically:
- **Dialogue:** if no grounded aligner is available yet, keep ordered segments and speaker continuity, but do **not** require authoritative `start`/`end` in the model output.
- **Music-vocals:** same answer, even more strongly. Keep ordered lyric fragments / repetitions / recurrence order, but avoid claiming precise windows unless an aligner produced them.

A safe interim contract would be:
- `index`
- optional `relative_order_group`
- optional `chunk_index`
- optional `coverage_hint` / `approximate_window`
- optional `timing_confidence`
- `start` / `end` only when produced by a grounded timing stage

If we do not want to change downstream consumers too much, a transitional variant is:
- allow `start` / `end` to be nullable
- require `timingMode` to declare whether timing is `grounded`, `chunk_local_estimated`, or `unresolved`

But the cleanest truthful move is still: **ordering first, timing later**.

## Concrete recommendation for Derrick

### Recommendation A — do this now

1. **Stop asking the LLM for authoritative line timestamps.**
2. **Change the requested JSON / validation contract so ordering is required but timing is optional or nullable.**
3. Preserve chunk/window provenance so we still know rough chronology.

### Recommendation B — next grounded implementation step

Implement a **separate local alignment stage** rather than provider-side tool-calling first.

Best first target:
- **Dialogue:** local ASR/alignment pass with word timestamps, then derive line spans

Second target:
- **Music-vocals:** only align lyrics when we have either:
  - a trusted lyric text candidate, or
  - a strong ASR hypothesis worth aligning

### Recommendation C — only add real tool calling later if still useful

If we later want the model to orchestrate alignment dynamically, add real OpenRouter tool calling after the local aligner exists.

But do that as a convenience/orchestration layer, **not** as the core timing solution.

## Practical implementation order

1. **Contract change**
   - make timestamps optional / nullable in dialogue + music-vocals outputs
   - preserve `timingMode`

2. **Grounding artifact prototype**
   - local script/service that returns word timestamps + grouped line spans for a chunk

3. **Lane integration**
   - let dialogue/music-vocals use alignment artifacts after text extraction

4. **Only then** consider real OpenRouter tool-calling integration if it still buys us anything

## Final recommendation

**Yes: remove required timestamps from the current LLM-requested JSON unless they come from a grounded alignment stage.**

That is the most truthful and practical answer for the current repo.
