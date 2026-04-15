# Dialogue Traits vNext Package Audit

**Date:** 2026-04-15  
**Auditor:** Independent package audit (ee-6o7m)  
**Scope audited:**
- `docs/2026-04-15-dialogue-traits-full-enum-audit.md`
- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture.md`

---

## 1. Audit verdict

**Verdict: Pass with conditions (strong design package, not yet unconditional implementation lock).**

The three vNext docs are coherent with each other and remain faithful to the core closed-contract philosophy established in the 2026-04-14 source docs:
- source truth remains line text + chronology + closed per-line traits
- no source-truth speaker ownership
- no role/lore labels
- no open-ended free text in `traits`

The proposed vNext contract is a meaningful, internally consistent upgrade, especially where stored-v2 had overloaded fields. The package should proceed as the review baseline, with a small set of conditioning clarifications before implementation.

---

## 2. What the package gets right

1. **Cross-doc coherence is high.**  
   The full enum audit recommendations are reflected in the maximalist contract and aligned with the architecture note. The key structural moves (`channel_texture` split, `delivery_stance` split, `whispered`, accent expansion, sentinel semantics) are carried through consistently.

2. **Closed-contract discipline is preserved.**  
   The package does not reintroduce forbidden patterns (speaker ownership in source truth, role/lore labels, free-text traits, timing re-ownership, persisted handoff payloads).

3. **The biggest fixes target true structural overload, not taxonomy sprawl.**  
   Replacing `channel_texture` and `delivery_stance` addresses known collapse points better than adding many small labels to existing overloaded fields.

4. **Sentinel behavior is elevated to first-class policy.**  
   Defining `unknown` / `mixed` / `variable` / `none_apparent` explicitly is crucial for consistency under required-all-fields constraints.

5. **Versioning posture is honest.**  
   `traits_contract_version: "3.0.0"` is justified by breaking field-list and enum changes.

---

## 3. Recommendations that pass audit strongly

1. **Approve major version bump to `traits_contract_version: "3.0.0"`.**  
   This is clearly a breaking schema change and should not be framed as a minor revision.

2. **Approve `channel_texture` -> `transmission_medium` + `spatial_texture`.**  
   This split is strongly justified and improves annotation clarity for medium vs spatial/acoustic perspective.

3. **Approve `delivery_stance` -> `interpersonal_stance` + `delivery_overlay`.**  
   This removes a major mixed-dimension field and should improve consistency for lines with both stance and overlays (e.g., laughter).

4. **Approve `phonation` revision baseline, especially `whispered`.**  
   `whispered` is a clear high-value addition. Keeping channel/signal artifacts out of phonation is also directionally correct.

5. **Approve the architecture-note split strategy as evidence-gated by default.**  
   The pass-ownership note avoids premature hard splitting and proposes concrete criteria for when split/no-split decisions should change.

---

## 4. Recommendations that need tightening / conditions

1. **`accent_family` expansion (including `anglophone_non_neutral`) is promising but conditional.**  
   Condition for approval: explicit annotation guidance that prevents identity/geography drift, plus examples showing when to choose `unknown` over forced family calls.

2. **`interpersonal_stance` refinements (`taunting`, `seductive`, narrowed `performative`) need discriminator rules.**  
   Without concise boundary examples, these can reduce inter-rater consistency.

3. **`delivery_overlay` values (notably `crying`) need explicit evidence thresholds.**  
   Keep, but require clear “heard overlay vs inferred emotion” guidance to avoid over-inference.

4. **`transmission_medium` internal boundaries need sharper examples.**  
   Distinguish `media_playback` vs `processed_or_synthetic` vs `direct` with short canonical examples; otherwise these may become soft catch-alls.

5. **Cross-field consistency checks should be warnings/retry hints, not brittle hard failures.**  
   Especially for accent pairings and noisy lines; hard enforcement is likely to over-reject real data.

---

## 5. Recommendations to defer or reject

1. **Defer broad accent-taxonomy redesign beyond the current bounded addition.**  
   Evidence does not yet justify a larger pre-implementation accent ontology.

2. **Defer wider affect/pragmatics expansion beyond currently proposed scope.**  
   Avoid adding more emotion/stance classes until annotation consistency data exists.

3. **Reject any move that reintroduces open text, role/lore labels, or source-truth speaker ownership.**  
   This remains non-negotiable and the package is correct to keep that boundary.

4. **Defer strict contradiction hard-fails.**  
   Keep semantic contradiction logic as advisory/warning-level until observed false-positive rates are known.

---

## 6. Architecture-note verdict

**Verdict: Architecturally sound and appropriately non-premature, with minor clarity gaps.**

The pass-ownership architecture makes sensible split/no-split recommendations:
- keeps reliability/prosody close to base extraction
- marks accent as the first likely specialist candidate
- frames split decisions as evidence-driven with measurable thresholds
- avoids “split everything now” over-optimization

Minor tightening needed:
- clarify that optional future bundling of `audibility`/`overlap` does not imply removing reliability ownership from base capture
- define exactly how threshold metrics will be computed (annotation protocol and acceptance gate)

Overall: **good architecture note; safe to use as decision framework.**

---

## 7. Final operator guidance

1. **Adopt this package as the vNext review baseline.**
2. **Lock immediately:**
   - major bump to `3.0.0`
   - `channel_texture` split
   - `delivery_stance` split
   - `phonation: whispered`
3. **Gate conditionally before implementation:**
   - accent-family wording/guidance
   - stance/overlay discriminator examples
   - medium-family boundary examples
   - warning-vs-error policy for cross-field checks
4. **Do a short consistency pilot before full implementation** (focused on accent, stance/overlay, medium/spatial distinctions).

**Bottom line:** The package is coherent, philosophically aligned, and directionally strong. With a targeted tightening pass on boundary definitions, it is ready to drive implementation planning.