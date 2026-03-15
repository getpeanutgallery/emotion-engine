# peanut-gallery: polyrepo drift audit for emotion-engine and sibling ownership

**Date:** 2026-03-14  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Audit the peanut-gallery polyrepo system to verify we have not drifted away from the intended repo boundaries by reintroducing code into `emotion-engine` that belongs in sibling polyrepos such as `tools`, `ai-providers`, `retry-strategy`, `goals`, `cast`, `digital-twin-router`, or `digital-twin-core`, and to verify that the related digital-twin pack repos have not drifted from the runtime assumptions of the code repos.

---

## Overview

A tools-repo audit surfaced a significant architectural smell: the canonical `emotion-lenses-tool` behavior appears to have migrated back into `emotion-engine`, while the `tools` sibling lags behind as a downstream package surface. Derrick clarified that this is not the intended architecture — the polyrepo sibling should be the place where tool code lives. That means this may not be just a one-off cleanup inside `tools`; it may indicate broader drift away from the intended polyrepo ownership model.

This plan treats the problem as a repo-boundary audit first, not an implementation sprint. Before we move more code around, we need an explicit inventory of what currently lives in `emotion-engine`, what should conceptually live in sibling repos, where imports/runtime resolution actually point today, and whether the present state reflects an intentional exception or an accidental rollback of the polyrepo design.

The audit scope is widened to include the digital-twin pack repos as well, because drift there could leave the code repos technically clean while the replay/cassette ecosystem still diverges from current runtime assumptions. Those pack repos are not primary logic owners in the same sense as `tools` or `ai-providers`, but they are part of the practical polyrepo system Derrick wants verified.

Because the concern spans multiple sibling repos but was discovered from the `emotion-engine` rollout, `emotion-engine` remains the coordination-owning repo for this audit plan. If the audit confirms systemic drift, we can then break remediation into repo-owned implementation beads and move code back to the correct siblings deliberately rather than via ad hoc edits.

---

## Tasks

### Task 1: Reconstruct intended polyrepo ownership model

**Bead ID:** `ee-9s4`  
**SubAgent:** `research`  
**Prompt:** `In the peanut-gallery workspace, reconstruct the intended polyrepo ownership model from repo docs, package metadata, import patterns, and historical notes. For each repo in scope (emotion-engine, tools, ai-providers, retry-strategy, goals, cast, digital-twin-router, digital-twin-core, digital-twin-openrouter-emotion-engine, digital-twin-emotion-engine-providers), document its intended responsibility boundary and note any explicit rules about what should not live in emotion-engine.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-polyrepo-drift-audit.md`
- `docs/POLYREPO-OWNERSHIP-MODEL-AUDIT-2026-03-14.md`

**Status:** ✅ Complete

**Results:** Created `docs/POLYREPO-OWNERSHIP-MODEL-AUDIT-2026-03-14.md` in `emotion-engine` and reconstructed the intended sibling ownership model from durable evidence in repo docs, package metadata, manifests, and live config/import usage. Main findings: `emotion-engine` is the canonical runtime orchestrator and script-contract owner; `ai-providers` owns provider/transport adapters; `retry-strategy` owns generic retry primitives; `goals` and `cast` are content repos; `digital-twin-router` and `digital-twin-core` own replay persistence and cassette schema/core respectively; the digital-twin emotion-engine repos are pack repos; and `tools` is the only materially ambiguous boundary, where current durable docs now treat it as a downstream compatibility package surface rather than the canonical contract owner. Explicit engine-outside boundaries were documented per repo, especially for provider logic, replay/schema ownership, generic retry primitives, and content/pack artifacts.

---

### Task 2: Audit actual runtime/import ownership across emotion-engine and siblings

**Bead ID:** `ee-duf`  
**SubAgent:** `primary`  
**Prompt:** `Audit current import paths, package resolution, duplicated implementations, and pack/runtime assumptions across emotion-engine and the repos in scope. Identify cases where emotion-engine contains code that appears to belong to a sibling polyrepo, where a node_modules sibling package is only a shim into emotion-engine, where sibling code has drifted behind the in-repo copy, or where digital-twin pack layout/fixtures have drifted from the expectations of the code repos.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-polyrepo-drift-audit.md`
- `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md`

**Status:** ✅ Complete

