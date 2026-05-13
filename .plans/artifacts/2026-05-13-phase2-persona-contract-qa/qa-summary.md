# Phase 2 Persona Thought Contract QA Summary

**Date:** 2026-05-13  
**Task / Bead:** `ee-oz5u`  
**Role:** QA  
**Scope:** Evaluate whether the restored Phase 2 persona-thought contract is genuinely useful and grounded, rather than schema noise.

## Verdict

**Recommendation: keep the contract, with light tightening rather than rollback.**

The restored contract is worth keeping as-is at the shape level:
- required `thought` is pulling real weight
- optional `continuationThought` is justified, though it should stay rare
- optional bounded `personaMeta.scrollRisk` is useful and not noisy in the inspected reruns

The main weakness is not the schema. It is **tone calibration**: the new `thought` lines are grounded and readable, but they are a little more polished / reviewer-friendly than the sharper older `REF-06` voice. That means the contract is good enough to keep, but prompt refinement should push harder toward the punchier persona style that made the older artifacts feel more alive.

## Evidence Reviewed

### Source of truth
- `/.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`
- `/.plans/artifacts/2026-05-13-phase2-persona-contract-design/design-note.md`
- `/.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/summary.md`
- `/tmp/task3-comparator-validation/before-head-reports/artifact-results/chunkAnalysis.json` (`REF-06` comparison baseline)

### Rerun outputs inspected
- `/output/cod-thought-contract-intro-0s-10s/phase2-process/chunk-analysis.json`
- `/output/cod-thought-contract-intro-0s-10s/phase3-report/summary/FINAL-REPORT.md`
- `/output/cod-thought-contract-middle-75s-80s/phase2-process/chunk-analysis.json`
- `/output/cod-thought-contract-middle-75s-80s/phase3-report/summary/FINAL-REPORT.md`
- `/output/cod-thought-contract-promo-125s-130s/phase2-process/chunk-analysis.json`
- `/output/cod-thought-contract-promo-125s-130s/phase3-report/summary/FINAL-REPORT.md`

## QA Findings

### 1) `thought` is meaningfully persona-voiced and chunk-grounded

**Pass.** The new `thought` field is doing real work.

Representative examples:
- Intro 0s-5s:  
  `Okay, glitchy robot, fast tunnel zoom, generic 'they want you afraid' voiceover... Show me actual gameplay or I'm out.`
- Middle 75s-80s:  
  `Okay, no boring logos, just straight into the action. That slide down the hill was pretty clean. You have my attention for now.`
- Promo 125s-130s:  
  `Two whole seconds of a static pre-order screen? Are you kidding me? I'm already swiping before the explosions even start.`

Why this passes:
- The lines reference concrete chunk content: glitchy tunnel / voiceover, slide action, static preorder screen.
- The voice is recognizably impatient-teenager rather than generic analyst prose.
- The best lines make a retention judgment, not just a description.

Where it still trails `REF-06`:
- `REF-06` reasoning often feels slightly sharper and more decisive, e.g. lines like:
  - `The phrase 'RISING TENSIONS' at 0.0s is a specific trigger for instant scrolling...`
  - `Just a bunch of pre-order screens and fine print. I'm already scrolling.`
- The new `thought` lines are more human-readable than the old scored reasoning, but a touch more polished and less savage. They sound a little more like a smart reviewer and a little less like an impatient scroller having a live reaction.

Bottom line: useful and grounded now, but could be made even more persona-authentic later.

### 2) `continuationThought` adds sequence value instead of just duplicating `thought`

**Mostly pass, with one mild caution.**

Only one inspected rerun chunk emitted `continuationThought`:
- Intro 5s-10s
  - `thought`: `Okay, production value is actually insane... but this feels like generic sci-fi trailer stuff. If nothing explodes or surprises me in the next 3 seconds, I'm out.`
  - `continuationThought`: `The aesthetic is cool but I need a reason to keep watching beyond pretty graphics.`

Why it is still acceptable:
- It does add a sequence-level takeaway: the viewer has now seen enough to convert first-impression skepticism into a more stable judgment about the clip's failure mode.
- It compresses the chunk-to-chunk retention logic into a cleaner follow-on line.

Why it is not a perfect pass:
- It is **adjacent** to duplication. The continuation line restates the same criticism in calmer wording.
- It adds value, but only a little. This is the kind of example that justifies keeping the field optional and rare.

