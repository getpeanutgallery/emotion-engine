# Gemini Dialogue Speaker-Continuity Prompt Review (Editable)

**Date:** 2026-04-10  
**Owner:** Derrick (editable/approval doc)  
**Related plan:** `.plans/2026-04-10-gemini-speaker-continuity-prompt-doc.md`  
**Implementation target:** `server/scripts/get-context/get-dialogue.cjs`

---

## Purpose (why this doc exists)

This doc is a practical prompt-review sheet for Gemini dialogue speaker continuity.

We already improved speaker fragmentation in recent reruns, but we still see occasional **speaker splitting** and some **over-merge** behavior. The goal here is to tighten wording so the model:

- reuses speaker IDs when the voice is plausibly the same,
- avoids creating new IDs from weak cues,
- and still allows true speaker changes when acoustic evidence is strong.

This is written for direct editing by Derrick before implementation.

---

## Current guidance snapshot (what matters most today)

Current live prompt guidance in `get-dialogue.cjs` already includes strong continuity language in:

- `buildTranscriptionPrompt` (whole asset)
- `buildChunkTranscriptionPrompt` (chunk lane)
- `buildStructuredSpeakerHandoff` (handoff memory)

Key current rules (summarized):

1. **Continuity is acoustic, not semantic.**
2. For adjacent lines, **default reuse** of speaker_id when voice plausibly matches.
3. Before minting a new speaker_id, compare multiple cues (timbre, delivery, texture, age/gender/accent impressions).
4. Do not split only because role/style labels shift (narration/comms/promo/etc.).
5. Minor intensity/pacing/channel-texture change alone is not enough.
6. Minimize speaker-id proliferation.

Recent audits used for this review:

- `docs/research/2026-04-10-gemini-speaker-continuity-guidance-audit.md`
- `docs/research/2026-04-10-gemini-speaker-continuity-rerun.md`
- `docs/research/2026-04-10-gemini-speaker-continuity-comparison-vs-truth.md`

---

## What is likely helping

These parts should be preserved:

- **Continuity-first default** for adjacent/near-adjacent lines.
- Explicit warning that **semantic context is not identity proof**.
- Explicit anti-proliferation wording (over-fragmenting is failure mode).
- Rule that role/style labels alone should not force new speaker IDs.
- Chunk handoff reminders that continuity memory is reference-only.

Observed impact (from rerun docs): fewer distinct speaker IDs and less one-line speaker churn.

---

## What is likely still hurting (speaker splitting + occasional over-merge)

1. **Threshold ambiguity:**
   - “multiple acoustic cues provide strong positive evidence” is directionally good, but still fuzzy in practice.
   - Model may still split on one salient-but-unstable cue.

2. **Fragile cues can dominate too early:**
   - age impression, gender presentation, role/style impressions, channel texture, or intensity can be noisy and scene-dependent.

3. **No explicit "single-cue is insufficient" rule:**
   - Prompt implies this, but does not state it as a hard guardrail.

4. **No explicit anti-over-merge check near true cast handoffs:**
   - After continuity hardening, some tail lines got merged that truth separates.
   - We need a small balancing rule: keep continuity by default, but split when two or more stable cues contradict continuity.

---

## Proposed replacement wording (speaker continuity section)

> **Recommended drop-in section for both whole-asset and chunk prompts (replace current speaker rules block):**

```text
Speaker continuity rules (priority order):

1) Default to continuity.
- Speaker identity is acoustic, not semantic.
- For adjacent or near-adjacent lines, reuse the current speaker_id unless there is clear acoustic contradiction.

2) Evidence required to create a new speaker_id.
- Create a new speaker_id only when at least TWO stable acoustic signals disagree with the current voice profile.
- Stable signals: core timbre/phonation quality, persistent accent/dialect impression, and sustained delivery profile across more than a fleeting phrase.
- A single cue is never enough to mint a new speaker_id.

3) Cues that are fragile (do not split on these alone).
- Do NOT split solely on: intensity/energy shifts, pacing changes, microphone distance changes, channel/FX texture, role/style label shifts (narration/comms/promo/villain/expository), or uncertain age/gender impression changes.

4) Uncertainty behavior.
- If evidence is mixed or weak, keep the existing speaker_id and lower confidence.
- Record uncertainty in grounded descriptors/inferred traits instead of creating a new speaker bucket.

5) Anti-fragmentation guardrail.
- Minimize speaker-id proliferation.
- One-line speaker IDs are discouraged unless the line has strong, explicit acoustic contradiction against nearby continuity.

6) Anti-over-merge guardrail.
- If two or more stable acoustic signals consistently conflict with the current speaker across adjacent lines, split to a new speaker_id.
- Do not force continuity through a real voice change.
```

---

## Fragile cue handling notes (explicit reminders)

Use this as an internal checklist when editing prompt text:

- **Gender presentation:** treat as speculative; never a sole split trigger.
- **Age impression:** speculative and noisy; can drift with tone/effort.
- **Intensity/energy:** high variance inside a single speaker; not identity.
- **Channel texture (radio/PA/comms/FX):** often production effect, not new voice.
- **Role/style labels:** narration/villain/official/comms/expository are storytelling roles, not identity evidence.
- **Accent/dialect impression:** useful only when stable across enough speech, not a short stylized fragment.

---

## Derrick edit / approval section

**Status:** ⛔ Not approved yet (editable)

### Keep as-is
- [ ] continuity-first default
- [ ] anti-fragmentation rule
- [ ] uncertain => keep speaker_id + lower confidence

### Change requested
- [ ] adjust threshold wording (`TWO stable acoustic signals`)
- [ ] tighten/loosen anti-over-merge rule
- [ ] add/remove fragile cue examples
- [ ] other:

### Final approved wording to implement

```text
[DERICK: paste or edit final approved speaker continuity wording here]
```

### Approval
- Reviewer: __________________
- Date: ______________________
- Notes: _____________________

---

## Implementation reference for next Gemini run

Once approved, this document is the **implementation reference** for the next Gemini speaker-continuity update in:

- `server/scripts/get-context/get-dialogue.cjs`
  - `buildTranscriptionPrompt`
  - `buildChunkTranscriptionPrompt`
  - `buildStructuredSpeakerHandoff` (only if needed for consistency)

After implementation, run the same dialogue-only Gemini lane and compare against truth with the existing speaker-map workflow.
