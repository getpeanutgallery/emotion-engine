# Emotion Engine

**Date:** 2026-04-20  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Reset `benchmarks/fixtures/cod-test/truth/dialogue-data.json` into the new Phase 1 dialogue-traits source-truth format so the active `cod-test` benchmark cleanly matches the current traits + deterministic heuristics system, while preserving the prior benchmark only as archived legacy reference.

---

## Overview

Derrick confirmed the active `cod-test` fixture should now be treated as a **clean break** from the older dialogue truth shape. The current `truth/dialogue-data.json` is still the older artifact form: it includes legacy speaker-oriented fields such as `speaker`, `speaker_id`, `start`, `end`, `confidence`, and `speaker_profiles`, which do not match the newer design where dialogue source truth carries per-line trait data and deterministic grouping/heuristics own speaker assignment separately.

The previous benchmark fixture has already been cloned into `benchmarks/fixtures/.archived/cod-test (legacy)/`, which gives us a safe historical reference without forcing the active `cod-test` fixture to remain backward-compatible. That means the active lane should optimize for correctness against the new Phase 1 contract, not for mixed-format continuity with the legacy benchmark surface.

This session should focus on preparing the new canonical human-review surface for dialogue truth: define exactly what the active `dialogue-data.json` must look like, generate or migrate the first-pass artifact from the legacy truth where safe, preserve the separate `music-vocals-data.json` split, and then hand the resulting file to Derrick for review/correction before we treat it as the new golden benchmark source.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Active outdated dialogue truth artifact to replace | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-02` | Archived legacy benchmark fixture kept for history/reference | `benchmarks/fixtures/.archived/cod-test (legacy)/` |
| `REF-03` | Separate music-vocals truth artifact that should remain a sibling file | `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` |
| `REF-04` | Current runtime-aligned grouping truth artifact | `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json` |
| `REF-05` | v3 speaker-grouping heuristics ruleset | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml` |
| `REF-06` | v3 speaker-grouping heuristics contract summary | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md` |
| `REF-07` | Existing execution epic that this clean-break truth migration should unblock/support | `ee-gqnc` |
| `REF-08` | Session direction: use legacy dialogue truth as anchor, but align active truth to the new traits/heuristics model | current session + memory/2026-04-20-truth-surface.md |
| `REF-09` | New cod-test clean-break source-truth contract doc produced by Task 1 | `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md` |

---

## Tasks

### Task 1: Define the exact clean-break source-truth contract for active `cod-test` dialogue data

**Bead ID:** `ee-80cy`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-03`, `REF-05`, `REF-06`, `REF-08`, `REF-09`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, define the exact target JSON shape for the active `benchmarks/fixtures/cod-test/truth/dialogue-data.json` file under the new Phase 1 dialogue-traits architecture. Explicitly identify which legacy fields are removed, which new fields are required, what remains human-reviewable gold truth, what stays scaffold/non-gold, and how this file relates to separate sibling truth files like `music-vocals-data.json` and `speaker-grouping*.json`. The contract must preserve the clean source-truth vs deterministic-grouping boundary.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md`
- `benchmarks/fixtures/cod-test/truth/README.md`

**Status:** ✅ Complete

**Results:** Locked the clean-break active contract without migrating `dialogue-data.json` yet. Added a canonical contract doc (`REF-09`) that defines the exact required Phase 1 traits-mode shape, explicitly removes legacy speaker/timing/handoff ownership from active source truth, marks `dialogue-data.json` as the gold human-review surface for spoken dialogue only, and preserves `music-vocals-data.json` plus `speaker-grouping*.json` as sibling artifacts with separate ownership. Also added a local truth-folder README so Task `ee-b9sl` has an in-place boundary reminder. The current live `dialogue-data.json` remains intentionally nonconforming legacy shape pending Task 2 migration.

---

### Task 2: Migrate or regenerate `dialogue-data.json` from the legacy anchor into the new format

**Bead ID:** `ee-b9sl`  
**SubAgent:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, produce a first-pass clean-break replacement for `benchmarks/fixtures/cod-test/truth/dialogue-data.json` that matches the new Phase 1 traits/heuristics expectations. Use the archived legacy fixture and the currently human-reviewed dialogue truth as anchors where safe, but do not preserve legacy shape just for compatibility. Keep `music-vocals-data.json` separate. Where trait values or grouping-related outputs are inferred/generated, mark boundaries honestly so the file remains suitable for human review instead of pretending uncertain fields are gold.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/.archived/cod-test (legacy)/truth/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

**Status:** ✅ Complete

**Results:** Replaced the live `cod-test` dialogue truth with a clean-break Phase 1 source-truth artifact that now conforms to the locked Task 1 contract: top-level `schema_version`/`contract`/`summary` plus closed per-line `traits` only. Preserved the 20 spoken dialogue lines and indexes from the human-reviewed legacy truth as anchors, left lyric/chant content in `music-vocals-data.json`, and removed all legacy source-truth drift fields (`_benchmark`, `speaker_profiles`, `speaker`, `speaker_id`, timestamps, confidence, and other handoff/grouping ownership). Used conservative line-local trait assignments with honest abstention (`unknown`, `mixed`, `variable` where needed), especially for accent-family calls and the overlapping "Mason" line. No helper scripts or docs were added. Verified the migrated file with the repo validator via `server/lib/dialogue-v3-source-truth-validator.cjs` (`ok: true`, `segmentCount: 20`). Handoff for `ee-e743`: review whether any line-local trait values should be tightened after listening again, with special attention to Menendez accent-family strength, whether the filtered "You shall know fear." line should stay `processed_or_synthetic` + `reverberant`, and whether the overlapping "You were never cut out to be a Mason." line should retain the current high-abstention posture.

---

### Task 3: Prepare the human-review packet and benchmark implications

**Bead ID:** `ee-e743`  
**SubAgent:** `qa`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, independently review the proposed new `dialogue-data.json` shape and contents for human-review readiness. Summarize what Derrick needs to verify manually, which fields are intended as gold truth versus scaffold, and what benchmark/comparator surfaces will need reruns or follow-up updates once the review corrections are applied.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/review/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-human-review-packet.md`

