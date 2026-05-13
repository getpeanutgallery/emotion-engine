# Phase 2 Continuity-State Refinement Design

**Date:** 2026-05-13  
**Scope:** Smallest durable fix for the current Phase 2 “micro-video” behavior  
**Status:** Proposed design only — no code changes in this pass

---

## Problem Statement

The restored Phase 2 thought contract is structurally correct, but the lived behavior still resets too hard every chunk. The strongest symptoms in the full rerun are:

- local-relative timestamp phrasing inside persona thoughts (`0.0s`, `2.0s`, `5.0s`)
- chunk-openers that read like a fresh clip instead of one continuous trailer watch
- false reset language like chunk 18’s `No intro fluff` even though that beat lands 90 seconds into the trailer
- dialogue-aware moments staying a little too detached from `thought`, because the prompt treats dialogue as support while still framing `thought` as chunk-local reaction

This is not a schema problem anymore. It is a continuity-state + prompt-contract seam.

---

## What the Audit Found

### 1) The runner carries too little prior viewer state

`server/scripts/process/video-chunks.cjs` currently forwards only:

- `previousState.summary`
- previous chunk `emotions`

It does **not** forward:

- previous `thought`
- previous `continuationThought`
- previous `personaMeta.scrollRisk`
- previous `dominant_emotion`
- previous chunk absolute window / where the viewer is in the trailer

That means the next prompt knows the prior neutral summary, but not the actual persona stance or retention momentum.

### 2) The prompt still frames `thought` as chunk-local

`tools/emotion-lenses-tool.cjs` currently says:

- `Use thought for persona-voiced internal reaction to this chunk.`
- `Optional follow-on reaction that carries momentum from the prior chunk.`

That wording is structurally safe, but behaviorally it nudges the model toward isolated clip review instead of a single ongoing watch experience.

### 3) The prompt exposes local chunk timing too directly

The prompt prints:

- `Chunk window: <start>-<end>`
- `Duration: <n>s`

That is useful for grounding, but with the current framing it appears to encourage local-relative narration inside `thought` (`0.0s and...`, `2.0s ...`, `5.0s ...`).

### 4) Dialogue grounding is present, but `thought` is over-disciplined away from using it naturally

The current prompt rightly warns that dialogue/music/lyrics cannot replace chunk-local visual grounding. That safeguard should stay.

But the current instruction set makes `thought` feel a little too separate from timestamp-grounded dialogue, even when the chunk clearly contains a speaking beat or a dialogue-driven reveal. The result is safe but slightly sterile reaction lines.

---

## Smallest Durable Design

## A. Carry forward a compact **viewer continuity state**

Do **not** redesign the artifact schema again. Keep this as an internal prompt-input seam.

### Proposed previous-state payload

Pass this forward from chunk N to chunk N+1:

```js
previousState: {
  summary,
  thought,
  continuationThought,
  dominantEmotion,
  scrollRisk,
  chunkIndex,
  startTime,
  endTime
}
```

### Why these fields

- `summary` — preserves neutral factual continuity
- `thought` — preserves the actual persona stance / attitude
- `continuationThought` — preserves forward lean when it exists
- `dominantEmotion` — preserves emotional lane without needing full score carryover
- `scrollRisk` — preserves retention momentum / viewer patience state
- `chunkIndex`, `startTime`, `endTime` — preserves where we are in the full watch experience

### What should **not** carry forward

Do **not** carry forward full previous dialogue lines, full music-vocals detail, or full prior lens reasonings as continuity state. Those are too verbose, more leak-prone, and already available through the current chunk’s support layers when relevant.

### Recommendation on existing `previousState.emotions`

Keep it only if another downstream consumer truly needs it; otherwise it is not the most useful continuity signal for persona-thought quality. For this seam, `dominantEmotion + scrollRisk + prior thought` matter more than the entire prior score object.

---

## B. Reframe `thought` as a single ongoing watch experience

### Prompt contract change

Replace the effective framing of:

- `thought = reaction to this chunk`

with:

- `thought = the persona’s current internal reaction while continuing to watch the same full trailer; this chunk is the newest evidence, not a fresh video start`

### Recommended instruction language

Use something close to:

> Treat `thought` as the viewer’s current running internal monologue while watching one continuous trailer from start to finish. The attached chunk is the newest slice of evidence in that ongoing watch experience, not a brand-new standalone clip.

And:

> `continuationThought` is optional. Use it only when a second line genuinely adds forward momentum, escalation, or retention intent beyond the main `thought`.

### Why this is the smallest fix

This keeps the current output shape intact while changing the behavioral target from “clip reaction” to “continuous viewing state.”

---

## C. Ban local-relative timestamp phrasing in persona thoughts

This should be enforced at **both** prompt and validator level.

### Prompt rule

Add an explicit negative rule:

> Do not narrate the chunk using local-relative timestamps or beat counters inside `thought` or `continuationThought` (examples to avoid: `0.0s`, `2.0s`, `5.0s`, `at the start of this chunk`).

And a positive replacement:

> If you need temporal language in persona thoughts, use full-watch phrasing such as `right away`, `still`, `now`, `by this point`, `this late in the trailer`, `at the end card`, or similar natural viewer language.

### Validator rule

Add a thought-field rejection for timestamp-style tokens in:

- `thought`
- `continuationThought`

Suggested first-pass regex class:

