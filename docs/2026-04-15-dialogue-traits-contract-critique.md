# Dialogue Traits Contract Critique (Stored v2)

**Date:** 2026-04-15  
**Status:** Design critique before implementation  
**Scope:** Current stored-v2 `dialogue-data.json` traits contract as documented in:
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `docs/2026-04-14-dialogue-traits-contract-v2-reviewed-decisions.md`
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`
- `docs/2026-04-14-dialogue-traits-mode-migration-seam.md`

---

## 1. Executive summary

The current stored-v2 dialogue traits contract is directionally strong. It makes the right architectural move by shrinking source truth down to line text, chronology, a required top-level summary, and a closed per-line traits object while explicitly removing speaker ownership, role/lore labels, persisted handoff payloads, and dialogue-owned timing.

That said, I do **not** think it is fully ready for implementation unchanged.

The biggest strengths are architectural, not taxonomic:
- the contract is intentionally narrow
- the ownership split between source truth and derived grouping is clear
- the `affect` vs `delivery_stance` separation is a real improvement
- the closed-vocabulary discipline is exactly right for a deterministic grouping follow-on stage

The biggest risks are also architectural:
- the repo still has significant legacy speaker/timing assumptions in validators, prompts, and benchmark surfaces
- several enum sets are semantically clean enough, but a few are not
- `mixed`, `variable`, and `unknown` do not yet have crisp enough semantics to keep model output stable
- a small number of important real-world line types still have no good home in the current enums

My overall recommendation is:
- **keep the core stored-v2 shape and ownership boundaries as-is**
- **revise a small number of enum sets and enum semantics before implementation**
- **treat validator/prompt/benchmark migration as a first-class implementation risk, not cleanup**

Most of the contract is already good enough. The right move is not broad expansion. The right move is a **small, disciplined tightening pass** before code lands.

---

## 2. What the current contract gets right

### A. It puts source truth in the right place

The best decision in this design is that `dialogue-data.json` stops pretending to know more than it actually knows.

It now owns only:
- line ordering
- line text
- line-local traits
- top-level summary

It explicitly does **not** own:
- speaker identity
- same-speaker continuity across lines
- `speaker_id`
- role/lore/character semantics
- persisted handoff state
- timing ownership

That is a healthier contract boundary than the older speaker-owned design.

### B. It is correctly closed

The closed-object, closed-enum posture is the right one for this layer.

Why this is good:
- it reduces prompt drift
- it makes validator behavior deterministic
- it gives the grouping lane a finite state space
- it avoids reintroducing lore/role labels through “helpful” free text
- it keeps future benchmarks auditable

This should be preserved.

### C. It distinguishes inner feeling from outward delivery

The split between:
- `affect` = apparent internal feeling state
- `delivery_stance` = outward directed/performed stance

is one of the most valuable improvements in the reviewed v2 design.

That distinction matters because lines like these are common:
- a frightened person speaking defiantly
- an angry person speaking with forced calm
- a calm person delivering a threat
- a playful/teasing line that is not emotionally happy

If implementation collapses those back together, grouping and later analysis will lose useful structure.

### D. It is intentionally compatible with deterministic grouping

The Layer A / Layer B / Layer C split in the artifact-shapes doc is good design.

Especially good:
- stable identity cues are separated from delivery cues
- production/context cues are not treated as identity by default
- gating cues are called out as gating/reliability inputs
- the source artifact is not mutated to carry grouping outputs back into truth

That separation is exactly the right shape for a traits-first architecture.

### E. It avoids the most dangerous regressions

The reviewed v2 docs explicitly forbid:
- role labels
- lore labels
- scene-function labels
- source-truth speaker ownership
- open-ended geography or identity text

That is important, because those are the exact shortcuts that would make the artifact feel richer while actually making it less trustworthy.

---

## 3. Weaknesses / blind spots

### A. Some enum families are cleaner than others

The contract is strongest where the trait captures one obvious perceptual dimension:
- `audibility`
- `pace`
- `pitch_band`
- `overlap`

It is weaker where the trait captures a fuzzier or mixed dimension:
- `phonation`
- `channel_texture`
- `accent_family`
- `affect`
- `delivery_stance`

That does **not** mean those fields are wrong. It means they need tighter semantics and, in a few cases, one additional closed value.

### B. `mixed`, `variable`, and `unknown` are not yet disciplined enough

Right now these tokens risk being used as catch-alls for different failure modes.

Those tokens should mean different things:
- `unknown` = the signal cannot be reliably judged
- `mixed` = multiple distinct values are materially present in the line
- `variable` = one speaker or one line audibly shifts over time within the line

Without a crisp style guide, models and validators will drift.

Examples of likely confusion:
- `pitch_band: variable` vs `pitch_band: unknown`
- `phonation: mixed` vs `phonation: unknown`
- `accent_strength: mixed` meaning multiple speakers vs accent shifts vs indecision
- `gender_presentation: mixed` being used for uncertainty instead of actual mixed presentation

### C. A few categories still force unnatural collapse

There are several common line situations where the current enums force the wrong bucket:
- whispered or hushed speech gets jammed into `breathy` or `clear`
- public-address / intercom audio gets jammed into `processed`, `radio`, or `phone`
- non-neutral anglophone accents get jammed into `germanic` or `neutral_or_unmarked`
- taunting/mockery gets jammed into `confrontational` or `performative`

These are not edge cases. They are common enough to matter.

### D. `accent_family` is the least mature enum family

This is the most fragile part of the current contract.

Problems:
- the set mixes linguistic-family-like labels, geographic-region labels, and identity-coded labels
- coverage is uneven
- several values are very broad while others are relatively specific
- there is no clean bucket for many common English-language accent impressions

The current set is usable as a first approximation, but it is not taxonomically balanced.

### E. Required-all-fields increases forced-guess pressure

I still agree with “all trait fields required.” It keeps the contract regular and validator-friendly.

But implementation needs to acknowledge the downside:
- if the prompt or validator wording is sloppy, models will guess instead of abstaining into `unknown`
- noisy lines will accumulate fake precision
- grouping may then over-weight invented distinctions

This is not a reason to relax the contract. It is a reason to make abstention semantics very explicit.

### F. The migration surface is larger than the docs alone imply

The reviewed docs are clean, but the repo still contains legacy speaker-era assumptions.

Concrete examples visible in the current repo:
- `server/lib/structured-output.cjs` still validates and normalizes the older speaker contract
- `server/lib/phase1-validator-tools.cjs` still describes dialogue output as speaker/timestamp oriented and shows examples with `speaker`, `speaker_id`, `start`, `end`, and `confidence`
- `server/lib/benchmark-runner.cjs` still has dialogue-default timing assumptions
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json` is still the older speaker/timing-based shape