**Status:** ✅ Complete

**Results:** Independently reviewed the migrated `truth/dialogue-data.json` against the locked clean-break contract, sibling `music-vocals` / runtime-aligned grouping artifacts, and the archived legacy truth anchor. Wrote a durable fixture-owned review packet at `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-human-review-packet.md` for Derrick’s manual pass. The packet explicitly separates gold truth (`summary`, `index`, `text`, closed per-line `traits`) from non-gold derived surfaces (`speaker-grouping*.json`, runtime `speaker_id` continuity, benchmark `_reports`). QA read: the file is structurally ready for human review and keeps the dialogue/music-vocals split honest; validator check still passes (`validateDialogueV3SourceTruthObject(...).ok === true`, 20 segments), and a targeted lyric-term sanity scan found no obvious chant/lyric leakage in the dialogue file. The packet narrows manual attention to the intended uncertainty hotspots: Menendez-related accent abstention, the filtered/reverberant posture on `"You shall know fear."`, the overlap-heavy abstention on the Mason line, and whether expository/promo lines should remain `performative` versus `neutral`. It also records the downstream follow-up: after Derrick confirms or edits gold truth, rerun the dialogue-focused benchmark/comparator surfaces first and refresh the speaker-grouping truth/comparator projections if any confirmed trait edits materially affect grouping evidence.

---

### Task 4: Audit the clean-break truth migration and decide the next execution lane

**Bead ID:** `ee-uyn9`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, audit whether the active `cod-test` dialogue truth surface has been cleanly reset to the new traits/heuristics expectations without leaking legacy contract assumptions back into the active benchmark. Verify that legacy history remains archived, the active source-truth/grouping boundary is honest, and the resulting artifact is a sound base for the next benchmark rerun and human correction pass.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/.archived/cod-test (legacy)/`
- `docs/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- audit note(s)

