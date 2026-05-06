# Peanut Gallery Emotion Engine

**Date:** 2026-05-06  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Investigate and fix the `index 6` placeholder leak in grounded Phase 2 dialogue prompts, and rename the misleading `Global Dialogue Context` prompt heading so the prompt contract accurately describes chunk-filtered timestamp-grounded dialogue support.

---

## Overview

The latest bounded rerun established that prompt-level chunk-local dialogue grounding is now working in practice, but it also exposed one cosmetic/correctness leak: chunk `5` still shows `index 6: Speaker 3: We're bringing peace and security to the world.` inside an otherwise grounded prompt. Based on the QA packet, this appears tied to one of the `3` unresolved dialogue segments in `dialogue-timestamps-data.reconciled.json`, and it may be leaking because the chunk-grounding path preserves a bounded unresolved span between timed neighbors. We should verify whether that is in fact the cause, whether the behavior is intentionally broad, and why it surfaced here but not elsewhere.

Separately, the prompt heading `Global Dialogue Context (ordered support only)` is now misleading. The source pool is the full asset, but the inserted support is chunk-filtered by timestamp overlap. That wording should be revised so human reviewers and future prompt audits do not mistake the current behavior for whole-run transcript spill.

This lane should stay narrow. First investigate the exact root cause of the placeholder leak by tracing the unresolved segment and the prompt assembly path. Then fix the prompt assembly or selection behavior so unresolved placeholder entries no longer surface as if they were real timed support, while preserving the validated overlap parity and clean no-dialogue windows. In parallel or immediately after, update the heading/copy for the dialogue support section to reflect the true contract. Then rerun a bounded Phase 1→Phase 2 packet or a targeted validation slice as needed, followed by QA and audit to ensure we did not regress the already-working grounding behavior.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Latest patched plan with validated dialogue grounding and known remaining issues | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-patch-bounded-phase2-rerun-to-include-timestamps.md` |
| `REF-02` | QA summary for the patched rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-0944-with-timestamps/qa-summary.md` |
| `REF-03` | Detailed QA evidence JSON including chunk `5` and clean-window examples | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-0944-with-timestamps/chunk-grounding-rerun-evidence.json` |
| `REF-04` | Phase 1 dialogue timestamp artifact for the validated rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/dialogue-timestamps-data.reconciled.json` |
| `REF-05` | Representative prompt showing the `index 6` placeholder leak | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/_meta/ai/_prompts/8d9f36d3c8be30a3db9330342a289e0681932b7ff3183854aa7b8b0d90258b13.json` |
| `REF-06` | Representative prompt showing healthy grounded dialogue | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/_meta/ai/_prompts/3c0bb0a6eb99c30e17e51e920b35e0924cec1a64335a098dd1ca722860bba889.json` |
| `REF-07` | Representative prompt showing a clean no-dialogue window | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/_meta/ai/_prompts/196e5e513ca7a6b6267bc1f2b64abf7750c493a224de018a966344f42c066695.json` |
| `REF-08` | Phase 2 chunk grounding implementation / prompt assembly path | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |

---

## Tasks

### Task 1: Investigate the `index 6` placeholder leak root cause

**Bead ID:** `ee-grqn`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-08`  
**Prompt:** `Claim bead ee-grqn on start with bd update ee-grqn --status in_progress --json. Trace exactly why chunk 5 surfaced the unresolved placeholder line 'index 6' in the prompt, determine whether it came from bounded unresolved-span carry-through or another fallback path, and explain why the issue appears here but not broadly elsewhere. Update the active plan with concrete findings and exact code/artifact evidence, then close bead ee-grqn only when the coder lane has an unambiguous root-cause statement.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- read-only inspection of `server/` and `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md`

**Status:** ✅ Complete

**Results:** Root cause is unambiguous: the leak comes from the bounded unresolved-span carry-through inside `selectChunkLocalTimedSegments(...)`, not from the source-segment fallback path and not from prompt-only formatting inventing extra rows. Exact code path: `server/scripts/process/video-chunks.cjs:1193-1222` first collects timed overlaps, then expands selection to every segment whose `sourceIndex` falls between the minimum and maximum overlapping indexes, and marks `usedBoundedIndexFallback: true` whenever any selected segment lacks a finite window. `buildChunkDialogueContext(...)` at `server/scripts/process/video-chunks.cjs:1292-1345` uses that timed selection directly and therefore keeps strategy `phase1_timestamp_overlap`; the fallback branch at `1321-1327` never runs for this case because `selectedSegments.length > 0`.

Concrete artifact evidence: in `REF-04`, segment `index: 5` is aligned at `23.22-27.02`, segment `index: 6` (`Speaker 3: We're bringing peace and security to the world.`) is `timing.status: "unresolved"` with no `start`/`end`, and segment `index: 7` is aligned at `27.88-29.88`. For chunk 5, `REF-05` shows the window `25.0s-30.0s` and includes exactly those three rows, with the middle unresolved row rendered as `index 6` because `formatSegmentRangeForPrompt(...)` in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs:152-159` falls back to `index ${segment.index}` when `start`/`end` are missing, and the dialogue section writer at `215-217` prints every selected segment verbatim.