That means the migration risk is not hypothetical. The codebase currently teaches the old contract.

---

## 4. Enum coverage review by existing key

## `audibility`

**Assessment:** Sufficient as-is.

Current values:
- `clear`
- `partially_masked`
- `heavily_masked`
- `unknown`

What works:
- the scale is short
- it is easy to explain
- it maps directly to reliability/gating use

What to watch:
- `heavily_masked` should still imply the line is transcribable enough to exist as a line
- validator/prompt guidance should discourage overusing `clear` on noisy-but-transcribed lines

Recommendation:
- **keep as-is**

---

## `overlap`

**Assessment:** Sufficient for v2, but needs semantics clarification.

Current values:
- `single_voice`
- `background_overlap`
- `competing_overlap`
- `unknown`

What works:
- the grouping lane mainly needs to know whether line-local cues are trustworthy
- this set is enough for gating and downweighting

What needs clarification:
- `background_overlap` should mean one primary readable line with non-dominant other voices/sounds behind it
- `competing_overlap` should mean material multi-voice competition that contaminates identity cues

I would **not** add a new overlap value yet. That would increase complexity fast.

Recommendation:
- **keep enum set as-is**
- add validator/prompt guidance on when to pick `background_overlap` vs `competing_overlap`

---

## `gender_presentation`

**Assessment:** Sufficient as-is.

Current values:
- `feminine`
- `masculine`
- `androgynous`
- `mixed`
- `unknown`

What works:
- the set stays at coarse perceptual presentation rather than identity
- it avoids over-precision
- it is consistent with the contract’s anti-lore / anti-biography posture

What needs clarification:
- `mixed` should mean materially mixed audible presentation in the line, not “the model is unsure”
- uncertainty should go to `unknown`

