# Cross-phase AI flow audit

Date: 2026-04-07  
Related plan: `.plans/2026-04-07-draft-dialogue-prompt-v2-1-and-audit-cross-phase-ai-flows.md`  
Reference draft direction: `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`

## Goal

Audit the AI-backed scripts across phase 1, phase 2, and phase 3 for the same design smells now called out in the dialogue lane:

- model-visible tool-loop mechanics
- prompt noise
- turn-budget clutter
- replayed conversation state
- weak invalid-JSON retry behavior
- redundant validate-then-resend success flow

This is an audit only. No runtime or prompt implementation changes were made.

---

## Executive summary

Yes: the same cleanup direction should apply broadly, but not uniformly.

There are really **three runtime families** in the current engine:

1. **Shared local-validator loop inside emotion-engine**  
   Used by `get-dialogue`, chunked `get-music`, chunked `get-music-vocals`, `get-visual-identity`, and `whole-video-mimo` via `server/lib/local-validator-tool-loop.cjs`.

2. **Older local-validator loop in the sibling `tools` repo**  
   Used by phase 2 `video-chunks` via `tools/lib/local-validator-tool-loop.cjs`.

3. **Custom recommendation loop**  
   Used only by phase 3 `recommendation.cjs`.

The broad pattern is real:

- the model is still shown local validator mechanics
- turn budgets and validator budgets are injected into the prompt
- full tool contracts are dumped into the prompt
- the full tool-loop history is replayed back to the model on follow-up turns
- parse/invalid-JSON retries usually re-run the whole prompt rather than sending a tight repair message

But the flows are **not all equally noisy**.

- `get-dialogue` is the noisiest because the domain prompt is already dense before the local tool-loop scaffolding gets appended.
- `get-visual-identity` and `whole-video-mimo` have comparatively cleaner task prompts; most of their avoidable clutter comes from the appended validator loop, not from the core task framing.
- `video-chunks` and `recommendation` differ materially because they still require the model to effectively do a success-path resend after validation.
- the whole-asset passes in `get-music` and `get-music-vocals` do **not** use the local tool loop at all, so they share the weak invalid-JSON retry pattern but not the model-visible tool-loop pollution.

The key distinction: some state carry is good and should remain, while some is pure runtime noise.

- **Keep:** domain continuity context like dialogue chunk handoff, music rolling summary, music-vocals whole-asset lyric scaffolding, previous chunk summary in video chunks, and additive phase-1 evidence for whole-video analysis.
- **Remove or hide:** tool contracts, validator instructions, turn budgets, validator budgets, and replayed assistant/tool history.

---

## Scope audited