- `\b\d+(?:\.\d+)?s\b`

Optionally also reject phrases like:

- `at the start of this chunk`
- `by 2.0s`
- `within the next 2 seconds`

The minimum durable version is the explicit numeric-seconds ban. That alone catches the current failure mode cleanly.

### Why validator enforcement matters

Prompt-only guidance is too soft. The current artifact already shows repeated violations across the full rerun. This needs a hard fail so the tool loop repairs it before artifact write.

---

## D. Let chunk-supported dialogue influence `thought` more naturally

Keep the current grounding doctrine:

- attached chunk remains authoritative
- timestamp-grounded dialogue remains support, not automatic proof
- do not import unsupported dialogue into the chunk

But add a missing allowance:

> When the attached chunk clearly includes a speaking beat, dialogue reveal, or visibly dialogue-driven moment, `thought` may react naturally to that line or beat. You may use timestamp-grounded dialogue context to sharpen wording **only when the chunk itself supports it**.

This is the right middle path:

- still no unsupported quote leakage
- but no artificial wall between dialogue evidence and persona thought

### Important nuance

The prompt should keep the existing evidence discipline for lens reasoning fields. The relaxation is mainly for **how thought is phrased**, not for weakening factual support requirements in `summary` or `emotions.*.reasoning`.

---

## E. Add a small prompt-visible continuity section

Instead of only showing `Previous Summary`, show a tighter continuity block.

### Recommended prompt section

```md
## Viewer Continuity State (support only — do not override fresh chunk evidence)
- Previous summary: ...
- Previous thought: ...
- Previous continuation thought: ...
- Previous dominant emotion: ...
- Previous scroll risk: ...
- Prior chunk window: 85.0s-90.0s
```

This gives the model a viewer-memory handoff without inventing a new public artifact contract.

---

## Why This Should Fix the Observed Symptoms

### Symptom: `0.0s ...`
Fixed by:
- explicit prompt prohibition
- validator rejection for timestamp tokens in persona thought fields
- stronger ongoing-watch framing

### Symptom: chunk 18 `No intro fluff`
Fixed by:
- prior chunk absolute window carryover
- prior thought / continuation carryover
- prompt framing that this is not a fresh video open

### Symptom: thoughts feel like micro-videos
Fixed by:
- continuity handoff carrying persona stance, not just summary
- redefining `thought` as running internal monologue across the full trailer

### Symptom: dialogue under-influences thought
Fixed by:
- explicit allowance for chunk-supported dialogue-driven thought phrasing
- without relaxing the existing anti-leak grounding rules

---

## Likely Touched Files

### Primary implementation files

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs`

### Mirror / parity validator file very likely needed

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/structured-output.cjs`

The tools-side validator is the live generation seam, but the emotion-engine-side validator mirrors the same contract and should stay behaviorally aligned.

### Tests likely touched

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/test/scripts/video-chunks.test.js`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/test/lib/structured-output-emotion.test.js`

---

## Suggested Validation Expectations

### Unit / contract validation

1. **Prompt contract test**
   - assert the prompt now frames `thought` as ongoing full-trailer watch state
   - assert the prompt explicitly bans local-relative timestamp phrasing in `thought` / `continuationThought`
   - assert the prompt explicitly allows chunk-supported dialogue to influence `thought`

2. **Validator test**
   - reject `thought: "0.0s and ..."`
   - reject `continuationThought: "2.0s later ..."`
   - continue rejecting redundant `continuationThought`
   - continue allowing normal natural language like `still`, `now`, `this late in the trailer`

3. **Runner test**
   - assert previousState now includes `thought`, optional `continuationThought`, `dominantEmotion`, `scrollRisk`, and prior window metadata

### Bounded rerun validation

Re-run only the windows that expose the seam:

- intro opening (`0s-15s`)
- dialogue transition lane around chunks `4-6`
- chunk `18` / `90s-95s`
- promo / end-card lane (`120s-130s`)

### Artifact checks

Confirm all of the following:

- no `thought` or `continuationThought` contains `\d+(\.\d+)?s`
- chunk 18 no longer implies a fresh intro reset
- dialogue-adjacent chunks can react more naturally to visible speaking beats
- grounding in `summary` and `emotions.*.reasoning` stays conservative

A cheap honest grep/script check over `chunk-analysis.json` for timestamp-token leakage should be part of rerun QA.

---

## Non-Goals

This pass should **not**:

- redesign the public output schema again
- add new required personaMeta fields
- broaden dialogue/music/lyrics into free evidence sources
- solve sharper persona tone globally

Tone sharpness can be tuned later. This pass is about repairing continuity behavior with the smallest durable seam change.

---

## Recommended Implementation Order

1. Update runner carry-forward state in `video-chunks.cjs`
2. Update prompt framing + continuity block in `emotion-lenses-tool.cjs`
3. Add timestamp-phrase rejection in both structured-output validators
4. Run focused tests
5. Run a bounded rerun on the known symptom windows

---

## Bottom Line

The smallest durable fix is:

- carry forward a compact viewer continuity state
- reframe `thought` as ongoing full-trailer watch, not per-chunk clip reaction
- hard-ban local-relative timestamp phrasing in persona thought fields
- explicitly allow chunk-supported dialogue to shape `thought` when the attached chunk supports it

That should address the current micro-video behavior without weakening grounding or reopening the schema surface.
