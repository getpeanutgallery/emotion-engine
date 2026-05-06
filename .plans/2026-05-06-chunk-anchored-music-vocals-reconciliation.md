# Peanut Gallery Emotion Engine

**Date:** 2026-05-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement a chunk-anchored `music-vocals` reconciliation path that uses dialogue-timed evidence and chunk/window membership as timing anchors, then verify whether Phase 2 prompts gain meaningful vocals support across the music-heavy `76s–98s` window.

---

## Overview

The faster-whisper migration for `music-vocals` was worth trying, but the audit outcome was clear: it improved the lane from completely dead to partially alive, yet it still only produced narrow hook-centric support in chunks `17–19`. That means faster-whisper can remain useful as an anchor hint source, but plain lyric alignment is not strong enough to serve as the primary timing truth for repeated, overlap-heavy sung vocals in this trailer.

The next practical lane is the chunk-anchored fallback Derrick pointed at directly: use the already-timed dialogue/timestamp evidence, plus chunk membership, to estimate where the separated `music-vocals` lyric rows belong. The key discipline is to preserve identity boundaries. `music-vocals` keeps ownership of lyric text / recognized-song semantics, while dialogue-timed evidence is used only as timing support when direct lyric alignment is weak.

This lane should stay narrow and product-facing. We do not need a full redesign of every Phase 1/2 contract. We need a timing reconciliation rule that can map the canonical lyric rows onto chunk/window evidence strongly enough for prompt-level `music-vocals` support to appear across more of the target `76s–98s` region, without regressing the now-validated dialogue slice.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Faster-whisper music-vocals plan and audit verdict | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md` |
| `REF-02` | Dialogue slice completion plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md` |
| `REF-03` | Current faster-whisper music-vocals timestamp artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json` |
| `REF-04` | Current dialogue timestamp artifact with validated overlap behavior | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/dialogue-timestamps-data.reconciled.json` |
| `REF-05` | QA packet showing partial faster-whisper prompt success in chunks 17–19 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-1229-faster-whisper/qa-summary.md` |
| `REF-06` | Detailed QA evidence for the faster-whisper music-vocals attempt | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-1229-faster-whisper/chunk-grounding-rerun-evidence.json` |
| `REF-07` | Current music-vocals timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-08` | Phase 2 chunk grounding implementation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |

---

## Tasks

### Task 1: Plan the chunk-anchored reconciliation contract

**Bead ID:** `ee-l0gk`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-l0gk on start with bd update ee-l0gk --status in_progress --json. Define the narrowest practical chunk-anchored reconciliation contract for music-vocals using dialogue-timed evidence and chunk/window membership as timing anchors. Be explicit about how lyric text ownership stays with music-vocals, how dialogue timing is allowed to assist without becoming the lyric source of truth, and what concrete success/failure evidence the coder lane should gather. Update the active plan with concrete findings and close the bead only when the coder lane can proceed without ambiguity.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- read-only inspection of `server/` and current artifacts

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-chunk-anchored-music-vocals-reconciliation.md`

**Status:** ✅ Complete

**Results:** The chunk-anchored reconciliation contract is now narrowed enough for implementation.

**Decision:** use a **small hybrid**: keep the main chunk/window selection logic in **Phase 2**, but add only a **minimal Phase 1 dialogue-assisted anchor augmentation** for music-vocals rows that already exist in the canonical `music-vocals` artifact.

