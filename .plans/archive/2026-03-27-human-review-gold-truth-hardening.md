# emotion-engine: human review and gold-truth hardening for cod-test benchmark

**Date:** 2026-03-27  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Turn the `cod-test` **dialogue** benchmark fixture from bootstrap truth into a human-reviewed baseline that reflects real human expectations for the dialogue output of `emotion-engine`, so future prompt changes can be judged against trustworthy dialogue truth instead of against whatever the model happened to emit last.

---

## Overview

The benchmark system exists to solve a product problem, not just to make a green test light appear. The AI-facing prompts inside `emotion-engine` will evolve over time, and those prompt changes can alter the expected outputs of AI-centric scripts. But the original pain point that motivated this whole system was **dialogue quality**: we need a stable human-verified baseline for what the dialogue output *should* say and how it should be structured.

The current `cod-test` fixture is structurally in place and technically passing, but much of its truth corpus is still bootstrap truth copied from canonical outputs. That gives us comparison plumbing, but not yet trustworthy human dialogue truth. After the first broad review pass, the plan was intentionally narrowed: solve dialogue first, make the dialogue truth reliable, and only then broaden human hardening to other synthesis-heavy surfaces.

This narrower lane still supports the larger benchmark-corpus strategy. `cod-test` remains the seed fixture, and future fixtures should eventually let us measure prompt regressions across multiple cases. But the highest-value move here was to establish a credible gold-truth baseline for the dialogue artifact, because that is the original user pain point and the clearest place where prompt iteration needs trustworthy human comparison.

The most important first hardening target inside dialogue was **speaker identity truth**: speaker roles, names/titles, descriptions, speaking style, grounded traits, and correct line-to-speaker assignment. Derrick's review model was not to rebuild the dialogue truth corpus from scratch, but to start from the current mostly-correct AI-generated artifact and hand-edit it into a human-verified master. That meant preserving the existing dialogue structure where it was already close, while making it easy to correct wrong speaker emergence, wrong speaker/line alignment, and incomplete or inaccurate speaker descriptions by hand.

---

## Tasks

### Task 1: Review current cod-test outputs against human expectations

**Bead ID:** `ee-q6oj`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved claim the assigned bead immediately, then review the current canonical cod-test output packet and benchmark artifacts to prepare a human-review packet. Focus on whether the outputs are actually good, grounded, and useful from a human perspective rather than merely benchmark-passable. Start from output/cod-test/phase2-process/chunk-analysis.json, output/cod-test/phase3-report/metrics/metrics.json, output/cod-test/phase3-report/recommendation/recommendation.json, output/cod-test/phase3-report/emotional-analysis/emotional-data.json, output/cod-test/phase3-report/summary/summary.json, output/cod-test/phase3-report/summary/FINAL-REPORT.md, and the acceptance rerun log. Produce a concise review memo that identifies strong areas, weak areas, obvious truth mismatches, and candidate fields that need human gold-truth edits. Update the plan with exact artifacts reviewed and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-27-human-review-gold-truth-hardening.md`
- `docs/cod-test-human-review-2026-03-27.md`

**Status:** ✅ Complete

**Results:** Reviewed these exact artifacts: `output/cod-test/phase2-process/chunk-analysis.json`, `output/cod-test/phase3-report/metrics/metrics.json`, `output/cod-test/phase3-report/recommendation/recommendation.json`, `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`, `output/cod-test/phase3-report/summary/summary.json`, `output/cod-test/phase3-report/summary/FINAL-REPORT.md`, `.logs/cod-test-20260320-155949-ee-acq-clean-full.log`, `.logs/cod-test-20260326-1235-ee-dn02.log`, and the current benchmark reports under `benchmarks/fixtures/cod-test/_reports/`. Wrote the durable review memo to `docs/cod-test-human-review-2026-03-27.md`. Main findings: chunk-level summaries and the top-line recommendation are genuinely useful and largely aligned with human expectations; the weak opening and late promo/info-dump block are believable weak points; `phase3-report/emotional-analysis/emotional-data.json` contains obvious truth mismatches where low-boredom action chunks (for example `40-45s`, `65-70s`, `80-85s`, `90-95s`, and `100-105s`) are transformed into boredom=`1.0` high-risk moments, making `criticalMoments`, scroll-risk fields, and some derived severity signals non-credible as human gold truth; `frictionIndex: 100` reads overstated; and the 2026-03-26 rerun log shows benchmark failure while `_reports/benchmark-summary.json` still says pass, so the acceptance story is currently contradictory/stale. Candidate gold-truth edits should focus first on emotional-analysis-derived boredom, dominant-emotion, scroll-risk, and critical-moment fields, then on any benchmark truth copied from those fields, while keeping recommendation prose advisory unless specifically human-confirmed.

---

### Task 2: Define dialogue gold truth versus dialogue bootstrap truth

**Bead ID:** `ee-blal`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved claim the assigned bead immediately, then convert the existing review findings into a dialogue-focused truth-provenance decision for cod-test. Work specifically from the dialogue artifact and the original benchmark purpose: decide field-by-field which parts of the dialogue output should become human-reviewed gold truth now, which should remain bootstrap truth for now, and which fields should stay comparator-skipped because they are too inferred, too volatile, or not worth human editorial effort yet. Be explicit about dialogue segments, speaker labels/IDs, cleaned transcript, speaker profiles, grounded traits, inferred traits, handoff context, and any confidence-like fields. Update fixture metadata/docs so dialogue provenance is explicit, update the plan with the exact decisions, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-27-human-review-gold-truth-hardening.md`
- `benchmarks/fixtures/cod-test/fixture.json`
- `docs/cod-test-dialogue-truth-provenance-2026-03-30.md`

