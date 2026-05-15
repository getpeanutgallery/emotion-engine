# Phase 3 QA summary after repair

**Date:** 2026-05-14  
**Bead:** `ee-0bq3`  
**Role:** `qa`

## QA scope

Judged the repaired human-facing Phase 3 surfaces directly against the current repaired Phase 2 truth packet, not against stale benchmark expectations:

- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/recommendation/recommendation.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- upstream truth anchor: `output/cod-test/phase2-process/chunk-analysis.json`
- context: plan, forensic note, and rerun summary for this repair lane

## Executive judgment

**Go / No-Go for repaired Phase 3 usefulness and truthfulness:** **GO, with benchmark-parity debt and minor report-polish debt still open.**

Plain English: the repaired Phase 3 packet now reads like a normal human interpretation of the current Phase 1/2 evidence. The major previously misleading failure mode is gone. The output is useful enough to review, discuss, and iterate on as a product surface.

What it is **not** yet:
- **not benchmark-green**
- **not perfectly polished**
- **not perfectly internally uniform in every presentation detail**

But it is now **substantively truthful** to the current packet.

## What now makes normal human sense

### 1) Metrics now match the actual Phase 2 emotional pattern

`metrics.json` now tells the same story a human would infer from the current chunk truth:

- average boredom is modest overall (`0.2643`), not artificially inflated
- boredom is lowest in the action-heavy `95-100s` window (`0.1`)
- boredom is highest in the static promo lane at `125s` (`0.8`)
- boredom trend is `stable`, which fits the packet much better than the previously misleading `increasing`
- excitement stays strong through the action core and bottoms out at the late promo screen (`125s`)

That lines up cleanly with the underlying chunk data:
- `95-100s` and `115-120s` are low-boredom / high-excitement beats
- `120-130s` is the real boredom spike

### 2) Emotional analysis now highlights the correct friction lane

`emotional-data.json` now points to the late pre-order/promo stretch as the critical negative moment, which matches the source packet:

- boredom threshold-high at `120s`
- peak scroll-risk / boredom at `125s`
- excitement threshold-low at `125s`
- false boredom spikes at `95s` and `115s` are gone

This is the biggest truthfulness win in the repair. The output no longer accuses strong action beats of being boredom peaks.

### 3) Recommendation is now directionally honest and useful

`recommendation.json` now makes normal product sense:

- early title card hurts momentum
- middle action run is the clear strength
- static pre-order screens create the main retention risk
- post-promo action is effective but arrives after a likely drop-off lane

That recommendation is useful to a trailer editor and is grounded in the repaired metrics plus the Phase 2 chunk evidence.

The suggestions are also reasonable rather than random:
- shorten the title card
- put text over action instead of isolating it
- animate or shorten the pre-order section
- use post-promo action to keep the CTA section alive

### 4) Final report is now much more honest for a human reader

`FINAL-REPORT.md` improved in the places that mattered most:

- aggregate averages are now labeled as normalized `0-1` values instead of falsely being labeled `1-10`
- the recommendation prose in the report body uses one-based chunk references (`Chunk 4`, `Chunks 26 and 27`) that fit the report’s display conventions
- the chunk-by-chunk story broadly matches the packet: early wobble, long exciting middle, late promo drag, re-engagement after promo

As a human-facing artifact, this is now readable without immediately undermining trust.

## Remaining issues by category

### A) Benchmark parity gaps

These are real gaps, but they do **not** mean the repaired Phase 3 packet is currently misleading.

- benchmark status remains red for recommendation / metrics / emotional analysis
- refreshed benchmark scores got worse in some Phase 3 classes because the repaired outputs moved farther away from stale truth fixtures
- this is especially obvious for the old expected critical moments / scroll-risk shape and older recommendation wording expectations

**QA call:** this is mainly benchmark-truth debt, not proof that the repaired packet is lying.

### B) Report polish gaps

These do not break usefulness, but they are still worth cleanup.

1. **Recommendation JSON and final report use different chunk numbering in prose**
   - `recommendation.json` reasoning still says `Chunk 3`, `Chunks 25 and 26`
   - `FINAL-REPORT.md` humanizes that to `Chunk 4`, `Chunks 26 and 27`
   - This means the JSON artifact still leaks internal indexing while the markdown surface does not

2. **Some labels are still a little awkward or overly mechanical**
   - `frictionIndex: 100` is not self-explanatory from the product surface alone
   - some emotional-analysis threshold events read more machine-derived than editorially curated

3. **There is mild cross-surface presentation inconsistency**
   - the report is human-facing and clean enough now, but the raw JSON surfaces are still more implementation-shaped than reviewer-shaped

**QA call:** these are polish issues, not truthfulness blockers.

### C) Actual misleading output still present

Only minor residual misleading risk remains; I did **not** find a major blocker comparable to the repaired exact-`1` bug.

The main remaining misleading risk is:

1. **Chunk-numbering inconsistency between artifacts**
   - the recommendation JSON still speaks in internal zero-based chunk numbering
   - the final report presents one-based chunk numbering
   - a reviewer comparing JSON to markdown could think the model is referencing different moments

This is confusing and should be cleaned up, but it is a **small product-surface mismatch**, not a deep semantic lie.

## Bottom-line QA call

### Useful now

Yes.

A human reviewing the repaired Phase 3 packet would now come away with the correct big-picture story:
- the trailer mostly works
- the action core is strong
- the early title card is a pacing drag
- the late pre-order block is the real retention problem
- the final post-promo action is too late to fully save the draggy CTA lane

### Truthful now

Mostly yes.

The repaired packet is now truthful enough that I would trust it for internal analysis and next-step product decisions. The major prior misread of the packet has been corrected.

### Ship / use recommendation

**GO for internal use, review, and further iteration as the current truthful Phase 3 surface.**

**NO-GO if the bar is “benchmark parity is resolved” or “all presentation/indexing inconsistency is gone.”**

## Recommended next follow-up

1. Refresh Phase 3 benchmark truth fixtures to match the repaired current-world packet instead of forcing consumers back toward stale expectations.
2. Normalize chunk-numbering conventions across `recommendation.json` and report surfaces so raw JSON and markdown agree.
3. Optionally do a light editorial cleanup pass on machine-ish labels/events if this report will be shown to non-technical stakeholders.