Recommendation:
- **keep as-is**

---

## `age_impression`

**Assessment:** Sufficient, but should be treated as a weak cue.

Current values:
- `child`
- `teen`
- `young_adult`
- `adult`
- `older_adult`
- `elder`
- `unknown`

What works:
- coarse bins are appropriate
- it stays in “impression” territory rather than factual age

What is weak:
- adjacent bins are inherently noisy, especially `teen` / `young_adult` / `adult`
- this field can create false certainty if over-weighted later

Recommendation:
- **keep as-is**
- grouping should treat it as a soft stable cue, not a high-confidence discriminator

---

## `pitch_band`

**Assessment:** Sufficient as-is.

Current values:
- `low`
- `mid`
- `high`
- `variable`
- `unknown`

What works:
- compact and usable
- `variable` is justified here because pitch genuinely shifts within a line

What needs clarification:
- `variable` should mean audible intra-line movement, not uncertainty

Recommendation:
- **keep as-is**

---

## `phonation`

**Assessment:** Missing one obvious value; one current value is ambiguous.

Current values:
- `clear`
- `breathy`
- `raspy`
- `nasal`
- `thin`
- `full`
- `strained`
- `distorted`
- `mixed`
- `unknown`

### Missing obvious value: `whispered`

Why it is needed:
- whispering is common in dramatic dialogue
- it is not just `breathy`
- it often affects grouping behavior and line interpretation
- forcing whispered lines into `breathy` collapses an important distinction

What distinction it captures:
- reduced or absent normal voiced phonation, hushed delivery, low-airflow speech that is intentionally whispered rather than merely airy

Example line situations where it matters:
1. A character leans in and says, “Keep your voice down.” That is `whispered`, not merely `breathy`.
2. A processed threat is still whispered under noise. Grouping should know this is a whisper-like delivery, not assume a breathy normal voice.

### Current value that looks ambiguous: `distorted`

Why it is problematic:
- distortion may come from the speaker’s own production
- or from the transmission/processing channel
- or from both

That makes `distorted` semantically unstable across `phonation` and `channel_texture`.

Recommendation:
- **revise before implementation**
- add `whispered`
- keep `distorted` for now, but define precedence rules so channel-caused distortion prefers `channel_texture` semantics when possible

---

## `pace`

**Assessment:** Sufficient as-is.

Current values:
- `slow`
- `measured`
- `fast`
- `variable`
- `unknown`

What works:
- compact
- perceptually obvious
- good as a soft cue

No obvious missing value stands out strongly enough to justify expansion.

Recommendation:
- **keep as-is**

---

## `energy`

**Assessment:** Sufficient as-is, but broad.

Current values:
- `calm`
- `steady`
- `intense`
- `variable`
- `unknown`

What works:
- simple and easy to apply
- useful as a delivery cue

What is broad/overlapping:
- `calm` can start to overlap with `affect: calm`
- `steady` is a wide middle bucket

Even so, I would avoid expanding it yet. More granularity here is likely to increase noise faster than value.

Recommendation:
- **keep as-is**
- treat as a low-weight delivery cue in grouping

---

## `channel_texture`

**Assessment:** Missing one obvious value; `processed` is too broad.

Current values:
- `clean`
- `reverberant`
- `radio`
- `phone`
- `distant`
- `processed`
- `unknown`

### Missing obvious value: `pa_or_intercom`

Why it is needed:
- public-address / intercom / loudspeaker speech is common in games, trailers, and broadcast-style media
- it is perceptually distinct from `phone` and from two-way `radio`
- it often matters for grouping because the same voice may appear both “clean” and over an intercom

What distinction it captures:
- one-to-many announcement / loudspeaker / onboard-system / overhead-address texture rather than personal phone or radio transmission

Example line situations where it matters:
1. “All personnel report to the lower deck immediately.” over a ship/intercom system.
2. A stadium or military base announcement played over loudspeakers.

### Current value that looks too broad: `processed`

Why it is problematic:
- it can absorb vocoder-like processing, pitch treatment, synthetic filtering, megaphone-like effects, and more
- it overlaps with `radio`, `phone`, and sometimes `distorted`