**Results:** Created `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` as the durable evidence-based runtime drift audit. Confirmed two high-signal drift areas: (1) `tools` no longer acts as the effective runtime owner of `emotion-lenses-tool` because `emotion-engine/node_modules/tools/emotion-lenses-tool.cjs` is a local shim back into `emotion-engine/server/lib/emotion-lenses-tool.cjs`, while the sibling repo’s own `tools/emotion-lenses-tool.cjs` has materially lagged behind the engine-local implementation; and (2) the provider cassette-pack boundary has drifted because `emotion-engine` tests default to `test/fixtures/digital-twin-emotion-engine-providers`, while the sibling repo `../digital-twin-emotion-engine-providers` exists as the nominal pack owner and its `providers.json` cassette has already diverged from the in-engine fixture copy. Also documented a medium pack-doc drift in `../digital-twin-openrouter-emotion-engine` where README examples still describe the older `openrouter-emotion-engine` cassette while `manifest.json` now points at `cod-test-golden-20260309-082851`. Notable non-drift findings were also recorded: `ai-providers` still owns provider/transport logic, `digital-twin-router` + `digital-twin-core` still own replay/schema logic, and `retry-strategy`, `goals`, and `cast` do not show current code reabsorption into `emotion-engine`.

---

### Task 3: Classify drift findings by severity and ownership correction path

**Bead ID:** `ee-hdr`  
**SubAgent:** `primary`  
**Prompt:** `For each drift finding, classify whether it is: (a) intentional/coherent, (b) mild drift but acceptable, (c) real ownership violation requiring code relocation, or (d) ambiguous and needing Derrick’s architectural decision. Propose the correct owning repo for each violation and the safest remediation path.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-polyrepo-drift-audit.md`
- `docs/POLYREPO-DRIFT-CLASSIFICATION-AND-REMEDIATION-2026-03-14.md`

**Status:** ✅ Complete

**Results:** Created bead `ee-hdr`, claimed it, and wrote `docs/POLYREPO-DRIFT-CLASSIFICATION-AND-REMEDIATION-2026-03-14.md` as the durable classification/remediation note. Classification outcome: the two `tools` findings are real ownership violations requiring relocation back to the sibling `tools` repo; the dependency-pin/local-installed-rewrite finding is packaging clarity drift that should be cleaned up alongside the `tools` correction but is not its own relocation driver; the provider twin-pack duplication between `emotion-engine/test/fixtures/...` and `../digital-twin-emotion-engine-providers` is the one finding that still needs Derrick’s architectural decision because both sibling-pack-canonical and engine-local-fixture-canonical models are coherent; and the `digital-twin-openrouter-emotion-engine` README mismatch is mild docs drift. The note also records correct owning repo recommendations, safest remediation paths, migration risks/validation needs, and blocker-vs-deferrable guidance for each finding.

---

### Task 4: Break confirmed ownership corrections into implementation beads

**Bead ID:** `Superseded by remediation plan`  
**SubAgent:** `primary`  
**Prompt:** `If the audit confirms real polyrepo drift, translate the findings into concrete implementation beads by owning repo. Include dependency order, whether code should move out of emotion-engine or back into a sibling, and any validation needed to preserve runtime behavior during the correction.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-polyrepo-drift-audit.md`
- `.plans/2026-03-14-polyrepo-drift-remediation.md`

**Status:** ✅ Complete

**Results:** Task 4 was satisfied by turning the audit conclusions into the dedicated remediation plan `.plans/2026-03-14-polyrepo-drift-remediation.md`, then executing that remediation to completion. The audit did not need a separate standalone bead graph beyond that follow-on plan.

---

## Questions this audit should answer

- Which repos are still truly canonical for their domain?
- Are there other cases besides `tools` where a sibling package now resolves back into an `emotion-engine` implementation?
- Did the polyrepo extraction drift back toward a monorepo-in-disguise?
- Which cases are deliberate convenience wrappers versus actual architectural regressions?
- Have the digital-twin pack repos drifted from the cassette/runtime assumptions of the current code repos?
- What code, package wiring, or pack structure needs to move, and in which order, if we want to restore the intended sibling ownership model?

---

## Success Criteria

- We have a clear source-of-truth map for the peanut-gallery polyrepo boundaries.
- We can point to concrete drift cases instead of relying on hunches.
- Each confirmed ownership violation has a recommended owning repo and remediation path.
- We do not begin moving code until Derrick can review the audit findings.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed a full ownership-model + runtime-drift audit across the peanut-gallery polyrepo, identified the real violations (`tools` ownership drift and provider twin-pack ownership drift), classified the findings, and converted them into the executed remediation plan that restored sibling ownership. The audit also verified that the rest of the sibling boundaries remained coherent and did not indicate a general monorepo collapse.

**Commits:**
- `36a4d7f` - docs: add polyrepo ownership model audit
- `8ebf15e` - docs: record polyrepo runtime drift findings
- `dd43cea` - docs: classify polyrepo drift findings

**Lessons Learned:** The useful pattern here was to separate intended ownership, actual runtime resolution, and remediation planning. The architecture smell looked broad at first, but the audit narrowed it to two real ownership violations and avoided unnecessary churn in repos whose boundaries were already healthy.

---

*Closed after Derrick confirmed the sibling repos should remain canonical and the follow-on remediation plan was executed.*