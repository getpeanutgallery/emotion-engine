# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Audit and refine the dialogue prompt so weak but real spoken lines like `You shall know fear.` are less likely to be omitted, then rerun `cod-test` and compare the updated scores against the current scored baseline.

---

## Overview

The current dialogue benchmark shape is now much more honest than it used to be. Split/merge drift is already separated into its own scored surface, which means the main dialogue-text percentage can stay focused on actual transcript fidelity instead of getting crushed by benign boundary variance. Derrick’s current direction is to tolerate low fused/separated boundary scores when the text is otherwise right and the same speaker is involved.

That shifts the highest-value next lane away from structural scoring work and toward line-omission prevention. The known example is `You shall know fear.` — a short, heavily filtered line that is plausibly being dropped either because the prompt over-rewards conservative omission under uncertainty, or because it encourages merging weak adjacent speech into stronger surrounding lines. This pass should inspect the current prompt for anti-omission bias, revise wording to preserve weak-but-audible lines, and then validate the effect with a fresh `cod-test` rerun and benchmark comparison against the current scored run.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Dialogue score reconciliation plan that separated transcript accuracy from boundary scoring | `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md` |
| `REF-02` | Current audit of dialogue drift versus benchmark truth | `.plans/2026-04-24-audit-current-dialogue-vs-benchmark-and-traits-drift.md` |
| `REF-03` | Current dialogue prompt draft / preferred direction artifact | `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md` |
| `REF-04` | Current cod-test benchmark truth for dialogue | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-05` | Current scored dialogue benchmark surface | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-06` | Current benchmark summary | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` |
| `REF-07` | Current runtime dialogue artifact family | `output/cod-test/phase1-gather-context/` |
| `REF-08` | Memory handoff noting prompt/runtime cleanup and the missing `You shall know fear.` line | `memory/2026-04-07.md` |

---

## Tasks

### Task 1: Audit the current dialogue prompt for anti-omission bias

**Bead ID:** `ee-n1m5`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** Audit the current dialogue prompt and nearby runtime instructions in `projects/peanut-gallery/emotion-engine` with one specific question: is any wording likely to suppress weak-but-real lines such as `You shall know fear.`? Claim the bead on start. Review the prompt, current runtime dialogue outputs, benchmark truth, and scored report surfaces. Identify any prompt wording that over-rewards omission, aggressive merging, or only-high-confidence capture. Recommend exact prompt edits that preserve faint/filtered spoken lines when audibly present, while still discouraging hallucinations. Write the findings into a concise repo doc and update the plan with what actually happened.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-dialogue-prompt-anti-omission-audit.md`
- `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

**Status:** ✅ Complete

**Results:** Completed the anti-omission audit and wrote `docs/2026-04-27-dialogue-prompt-anti-omission-audit.md`. Findings: the current live prompt in `server/scripts/get-context/get-dialogue.cjs` has a contradiction that likely biases toward omission under uncertainty: it tells the model to preserve damaged speech fragments, but still frames inclusion around `intelligible` dialogue. The cod-test report confirms the weak-line failure at the target spot: truth indexes `[8,9,10]` collapsed into one output window in `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`, and `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` shows truth `You shall know fear.` being skipped while the output advances to `This isn't real.`. The recommended revision is narrow: replace `intelligible`-only scope wording with `audibly supported spoken words or spoken fragments`, explicitly state that low-confidence retention is preferred over omission for weak real lines, and add an anti-absorption rule so short weak inserts are kept as their own segments when audibly present. Also noted a nearby runtime factor: the lean validator loop accepts the first schema-valid JSON without any model-visible coverage check, so omission-biased first drafts can pass cleanly. No prompt files were changed and no rerun was performed.

---

### Task 2: Implement the agreed dialogue prompt revision

**Bead ID:** `ee-6snj`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-03`, `REF-07`  
**Prompt:** After Derrick approves the prompt direction, implement the agreed dialogue prompt wording changes in the owning prompt/runtime files. Claim the bead on start. Keep the goal narrow: reduce omission of weak-but-real spoken lines without reopening the accepted split/merge scoring tradeoff. Run the repo-local validation relevant to the touched files, update the plan with what changed, and commit/push by default before handoff unless instructed otherwise.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`
- `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

**Status:** ✅ Complete

**Results:** Implemented the approved anti-omission revision narrowly in the live dialogue runtime prompt file `server/scripts/get-context/get-dialogue.cjs` across both whole-asset and chunked prompt paths plus the shared artifact-rule scaffolding that feeds them. The change replaced `intelligible`-only inclusion/empty-output framing with `audibly supported spoken words or spoken fragments`, preserved anti-hallucination language, added explicit keep-the-fragment guidance for weak/filtered/reverberant/partly recoverable lines, added anti-absorption rules so short weak inserts are not swallowed by stronger neighbors, and added an explicit confidence counterweight telling the model to keep faint supported words at lower confidence instead of omitting them. Updated `test/scripts/get-dialogue.test.js` to assert the new approved wording in the generated prompts. Validation: `node --check server/scripts/get-context/get-dialogue.cjs`, `node --check test/scripts/get-dialogue.test.js`, and `node --test test/scripts/get-dialogue.test.js` all passed. I also ran the full `npm test` suite; it still has unrelated pre-existing failures in benchmark/config/proof-gate areas outside this change, but the touched dialogue test file is green.

---

### Task 3: Rerun cod-test and compare scores to the current baseline

**Bead ID:** `ee-6yxq`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** After the prompt revision lands, claim the bead and rerun the relevant `cod-test` flow. Compare the fresh dialogue outputs and benchmark scores against the current scored baseline. Focus on whether the rerun recovers `You shall know fear.` or other weak omitted lines, and whether the overall dialogue-text percentages improve, regress, or stay flat. Treat fused/separated boundary scoring as informational only unless it changes unexpectedly beyond the accepted tolerance. Record the exact before/after numbers and concrete line-level differences in the plan and any supporting QA note.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh cod-test output/report artifacts
- optional QA note if useful
- `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of the rerun outcome

**Bead ID:** `ee-l0l5`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the post-change rerun. Claim the bead on start. Verify whether the prompt revision actually improved omission behavior without introducing unacceptable hallucinations or other regressions. Confirm whether any recovered lines are genuinely supported by the audio and whether the score movement matches the concrete artifact diff. Close the bead only if the evidence supports the conclusion.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`

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

*Planned on 2026-04-27*