**Status:** ✅ Complete

**Results:** Independently audited the active clean-break dialogue truth against `REF-09`, the archived legacy fixture, the sibling music-vocals truth, and the current review packet. Wrote a durable audit note at `benchmarks/fixtures/cod-test/review/2026-04-20-dialogue-traits-audit-note.md` and corrected the truth-folder README current-state note so it no longer claims migration is still pending. Audit verdict: **pass with one explicit residual follow-up**. The active `truth/dialogue-data.json` now cleanly matches the locked traits-only source-truth contract, contains no legacy speaker/timing/confidence/grouping leakage, preserves the dialogue vs music-vocals split, and is a sound base for Derrick’s human correction pass plus the next dialogue-focused rerun. The honest remaining gap is in the sibling derived `speaker-grouping*.json` artifacts: their projection metadata still references removed legacy source fields such as `dialogue_segments[*].speaker_id` / `speaker_profiles[*]`, so grouping/comparator surfaces should be regenerated or revised before treating grouping-specific evidence as fully refreshed under the new contract.

---

## Human Review Outcome Applied

On 2026-04-20, Derrick’s confirmed line-level review decisions were applied directly to `benchmarks/fixtures/cod-test/truth/dialogue-data.json` without broadening scope beyond the approved edits.

**Applied gold-truth edits:**
- `index 2`: `accent_strength -> clear_non_neutral`, `accent_family -> hispanic`
- `index 4`: `interpersonal_stance -> confrontational`
- `index 5`: `interpersonal_stance -> confrontational`
- `index 6`: `spatial_texture -> unknown`, `affect -> tense`, `interpersonal_stance -> neutral`
- `index 7`: `accent_strength -> none_apparent`, `accent_family -> neutral_or_unmarked`
- `index 8`: `spatial_texture -> unknown`
- `index 10`: `accent_strength -> clear_non_neutral`, `accent_family -> anglophone_non_neutral`
- `index 11`: `accent_strength -> clear_non_neutral`, `accent_family -> anglophone_non_neutral`
- `index 16`: `accent_strength -> none_apparent`, `accent_family -> neutral_or_unmarked`, `interpersonal_stance -> neutral`
- `index 18`: `spatial_texture -> unknown`, `affect -> angry`, `interpersonal_stance -> confrontational`

**Explicit keep decisions preserved:**
- `index 3` kept `interpersonal_stance: performative`
- `index 9` kept all current values
- `index 14` kept `gender_presentation: feminine`
- `index 17` kept all current values
- `index 19` kept `interpersonal_stance: performative`

**Validation after edit:**
- Ran the repo validator via `server/lib/dialogue-v3-source-truth-validator.cjs`
- Result: `ok: true`, `errorCount: 0`, `segmentCount: 20`

**Follow-up boundary:**
- No reruns were started in this update pass.
- The next honest step remains the dialogue-focused comparator refresh first, followed by any needed speaker-grouping derived-artifact refresh.

## Final Results

**Status:** ✅ Complete

**What We Built:** Reset the active `cod-test` dialogue gold-truth file into the new Phase 1 traits-only contract, migrated `truth/dialogue-data.json` into that shape, prepared and executed the human review pass, applied the confirmed trait corrections, and kept the file validator-clean under the locked v3 source-truth contract.

**Reference Check:** `REF-01`, `REF-03`, `REF-05`, `REF-06`, and `REF-08` were satisfied by the contract/migration/review pass; the grouping-derived follow-up that was pending at the end of this plan was completed later in the subsequent `2026-04-20-refresh-speaker-grouping-derived-artifacts-for-traits-clean-break.md` lane.

**Commits:**
- Pending wrap-up commit/push.

**Lessons Learned:** Locking the source-truth contract before the human review pass made the edit lane much safer. Once the file shape was fixed and validator-backed, the human review could focus on real semantic decisions instead of schema confusion, and the derived grouping surfaces were cleaner to refresh as a downstream lane rather than being mixed into the truth-edit pass.

---

*Drafted on 2026-04-20*