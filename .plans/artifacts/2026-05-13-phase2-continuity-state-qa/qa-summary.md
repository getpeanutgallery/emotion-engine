# Phase 2 Continuity-State Refinement QA

**Date:** 2026-05-13  
**Bead:** `ee-aqg0`  
**Role:** QA  
**Scope:** Lived-sequence continuity behavior in the continuity-state rerun artifact

## Verdict

**Status:** ⚠️ Partial pass / audit-blocking follow-up recommended

The continuity-state refinement is a real behavioral improvement, not just a regex cleanup. The rerun reads much more like one continuous trailer watch across the key windows Derrick called out. Chunk 1 now explicitly carries forward the bad intro before reacting to escalation, chunk 18 now reads like a late-trailer payoff instead of a cold open, and chunks 24-25 preserve end-card awareness while still acknowledging promo clutter.

However, the QA sweep found **one residual local-relative timing phrase** in the thought layer:

- **Chunk 14 continuationThought:** `Music is about to drop. If the next 5 seconds hit hard, I'm sharing this.`

That line is materially better than the prior `0.0s` wording, but it is still chunk-local timing language inside `continuationThought`, which means the “no misleading local-reset language remains” goal is **not fully satisfied yet**.

## Inputs Reviewed

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-13-phase2-continuity-state-refinement.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-design/design-note.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/evidence.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-continuity-rerun-2026-05-13/phase2-process/chunk-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-continuity-rerun-2026-05-13/phase3-report/summary/FINAL-REPORT.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`

## What I Checked

### 1) Human continuity gain vs regex-only cleanup

**Pass.** The best windows show real cumulative viewer memory:

- **Chunk 1** now says `the generic intro is over`, which proves the persona is carrying forward an opinion from chunk 0 instead of reacting like a fresh clip.
- **Chunk 18** now ends with `I'm seeing this through to the end card`, which is genuine late-trailer awareness.
- **Chunk 25** inherits the date/end-card state from chunk 24 before reacting to the surprise gameplay tag.

This feels materially more human than the prior run.

### 2) No misleading local-reset language remains in `thought` / `continuationThought`

**Fail.** The main reset language is mostly gone, but not completely.

#### Cleanups that worked

- Prior numeric-seconds phrasing like `0.0s` is gone from the rerun artifact.
- Chunk 18 no longer says `No intro fluff`.
- Chunk 25 no longer frames the promo lane as if it were a fresh beginning.

#### Residual problem

- **Chunk 14 continuationThought:** `Music is about to drop. If the next 5 seconds hit hard, I'm sharing this.`

Why this matters:
- it still narrates the viewer reaction in local chunk-time terms
- it weakens the claim that the thought layer fully escaped the micro-video frame
- it suggests the validator/prompt ban is still too narrow, because it blocks `5.0s` but not `next 5 seconds`

### 3) Chunks 4-5 use dialogue naturally only when chunk-supported

**Pass.**

- **Chunk 4** feels more natural than before without overclaiming dialogue content. It reacts to the speaking beat and visible cybernetic detail (`what is on that lady's neck?`) plus robot deployment, which matches the chunk summary and the rerun evidence.
- **Chunk 5** stays skeptical about the talking-head cut (`why are we cutting to two guys talking in a field?`) instead of pretending the exposition itself is inherently exciting.

Net: dialogue influence looks **bounded by actual chunk support**, not sprayed across the whole sequence.

### 4) Chunk 18 feels like a late-trailer beat rather than a cold open

**Pass.**

Before:
- `No intro fluff`
- `I might actually watch the whole thing`

After:
- `I'm locked in.`
- `I'm seeing this through to the end card.`

That is the correct lived-sequence posture for a chunk landing around 90s into the trailer.

### 5) Promo/end-card chunks 24-25 preserve end-card awareness without over-softening the promo dip

**Pass, with minor softness noted but acceptable.**

- **Chunk 24** still calls the lane `pre-order spam` and `cluttered`, so the promo dip has not been scrubbed into fake enthusiasm.
- **Chunk 25** clearly knows it is in the trailer tail (`Thought we were done`, `Final hype reel energy`) and carries forward the date awareness from chunk 24.

The tone is somewhat warmer than the prior run, but not misleadingly so. The promo annoyance is still present.

### 6) No obvious grounding regressions in the thought layer

**Pass in QA sweep.**

I did not find an obvious new pattern of unsupported hallucination in the targeted windows or in a broader read-through of all rerun `thought` / `continuationThought` fields. The thought layer remains anchored to visible/actionable chunk content:

- chunk 4 reacts to the `2035` card, speaking beat, neck detail, and robot deployment
- chunk 5 reacts to the robot army + field conversation cut
- chunk 18 reacts to `Avalon`, wingsuits, and hallway gunplay
- chunks 24-25 react to title/pre-order/date/gameplay tag flow

The main QA issue is continuity phrasing residue, not grounding drift.

## Evidence Notes

### Before/after anchors

- **Chunk 1 before:** fresh escalation reaction with no memory of the weak intro
- **Chunk 1 after:** `Okay, the generic intro is over. Now we're talking.`

- **Chunk 18 before:** `No intro fluff` / `watch the whole thing`
- **Chunk 18 after:** `I'm seeing this through to the end card.`

- **Chunk 25 before:** cold-open-ish complaint about a `Static screen for 3 seconds`
- **Chunk 25 after:** date carryover + `Thought we were done` + end-burst framing

### Residual continuity-language evidence

- **Chunk 14 continuationThought:** `Music is about to drop. If the next 5 seconds hit hard, I'm sharing this.`

This is the only clearly audit-relevant remainder I found in the rerun thought layer.

## Recommended Audit Handoff

**Current QA call:** do **not** treat the continuity-state refinement as fully done yet.

Recommended auditor posture:
- accept that the refinement produced real continuity gains
- verify that the remaining issue is isolated to residual local-timing phrasing rather than broader continuity failure
- send the work back for a small follow-up that widens the prompt/validator guardrail from numeric-second tokens (`0.0s`) to natural-language variants like `next 5 seconds`

## Suggested Follow-up Scope

Small follow-up only; no redesign needed.

Likely fix target:
- expand the continuity-language ban so it catches natural-language local-time phrasing, not just numeric `Xs` tokens

Examples that should be disallowed in `thought` / `continuationThought`:
- `next 5 seconds`
- `in the next second`
- similar local beat-count phrasing that still treats the chunk like an isolated micro-video

## Concise QA Outcome

- **Human continuity gain:** yes
- **Dialogue-use on chunks 4-5:** yes, appropriately bounded
- **Chunk 18 late-trailer awareness:** yes
- **Chunks 24-25 end-card awareness without losing promo dip:** yes
- **Grounding regressions:** none obvious in QA sweep
- **Residual blocker:** chunk 14 still uses local-relative timing language (`next 5 seconds`)
