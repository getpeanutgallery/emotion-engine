# 2026-05-12 final audit decision

**Date:** 2026-05-12  
**Auditor:** Cookie 🍪  
**Bead:** `ee-jk95`

---

## Executive verdict

**Do not greenlight one more music-vocals deterministic prototype right now.**

The residual music-vocals timestamp problem is now **below the threshold where it is the next honest bottleneck**. It is still real, but the fresh rerun and QA packet show it is **no longer the main source of downstream product harm**.

**Recommended next lane:** Phase 2 prompt/goal refinement.

**Recommended wait:** Phase 3 / reporting cleanup should wait until after at least one bounded Phase 2 refinement pass, because the current bigger problem is chunk interpretation / continuity drift, not reporting polish.

---

## Question 1: Is the residual music-vocals timestamp problem still bad enough to justify one more bounded deterministic prototype?

**Answer: no, not now.**

### Why

The May 6-7 chain left one credible optional prototype on the table: **separation-first -> existing `faster_whisper` -> unchanged derivation/scoring**. That was the right recommendation at the time because we had not yet rechecked the full current Phase 1 -> Phase 2 product surface after cleanup.

The fresh May 12 rerun changes the decision surface:

- Trusted benchmark windows stayed strong on the dimensions that matter most for the current product question:
  - **dominant emotion exact on 17/17 trusted windows**
  - **average absolute score drift 0.61** on trusted windows
- Dialogue grounding is behaving correctly at the chunk-window level:
  - no cross-window dialogue leakage was found
  - sampled dialogue prompts only included overlapping timestamped lines
- Music-vocals grounding is still imperfect, but the harm is **localized rather than systemic**:
  - the main leak-risk case is **chunk 18**
  - that chunk includes **2 timed overlapping lyric anchors** and **7 unresolved ordered lyric entries** via bounded fallback
  - QA found this as a real residual risk, but **not the dominant explanation** for the overall miss pattern
- The broader miss pattern is better explained by **chunk interpretation / continuity drift** than by lyric contamination:
  - excluded/frozen windows remain weak overall
  - chunk 18 is the clearest miss, but chunk 6 and other skeptical windows also show summary/scene-selection drift without needing a music-vocals explanation

### Bottom line on prototype justification

A separation-first prototype is still intellectually plausible, but it is **no longer the next highest-value move**.

The evidence no longer supports saying:
- “music-vocals timestamps are the current blocker,” or
- “another timestamp prototype is the most honest next use of time.”

Instead, the evidence supports saying:
- “the timestamp lane is imperfect but usable enough for now,” and
- “the product bottleneck has moved upstream into how Phase 2 interprets and summarizes chunk evidence.”

So the honest decision is to **defer** the prototype, not to deny that the residual issue exists.

---

## Question 2: If Phase 2 is good enough on the timestamp question, what should be next?

**Next should be Phase 2 prompt/goal refinement.**

### Why this is the sharper lane

The QA packet shows the current system is not failing mainly because it lacks timestamped support data. It is failing because the model still drifts on **what to prioritize inside a chunk**.

Evidence:

- **Chunk 18** misses the Hawaii title-card / soldier-platform truth and instead summarizes wingsuit-city action with heavy-metal emphasis.
- **Chunk 6** keeps the correct dominant emotion but over-centers the dialogue line and underweights the aircraft/city visual progression.
- Trusted windows are directionally strong, which means the current grounding stack is already sufficient to support useful Phase 2 behavior in many important segments.
- The remaining quality gap is therefore more about:
  - visual-vs-dialogue prioritization,
  - continuity handling from previous-summary context,
  - chunk objective clarity,
  - how support context is framed so it does not overpower immediate visual evidence.

Those are all **Phase 2 prompt/goal problems**, not timestamp-backend problems.

### Honest bounded next work inside Phase 2 refinement

The next refinement pass should focus on:

1. **Clarifying chunk objective hierarchy**
   - immediate visual evidence first
   - dialogue/music/lyrics only as support
   - continuity as secondary, never scene-overriding

2. **Tightening previous-summary influence**
   - preserve continuity without letting prior action beats overwrite fresh local evidence

3. **Reducing over-weighting of support context in scene summaries**
   - especially when a chunk contains title cards, location cards, or promo-card transitions

4. **Explicitly instructing the model to prefer current-window scene transitions over generalized trailer momentum**
   - this directly targets the kind of miss seen in chunk 18

---

## Question 3: Should Phase 3 / reporting cleanup happen next?

**No. It should wait.**

### Why

Phase 3/reporting cleanup would polish a surface that still reflects unresolved Phase 2 interpretation drift.

Right now:
- the trusted windows are strong enough to say the pipeline has real value,
- the timestamp lane is no longer the primary blocker,
- but the output still is **not benchmark-honest enough across the full rerun** to make reporting cleanup the best next move.

Doing Phase 3/reporting cleanup now would risk polishing the wrong ceiling.

The better order is:
1. accept the current timestamp lane as good-enough-for-now,
2. do one bounded Phase 2 prompt/goal refinement pass,
3. then decide whether Phase 3/reporting cleanup is finally aligned to the actual capability level.

---

## Final decision Derrick can use next session

### One more music-vocals prototype justified now?

**No. Defer it.**

Reason: the residual timestamp weakness is real but no longer the main downstream bottleneck; the current larger harm comes from Phase 2 interpretation / continuity drift.

### Should Phase 2 prompt/goal refinement be next?

**Yes.**

Reason: the fresh evidence says the next highest-value improvement is in how Phase 2 weighs local visuals, continuity, dialogue, and support context.

### Should Phase 3/reporting cleanup wait?

**Yes.**

Reason: reporting cleanup should follow at least one bounded Phase 2 refinement pass, not precede it.

---

## Final judgment on “is Phase 2 good enough yet?”

Two-part answer:

- **Good enough to stop chasing music-vocals timestamp R&D as the immediate next step:** **yes**.
- **Good enough to call benchmark-quality overall:** **no**.

That distinction matters. The timestamp lane is now good enough **for prioritization purposes**, but the overall Phase 2 product still needs refinement before it is ready to be treated as settled or polished in Phase 3.

---

## Evidence used

- `.plans/artifacts/2026-05-12-cleanup-audit/summary.md`
- `.plans/artifacts/2026-05-12-cleanup-audit/post-cleanup-audit.md`
- `.plans/artifacts/2026-05-12-rerun/summary.md`
- `.plans/artifacts/2026-05-12-rerun-qa/qa-summary.md`
- `.plans/artifacts/2026-05-12-rerun-qa/chunk-context-audit.json`
- `.plans/artifacts/2026-05-12-rerun-qa/benchmark-comparison.json`
- `.plans/archive/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`
- `.plans/archive/2026-05-07-deterministic-music-vocals-timestamp-next-step-evaluation.md`
- `/home/derrick/.openclaw/workspace/memory/2026-05-06.md`
- `/home/derrick/.openclaw/workspace/memory/2026-05-07.md`
