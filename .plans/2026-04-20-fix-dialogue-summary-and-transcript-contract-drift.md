# Emotion Engine

**Date:** 2026-04-20  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Reduce the remaining `dialogueData` benchmark red by fixing the dialogue summary/transcript contract drift so post-reconciliation dialogue output matches the intended gold-truth contract more faithfully on `cod-test`.

---

## Overview

The reconciliation-path fix appears to have resolved the original dialogue-vs-music-vocals contamination bug. That means the remaining `dialogueData` failures are now more useful: they look like honest residual issues instead of lane-routing contamination. The latest audit specifically calls out dialogue summary/transcript contract drift as one of the next worthwhile improvement lanes.

This lane should stay tightly scoped. We do not want to broaden into music-vocals repair or grouping repair yet. The purpose here is to inspect the current dialogue comparator/report output, identify exactly which remaining dialogue failures are due to transcript text drift versus summary-contract drift, fix the smallest durable upstream path that produces those fields, and then rerun the relevant comparison surfaces to see whether `dialogueData` improves honestly.

The likely code surface spans the dialogue generation/finalization path, any reconciliation-aware dialogue shaping code, and the dialogue benchmark comparator expectations. The plan should preserve the clean truth boundary already established in `truth/dialogue-data.json` and avoid hand-waving away remaining mismatches.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current dialogue truth artifact | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-02` | Latest dialogue-vs-vocals post-fix audit | `docs/research/2026-04-20-cod-benchmark-postfix-dialogue-vs-vocals-audit.md` |
| `REF-03` | Latest dialogue artifact-result report | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-04` | Current benchmark summary | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` |
| `REF-05` | Reconciled dialogue runtime artifact | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-06` | Benchmark runner / comparator surfaces | `server/lib/benchmark-runner.cjs`, relevant dialogue comparator code |
| `REF-07` | Dialogue truth clean-break plan | `.plans/2026-04-20-reset-cod-test-dialogue-truth-for-phase1-traits-clean-break.md` |
| `REF-08` | Reconciliation-fix plan that just landed | `.plans/2026-04-20-fix-famous-song-reconciliation-and-benchmark-scoring-behavior.md` |

---

## Tasks

### Task 1: Audit the remaining dialogueData failures and separate transcript drift from summary-contract drift

**Bead ID:** `ee-c8ii`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, inspect the latest `dialogueData` benchmark output and identify exactly which remaining failures are transcript text drift versus summary-contract drift versus any other contract mismatch. Produce a durable note that points at the specific fields/files/code surfaces most likely responsible.

**Status:** ✅ Complete

**Results:** Audited the live `dialogueData` residuals and wrote `docs/research/2026-04-20-dialogue-data-residual-audit.md`. The remaining red cleanly separates into: (1) transcript text drift = `19` scoreable failures (`1` array-length mismatch, `15` text mismatches, `3` unmatched truth segments caused by downstream alignment shift), (2) summary-contract drift = `1` scoreable failure (`summary` still says lyrics are interspersed in dialogue), and (3) other contract mismatch = `77` errors total, where `75` are non-deferred legacy-vs-v3 shape mismatches (`schema_version`/`contract` missing; per-segment `traits` missing while legacy `speaker`/`speaker_id`/`confidence` extras remain) and `2` are the currently deferred `speaker_profiles` + `handoffContext` paths. The audit note also points coder bead `ee-tzlr` at the most likely owning surfaces: `server/scripts/get-context/get-dialogue.cjs`, `server/scripts/get-context/reconcile-famous-song-phase1.cjs`, `server/lib/phase1-baseline-resolution.cjs`, `benchmarks/fixtures/cod-test/benchmark.json`, and relevant alignment/classification logic in `server/lib/benchmark-runner.cjs`.

---

### Task 2: Implement the smallest durable fix for the dialogue summary/transcript contract drift

