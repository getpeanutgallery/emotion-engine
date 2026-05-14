# Peanut Gallery Emotion Engine

**Date:** 2026-05-14  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Fix the fresh-proof rerun contract mismatch so the canonical `cod-test` full-run lane truthfully produces the Phase 2 artifact needed for proof review, then resume the fresh full rerun and QA/audit flow for Phase 3 readiness.

---

## Overview

The fresh proof rerun did not fail because of a provider crash or a new persona-quality regression. It failed because the current canonical `configs/cod-test.yaml` Phase 2 lane points at `server/scripts/process/whole-video-mimo.cjs`, which writes `phase2-process/whole-video-analysis.json`, while the benchmark and downstream proof-review expectations still require `phase2-process/chunk-analysis.json`. That means the current full-run path cannot complete honestly enough to produce the exact artifact that today’s readiness review needs.

Derrick has now clarified the intended source of truth: **`cod-test` proof should be based on chunk-analysis, because chunk-video is the real Phase 2 script and whole-video was only a test idea.** That removes the earlier ambiguity. The fix lane should therefore focus on restoring the canonical full-run proof path to the chunk-analysis-producing Phase 2 surface and repairing any config/runner/benchmark drift that blocks that path.

Once that contract is repaired, the work should immediately resume the blocked proof flow: rerun the canonical full packet, verify that the required Phase 2 artifact now exists, then run the same QA and auditor checks we intended earlier against the fresh artifact. If the contradiction class is gone, Phase 2 can finally graduate toward Phase 3. If not, we will at least be back to failing on the actual product truth instead of a pipeline mismatch.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Blocked fresh-proof rerun plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase2-fresh-proof-rerun.md` |
| `REF-02` | Rerun summary capturing the exact contract mismatch failure | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase2-fresh-proof-rerun/rerun-summary.md` |
| `REF-03` | Current canonical full-run config | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml` |
| `REF-04` | Today’s readiness audit that said one fresh full proof rerun is the right next step | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase2-readiness-review/audit-summary.md` |
| `REF-05` | Last known successful chunk-analysis proof artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json` |
| `REF-06` | Memory note describing the successful May 13 full rerun path and its clean chunk-analysis output | `/home/derrick/.openclaw/workspace/memory/2026-05-13.md` |
| `REF-07` | Earlier memory note confirming `cod-test` has historically completed with truthful `chunk-analysis.json` output | `/home/derrick/.openclaw/workspace/memory/2026-03-16.md` |

---

## Tasks

### Task 1: Forensic review of config drift away from the chunk-analysis proof lane

**Bead ID:** `ee-p44s`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Derrick has clarified the source of truth: cod-test proof must be based on chunk-analysis, because chunk-video is the real Phase 2 script and whole-video was only a test idea. Audit the current config, benchmark expectation, recent successful rerun history, and relevant script/output contracts to determine exactly where the canonical full-run lane drifted away from the intended chunk-analysis proof surface. Do not implement yet. Produce a durable forensic note with a narrow recommended fix path and explicitly identify which files should change and which should not. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/`
- `configs/` (inspection only)
- `server/` (inspection only)
- `benchmarks/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase2-proof-contract-fix.md`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/forensic-note.md`

**Status:** ✅ Complete

**Results:** Research audit completed and durable forensic notes were written to `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase2-proof-contract-fix/forensic-note.md`. The drift is now concrete: `configs/cod-test.yaml` currently routes Phase 2 through `server/scripts/process/whole-video-mimo.cjs`, which only emits `phase2-process/whole-video-analysis.json`, while `benchmarks/fixtures/cod-test/benchmark.json` still correctly requires `phase2-process/chunk-analysis.json` from script `video-chunks`. Historical proof references remain aligned with chunk-analysis (`/home/derrick/.openclaw/workspace/memory/2026-03-16.md`, `/home/derrick/.openclaw/workspace/memory/2026-05-13.md`, and `output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`). Git history identifies two likely drift points: `3a28409` switched the canonical config to the whole-video prototype and removed chunk-analysis from the benchmark at the time; `429d95f` later restored the chunk-analysis benchmark lane without restoring `configs/cod-test.yaml`, recreating the contradiction. Recommended narrow fix path: change `configs/cod-test.yaml` back to `server/scripts/process/video-chunks.cjs`; do **not** rewrite benchmark truth or report consumers for this bead. Whole-video should remain a separate experimental/test config rather than the canonical proof surface.

---

### Task 2: Implement the narrow contract fix and restore a truthful proof-run path

**Bead ID:** `ee-zran`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`  
**Prompt:** `Using the approved forensic conclusion, implement the narrowest truthful fix so the canonical cod-test proof lane again runs through the intended chunk-analysis-producing Phase 2 path and the benchmark/proof-review contract agrees with it. Whole-video should be treated as a test lane, not the canonical proof surface. Keep the fix narrow, add or update validation if needed, run repo-local validation, and commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `configs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `.plans/2026-05-14-phase2-proof-contract-fix.md`

**Status:** ✅ Complete

**Results:** Implemented the forensic recommendation as a narrow one-line config restoration in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml`, switching the canonical `cod-test` Phase 2 `process:` entry from `server/scripts/process/whole-video-mimo.cjs` back to `server/scripts/process/video-chunks.cjs` so the proof lane again targets `phase2-process/chunk-analysis.json` in line with `REF-02`, `REF-03`, and `REF-05`. No benchmark, report-consumer, or Phase 2 script logic changes were made. Repo-local validation run: `npm run validate-configs` ✅, confirming `cod-test.yaml` and all YAML configs still parse successfully after the fix. Whole-video was intentionally left untouched as a non-canonical/test path rather than the canonical proof surface.

---

### Task 3: Re-run the fresh full proof packet after the contract fix

**Bead ID:** `ee-6mwr`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Run the canonical cod-test full proof lane again after the contract fix. Capture the exact command, output path, and whether the required Phase 2 proof artifact is produced. This is the unblock step for the fresh-proof lane; do not broaden scope. Leave a durable rerun summary and confirm whether chunk-analysis.json or its approved replacement exists exactly where the benchmark/proof consumers now expect it.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase2-proof-contract-fix.md`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/rerun-summary.md`
- new output folder(s) under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: QA the repaired fresh full proof packet for the original continuity blocker class

**Bead ID:** `ee-2gzj`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-01`, `REF-04`, `REF-05`  
**Prompt:** `QA the repaired fresh full proof packet directly against the chunk-analysis proof surface. Check the same blocker class from the readiness review: local countdown phrasing, chunk 18 cold-open framing, title-awareness contradiction, and late-end continuity regression. Sample the fresh chunk-analysis artifact broadly enough to confirm one-viewer continuity across opener, middle, chunk 18, and end-card tail. Produce a durable QA summary with an explicit go/no-go judgment.`

**Folders Created/Deleted/Modified:**
- `output/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase2-proof-contract-fix.md`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/qa-summary.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Audit whether the repaired proof lane now clears Phase 2 for Phase 3

**Bead ID:** `ee-djrx`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-04`, `REF-05`  
**Prompt:** `Independently audit the contract fix, the repaired fresh full proof rerun, and the QA packet. Decide whether the proof lane is now truthful and whether the fresh artifact clears Phase 2 for graduation toward Phase 3. Be explicit about whether the issue was fully fixed, merely rerouted, or still unresolved. Close the bead only if the audit finds the task completed honestly.`

**Folders Created/Deleted/Modified:**
- `output/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase2-proof-contract-fix.md`
- `.plans/artifacts/2026-05-14-phase2-proof-contract-fix/audit-summary.md`

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