**Status:** ✅ Complete

**Results:** The provenance-definition work was completed implicitly by the Task 3 + Task 4 artifacts and then closed out directly on bead `ee-blal`. No extra schema or comparator change was needed beyond repo-owned fixture/documentation updates already landed. The explicit dialogue provenance decisions are now:
- **Human-reviewed gold truth now:** revised `dialogue_segments[*].text` / `speaker_id` / `speaker` ordering and assignment for the reviewed sequence; the corrected post-segment-8 recovery; `cleanedTranscript`; the reviewed `speaker_profiles[*].grounded.linked_segment_indexes`; the key grounded acoustic descriptors and inferred traits needed to keep speaker separation honest; and `handoffContext` rewritten to describe the corrected registry without pretending uncertainty is resolved.
- **Bootstrap-derived / lightly carried scaffold:** `dialogue_segments[*].confidence`, `speaker_profiles[*].label`, `speaker_profiles[*].grounded.confidence`, `totalDuration`, and the compact `summary`. These are intentionally retained for schema parity and benchmark usefulness, not promoted to fully reviewed gold truth.
- **Intentionally uncertain instead of falsely reviewed:** `spk_003` remains distinct from the later older leader, `spk_014` remains an uncertain processed antagonist voice rather than confirmed Raul, `spk_008` comms-line reuse remains likely but not overclaimed, `spk_013` remains an uncertain montage voice, and `spk_015` remains an overlap-heavy mixed-speaker bucket rather than a fake precise identity.
- **Comparator / provenance rule:** provenance stays documented in `docs/cod-test-dialogue-truth-provenance-2026-03-30.md` and referenced from `benchmarks/fixtures/cod-test/fixture.json`, rather than inventing comparator-facing provenance fields inside `truth/dialogue-data.json`.
This bead is now closed because the provenance boundary is explicit in source-owned artifacts and is consistent with the reviewed dialogue truth that actually shipped.

---

### Task 3: Apply the first human-reviewed dialogue truth edits to cod-test