Recommendation:
- Keep `continuationThought` optional.
- Treat this intro example as near the lower bound of acceptable novelty.
- If later prompt tuning makes the second line more sequence-aware (escalation, payoff expectation, changed stance), it gets stronger fast.

### 3) `personaMeta` stayed optional and bounded

**Pass.** In every inspected rerun artifact, `personaMeta` was either absent or exactly:

```json
{ "scrollRisk": "..." }
```

Observed values:
- intro chunk 1: `medium`
- intro chunk 2: `medium`
- middle chunk: `low`
- promo chunk: `SCROLLING`

No extra keys appeared. No junk overflow appeared. No arbitrary nested persona payload appeared.

This matches the design note's intended boundary and proves the schema restoration did not reopen the old junk-drawer risk.

### 4) `scrollRisk` is useful rather than noisy

**Pass.** It is useful in the reruns because it sharpens the retention reading without bloating the main contract.

Best example:
- Promo 125s-130s: `SCROLLING`
  - This is genuinely informative because the thought already says the viewer is gone before the action starts.
  - The extra field makes that a machine-visible retention state, not just vibe.

Other examples:
- Intro chunks at `medium` are reasonable: the viewer is annoyed but not yet lost.
- Middle chunk at `low` is aligned with the strong action hook.

Caution:
- `SCROLLING` is effective here because it marks a threshold crossing, not merely a stronger adjective.
- To stay useful, it should remain sparse and tied to a clear viewer-state distinction.

### 5) Tone / utility compared with stronger older artifact style (`REF-06`)

**Mixed but favorable.**

What got better:
- The new contract gives the persona reaction a dedicated field instead of forcing it to leak through summary or emotion reasoning.
- The result is easier to scan in both raw chunk JSON and Phase 3 reports.
- The best new thoughts are more quotable and more directly useful for human review.

What `REF-06` still does better:
- Older lines often snap harder to specific retention heuristics:
  - instant scrolling triggers
  - 3-second rule
  - title-card impatience
  - “I’m already scrolling” style threshold calls
- `REF-06` often sounds slightly less filtered and more reflexive.

Net assessment:
- **Structure improved; peak voice intensity softened slightly.**
- That is not a reason to drop the contract. It is a reason to keep the contract and tune the prompt.

## Contract-Level Recommendation

### Keep
- `thought` required
- `continuationThought` optional
- `personaMeta` optional
- `personaMeta.scrollRisk` bounded

### Do not drop
- Do **not** remove `continuationThought` just because the first example is only moderately additive. Its optional nature is exactly what makes it safe.
- Do **not** promote `scrollRisk` to a required top-level field. It is working precisely because it is bounded and optional.

### Tighten later
Prompt refinement should aim for:
- slightly more immediate first-person snap
- more explicit state change when `continuationThought` appears
- preservation of chunk grounding over generic style

## Weaknesses That Matter

These are the real weaknesses I found:

1. **`continuationThought` can drift toward paraphrase.**  
   The intro example is acceptable but close to redundant.

2. **Voice is useful but slightly smoothed versus `REF-06`.**  
   The restored contract recovers persona utility, but not yet the sharpest edge of the older artifact style.

3. **Report readability is improved, but the strongest value is still in raw chunk review.**  
   The Phase 3 rendering is correct and helpful, though the core win remains the preserved Phase 2 contract itself.

None of these weaknesses make the contract not worth keeping.

## Final QA Decision

**Decision:** ✅ Keep the restored Phase 2 persona-thought contract.

**Rationale:**
- It restores a genuinely useful human-review layer.
- It is grounded in the actual chunk contents.
- It preserves schema discipline.
- It keeps `continuationThought` and `scrollRisk` in bounded, non-noisy roles.
- The remaining issues are prompt/tone calibration issues, not contract-shape issues.

## Audit Handoff

The auditor should verify:
- the inspected rerun artifacts contain exactly the bounded field shape described above
- `continuationThought` remains optional and sparse rather than default-filled
- `personaMeta` contains only `scrollRisk` in these reruns
- the recommendation is interpreted as **keep the contract, continue prompt refinement**, not “ship and forget”
- the slight tone softening versus `REF-06` is accurately captured as a calibration follow-up, not a schema failure
