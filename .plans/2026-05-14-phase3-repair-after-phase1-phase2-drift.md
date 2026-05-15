# Peanut Gallery Emotion Engine

**Date:** 2026-05-14  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Repair Phase 3 reporting and benchmark consumers so they truthfully consume the newly re-stabilized Phase 1 and Phase 2 surfaces, then verify whether the current `cod-test` packet is useful, grounded, and ready for the next phase of work.

---

## Overview

Phase 2 proof readiness is now good enough to graduate toward Phase 3: the canonical `cod-test` lane once again produces `phase2-process/chunk-analysis.json`, and the earlier continuity blocker class has been cleared on a fresh repaired packet. But the full pipeline remains benchmark-red downstream, and the current failure surface strongly suggests that Phase 3 is still carrying stale assumptions from older pipeline eras.

That matches Derrick’s intuition. We changed Phase 1 and Phase 2 substantially since the last serious Phase 3 work: dialogue capture/reconciliation evolved, chunk-analysis gained persona-thought continuity fields, and the proof lane itself temporarily drifted before being restored. Phase 3 scripts, report shaping, and benchmark consumers may now be semantically outdated even if they still run. The key question is no longer whether Phase 2 can produce a proof artifact — it can. The question is whether Phase 3 is interpreting the newer upstream truth honestly.

This plan treats Phase 3 as its own repair lane. First, do a forensic review of the current benchmark-red Phase 3 surface against the fresh repaired `cod-test` packet and the historical archived Phase 3 plans. Then implement the narrowest truthful repairs in Phase 3/reporting consumers. After that, rerun the relevant validation lane, QA the resulting recommendation/metrics/emotional-analysis/final-report outputs for usefulness and grounding, and finish with an independent audit that decides whether Phase 3 is actually repaired or merely less broken.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Fresh Phase 2 proof-contract-fix plan and final handoff state | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase2-proof-contract-fix.md` |
| `REF-02` | Fresh repaired proof-lane audit confirming Phase 2 clears toward Phase 3 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase2-proof-contract-fix/audit-summary.md` |
| `REF-03` | Current benchmark failure surface for `cod-test` | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-04` | Current benchmark JSON details for failing artifacts and metrics | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` |
| `REF-05` | Fresh repaired Phase 2 proof artifact now feeding Phase 3 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json` |
| `REF-06` | Current Phase 3 final report from the repaired packet | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md` |
| `REF-07` | Historical memory note for prior Phase 3 recommendation repair lane | `/home/derrick/.openclaw/workspace/memory/2026-03-12.md` |
| `REF-08` | Archived Phase 3 repair plans from the earlier Phase 3 work burst | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/archive/2026-03-12-prioritize-phase3-json-validation-and-grounding.md` |
| `REF-09` | Additional archived Phase 3 validation plan from the same era | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/archive/2026-03-15-live-phase3-validation-under-upgraded-recovery.md` |

---

## Tasks

### Task 1: Forensic audit of current Phase 3 breakage against fresh upstream truth