Why it appears here but not broadly elsewhere: this bounded carry-through only leaks unresolved placeholders when an unresolved segment is chronologically sandwiched between timed overlaps that both intersect the same chunk window. Reproduced against the current helper export: `selectChunkLocalTimedSegments(segs, 25, 30)` returns indexes `[5, 6, 7]` with `timedOverlapCount: 2` and `usedBoundedIndexFallback: true`, which is exactly the leak case. The other unresolved dialogue rows in `REF-04` are indexes `15` and `16`, but chunk-local windows around them do not bracket them with overlapping timed neighbors; e.g. `selectChunkLocalTimedSegments(segs, 80, 85)` returns only `[14]` and `selectChunkLocalTimedSegments(segs, 85, 90)` returns only `[17]`, both with `usedBoundedIndexFallback: false`. A prompt grep across `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/_meta/ai/_prompts/` found the leaked text only in `REF-05`, which matches the narrow reproduction.

Narrowest safe fix direction for coder lane: keep the current timestamp-overlap selection behavior for aligned segments, but suppress unresolved dialogue placeholders at prompt assembly or immediately after timed selection for the dialogue lane only. The safest minimal patch is to preserve bounded carry-through metadata internally if useful, while filtering dialogue prompt entries to segments with finite `start`/`end` (or at minimum excluding `timing.status === "unresolved"`) before rendering the dialogue support block. That removes the bogus `index 6` row without changing the validated overlap rows `5` and `7`, without invoking the broader source fallback, and without widening scope into music/music-vocals behavior.

---

### Task 2: Fix the placeholder leak and rename the dialogue heading

**Bead ID:** `ee-plo0`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-plo0 on start with bd update ee-plo0 --status in_progress --json. Implement the narrowest durable fix so unresolved placeholder dialogue entries like 'index 6' no longer leak into grounded prompts, while preserving validated overlap parity and clean no-dialogue windows. Also rename the misleading dialogue prompt heading/copy to exactly 'Timestamp-Grounded Dialogue Context' so it describes chunk-filtered timestamp-grounded support rather than sounding like whole-run global transcript context. Add/update targeted tests as needed, document exact changes, and commit/push by default before QA.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- sibling prompt owner: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md`
- `server/scripts/process/video-chunks.cjs`
- `test/scripts/video-chunks.test.js`
- `test/scripts/emotion-lenses-tool.test.js`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-plo0` and landed the narrowest durable fix at the dialogue-lane seam instead of broadening the shared timed-selection helper. In `server/scripts/process/video-chunks.cjs`, `buildChunkDialogueContext(...)` now preserves `selectChunkLocalTimedSegments(...)` overlap parity/metadata (`timedOverlapCount`, `usedBoundedIndexFallback`, `phase1_timestamp_overlap`) but filters the selected timestamp rows through `hasFiniteSegmentWindow(...)` before they are exposed to the prompt-visible `dialogueContext.segments`. That removes unresolved placeholder entries like `index 6` from grounded dialogue prompts without changing the validated timed rows on either side and without altering the honest empty-window fallback behavior when a chunk has no overlapping timed dialogue.

The heading/copy fix stayed exactly where that prompt text is owned: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` now renders the dialogue section heading as exactly `Timestamp-Grounded Dialogue Context`, and the supporting sentence now says the context is filtered by timestamp overlap rather than implying whole-run global support. That sibling prompt-owner change is committed/pushed as `tools@9179d9b` (`Rename timestamp-grounded dialogue prompt heading`).

Targeted regression coverage was updated in-repo: `test/scripts/video-chunks.test.js` now verifies that the bounded `[5, 6, 7]` reproduction still reports `usedBoundedIndexFallback: true` and `phase1_timestamp_overlap`, but only prompt-safe timed rows `5` and `7` survive into `dialogueContext.segments`; it also adds a direct helper test for the exact unresolved-placeholder reproduction from `REF-04`/`REF-05`. `test/scripts/emotion-lenses-tool.test.js` now asserts the new exact heading text and rejects the old `Global Dialogue Context (ordered support only)` wording.

Validation/evidence: `node --test test/scripts/video-chunks.test.js test/scripts/emotion-lenses-tool.test.js` passed (`59` tests, `0` failed) after the patch. The passing assertions are the bounded evidence that the coder lane preserved the already-working overlap behavior from `REF-06`, kept clean no-dialogue windows aligned with the existing fallback contract from `REF-07`, and removed the unresolved placeholder leak reproduced from `REF-04`/`REF-05`. The engine-side fix/plan/test update is committed/pushed as `emotion-engine@67c70fc` (`Filter unresolved dialogue placeholders from chunk prompts`).

---

### Task 3: QA the new prompt contract and placeholder behavior

**Bead ID:** `ee-m2p7`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-m2p7 on start with bd update ee-m2p7 --status in_progress --json. Verify that the placeholder leak is gone, the renamed dialogue section appears consistently as 'Timestamp-Grounded Dialogue Context', dialogue-overlap prompts still receive the correct chunk-local support, and no-overlap windows remain clean. Produce a fresh QA packet with representative before/after examples, update the active plan, and close bead ee-m2p7 only when the evidence packet is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md`
- fresh QA notes/artifacts under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit the fix and decide whether the dialogue slice is human-verified complete

**Bead ID:** `ee-3t6j`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-08`  
**Prompt:** `Claim bead ee-3t6j on start with bd update ee-3t6j --status in_progress --json. Independently audit the placeholder-leak fix and prompt-heading change. Confirm whether the dialogue grounding slice is now human-verified complete enough to leave behind and shift cleanly into music-vocals timing. Update the active plan with the verdict and close bead ee-3t6j only when the recommendation is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md`

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