### Phase 1

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/ai-recovery-runtime.cjs`

### Phase 2

- `server/scripts/process/video-chunks.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`

### Phase 3

- `server/scripts/report/recommendation.cjs`

---

## Findings by flow family

### 1) Shared emotion-engine local-validator loop family

**Files:**
- `server/lib/local-validator-tool-loop.cjs:128-171`
- `server/lib/local-validator-tool-loop.cjs:202-470`
- Call sites:
  - `server/scripts/get-context/get-dialogue.cjs:2275-2365`
  - `server/scripts/get-context/get-music.cjs:1560-1615`
  - `server/scripts/get-context/get-music-vocals.cjs:1604-1655`
  - `server/scripts/get-context/get-visual-identity.cjs:558-592`
  - `server/scripts/process/whole-video-mimo.cjs:701-734`

#### What clearly shares the same problem pattern

This family clearly shares the dialogue-lane smell.

The shared prompt builder injects all of the following into the model-visible prompt on every loop turn:

- `LOCAL TOOL LOOP:` framing
- a canonical tool-call envelope example
- acceptance rules that explain validator sequencing
- the full tool contract JSON
- current turn budget and validator budget
- full conversation state/history

That means the runtime is spending prompt budget on local orchestration mechanics instead of only on the task and schema.

#### Specific issues

**Model-visible tool-loop mechanics**  
Strongly present. The model is explicitly told about the local validator and its acceptance rules.

**Prompt noise**  
Strongly present. The loop scaffolding is appended after the real task prompt.

**Turn-budget clutter**  
Strongly present. `remainingTurns` and `remainingValidatorCalls` are surfaced directly to the model.

**Replayed conversation state**  
Strongly present. Assistant output and tool results are serialized back into `Conversation state:`.

**Weak invalid-JSON retry behavior**  
Present. Parse/tool-loop failures become retryable errors, but the retry path generally means “run the full prompt again,” not “send a narrow JSON repair instruction.”

**Redundant validate-then-resend success flow**  
Mostly fixed in the shared engine loop implementation, but the prompt still claims otherwise.

Important nuance:

- the current `server/lib/local-validator-tool-loop.cjs` already **accepts the first valid artifact** after local validation in the success path
- however, the prompt still tells the model that the final artifact is accepted only after validator success and then says “After the validator returns valid=true, return ONLY the final JSON object”

So the runtime behavior is already leaner than the prompt contract. The model is still being asked to reason about an unnecessary two-step success path that the runtime no longer truly needs.

#### Which scripts in this family are worst affected

**Highest pain: `get-dialogue`**  
The base prompt is already large and rule-heavy (`get-dialogue.cjs:2159-2245`, plus chunk variants). Appending loop mechanics on top of that is a bad fit. This is the clearest candidate for the v2.1 lean-runtime approach.

**Medium pain: chunked `get-music` and `get-music-vocals`**  
Their core prompts are not broken, but they already carry real domain context:

- whole-asset context
- rolling summaries
- lyric recall scaffolding in music-vocals

Because they already need that legitimate context, adding tool-loop noise makes their prompts heavier than necessary.

**Medium pain but cleaner base prompt: `get-visual-identity` and `whole-video-mimo`**  
These have comparatively focused task prompts. Most avoidable clutter is the appended local-validator scaffolding rather than the base task instructions themselves.

#### Materially different things that should not be “cleaned up” as if they were noise

These flows also carry **intentional semantic context**, which is useful:

- dialogue chunk handoff / continuity notes
- music rolling summary and whole-asset context
- music-vocals whole-asset lyric checklist / recall scaffold
- phase-1 additive structured context for `whole-video-mimo`

That is not the same as replaying tool-loop history. The former is domain memory; the latter is runtime self-talk.

---

### 2) Older `tools` local-validator loop family (`video-chunks`)

**Files:**
- `server/scripts/process/video-chunks.cjs:760-783`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs:205-289`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs:526-593`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs:118-157`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs:187-420`

#### What it shares

This family shares the same core smell as dialogue and the other loop-based flows:

- model-visible local validation
- tool contract dumping
- turn-budget clutter
- conversation-state replay
- whole-prompt retry behavior for invalid output

#### What differs materially

This older loop still has the **redundant validate-then-resend success flow** in runtime behavior, not just prompt wording.

It records a successful validator result, then continues waiting for a follow-up final artifact. In other words, the model has to:

1. produce a tool call or candidate
2. get local validation success
3. then produce the final artifact again

That is precisely the success-path redundancy the dialogue v2.1 direction is trying to avoid.

So `video-chunks` is **worse than** the newer shared engine loop, because the older sibling-loop implementation still enforces the noisy two-step happy path.

#### Extra observation

The base phase-2 chunk prompt in `emotion-lenses-tool.cjs` is fairly reasonable. It uses:

- persona/goal
- configured lenses
- previous summary as continuity only
- dialogue/music as supporting context
- attached chunk as primary evidence

That semantic context is defensible. The waste comes from the older validator loop wrapped around it.

---

### 3) Custom recommendation loop family

**Files:**
- `server/scripts/report/recommendation.cjs:146-170`
- `server/scripts/report/recommendation.cjs:173-199`
- `server/scripts/report/recommendation.cjs:214-492`

#### What it shares

Recommendation clearly shares the same broad design smell:

- model-visible tool-loop instructions
- explicit validator framing
- turn-budget clutter
- full conversation-state replay
- invalid-JSON failures handled as loop retries instead of a narrow repair message

#### What differs materially

Recommendation is not using the shared loop helper. It has its own custom copy of the pattern.

It also still contains the **redundant validate-then-resend success flow**:

- once the validator succeeds, the loop keeps going until the model returns a final recommendation JSON matching the validated content
- if the model validates a recommendation and then returns a slightly different final payload, the loop continues again

So recommendation is conceptually aligned with the old `tools` loop, not with the newer emotion-engine loop.

This makes phase 3 a strong cleanup target, but it is **not** just a one-line reuse of the current engine loop; it is a separate local implementation that needs to be brought into the same runtime philosophy.

---

### 4) Direct whole-asset JSON passes (`get-music`, `get-music-vocals`)

**Files:**
- `server/scripts/get-context/get-music.cjs:1324-1405`
- `server/scripts/get-context/get-music.cjs:1540-1558`
- `server/scripts/get-context/get-music.cjs:1626-1748`
- `server/scripts/get-context/get-music-vocals.cjs:1401-1479`
- `server/scripts/get-context/get-music-vocals.cjs:1587-1601`
- `server/scripts/get-context/get-music-vocals.cjs:1676-1800`

#### What differs materially

These passes do **not** use the local validator tool loop.

So they do **not** share:

- model-visible tool-loop mechanics
- turn-budget clutter
- conversation-state replay
- validate-then-resend success flow

#### What they still share

They do still share a weaker version of the invalid-output problem:

- invalid JSON / invalid schema causes retryable failure
- retries generally mean another full prompt/provider attempt
- there is no tight repair-only follow-up message inside the same attempt

So these whole-asset passes should still follow the broader lean-runtime philosophy, but they are **not** the same cleanup problem as dialogue/video/recommendation.

---

## Flow-by-flow verdict

| Flow | Phase | Runtime family | Same core problem pattern? | Key difference |
|---|---|---|---|---|
| `get-dialogue` transcription + stitch | Phase 1 | shared engine loop | Yes, strongly | worst prompt-noise pressure because base prompt is already large |
| `get-music` chunk analysis | Phase 1 | shared engine loop | Yes | keep rolling + whole-asset semantic context |
| `get-music-vocals` chunk analysis | Phase 1 | shared engine loop | Yes | keep rolling + whole-asset lyric scaffold |
| `get-visual-identity` | Phase 1 | shared engine loop | Yes | base prompt is relatively clean; runtime scaffolding is the main avoidable clutter |
| `video-chunks` | Phase 2 | older tools loop | Yes, strongly | still truly requires validate-then-resend success flow |
| `whole-video-mimo` | Phase 2 | shared engine loop | Yes | base prompt is mostly reasonable; runtime scaffolding is the main avoidable clutter |
| `recommendation` | Phase 3 | custom loop | Yes, strongly | custom implementation still forces success-path resend logic |
| `get-music` whole-asset pass | Phase 1 | direct JSON parse | Partially | no tool-loop pollution; still weak on invalid-JSON retry style |
| `get-music-vocals` whole-asset pass | Phase 1 | direct JSON parse | Partially | no tool-loop pollution; still weak on invalid-JSON retry style |

---

## Recommended cleanup strategy

## Recommendation: yes, use a common cleanup strategy broadly

A common strategy is recommended, with **two variants**.

### Variant A: loop-based flows

Apply one shared lean-runtime rule to:

- `get-dialogue`
- chunked `get-music`
- chunked `get-music-vocals`
- `get-visual-identity`
- `whole-video-mimo`
- `video-chunks`
- `recommendation`

#### Target behavior

- model sees only the task prompt + required JSON shape + task-relevant rules
- local validation stays hidden
- first valid JSON is accepted immediately
- invalid JSON gets a short repair message, not a replay of tool contracts/history/budgets
- tool-loop history is not echoed back to the model
- turn/validator budgets stay internal

#### Practical implication

This does **not** mean deleting domain continuity context.

Keep:

- chunk handoff / rolling summary / whole-asset recall context when it helps the task
- supporting phase-1 artifacts for phase 2 whole-video analysis
- previous summary continuity for chunk emotion analysis

Remove or hide:

- tool-call envelope instructions
- validator acceptance sequencing
- tool contract JSON
- current turn budget JSON
- conversation-state JSON transcript

### Variant B: direct whole-asset JSON passes

Apply a lighter version to:

- whole-asset `get-music`
- whole-asset `get-music-vocals`

#### Target behavior

- keep the direct “return JSON only” prompt style
- when JSON is invalid, retry with a short bounded repair prompt/message rather than simply re-running the full unchanged request
- do not introduce model-visible validator tools just to unify everything

---

## Priority / rollout view

### Highest-value first

1. **Dialogue**  
   This is already the approved conceptual direction and the clearest win.

2. **`video-chunks` and `recommendation`**  
   These still enforce the redundant validate-then-resend success path in runtime behavior.

3. **`get-visual-identity` and `whole-video-mimo`**  
   Cleaner base prompts mean they should benefit quickly from hiding the loop scaffolding.

4. **chunked `get-music` and `get-music-vocals`**  
   Same runtime cleanup, but preserve the semantic cross-chunk context.

5. **whole-asset `get-music` and `get-music-vocals`**  
   Improve invalid-JSON repair path, but these are a separate class from the tool-loop family.

---

## Bottom line

### Flows that clearly share the same problem pattern

- `get-dialogue`
- chunked `get-music`
- chunked `get-music-vocals`
- `get-visual-identity`
- `video-chunks`
- `whole-video-mimo`
- `recommendation`

### Flows that differ materially

- whole-asset `get-music`
- whole-asset `get-music-vocals`

These whole-asset passes still need better invalid-JSON repair handling, but they are **not** suffering from model-visible validator-loop pollution.

### Final recommendation

**Yes: a common cleanup strategy is recommended across the loop-based AI flows.**

Use the dialogue v2.1 lean-runtime direction as the template:

- hide validation
- accept first valid JSON
- retry only for invalid output
- preserve domain context
- remove model-visible orchestration chatter

Then treat the whole-asset music passes as a smaller adjacent cleanup: better bounded JSON-repair retries without introducing a tool loop.