**Bead ID:** `ee-prta`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved claim the assigned bead immediately, then apply the first honest human-reviewed dialogue truth edits to the cod-test fixture. Edit the dialogue truth artifact directly, preserving explicit provenance boundaries between reviewed gold truth, bootstrap truth, and comparator-skipped fields. If the current dialogue comparator needs small honest adjustments to support the reviewed provenance split, make only the minimal owning-repo changes required. Re-run the benchmark/tests needed to prove the updated dialogue truth corpus is valid. Update the plan with exact truth files changed, validation results, and any unresolved dialogue review gaps, then close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `benchmarks/fixtures/cod-test/truth/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-27-human-review-gold-truth-hardening.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `docs/cod-test-dialogue-truth-provenance-2026-03-30.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-prta`, then applied the first honest human-reviewed dialogue hardening pass directly in `benchmarks/fixtures/cod-test/truth/dialogue-data.json` while keeping the truth payload in the existing pipeline-shaped schema. Opening fixes landed exactly as reviewed: segments `0` and `1` remain `spk_001`; segment `2` stays `spk_002` / Raul Menendez with corrected reviewed text; segment `3` stays `spk_003` and now carries inferred `male`; segments `4` and `5` were reassigned from the old bootstrap `spk_004` / `spk_005` split back to `spk_001`; segment `6` remains David (`spk_006`); segment `7` remains the older general/leader (`spk_007`); and segment `8` was reassigned back to David. The wrong downstream bootstrap continuation after segment `8` was replaced with the recovered actual-order lines: uncertain processed threat (`"You shall know fear."`), younger comms voice (`"Specter one, report."` / `"Need a sitrep."`), deeper squadmate (`"This isn't real."`), separate white male squadmate (`"The hell it ain't!"`), the `Master of Puppets` lyric run, African-American female squadmate (`"Pull it together, man!"`), Raul (`"So eager to leave daddy."`), uncertain white male montage voice (`"Killing the man is a hell of a lot easier than killing the idea."`), overlap-heavy hallucination blend (`"You were never cut out to be a Mason."`), David (`"No more games! This ends now."`), promo VO (`"Get the Reznov challenge pack when you preorder now!"`), and the closing lyric tag (`"Master, master"`). To preserve provenance boundaries without adding comparator-facing schema drift, the reviewed-vs-bootstrap-vs-uncertain split was documented in `docs/cod-test-dialogue-truth-provenance-2026-03-30.md` and a fixture note was added in `benchmarks/fixtures/cod-test/fixture.json` pointing at that doc. Truth-model decisions: lyrics remain separate from scene dialogue as `spk_011`; promo VO remains separate as `spk_016`; the overlap-heavy `"You were never cut out to be a Mason."` line uses its own mixed speaker bucket (`spk_015`) instead of a false clean identity; `spk_014` (`"You shall know fear."`) stays intentionally uncertain rather than being upgraded to confirmed Raul; and `spk_013` (`"Killing the man..."`) stays an uncertain montage voice rather than being collapsed into an existing character. Smallest honest repo-owned validation found for the dialogue benchmark/fixture was the benchmark-runner unit file: `node --test test/lib/benchmark-runner.test.js` → passed (`10` tests, `0` failures). A full cod-test acceptance benchmark was not rerun because the checked-in output artifact set is known stale/misaligned relative to this freshly corrected dialogue truth, so a full compare would mostly measure old output drift rather than fixture integrity.

---

### Task 4: Document the dialogue benchmark regression workflow for future prompt iterations

**Bead ID:** `ee-ix33`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, once this plan is approved claim the assigned bead immediately, then document the intended workflow for using dialogue benchmark fixtures during future prompt iteration. Explain that dialogue prompt changes should be checked against human-reviewed dialogue truth in cod-test and future fixtures, how regressions should be interpreted, and where remaining bootstrap truth still limits confidence. Add the smallest durable doc/update needed, update the plan with exact files changed, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-27-human-review-gold-truth-hardening.md`
- `docs/cod-test-dialogue-truth-provenance-2026-03-30.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-ix33` and documented the future prompt-iteration workflow by extending the existing provenance note at `docs/cod-test-dialogue-truth-provenance-2026-03-30.md` instead of adding a new standalone doc. This was the smallest durable source-owned update because `benchmarks/fixtures/cod-test/fixture.json` already points readers at that provenance doc, so the prompt-iteration guidance now lives beside the reviewed-vs-bootstrap dialogue boundary it depends on. Added an explicit “How to use dialogue fixtures during future prompt iteration” section covering: (1) dialogue prompt changes should be checked first against the human-reviewed `cod-test` dialogue truth and then against future human-reviewed dialogue fixtures as they are added; (2) regressions on reviewed speaker assignment / reviewed line text-order / cleaned-transcript alignment / reviewed speaker grounding should be treated as high-signal until a human says the new output is better, while bootstrap-only drift should be treated as a weaker investigation signal; and (3) remaining bootstrap truth still limits confidence because only part of the dialogue payload is reviewed, `cod-test` is still a single fixture, confidence-like numeric fields remain scaffold, and the non-dialogue benchmark artifacts in this fixture are still largely bootstrap truth. Validation/check performed: re-read `docs/cod-test-dialogue-truth-provenance-2026-03-30.md` after the edit and confirmed the existing fixture metadata in `benchmarks/fixtures/cod-test/fixture.json` already references that doc, so no extra fixture/schema change was needed for discoverability.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- a durable human-review memo capturing where `cod-test` benchmark truth is credible and where it is still bootstrap or stale
- the first source-controlled human-reviewed dialogue truth pass for `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- explicit repo-owned provenance documentation for reviewed dialogue fields versus scaffold fields versus intentionally uncertain identities
- a fixture-level discoverability note in `benchmarks/fixtures/cod-test/fixture.json` pointing future readers at the provenance boundary
- a documented workflow for treating `cod-test` dialogue truth as the first real regression gate for future prompt iteration
- closed beads for all work directly associated with this plan (`ee-q6oj`, `ee-blal`, `ee-prta`, `ee-ix33`); no bead remains intentionally open for this plan

**Commits:**
- `c73edb8` - Harden cod-test dialogue truth provenance

**Lessons Learned:**
- the highest-value benchmark hardening work was not "review everything" but "review the part humans actually care about most" — dialogue identity/order truth
- provenance belongs in source-owned docs + fixture notes when the runtime schema must stay pipeline-shaped; forcing provenance into the truth JSON would have created benchmark drift for the wrong reason
- uncertainty needs to be preserved as a first-class honest outcome; mixed voices, lyrics, and promo VO are better represented as distinct or uncertain buckets than as false certainty
- full acceptance reruns are not automatically the right verification step when checked-in output artifacts are known stale relative to the newly corrected truth corpus; smaller fixture-integrity validation can be more honest

---

*Completed on 2026-03-30*
