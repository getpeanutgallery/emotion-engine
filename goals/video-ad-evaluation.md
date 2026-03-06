# GOAL.md — Video Ad Evaluation

> **Version:** 1.0.0  
> **Status:** Active  
> **Last Updated:** 2026-03-03  
> **SemVer:** Major.Minor.Patch (breaking.feature.fix)

---

## Primary Objective

Evaluate whether this video would retain viewer attention through completion and drive desired action (engagement, click-through, conversion).

---

## Success Criteria

### Hook (0-3 seconds)

- [ ] Visual or audio hook present in first frame
- [ ] Clear stakes or curiosity gap established
- [ ] No generic intro sequences (logos, "rising tensions," etc.)

### Value Proposition (3-10 seconds)

- [ ] Viewer understands what they're watching
- [ ] Clear benefit or entertainment value communicated
- [ ] Pacing maintains attention (no dead air)

### Sustained Engagement (10s - end)

- [ ] Pattern interrupts every 5-8 seconds
- [ ] Emotional arc or narrative progression
- [ ] No significant boredom spikes (boredom < 7/10)

### Call-to-Action (if applicable)

- [ ] CTA is clear and compelling
- [ ] CTA appears at optimal moment (not too early, not rushed)
- [ ] Viewer has reason to act (incentive, urgency, relevance)

---

## Evaluation Dimensions

Track the following **per-second** throughout video duration:

| Dimension      | What It Measures                 | Critical Threshold       |
| -------------- | -------------------------------- | ------------------------ |
| **Patience**   | Willingness to continue watching | ≤ 3 = abandonment risk   |
| **Boredom**    | Level of disengagement           | ≥ 7 = scroll imminent    |
| **Excitement** | Positive arousal/engagement      | ≥ 6 = likely to complete |
| **Clarity**    | Understanding of content/purpose | ≤ 4 = confusion risk     |
| **Trust**      | Believability/authenticity       | ≤ 4 = skepticism high    |

---

## Output Requirements

### Per-Second Data

For every second of video, output:

```json
{
  "timestamp": 0,
  "visuals": "brief description of what's on screen",
  "patience": 0-10,
  "boredom": 0-10,
  "excitement": 0-10,
  "clarity": 0-10,
  "trust": 0-10,
  "thought": "internal monologue in persona voice",
  "scroll_risk": "low|medium|high|SCROLLING"
}
```

### Summary Metrics

- **Average scores** per dimension
- **Peak boredom moment** (timestamp + score)
- **Peak excitement moment** (timestamp + score)
- **Abandonment prediction** (would complete: yes/no/maybe)
- **Confidence level** (0-100%)

### Recommendations

Provide 3-5 actionable recommendations:

- Specific timestamps to address
- Concrete changes (not vague advice)
- Prioritized by impact

---

## Use Cases

### Marketing Teams

- Test ad creative before spend
- A/B test hooks and intros
- Optimize for platform (TikTok vs. YouTube vs. Instagram)

### Content Creators

- Validate video pacing
- Identify boring sections
- Improve retention rates

### Agencies

- Client presentations (data-backed creative decisions)
- Pre-flight creative review
- Post-campaign analysis

---

## Version History

| Version | Date       | Type  | Changes                 |
| ------- | ---------- | ----- | ----------------------- |
| 1.0.0   | 2026-03-03 | Major | Initial GOAL.md release |

### Versioning Policy

- **Major (1.0.0 → 2.0.0):** Breaking changes to evaluation criteria, output schema, or success metrics
- **Minor (1.0.0 → 1.1.0):** Non-breaking additions (new dimensions, expanded use cases)
- **Patch (1.0.0 → 1.0.1):** Typos, clarifications, no behavioral impact

---

*This GOAL.md is part of the OpenTruth Emotion Engine persona system. Pair with a SOUL.md (persona identity) and TOOLS.md (response schema) for complete evaluation.*