**Bead ID:** `ee-tzlr`  
**SubAgent:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-05`, `REF-06`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, implement the smallest durable upstream fix that reduces the audited dialogue summary/transcript contract drift on `cod-test` without broadening into unrelated music-vocals or grouping work. Update tests/validation if appropriate.

**Status:** ✅ Complete

**Results:** Re-scoped the fix to the clarified primary target: benchmark routing was the dominant contract-family bug, so the durable change was to let benchmark manifest entries explicitly route a logical artifact (`dialogueData`) to a different runtime artifact family (`dialogueV3SourceTruth`) without renaming the scored artifact key. Implemented `runtimeArtifactKey` support in `server/lib/benchmark-runner.cjs` and alias-aware path resolution in `server/lib/phase1-baseline-resolution.cjs`, then pointed both `benchmarks/fixtures/cod-test/benchmark.json` and `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json` at the v3 dialogue runtime family. Added focused coverage in `test/lib/benchmark-runner.test.js` proving a `dialogueData` benchmark entry can now score against `dialogue-v3-source-truth(.reconciled).json` instead of the legacy `dialogue-data(.reconciled).json` family. Validation stayed honest: `node --test test/lib/benchmark-runner.test.js` passed, and a real `runBenchmarkStage` rerun against `configs/cod-test.yaml` showed the dialogue benchmark now resolves to `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`, collapsing the previous legacy-vs-v3 structural-error lane into ordinary scored failures (`104/288` scoreable fields passed, `184` remaining fails, `0` errors). I deliberately did **not** broaden into transcript regrouping/music-vocals work, and I left the stale spoken-dialogue summary wording untouched here because routing was the main required fix and summary rewriting would have required a separate content-contract decision.

---

### Task 3: QA the post-fix dialogue artifact and rerun the relevant dialogue comparison surface

**Bead ID:** `ee-eq3c`  
**SubAgent:** `qa`  
**References:** `REF-01`, `REF-03`, `REF-05`, `REF-06`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, verify that the post-fix dialogue artifact reflects the intended contract more faithfully and rerun the relevant dialogue comparison/report surface. Confirm what improved, what stayed red, and whether the improvement is honest.

**Status:** ✅ Complete

**Results:** Verified the routing fix with a targeted `dialogue-only` benchmark rerun plus a confirming full `cod-test` benchmark refresh against the existing `output/cod-test` artifacts, and wrote the durable QA note `docs/research/2026-04-20-dialogue-routing-fix-qa-verification.md`. Confirmed both `benchmarks/fixtures/cod-test/benchmark.json` and `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json` now keep `artifactKey: "dialogueData"` while routing runtime resolution through `runtimeArtifactKey: "dialogueV3SourceTruth"`. The benchmark resolver now lands on `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`, and the refreshed dialogue report records that exact output path. The important improvement is real: the old legacy-vs-v3 structural mismatch lane is gone from the dialogue surface (`0` dialogue errors now, where the prior audit recorded `75` non-deferred legacy-vs-v3 shape errors plus `2` deferred-path errors), leaving only `reconciled_post_processing_contract_mismatch` failures. The result is still honestly red, not green: the dialogue-only surface now reports `104/288` scoreable fields passed with `184` remaining fails, driven by genuine v3-vs-truth content drift such as stale summary wording, `20`-vs-`17` dialogue segment count mismatch, transcript text drift, and heavy trait mismatches. This QA pass validates the routing/contract-family fix while explicitly preserving that overall dialogue parity remains unfinished.

---

### Task 4: Consolidate the readiness call for the next residual lane

**Bead ID:** `ee-ucs4`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, consolidate the audit/implementation/QA results into a crisp summary. State whether dialogue summary/transcript drift is materially improved, what remains red honestly, and what residual lane should be prioritized next.

**Status:** ✅ Complete

**Results:** Consolidated the operator-facing readiness call after the audit (`REF-02`/Task 1), routing implementation (Task 2), and QA rerun (`REF-03`/`REF-04`). Honest outcome: dialogue summary/transcript drift is **materially improved only in the sense that the benchmark now routes through the intended v3/new-golden-truth artifact family and the old legacy-vs-v3 structural mismatch lane is gone**. The dialogue lane is **not green overall**. Remaining red is genuine content drift on the v3 surface: the summary still incorrectly says dialogue is interspersed with song lyrics, dialogue segment count is still `20` vs `17`, transcript text still drifts/misaligns, and many v3 trait fields still disagree with truth. Residual priority recommendation: stay on the dialogue lane, but prioritize **transcript segmentation/text recovery first** (restore missing comms lines, stop split/merge drift, then clean the summary string) because that lane is now the main source of honest downstream mismatch and is likely to collapse the largest share of remaining dialogue red before trait-only tuning.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Landed the benchmark-routing fix so `dialogueData` now scores against the v3/new-golden-truth runtime artifact family instead of the legacy dialogue artifact family, then verified that the old structural contract-family mismatch lane disappeared from the dialogue surface. The result is a cleaner, more honest benchmark: dialogue red now reflects real v3-vs-truth content drift instead of routing drift.

**Reference Check:** `REF-02` residual-audit findings were incorporated into the Task 2 targeting and Task 4 summary; `REF-03` and `REF-04` now confirm the routed dialogue output path, `104/288` scoreable dialogue fields passed, `184` dialogue fails remain, and `0` dialogue errors remain. Deliberate non-claim: this plan did **not** achieve dialogue parity or make the dialogue lane green.

**Commits:**
- See Task 2 implementation handoff for the routing-fix commit(s); this Task 4 pass added only plan-state documentation.

**Lessons Learned:** Routing/contract-family drift can mask the real problem. With routing fixed, the remaining dialogue failures are finally useful: summary wording, transcript segmentation/text alignment, and v3 trait truth drift should now be treated as separate residual content lanes, with transcript recovery first.

---

*Drafted on 2026-04-20*