# Phase 2 Full-Run Persona QA Summary

**Date:** 2026-05-14  
**Bead:** `ee-o1eg`  
**Role:** QA  
**Primary artifact reviewed:** `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`

## Verdict

**Status:** ❌ No-go for using this exact full-run packet as Phase 3 readiness proof

This run is **close enough to be encouraging** but **not clean enough to certify**. A normal human reader would often believe the impatient-teenager voice within individual chunks, especially across the middle action stretch and the late promo dip. But when read as **one continuous 2:20 trailer watch**, the artifact still shows repeated micro-clip reset language and a few direct memory contradictions that break the illusion of one viewer carrying state forward.

So the honest QA call is:
- **Phase 2 architecture:** broadly working and likely near-ready
- **This full-run evidence packet:** **not ready** to graduate toward Phase 3

## Inputs reviewed

Required references reviewed:
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-full-thought-digest/full-thought-digest.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-thought-comparison/thought-comparison.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-qa/qa-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-guardrail-audit/audit-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-persona-contract-audit/audit-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase2-readiness-review/forensic-review.md`

## QA method

I did **not** treat the prior summaries as authoritative. I used them as leads, then directly inspected the full-run `chunk-analysis.json` across the whole sequence.

Broad sample / direct checks performed:
- opener and early hook: chunks **0-5**
- corridor-to-floating-islands transition: chunks **10-12**
- previously risky local-reset cluster: chunks **13-16**
- previously risky chunk-18-style window: chunks **18-20**
- title / promo / tail-end coherence: chunks **23-27**
- cross-run scan for known bad phrases in `thought` and `continuationThought`
- spot-check of `summary`, `thought`, `continuationThought`, `dominant_emotion`, and `personaMeta.scrollRisk` alignment

## What passes

### 1) The persona voice is present and usually readable
The `thought` layer is fully populated and mostly sounds like one impatient, spectacle-driven viewer rather than a dry evaluator. The voice is skeptical, pace-sensitive, and reacts in a human-readable way to action vs exposition.

### 2) Large parts of the middle run feel coherent
Chunks **7-12** and **19-23** mostly read like one viewer staying engaged because the trailer keeps escalating. Examples that work well:
- chunk 8: the viewer is weirded out by the butterflies but stays in because the action paid off
- chunk 12: the explosion-to-quiet cut reads like a real attention spike
- chunk 20: `We're at 100 seconds in and I'm still here` is exactly the sort of full-watch awareness this system needs
- chunks 24-25: the promo dip is correctly treated as cluttered and momentum-killing

### 3) Emotion labels are usually directionally coherent
The dominant emotion and scroll risk usually match the actual thought text:
- chunk 0: boredom / high scroll risk makes sense
- chunk 13-20 action stretch: excitement / low scroll risk generally fits
- chunks 24-25: boredom / high scroll risk fits the static promo beat
- chunk 27: boredom / `SCROLLING` fits the logo-kill ending

### 4) Promo negativity survives
The system did not scrub the end-card lane into fake enthusiasm. The viewer still gets annoyed by static promo clutter and badly placed call-to-action material, which feels honest.

## Blocker findings

## B1. Repeated chunk-local reset language still breaks the one-viewer illusion
This is the main blocker.

Direct evidence from the full-run artifact:
- **chunk 0 thought:** `0.0s ...`
- **chunk 0 continuationThought:** `in the next second`
- **chunk 4 thought:** `0.0s ...`
- **chunk 4 continuationThought:** `in the next 2 seconds`
- **chunk 10 continuationThought:** `in the next few seconds`
- **chunk 13 thought:** `0.0s ... 2.0s ... 5.0s ...`
- **chunk 14 thought:** `0.0s ...`
- **chunk 16 thought:** `0.0s ... 2.0s ... 3.0s ... 5.0s ...`
- **chunk 26 continuationThought:** `If the next five seconds keep this energy...`

Why this is blocker-level:
- it makes the persona sound like it is repeatedly watching isolated 5-second clips, not one continuous trailer
- it directly weakens human readability even where the local line is otherwise punchy
- this was a known risk lane, so seeing it survive in the full-run proof packet means the packet itself cannot be the graduation evidence

## B2. Chunk 18 still has the late-trailer cold-open bug class
- **chunk 18 thought:** `Avalon drops and we're immediately wingsuiting? No intro fluff.`