Recommendation:
- **revise before implementation**
- add `pa_or_intercom`
- keep `processed`, but define it as a residual bucket for obvious non-radio/non-phone/non-PA signal treatment

---

## `accent_strength`

**Assessment:** Sufficient, but `mixed` needs clarification.

Current values:
- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `mixed`
- `unknown`

What works:
- simple and useful
- separates presence-strength from family classification

What is ambiguous:
- `mixed` can mean multiple speakers, code-switching, unstable impression, or blended accent signals

Recommendation:
- **keep enum set as-is**
- define `mixed` more tightly before implementation

---

## `accent_family`

**Assessment:** Missing one obvious value; several current values are uneven or overly broad.

Current values:
- `neutral_or_unmarked`
- `hispanic`
- `slavic`
- `germanic`
- `romance`
- `south_asian`
- `east_asian`
- `southeast_asian`
- `african`
- `middle_eastern`
- `mixed`
- `unknown`

### Missing obvious value: `anglophone_non_neutral`

I am using that token name descriptively here; the exact final token can be chosen later, but the **category itself is needed**.

Why it is needed:
- many common non-neutral English-language accent impressions do not fit well in the current set
- UK/Commonwealth/Irish/Scottish/Australian/New Zealand/South African English-type impressions are common enough that forcing them into `germanic` or `neutral_or_unmarked` is a real hole
- without this bucket, one of the most common accent families in English-language media has no clean representation

What distinction it captures:
- clearly non-neutral English-language accent families that are not well represented by the current coarse set and should not be collapsed into `germanic`

Example line situations where it matters:
1. A British military briefing voice that is clearly non-neutral but not plausibly `neutral_or_unmarked`.
2. An Australian radio-style comms line that should not be forced into `germanic`.

### Current values that look too broad or uneven

#### `germanic`
Problem:
- too broad
- currently has to absorb both continental Germanic impressions and many English-variant accents that do not feel like a good fit

#### `hispanic`
Problem:
- more identity-coded than family-coded
- semantically uneven next to labels like `slavic` or `romance`

#### `african`
Problem:
- extremely broad
- covers too many distinct accent spaces to be very meaningful

I do **not** recommend a large accent-taxonomy explosion right now. That would violate the spirit of the current design. But I do recommend plugging the most obvious coverage hole before implementation.

Recommendation:
- **revise before implementation**
- add one closed bucket for common non-neutral anglophone accents
- defer any broader accent-family overhaul until after real artifact evidence is collected

---

## `affect`

**Assessment:** Good enough for v2.

Current values:
- `calm`
- `serious`
- `angry`
- `sad`
- `fearful`
- `happy`
- `sensual`
- `surprised`
- `determined`
- `mixed`
- `unknown`

What works:
- covers the most important headline emotional states
- keeps the vocabulary small enough to stay learnable
- avoids drifting into prose

What is broad:
- `serious` is not a pure emotion; it is closer to general affective tone

Even so, I would not expand this set before implementation unless real artifact evidence shows repeated collapse.

Recommendation:
- **keep as-is for v2**
- note that `serious` is broad but still serviceable

---

## `delivery_stance`

**Assessment:** Missing one obvious value; `performative` is too broad.

Current values:
- `neutral`
- `directive`
- `confrontational`
- `supportive`
- `pleading`
- `sexual`
- `laughing`
- `performative`
- `mixed`
- `unknown`

### Missing obvious value: `taunting`

Why it is needed:
- taunts/mockery are common in dramatic and game dialogue
- taunting is not always the same thing as full confrontation
- it is also not the same thing as generic performance

What distinction it captures:
- an outwardly mocking, baiting, needling, or jeering posture directed at another person

Example line situations where it matters:
1. “So eager to leave daddy.” This reads as taunting more than simply `confrontational`.
2. “You were never cut out for this.” delivered as a sneer rather than a direct command.

### Current value that looks too broad: `performative`

Why it is problematic:
- it can absorb narration, announcement voice, theatrical flourish, promo VO, speechifying, and exaggerated delivery
- that makes it a broad junk drawer if left underdefined

Recommendation:
- **revise before implementation**
- add `taunting`
- keep `performative`, but define it narrowly as overtly staged/showman-like delivery rather than any non-neutral presentation

---

## 5. Validator and migration risks

