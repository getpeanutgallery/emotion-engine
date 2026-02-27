# Stateful Persona Evaluation — Design Spec

## Concept: Emotional State Chain

Instead of parallel independent evaluations, we create a **sequential chain** where each persona instance inherits the previous emotional state.

## Workflow

```
Frame 0 @ 0s:
  Input: Fresh persona + frame
  Output: Scores + State Summary → Save to disk

Frame 1 @ 2s:
  Input: Persona + Frame 0 State Summary + new frame
  Output: Updated scores + New State Summary → Save

Frame 2 @ 4s:
  Input: Persona + Frame 1 State Summary + new frame
  Output: Updated scores + New State Summary → Save

...continues until video ends...
```

## State Summary Format

```json
{
  "timestamp": 4000,
  "frameIndex": 2,
  "emotionalState": {
    "patience": 2,
    "boredom": 9,
    "excitement": 3,
    "frustration": 7,
    "cumulativeFrustration": 18,
    "attentionSpanRemaining": 1
  },
  "keyEvents": [
    "0s: Corporate intro triggered immediate annoyance",
    "2s: Glitch effects added confusion without payoff",
    "4s: Still no gameplay visible, patience depleted"
  ],
  "scrollProbability": 0.95,
  "wouldRecommend": false,
  "currentThought": "This is taking forever. 4 seconds in and still no action. About to scroll."
}
```

## Prompt Design

### Frame 0 (Fresh State)
```
You are [persona definition].

Evaluate this first frame. What's your initial reaction?

Respond with:
1. Scores (1-10) for: patience, boredom, excitement, frustration, clarity
2. Your current thought (1 sentence)
3. Key observation about this frame
```

### Frame N+1 (Stateful)
```
You are [persona definition].

Your emotional state from the previous frame:
- Patience: 2/10 (low)
- Boredom: 8/10 (high) 
- You've been watching for 2 seconds
- Last thought: "Corporate intro is boring"

Now you see this next frame at 4 seconds:
[IMAGE]

How has your emotional state changed? Have you:
- Become more bored?
- Lost more patience?
- Found something exciting?
- Decided to scroll?

Respond with:
1. Updated scores
2. Your current thought
3. What changed (if anything)
4. Are you about to scroll? (yes/no/maybe)
```

## Benefits

### 1. Emotional Trajectory
**Before (Independent):**
- 0s: Boredom 8/10
- 2s: Boredom 8/10  
- 4s: Boredom 9/10

**After (Stateful):**
- 0s: Boredom 8/10 → "Already annoyed"
- 2s: Boredom 9/10 → "Getting worse, patience dropping"
- 4s: Boredom 9/10 → "About to scroll, total loss of interest"

### 2. Scroll Prediction
With state tracking, we can identify:
- **Cumulative frustration** building over time
- **Attention depletion** (patience trending down)
- **Boredom acceleration** (getting worse, not staying constant)
- **Exact abandonment moment** ("I've had enough")

### 3. Richer Insights
Instead of "this frame is boring," we get:
- "I've been bored for 6 seconds straight"
- "My patience is depleted, one more boring frame and I'm gone"
- "This frame slightly recovered my interest, but too late"

## Tradeoffs

| Aspect | Parallel (Current) | Sequential (Proposed) |
|--------|-------------------|------------------------|
| **Speed** | Fast (70 frames × 15s ÷ parallelism) | Slow (70 frames × 15s sequential) |
| **Cost** | Lower (shorter prompts) | Higher (context added each time) |
| **Accuracy** | Snapshots | Trajectory |
| **Scroll Detection** | Frame-by-frame | Cumulative state |
| **Implementation** | Simple | Moderate |

## Token Cost Analysis

**Parallel (Current):**
- System prompt: ~500 tokens
- Image: ~1000 tokens
- Per frame: ~1500 tokens × 70 = **105,000 tokens**

**Sequential (Proposed):**
- Frame 0: ~1500 tokens
- Frame 1: ~1500 + 200 (state summary) = ~1700 tokens
- Frame 2: ~1500 + 200 = ~1700 tokens
- Total: 1500 + (69 × 1700) = **~118,800 tokens**

**Difference**: ~13,800 tokens (~$0.03 more for 70 frames)

## Implementation Strategy

### Option A: In-Memory (Lambda)
```javascript
// Keep state in memory during execution
let currentState = null;

for (const frame of frames) {
  const result = await evaluateWithState(frame, currentState);
  currentState = result.newState;
  // Store in result array
}
```

### Option B: File-Based (Local/Dev)
```javascript
// Save state to disk after each frame
for (let i = 0; i < frames.length; i++) {
  const prevState = i > 0 ? await loadState(i - 1) : null;
  const result = await evaluateWithState(frames[i], prevState);
  await saveState(i, result.newState);
  await saveResult(i, result);
}
```

### Option C: Hybrid (Production)
- Use parallel for initial scan (fast, cheap)
- Use sequential for "suspicious" sections (e.g., where boredom > 7)

## Recommended Approach: Start with Option B

For development/testing, file-based state is:
- Easy to debug (inspect state files)
- Persistent across crashes
- Simple to implement
- Good for understanding the concept

Then migrate to Option A for Lambda production.

## File Structure

```
output/
├── session-xxx/
│   ├── frame-000.json      # Full evaluation + state
│   ├── frame-001.json
│   ├── frame-002.json
│   ├── state-summary.json  # Aggregated state timeline
│   └── report.html
```

## Summary

**Your idea is excellent** — it adds ~$0.03 in cost but gets us:
1. ✅ Emotional trajectory tracking
2. ✅ Better scroll prediction  
3. ✅ More realistic persona behavior
4. ✅ Cumulative frustration metrics

**The implementation is straightforward**: sequential loop with state passed forward.

**Want me to build this now?** It would be:
1. Modify `test-30s.cjs` to use sequential evaluation
2. Add state summary generation to each frame
3. Update prompts to include "previous state" context
4. Generate timeline showing emotional journey

Should I implement the stateful version?