**Contract:**
- **Lyric text ownership stays with `music-vocals`.** The canonical `music-vocals` rows (`index`, `text`, performer metadata, recognized-song metadata) remain the only source of lyric text. No lyric text may be copied from dialogue into the music-vocals artifact as a rewrite source.
- **Dialogue timing is timing evidence only.** It may contribute `start/end` support **only** when a dialogue-timed segment clearly matches an existing `music-vocals` row after normalization. That means dialogue may help place a lyric row in time, but it may not create new lyric rows, rename rows, merge rows, or reorder the canonical lyric sequence.
- **Phase 1 scope stays tiny.** In `music-vocals` timestamp derivation, add a bounded assist pass that inspects the dialogue timestamp artifact and, for each unresolved music-vocals row, attempts a direct normalized-text match against dialogue-timed rows. When a high-confidence direct match exists, copy only the timing window onto that same music-vocals row and mark the row as dialogue-assisted timing provenance rather than native lyric alignment.
- **Allowed anchor shape:** direct text-equivalent or near-text-equivalent lyric overlap only (normalization/punctuation-insensitive). Example from current evidence: dialogue `Twisting your mind and smashing your dreams.` at `80.5s-82.5s` can assist the existing music-vocals row `Twisting your mind and smashing your dreams`.
- **Disallowed anchor shape:** speculative placement from thematic similarity, non-lyric dialogue, or timeline guessing alone. Example: `Pull it together, man.` must never produce a music-vocals anchor.
- **Phase 2 remains the chunk-grounding consumer.** Keep `buildChunkMusicVocalsContext()` as the place that turns timed rows into chunk-local context using overlap + bounded index fallback. The new Phase 1 assisted anchors simply give Phase 2 one more trustworthy timed row to work with; Phase 2 should not become a text-matching engine against dialogue.
- **Chunk/window membership remains an anchor, not a text source.** Once a music-vocals row has a trustworthy timed window — whether from lyric alignment or dialogue-assisted anchoring — Phase 2 may include that row and the already-supported bounded neighboring rows for the overlapping chunk. This preserves the existing chunk-local behavior instead of inventing a second reconciliation system.
- **No broad reorder contract in this pass.** Even if dialogue reveals lyrics earlier than some existing music-vocals indexes suggest, this pass does not rewrite canonical row order. It only attaches timing to already-existing rows and lets current chunk-window selection consume those timings.

**Why this is the narrowest practical path:**
- Current evidence already shows Phase 2 can do useful bounded chunk grounding once timed anchors exist (`chunks 17-19`).
- The biggest missing late-window support seam is that dialogue has a timed lyric-overlap segment at `80.5s-82.5s` while `music-vocals` has the corresponding lyric row unresolved.
- Adding a direct dialogue-assisted anchor in Phase 1 should expand dedicated music-vocals support without making dialogue the lyric authority or forcing a Phase 2 redesign.

**Concrete coder-lane success evidence to gather:**
- **Artifact integrity:** prove every canonical `music-vocals` row text remains verbatim before/after; no added/removed/reordered lyric rows.
- **Anchor evidence:** show at least one direct dialogue-assisted timing anchor lands on an existing unresolved music-vocals row, with explicit provenance/method that distinguishes it from native lyric alignment.
- **Representative expected case:** the existing unresolved row `Twisting your mind and smashing your dreams` should gain a timed window matching the dialogue artifact (`80.5s-82.5s`) if the direct-match pass is implemented correctly.
- **Prompt-level effect:** reconstructed or rerun Phase 2 evidence should show dedicated `music-vocals` context appears in chunk `16` (`80s-85s`) in addition to the already-seen `17-19` region, and the emitted lyric text must come from the music-vocals row, not from dialogue prompt formatting.
- **Non-regression:** dialogue chunk gating sets must remain unchanged from the current validated behavior, and no-dialogue windows must stay clean.
- **Boundedness:** only clearly matched lyric rows should gain assisted timing; unmatched or ambiguous rows should remain unresolved rather than being force-fit.

**Concrete failure evidence / reject conditions:**
- Music-vocals text is rewritten from dialogue or canonical row order is silently changed.
- Dialogue-only lines create music-vocals anchors.
- The implementation moves text matching into Phase 2 chunk grounding instead of keeping Phase 2 as a chunk-window consumer.
- The artifact gains many speculative timings without direct dialogue-row support.
- Chunk `16` still lacks dedicated music-vocals support despite the direct matched lyric row being present in both artifacts, unless coder evidence proves the row is not safely matchable under the bounded normalization rule.

Validated against `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, and `REF-08`: current faster-whisper music-vocals artifact has only two timed anchors (`89.8s-91.68s`, `92.22s-96.36s`), current dialogue artifact carries an additional lyric-overlap timing at `80.5s-82.5s`, and existing Phase 2 grounding already productively consumes timed anchors once present.

---

### Task 2: Implement chunk-anchored music-vocals timing reconciliation

**Bead ID:** `ee-y226`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-y226 on start with bd update ee-y226 --status in_progress --json. Implement the narrowest durable chunk-anchored music-vocals timing reconciliation path, using dialogue-timed evidence and chunk/window membership as timing support while preserving canonical music-vocals lyric text ownership and the already-validated dialogue behavior. Add/update targeted tests, document exact changes and validation, commit/push by default before QA, and close the bead only after the plan is updated.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-chunk-anchored-music-vocals-reconciliation.md`
- `server/lib/phase1-timestamp-derivation.cjs`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
- `test/scripts/get-music-vocals-timestamps.test.js`
- `test/scripts/video-chunks.test.js`