### A. The implementation surface still teaches the legacy contract

This is the highest practical risk.

The reviewed docs say stored-v2 traits mode should not own:
- `speaker`
- `speaker_id`
- `speaker_profiles`
- `confidence`
- per-line `start`
- per-line `end`
- persisted `handoffContext`

But the current repo still has validator and prompt surfaces oriented around exactly those fields.

Visible examples in the current codebase:
- `server/lib/structured-output.cjs` still validates and normalizes the speaker contract
- `server/lib/phase1-validator-tools.cjs` still describes speaker-oriented dialogue candidates and shows speaker/timing examples
- the benchmark surfaces still assume old dialogue truth

If implementation tries to “adapt” the legacy path instead of creating a clean traits-mode path, the old contract will leak back in.

### B. Prompt examples can silently overpower docs

Even with correct design docs, example JSON in validator-tool contracts tends to dominate model behavior.

If prompt examples still show:
- `speaker`
- `speaker_id`
- `start`
- `end`
- `confidence`

then models will keep emitting them.

This is especially dangerous because it will look like a small cleanup problem when it is actually source-truth drift.

### C. Benchmark truth and comparator assumptions are still on the old schema

The benchmark side is not yet ready for the new contract.

Current repo evidence:
- benchmark truth still contains speaker/timing fields
- benchmark-runner still has dialogue timing assumptions

If traits-mode implementation lands before the benchmark surface is split or migrated, the system will generate misleading “regressions” that are actually schema mismatch.

### D. Required-all-fields plus closed enums needs a real abstention policy

Validator logic should not merely reject invalid tokens. It should also shape correct abstention behavior.

Needed policy:
- prefer `unknown` over guessing
- prefer `mixed` only for actual multi-state presence
- prefer `variable` only where temporal variation is meaningful for that field

Without that, the output will be syntactically valid but semantically noisy.

### E. Semantic contradiction checks should exist, but stay lightweight

The validator should probably enforce or warn on a small number of contract-safety contradictions.

Examples worth considering:
- `overlap: single_voice` with repeated use of `mixed` on identity-like fields
- `accent_strength: none_apparent` paired with a non-neutral `accent_family`
- `audibility: heavily_masked` plus an unusually confident-looking fully specific trait profile

I would keep these as warnings or bounded retry triggers, not hard logical impossibility rules.

---

## 6. Grouping-stage implications

### A. The bucket map is right, but not all “stable” cues are equally stable

I agree with putting these in `stable_identity_cues`:
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `accent_strength`
- `accent_family`

But they should not all be weighted equally.

Suggested practical posture:
- `pitch_band` and some `phonation` values can be useful but noisy
- `age_impression` should be weak
- `accent_*` should only be trusted when audibility and overlap conditions are decent

### B. `audibility` and `overlap` should control whether a line is trusted, not just how it is scored

I would strongly recommend grouping logic like this:
- `audibility: clear` + `overlap: single_voice` → full evidence allowed
- `partially_masked` or `background_overlap` → reduced evidence
- `heavily_masked` or `competing_overlap` → do not let line seed a new speaker confidently

That is more important than fine-tuning weights.

### C. `unknown`, `mixed`, and `variable` should be neutralized, not penalized

The grouping engine should not treat these as negative mismatch evidence.

Why:
- they often represent lack of reliable observation, not positive contradiction
- penalizing them creates fake separation between noisy lines from the same speaker

### D. `channel_texture` should primarily act as a guardrail, not identity proof

This is especially important because the same speaker may appear:
- clean in one line
- on radio in the next
- over intercom later

A channel mismatch can be useful context, but should not be mistaken for strong speaker mismatch unless the overall ruleset explicitly wants that behavior.

### E. The recommended enum additions help grouping without widening source truth too much

The most justified additions all help prevent false collapse:
- `phonation.whispered` prevents whisper lines from being forced into the wrong voice-quality bucket
- `channel_texture.pa_or_intercom` prevents PA speech from being wrongly merged with phone/radio/processed buckets
- `accent_family.anglophone_non_neutral` plugs a real coverage hole
- `delivery_stance.taunting` separates common baiting dialogue from generic confrontation

These are small additions with practical payoff.

---

## 7. Prioritized recommendations

### Priority 0 — revise before implementation