**Bead ID:** `ee-x211`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Audit the current Phase 3 failure surface against the fresh repaired cod-test packet. Identify exactly which Phase 3 artifacts are stale, misleading, structurally mismatched, or benchmark-red because they still assume older Phase 1/2 shapes or semantics. Compare today’s outputs with the archived Phase 3 repair history so we don’t rediscover old fixes blindly. Produce a durable forensic note that ranks the real breakages and recommends the narrowest truthful repair order. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/`
- `benchmarks/` (inspection only)
- `server/scripts/report/` (inspection only)
- `output/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/forensic-note.md`

**Status:** ✅ Complete

**Results:** Completed a reference-backed forensic audit and wrote `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/forensic-note.md`. Main finding: today’s benchmark-red Phase 3 surface is not a replay of the March recommendation-JSON/runtime failure lane. The fresh packet proves current Phase 3 artifacts are being produced, but one real consumer bug remains in the derived Phase 3 semantics: `metrics` and `emotional-analysis` treat an upstream emotion score of exactly `1` as normalized `1.0` instead of `0.1`, which fabricates boredom peaks/trends and corrupts critical moments/scroll-risk output. The rest of the loudest Phase 3 red is mostly stale benchmark truth and report presentation drift, not fresh Phase 3 generation failure. Narrowest truthful repair order from the forensic note: (1) fix the exact-score normalization contract in metrics + emotional-analysis, (2) rerun the smallest honest Phase 3 lane on the same fresh packet, (3) repair final-report scale/index presentation drift, (4) only then decide whether recommendation wording still needs a narrow follow-up, and (5) treat remaining recommendation/metrics/emotional-analysis red primarily as benchmark-truth refresh debt unless rerun evidence proves otherwise.

---

### Task 2: Implement the narrow Phase 3/reporting repairs

**Bead ID:** `ee-kiv1`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Using the forensic conclusions, implement the narrowest truthful Phase 3 repairs so recommendation, metrics, emotional-analysis, summary, and any necessary benchmark/report consumers interpret the current Phase 1/2 surfaces honestly. Prefer repair of stale assumptions over broad redesign. Add or update tests/validation where appropriate, run repo-local validation, and commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `server/scripts/report/`
- `benchmarks/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`
- `server/scripts/report/recommendation.cjs`
- `server/scripts/report/final-report.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/scripts/computed-report-contract.test.js`
- `test/scripts/final-report.test.js`
- `.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md`

**Status:** ✅ Complete

**Results:** Implemented the narrow evidence-driven Phase 3 consumer repairs the forensic note ranked first, without reopening the older March JSON-hardening lane. True consumer-drift files: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/report/metrics.cjs` and `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/report/emotional-analysis.cjs` now treat only values strictly below `1` as pre-normalized fractions, so an upstream exact score of `1` is normalized to `0.1` via `score / 10` instead of being misread as `1.0`. Supporting narrow recommendation/report consumer drift: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/report/recommendation.cjs` now exposes `chunkNumber` and explicitly instructs the model to use one-based chunk numbering in prose, while `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/report/final-report.cjs` humanizes chunk references for display and labels aggregate averages honestly as normalized `0-1` metrics with matching visual bars. Legacy presentation parity was also kept truthful in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/report/evaluation.cjs` so the compatibility wrapper does not preserve the stale exact-`1` bug or mislabeled normalized averages. Added targeted regression coverage in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/test/scripts/computed-report-contract.test.js` and `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/test/scripts/final-report.test.js`. Validation run: `node --test test/scripts/computed-report-contract.test.js test/scripts/final-report.test.js test/scripts/evaluation.test.js` ✅. Repo-local evidence pass against the real repaired packet: ran `metrics.cjs` and `emotional-analysis.cjs` on `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json` into `/tmp/ee-phase3-repair-validation`, confirming boredom average ≈ `0.2643`, highest boredom timestamp `125`, boredom trend `stable`, and boredom threshold-high moments collapsing to the truthful late-screen lane instead of the false `95s/115s` spikes.

---

### Task 3: Re-run the repaired Phase 3 validation lane

**Bead ID:** `ee-gec0`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Run the appropriate validation lane after the Phase 3 repairs. Prefer the smallest honest lane that proves the repaired Phase 3 consumers against the fresh cod-test packet, but use the canonical full pipeline if that is the only truthful way to validate. Capture the exact command, output paths, benchmark/report results, and whether the previously failing Phase 3 artifact classes improved. Leave a durable rerun summary and do not broaden scope.`

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/rerun-summary.md`
- refreshed output/report artifacts as produced by the chosen validation lane

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: QA the repaired Phase 3 outputs for usefulness, grounding, and honesty

**Bead ID:** `ee-0bq3`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `QA the repaired Phase 3 outputs directly. Judge whether recommendation, metrics, emotional-analysis, summary, and final report now make normal human sense given the current Phase 1/2 truth. Distinguish between benchmark parity gaps, report polish gaps, and actual misleading output. Produce a durable QA summary with an explicit go/no-go judgment for Phase 3 usefulness and truthfulness.`

**Folders Created/Deleted/Modified:**
- `output/` (inspection only)
- `benchmarks/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/qa-summary.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Audit whether Phase 3 is genuinely repaired and define the next benchmark lane

**Bead ID:** `ee-dpbe`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Independently audit the forensic note, implementation, validation rerun, and QA findings. Decide whether Phase 3 is now truthfully repaired for the current pipeline state, whether the remaining red is mostly benchmark parity debt, or whether deeper report logic is still broken. Close the bead only if the audit finds the work honestly complete, and clearly define the next benchmark lane if any red remains.`

**Folders Created/Deleted/Modified:**
- `output/` (inspection only)
- `benchmarks/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md`
- `.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/audit-summary.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on Pending*
