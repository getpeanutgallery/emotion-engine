# Phase 2 Thought Comparison — Old vs New

**Date:** 2026-05-13  
**Purpose:** Compare restored Phase 2 `thought` lines against older sharper persona-style lines for representative chunks.  
**Scope:** Intro, action-heavy middle, and promo dip.

## Method

- **Current side** comes from the restored Phase 2 rerun chunk outputs.
- **Old side** comes from the older comparator artifact (`tmp/task3-comparator-validation/before-head-reports/artifact-results/chunkAnalysis.json`).
- The comparator file does not expose a literal historical `thought` field in this artifact; the best durable old persona-style equivalents live in the `truthValue` text for chunk-level emotional reasoning.
- When an exact old time window existed, I used it.
- When the exact old window was weaker or less persona-like than the adjacent promo dip it belonged to, I used the **closest honest equivalent** and called that out explicitly.

## Comparisons

| Focus | Current chunk/window | Old comparison window | Current thought | Old thought / persona-style line | continuationThought exists? | Comparison note |
| --- | --- | --- | --- | --- | --- | --- |
| Intro opener | `0.0s-5.0s` | `0.0s-5.0s` (exact) | `Okay, glitchy robot, fast tunnel zoom, generic 'they want you afraid' voiceover. It's moving fast enough to keep me from instantly swiping, but this feels like every other shooter trailer. Show me actual gameplay or I'm out.` | `The phrase 'RISING TENSIONS' at 0.0s is a specific trigger for instant scrolling per persona profile; patience evaporates immediately despite visual chaos.` | No | **New is smoother and more readable as an internal monologue.** It sounds like a real viewer reacting beat-by-beat. **Old is sharper and harsher** because it lands one clean judgment immediately: instant scroll trigger. **Most useful:** new for product intuition, old for hard-threshold persona calibration. |
| Intro escalation | `5.0s-10.0s` | `5.0s-10.0s` (exact) | `Okay, production value is actually insane... but this feels like generic sci-fi trailer stuff. If nothing explodes or surprises me in the next 3 seconds, I'm out.` | `The Inception-style city bending and high-octane action are exactly the kind of visual punch that gets me hooked.` | Yes — `The aesthetic is cool but I need a reason to keep watching beyond pretty graphics.` | **New is more conditional and skeptical, which matches the persona contract well.** The continuation thought adds sequence continuity the old output did not surface here. **Old is cleaner and more decisive** but reads more like evaluative reasoning than a live thought. **Most useful:** new, because it carries both reaction and retention condition. |
| Action-heavy middle | `75.0s-80.0s` | `75.0s-80.0s` (exact) | `Okay, no boring logos, just straight into the action. That slide down the hill was pretty clean. You have my attention for now.` | `Immediate action with no intro fluff respects my 3-second rule; cuts happen fast enough to keep my thumb still.` | No | **New feels more human and watchable** because it reacts to a specific moment (`slide down the hill`) instead of only summarizing attention logic. **Old is sharper** because it compresses the persona into one retention rule: thumb-still / 3-second hook. **Most useful:** tie — new for scene-level feel, old for strict hook/scroll framing. |
| Promo dip | `125.0s-130.0s` | `120.0s-125.0s` (**closest honest equivalent**, same promo dip cluster) | `Two whole seconds of a static pre-order screen? Are you kidding me? I'm already swiping before the explosions even start.` | `Just a bunch of pre-order screens and fine print. I'm already scrolling.` | No | This is the clearest case where the **old line is sharper**: brutally compressed, memorable, and instantly legible as a fail state. **New is still strong** and arguably more cinematic because it contrasts the dead static screen with the too-late explosions. **Most useful:** slight edge to old for pure persona sharpness; slight edge to new for diagnosing why the rescue attempt fails. |

## Takeaways

1. The restored `thought` field is **structurally back** and now clearly useful.
2. The restored lines are generally **smoother, more scene-aware, and more conversational** than the older comparator phrasing.
3. The older comparator lines still win when Derrick wants **hard persona thresholds** in as few words as possible.
4. The strongest restored win in this sample is the **`5.0s-10.0s` intro chunk**, where the current thought plus `continuationThought` gives both persona attitude and continuity.
5. The clearest remaining tone gap is the **promo dip**, where the older language still lands a more brutally memorable rejection.

## Source Notes

- Current intro source: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-thought-contract-intro-0s-10s/phase2-process/chunk-analysis.json`
- Current middle source: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-thought-contract-middle-75s-80s/phase2-process/chunk-analysis.json`
- Current promo source: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-thought-contract-promo-125s-130s/phase2-process/chunk-analysis.json`
- Old comparator source: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/tmp/task3-comparator-validation/before-head-reports/artifact-results/chunkAnalysis.json`
