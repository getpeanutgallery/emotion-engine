# TOOLS.md — Emotion Tracking System

> **Version:** 1.0.0  
> **Status:** Active  
> **Last Updated:** 2026-03-03  
> **Applies To:** All personas, all goals

---

## Overview

This document defines the **emotional lenses**, **response schemas**, and **prompt templates** used across the Emotion Engine system.

All personas use this shared schema to ensure consistent, comparable outputs regardless of which SOUL.md is active.

---

## Emotional Lenses (Composable)

Personas can track any combination of these lenses. Select based on your use case.

### Core Lenses (Always Available)

| Lens | Description | Scale | Critical Threshold |
|------|-------------|-------|-------------------|
| **Patience** | Willingness to continue watching | 1-10 | ≤ 3 = abandonment risk |
| **Boredom** | Level of disengagement | 1-10 | ≥ 7 = scroll imminent |
| **Excitement** | Positive arousal/engagement | 1-10 | ≥ 6 = likely to complete |

### Extended Lenses (Optional)

| Lens | Description | Scale | Critical Threshold |
|------|-------------|-------|-------------------|
| **Clarity** | Understanding of content/purpose | 1-10 | ≤ 4 = confusion risk |
| **Trust** | Believability/authenticity | 1-10 | ≤ 4 = skepticism high |
| **Frustration** | Annoyance or irritation | 1-10 | ≥ 7 = negative association |
| **Confusion** | Mental load/cognitive effort | 1-10 | ≥ 7 = give up risk |
| **Overwhelm** | Too much information too fast | 1-10 | ≥ 7 = tune out |
| **Flow** | In-the-zone engagement | 1-10 | ≥ 7 = optimal state |
| **Joy** | Positive emotional response | 1-10 | ≥ 6 = memorable moment |
| **Relief** | Tension release | 1-10 | Context-dependent |
| **Skepticism** | Doubt or disbelief | 1-10 | ≥ 7 = trust issue |
| **Anxiety** | Unease or worry | 1-10 | ≥ 7 = negative experience |
| **Empowerment** | Feeling capable/inspired | 1-10 | ≥ 6 = motivational |
| **Confidence** | Trust in message/brand | 1-10 | ≥ 6 = persuasion likely |
| **Cringe** | Secondhand embarrassment | 1-10 | ≥ 7 = share-negative |
| **ROI Confidence** | Perceived value for money | 1-10 | ≥ 6 = purchase likely |
| **Empathy** | Connection to subject | 1-10 | ≥ 6 = emotional investment |

---

## Response Schema (Strict JSON)

### Per-Second Analysis

```json
{
  "per_second_analysis": [
    {
      "timestamp": 0,
      "visuals": "string (max 200 chars)",
      "patience": 0,
      "boredom": 0,
      "excitement": 0,
      "clarity": 0,
      "trust": 0,
      "thought": "string (max 200 chars, persona voice)",
      "scroll_risk": "low|medium|high|SCROLLING"
    }
  ]
}
```

### Chunk Summary (8-second segments)

```json
{
  "chunk_index": 0,
  "start_time": 0,
  "end_time": 8,
  "average_scores": {
    "patience": 0,
    "boredom": 0,
    "excitement": 0
  },
  "peak_moments": [
    {
      "timestamp": 3,
      "type": "boredom_spike|excitement_peak|clarity_drop",
      "score": 9,
      "description": "string"
    }
  ],
  "summary": "string (emotional arc for this chunk)",
  "scroll_decision": "WATCHING|CONSIDERING_SCROLL|SCROLLING"
}
```

### Final Report Structure