#### 1. Create a clean traits-mode validator/prompt path instead of adapting the speaker path in place

This is the most important implementation recommendation.

Do not rely on legacy speaker normalization and then strip fields later.

Traits mode should have its own:
- validator contract/examples
- normalized artifact shape
- prompt examples
- strict forbidden-field checks
- benchmark configuration

If this is not done, the old contract will leak forward.

#### 2. Define exact semantics for `unknown`, `mixed`, and `variable`

This should be written down before coding.

A small rules table will pay off massively in output consistency.

#### 3. Make a minimal enum revision in four places

Recommended additions before implementation:
- `phonation`: add `whispered`
- `channel_texture`: add `pa_or_intercom`
- `accent_family`: add one closed bucket for common non-neutral anglophone accents (example name: `anglophone_non_neutral`)
- `delivery_stance`: add `taunting`

These are the smallest additions that fix the most obvious real-world coverage holes.

#### 4. Define precedence/usage rules for ambiguous current values

Especially:
- `phonation.distorted`
- `channel_texture.processed`
- `accent_strength.mixed`
- `delivery_stance.performative`

Without definitions, these become junk drawers.

### Priority 1 — implement with grouping in mind

#### 5. Treat gating cues as true reliability controls

Before weighting debates, lock these behaviors:
- noisy/overlapped lines should downweight or block stable cue use
- `unknown` / `mixed` / `variable` should not count as clean mismatch evidence
- delivery cues should stay soft

#### 6. Add lightweight semantic validator checks

Not to over-police the artifact, but to catch obvious drift patterns and retry-worthy contradictions.

### Priority 2 — defer until after early implementation evidence

#### 7. Do not explode the accent taxonomy yet

The current accent family set is uneven, but a large redesign before implementation would create more theory than value.

Fix the biggest hole now, gather artifacts, then revisit with evidence.

#### 8. Do not add more affect/delivery nuance yet

Even though one could imagine values like `warning`, `mocking`, `amused`, `disgusted`, etc., the contract should resist premature granularity.

Only `taunting` stands out as strong enough to justify addition now.

---

## 8. Recommendation posture summary

## Keep as-is

- closed source-truth philosophy
- no source-truth speaker ownership
- no role/lore/character labels
- no open-ended free-text trait fields
- required top-level `summary`
- required closed `traits` object on every line
- removal of persisted `start` / `end`
- removal of persisted `handoffContext`
- removal of persisted `speaker` / `speaker_id` / `confidence`
- the `affect` vs `delivery_stance` split
- the overall bucket split between source traits, grouping buckets, and derived grouping outputs
- these enum sets as currently scoped: `audibility`, `overlap`, `gender_presentation`, `age_impression`, `pitch_band`, `pace`, `energy`, `accent_strength`, `affect`

## Revise before implementation

- define exact semantics for `unknown`, `mixed`, and `variable`
- add `phonation: whispered`
- add `channel_texture: pa_or_intercom`
- add one closed `accent_family` bucket for common non-neutral anglophone accents
- add `delivery_stance: taunting`
- tighten definitions for `phonation.distorted`, `channel_texture.processed`, `accent_strength.mixed`, and `delivery_stance.performative`
- build a clean traits-mode validator/prompt path rather than reusing the legacy speaker-normalization path
- migrate benchmark truth/comparator surfaces so traits-mode is judged against the right contract

## Intentionally defer until later

- broader redesign of the accent taxonomy beyond the single biggest coverage hole
- finer-grained affect expansion
- finer-grained delivery-stance expansion beyond `taunting`
- reintroducing timing ownership to dialogue source truth
- reintroducing speaker ownership to dialogue source truth
- adding free-text explanatory fields inside `traits`
- any role/lore/character labels, even if they seem useful for grouping

---

## Closing judgment

The current stored-v2 contract is a **good system design with a few important pre-implementation gaps**, not a broken design.

The correct next step is **not** to reopen the whole philosophy. The philosophy is right.

The correct next step is:
1. preserve the current ownership boundary
2. tighten enum semantics
3. add a very small number of justified values
4. treat migration off the legacy speaker/timing surfaces as mandatory, not optional

If those revisions are made, the contract should be in a strong position to support deterministic grouping without regressing into speaker-owned source truth.