Why this is blocker-level:
- by 90-95 seconds, the trailer has already had a long opening, multiple location reveals, and sustained escalation
- `No intro fluff` is false from the viewpoint of a single continuous viewer
- this is exactly the kind of canary bug that makes the continuity claim feel untrustworthy

## B3. Chunk 0 and chunk 2 contradict each other about the trailer opening
- **chunk 0 thought:** `already a dark, cluttered mess with generic 'RISING TENSIONS' corporate buzzwords`
- **chunk 2 thought:** `No generic intro sequence, just immediate smoke and title`

Why it matters:
- a coherent viewer could say the generic intro is over now
- saying there was **no** generic intro sequence contradicts the earlier lived reaction
- this reads like memory reset, not natural escalation

## B4. Chunk 2 and chunk 23 contradict each other about title awareness
- **chunk 2 thought:** `I know what this is instantly`
- **chunk 23 thought:** `I need to see the name`

Why it matters:
- chunk 23 can absolutely react to the final title/payoff card
- but it should not imply the viewer still does not know the game's name after chunk 2 already said the opposite
- this is a real retained-knowledge contradiction, not just tone drift

## B5. Chunk 26 makes an implausible near-end decision claim
- **chunk 25 continuationThought:** `Since it's the end, I'm just waiting for it to finish...`
- **chunk 26 continuationThought:** `If the next five seconds keep this energy, I might actually watch the whole thing.`

Why it matters:
- chunk 25 already shows end-of-trailer awareness
- chunk 26 reverts to an earlier-stage decision posture as though completion is still hypothetical
- near the end of a 140-second trailer, this reads like continuity loss

## Non-blocker concerns

### N1. Some continuation thoughts feel templated
Repeated scaffolds like `If the next beat keeps this energy...` or `If the next scene matches this energy...` appear often enough to feel formulaic. This is a quality issue, but not the main reason for failure.

### N2. Some emotion labels are slightly flatter than the prose
Example: chunk 2 is labeled dominant `patience`, which is defensible, but the line also reads pretty clearly as energized recognition. Not wrong enough to block; just mildly less vivid than the thought text.

### N3. Several summaries are serviceable rather than vivid
The summaries usually ground the chunk correctly, but they are not the part carrying the continuity burden. That is acceptable as long as the thought layer stays coherent.

## Readiness judgment

**Go / no-go:** **No-go** for this full-run evidence packet.

Why:
- the packet demonstrates that the persona system is much healthier than before
- but the remaining failures are not just nitpicks; they directly attack the core Phase 2 claim that a reader can follow one believable viewer across the whole trailer
- because the contradiction class is visible in multiple places, I would not sign off on this exact packet as the artifact that proves readiness for Phase 3

## What would change this to a go

A fresh full rerun would likely pass QA if it shows all of the following:
1. no chunk-local timestamp/countdown phrasing in `thought` or `continuationThought`
2. chunk 18 reads like a late-trailer payoff, not a fresh cold open
3. later title-card reactions preserve the fact that the viewer already knows the game's name
4. once late-trailer awareness appears, end-stage chunks do not revert to `might watch the whole thing`
5. the persona keeps the same skeptical voice while sounding like one continuous watcher

## Bottom line

This run is **promising but not certifiable**.

The strongest honest QA sentence is:

> The latest full Phase 2 persona outputs are broadly believable chunk-to-chunk, but this exact full-run artifact still contains blocker-level continuity resets and a few direct memory contradictions, so it should not yet be used as the readiness packet for Phase 3.