**Status:** ✅ Complete

**Results:** Implemented the narrow Phase 1 hybrid exactly as contracted.

**Exact changes landed:**
- `server/lib/phase1-timestamp-derivation.cjs`
  - added a bounded `findDialogueAssistedTimingMatch()` helper that only accepts a **single exact normalized-text match** from timed dialogue rows
  - extended `deriveMusicVocalsSegmentTimings()` so unresolved music-vocals rows can borrow **timing only** from that dialogue row
  - emitted explicit per-row provenance via `timing.method="dialogue_assisted_anchor"`, `timing.provenance="dialogue_text_match"`, and `timing.support={ lane:"dialogue", segmentIndex, speaker, speaker_id, text }`
  - preserved canonical lyric ownership: no row creation, no row reorder, no lyric text rewrite
  - added artifact-level provenance `provenance.dialogueTimingAssist` plus a quality note documenting the bounded policy
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
  - added optional canonical loading of `dialogueTimestampsData` so the assist can use the already-validated dialogue timing artifact without changing the faster-whisper music-vocals pass or Phase 2
- `test/scripts/get-music-vocals-timestamps.test.js`
  - added a positive test proving `Twisting your mind and smashing your dreams` gains `80.5s–82.5s` from dialogue while keeping the lyric text verbatim
  - added a negative test proving repeated ambiguous dialogue lines like `Master. Master.` do **not** get force-fit as anchors
- `test/scripts/video-chunks.test.js`
  - added a chunk-local grounding test proving the assisted music-vocals row now surfaces in the `80s` chunk as `music-vocals` context, with dialogue only visible as provenance metadata

**Validation run:**
- `node --test test/scripts/get-music-vocals-timestamps.test.js test/scripts/video-chunks.test.js`
  - passed: `50/50`

**Sample evidence against current artifacts (`REF-03`, `REF-04`, `REF-08`):**
- **Verbatim lyric-row integrity:** rebuilt `music-vocals` texts before/after were byte-for-byte identical in order (`textIntegrity=true`)
- **Explicit dialogue-assisted timing provenance:** row `index=6` / `Twisting your mind and smashing your dreams` now resolves to `start=80.5`, `end=82.5` with `method=dialogue_assisted_anchor` and dialogue support pointing to dialogue segment `14`
- **Prompt-level chunk support:** rebuilding chunk-local music-vocals context for `80s–85s` now yields exactly one `music-vocals` row — `Twisting your mind and smashing your dreams` — with grounding strategy `phase1_timestamp_overlap`; neighboring chunk `85s–90s` still shows the existing lyric-alignment-driven `Master! Master!` support
- **Dialogue non-regression checks:** chunk-local dialogue context for `80s–85s` is unchanged and still contains the dialogue row `Twisting your mind and smashing your dreams.`; a clean no-dialogue window `40s–45s` remains empty
- **Boundedness check:** ambiguous repeated dialogue lyric rows remain unresolved and do not receive speculative anchors

**Commit / push:** completed after this plan update; see final commit entry below once recorded.

---

### Task 3: QA chunk-anchored music-vocals prompt grounding

**Bead ID:** `ee-nyw7`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-08`  
**Prompt:** `Claim bead ee-nyw7 on start with bd update ee-nyw7 --status in_progress --json. Verify whether the chunk-anchored music-vocals lane now produces broader prompt-level vocals support across the 76s–98s region, while preserving healthy dialogue grounding and clean no-dialogue windows. Produce a fresh QA packet with representative prompt/artifact evidence, update the active plan, and close the bead only when the evidence packet is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-chunk-anchored-music-vocals-reconciliation.md`
- fresh QA notes/artifacts under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit the chunk-anchored music-vocals lane and recommend next step

**Bead ID:** `ee-yy5n`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-08`  
**Prompt:** `Claim bead ee-yy5n on start with bd update ee-yy5n --status in_progress --json. Independently audit the chunk-anchored music-vocals lane and decide whether prompt-level vocals grounding is now good enough to continue forward, or whether another escalation is still required. Distinguish clearly between music-vocals gains, preserved dialogue behavior, and any remaining cleanup work. Update the active plan with the verdict and close only when the recommendation is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-chunk-anchored-music-vocals-reconciliation.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Completed on YYYY-MM-DD*