```json
{
  "video": {
    "path": "string",
    "duration": 0,
    "chunks_analyzed": 0
  },
  "persona": {
    "id": "string",
    "name": "string",
    "soul_version": "string"
  },
  "goal": {
    "id": "string",
    "name": "string",
    "version": "string"
  },
  "tools_version": "1.0.0",
  "summary_metrics": {
    "averages": {
      "patience": 0,
      "boredom": 0,
      "excitement": 0
    },
    "peak_boredom": {
      "timestamp": 0,
      "score": 0
    },
    "peak_excitement": {
      "timestamp": 0,
      "score": 0
    },
    "abandonment_prediction": "yes|no|maybe",
    "confidence": 0
  },
  "recommendations": [
    {
      "priority": 1,
      "timestamp": 0,
      "issue": "string",
      "suggestion": "string",
      "impact": "high|medium|low"
    }
  ],
  "generated_at": "ISO8601 timestamp"
}
```

---

## System Prompt Template

Build the full system prompt by composing these sections:

```
You are {SOUL_NAME}, {SOUL_AGE}, {SOUL_DEMOGRAPHIC}.

{SOUL_CORE_TRUTH}

{SOUL_BEHAVIORAL_PROFILE}

---

YOUR EVALUATION GOAL:
{GOAL_PRIMARY_OBJECTIVE}

Success criteria:
{GOAL_SUCCESS_CRITERIA}

---

TRACK THESE EMOTIONS:
{SELECTED_LENSES}

Response format (STRICT JSON, no other text):
{TOOLS_RESPONSE_SCHEMA}

---

IMPORTANT:
- Respond ONLY with valid JSON
- Use the persona's authentic voice in "thought" fields
- Be brutally honest—this persona's job is to fail content that doesn't work
- Score every second from 0 to {VIDEO_DURATION}
- Mark scroll_risk as "SCROLLING" the moment this persona would abandon
```

---

## Scroll Risk Logic

```javascript
/**
 * Determine scroll risk based on emotional scores
 * @param {number} patience - 1-10
 * @param {number} boredom - 1-10
 * @param {number} excitement - 1-10
 * @returns {"low"|"medium"|"high"|"SCROLLING"}
 */
function calculateScrollRisk(patience, boredom, excitement) {
    // Immediate scroll conditions
    if (boredom >= 9) return 'SCROLLING';
    if (patience <= 1) return 'SCROLLING';
    
    // High risk
    if (boredom >= 7) return 'high';
    if (patience <= 3) return 'high';
    if (excitement <= 2 && boredom >= 5) return 'high';
    
    // Medium risk
    if (boredom >= 5) return 'medium';
    if (patience <= 5) return 'medium';
    if (excitement <= 4) return 'medium';
    
    // Low risk (engaged)
    return 'low';
}
```

---

## Friction Index Calculation

```javascript
/**
 * Calculate overall friction index (0-10, lower is better)
 * @param {Array} perSecondData - Array of per-second scores
 * @returns {number} Friction index (0-10)
 */
function calculateFrictionIndex(perSecondData) {
    const avgBoredom = avg(perSecondData.map(d => d.boredom));
    const avgPatience = avg(perSecondData.map(d => d.patience));
    const avgExcitement = avg(perSecondData.map(d => d.excitement));
    
    // Weighted formula
    const friction = (
        (avgBoredom * 0.4) +           // Boredom is biggest factor
        ((10 - avgPatience) * 0.35) +  // Low patience = friction
        ((10 - avgExcitement) * 0.25)  // Low excitement = friction
    );
    
    return Math.round(friction * 10) / 10;
}
```

---

## Version Compatibility

| Persona System Version | TOOLS.md Version | Compatible |
|------------------------|------------------|------------|
| 1.0.x | 1.0.x | ✅ Yes |
| 1.0.x | 2.0.x | ⚠️ Check breaking changes |
| 2.0.x | 1.0.x | ❌ No (newer persona, older tools) |

**Default behavior:** Use latest TOOLS.md version unless explicitly overridden.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-03 | Initial TOOLS.md format with 15 emotional lenses |

---

*This TOOLS.md is part of the OpenTruth Emotion Engine persona system. Pair with a SOUL.md (persona identity) and GOAL.md (evaluation objective) for complete evaluation.*
