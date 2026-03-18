---
plan_id: plan-2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state
bead_ids:
  - ee-4ew
  - ee-rq2
  - ee-3bs
  - ee-mkm
  - ee-ybp
---
# emotion-engine: investigate AI recovery handoff vs live polyrepo state

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Determine whether the older AI recovery lane handoff / bead trail is stale or still actionable by checking the current live state of emotion-engine and its sibling polyrepos against the intended architecture.

---

## Overview

There is now tension between the remembered handoff and the likely current repo truth. Memory still surfaces the March 14–15 architecture lane and specifically names `ee-32e` as the next logical bead in one older handoff, but a newer active plan already records that `ee-32e` and the broader rollout chain were completed, with the more practical remaining concern being whether the runnable configs/docs truthfully activate and describe the AI recovery system.

This investigation should not assume the old handoff is still valid. Instead, it should reconstruct the actual current state from Beads, plans, code, configs, README/docs, and the sibling polyrepos that participate in the recovery/runtime contract. The key product question is not merely “does AI recovery exist,” but whether it is actually used in the intended place: only as a bounded last-ditch fallback after deterministic/mechanical repair strategies are exhausted, and whether that contract is consistent across emotion-engine and the relevant sibling repos.

Because the owning architecture, open beads, and historical rollout plans all live in `emotion-engine`, this repo remains the coordination root. Sibling repos are in scope for inspection, but this plan remains owned by `emotion-engine/.plans/`.

---

## Tasks

### Task 1: Reconstruct current bead + plan truth

**Bead ID:** `ee-rq2`  
**SubAgent:** `primary`  
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, inspect current Beads state and the relevant March 13–15 plans. Produce a precise truth report covering: whether `ee-32e` is closed, what rollout/sanity-sweep beads remain open, which handoff docs/plans are stale, and whether the old “next logical bead is ee-32e” guidance should now be considered superseded. Update this active plan with exact evidence.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/` (inspection only unless explicit status cleanup is justified by evidence)

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`

**Status:** ✅ Complete

**Results:** Reconstructed current truth from live Beads plus the March 13–15 plan trail. `bd show ee-32e --json` confirms `ee-32e` is **closed** (`closed_at: 2026-03-14T17:46:46Z`, reason: `Defined AI recovery lane contract and YAML configuration`), so any older handoff saying the “next logical bead is ee-32e” is now historical-only and should be treated as **superseded**, not actionable. The broader rollout/sanity chain is also already complete in live Beads: `ee-d4x`, `ee-d4x.1`–`ee-d4x.4`, sibling epic `ee-cwi` plus `ee-cwi.1`–`ee-cwi.4`, and final sweep `ee-vaa` all show `status: closed`; `ee-vaa` specifically closed on 2026-03-15 with the reason that runtime alignment across emotion-engine + sibling repos was completed and only bounded historical doc/plan cleanup remained. So there are **no remaining open rollout or sanity-sweep beads from that March 13–15 recovery rollout chain**.

What is still open today is a newer investigation stack, not unfinished rollout work: epic `ee-4ew` with child tasks `ee-rq2`, `ee-3bs`, `ee-mkm`, and decision bead `ee-ybp`, plus unrelated residual bugs/investigations such as `ee-4sx`, `ee-5dv`, `ee-58s`, `ee-bao`, and `ee-2fs`. That means the old handoff is stale in two ways: (1) the March 14 plan `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md` still contains preserved historical wording like “`ee-32e` was the explicit next pickup point” and mid-rollout/open-bead framing, but that same file also contains 2026-03-15 closure addenda noting those statements are historical; and (2) the earlier March 13 top-level planning scaffolds `.plans/2026-03-13-pre-golden-run-bead-sequence.md`, `.plans/2026-03-13-schema-validator-rollout-across-ai-lanes.md`, and `.plans/2026-03-13-unified-output-failure-and-ai-recovery-architecture.md` were already identified on 2026-03-15 as superseded by the March 14 execution graph + later verification/activation work, even though they still sit top-level. Net truth for handoff recovery: **do not resume at `ee-32e`; that guidance is superseded by closed live Beads, and the remaining live work is documentation/truth/audit follow-up, not unfinished recovery-rollout implementation.**

---

### Task 2: Audit live emotion-engine implementation vs README/config/docs

**Bead ID:** `ee-3bs`  
**SubAgent:** `coder`  
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`, audit the live AI recovery behavior in code against the README, current docs, and runnable configs. Confirm whether AI recovery is wired as a bounded last-ditch fallback after deterministic/mechanical repair paths are exhausted; identify the exact enforcement points in code; verify which runnable configs activate it (or do not); and note any README/docs/config drift. Update this plan with file-level evidence.

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/`
- `configs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`
- any tiny truth-fix docs only if needed to preserve accuracy

**Status:** ✅ Complete

**Results:** Audited the live code/config/doc path and confirmed the intended semantics are genuinely implemented in `emotion-engine`: deterministic/mechanical recovery is evaluated first, and AI recovery is only considered as a bounded last-ditch fallback after deterministic options are exhausted or unavailable.

Evidence from live code:
- `server/lib/script-contract.cjs` is the decision point. `buildDeterministicState(...)` derives script-family-specific deterministic strategies from the actual lane/config state; for AI structured-output lanes it orders `repair-with-validator-tool-loop`, then `retry-same-target`, then `failover-next-target`, then `retry-with-lower-thinking` when those are truly available. `determineNextAction(...)` then prefers `policy: 'deterministic_recovery'` whenever deterministic recovery is eligible and budget remains, and only falls through to `policy: 'ai_recovery'` after deterministic `remaining` is empty or attempts are exhausted. Default caps are small and explicit: deterministic `maxAttemptsPerFailure: 2`; AI `maxPerFailure: 1`, `maxPerScriptRun: 1`, `maxPerPipelineRun: 3`, plus token/cost/time ceilings.
- `server/lib/script-runner.cjs` is the runtime gate. Even if a failure envelope selects `ai_recovery`, the runner will only invoke it when **all** of these are true: `nextAction.policy === 'ai_recovery'`, the script exports `aiRecovery`, and YAML sets `config.recovery.ai.enabled`, `adapter`, and `model`. Otherwise the failure hard-stops with no hidden AI fallback.
- `server/lib/ai-recovery-lane.cjs` keeps the fallback narrow and auditable. The failure package/result contracts are `ee.ai-recovery-input/v1` and `ee.ai-recovery-result/v1`; the lane requires the local validator tool `validate_ai_recovery_decision_json`; and same-script re-entry is restricted to `same-script-revised-input` with only `repairInstructions` and `boundedContextSummary` allowed. `server/lib/ai-recovery-runtime.cjs` then appends only bounded repair/context guidance to the original script prompt.
- Current AI-recovery-capable scripts are exactly the four meaningful AI lanes that export `aiRecovery`: `server/scripts/get-context/get-dialogue.cjs`, `server/scripts/get-context/get-music.cjs`, `server/scripts/process/video-chunks.cjs`, and `server/scripts/report/recommendation.cjs`. Computed/report scripts such as `metrics`, `emotional-analysis`, `summary`, and `final-report` do not export `aiRecovery`, so they cannot enter the AI recovery lane.

Config truth:
- Runnable configs that currently **activate** AI recovery: `configs/cod-test.yaml`, `configs/cod-test-phase3.yaml`, and `configs/cod-late-window-grounding-check.yaml` (all contain top-level `recovery.ai.enabled: true` plus `adapter: openrouter` and `model: google/gemini-3.1-pro-preview`).
- Runnable configs that currently **do not** activate AI recovery because they omit top-level `recovery:` entirely: `configs/audio-analysis.yaml`, `configs/dialogue-transcription.yaml`, `configs/e2e-test.yaml`, `configs/example-pipeline.yaml`, `configs/full-analysis.yaml`, `configs/image-analysis.yaml`, `configs/metadata-extract.yaml`, `configs/multi-analysis.yaml`, `configs/multi-persona-swarm.yaml`, `configs/quick-test.yaml`, `configs/raw-analysis.yaml`, `configs/single-chunk-test-debug.yaml`, `configs/single-chunk-test-per-second.yaml`, `configs/single-chunk-test.yaml`, `configs/test-model-loading.yaml`, `configs/video-analysis-parallel.yaml`, and `configs/video-analysis.yaml`. Per `docs/CONFIG-GUIDE.md` and `server/lib/script-contract.cjs`, omission is valid but means AI recovery stays disabled by default.

README/docs/config drift findings:
- `README.md` is directionally accurate but intentionally high-level: it links to the recovery docs and current config guide, but it does not itself spell out which checked-in runnable configs have recovery armed.
- `docs/CONFIG-GUIDE.md` now matches the live code on the important behavior: omission is valid, AI recovery defaults off, activation requires `enabled + adapter + model`, and the live mutable re-entry surface is only `repairInstructions` + `boundedContextSummary`.
- `docs/AI-RECOVERY-LANE-CONTRACT.md` also matches the current narrower implementation in its 2026-03-15 addendum: validator-tool mediation is mandatory, re-entry uses `same-script-revised-input`, and the mutable surface is the same bounded pair above.
- I did **not** find a doc truth-fix that was still necessary for this task, so no behavior/doc edits were made beyond recording this evidence here.

---

### Task 3: Inspect sibling polyrepos for contract usage and drift

**Bead ID:** `ee-mkm`  
**SubAgent:** `coder`  
**Prompt:** Compare emotion-engine’s current recovery/runtime contract against the relevant sibling polyrepos: `ai-providers`, `digital-twin-router`, `digital-twin-core`, `digital-twin-openrouter-emotion-engine`, `digital-twin-emotion-engine-providers`, and `tools` if still contract-relevant. Confirm whether they preserve the intended ownership boundaries and whether any current README/docs/code still imply stale rollout or stale ownership. Record exact drift and whether it is runtime drift or only historical documentation drift.

**Folders Created/Deleted/Modified:**
- sibling repo roots as needed for inspection
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`
- optional bounded doc truth-fixes only if needed

**Status:** ✅ Complete

**Results:** Inspected the live sibling polyrepos against emotion-engine’s current runtime contract and found **no sibling-side runtime ownership drift in the AI recovery lane**. The current boundaries are still preserved: `emotion-engine` owns script-level recovery policy and decides AI recovery only after deterministic recovery is exhausted (`server/lib/script-contract.cjs:632-647`), and the runtime entrypoint still consumes the sibling-owned emotion-lenses implementation from `../tools` (`server/scripts/process/video-chunks.cjs:15`, `772-790`).

Sibling repo findings:
- **`../ai-providers`** remains transport-only, not policy-owning. Its README explicitly says it does **not** own script-level success/failure envelopes or recovery policy and only surfaces machine-routable provider metadata (`../ai-providers/README.md:5-42`). The adapters still only wrap provider calls plus digital-twin transport (`../ai-providers/providers/openai.cjs:187-206`, `../ai-providers/providers/anthropic.cjs:197-216`, `../ai-providers/providers/gemini.cjs:192-211`, `../ai-providers/providers/openrouter.cjs:305-325`). **Drift:** none observed; runtime and docs match the intended boundary.
- **`../digital-twin-router`** still owns recording/replay transport concerns, including `recordedFailure` refs and provider failure fidelity, without claiming recovery policy ownership (`../digital-twin-router/README.md:3-28`, `78-83`). **Drift:** none observed; this is aligned runtime support, not recovery-policy takeover.
- **`../digital-twin-core`** remains schema/validation infrastructure only. It validates the additive recorded-failure/provider envelope shape (`../digital-twin-core/lib/cassette.js:1-12`, `148-208`) and documents that as cassette-schema support for replay/recovery debugging (`../digital-twin-core/README.md:15`, `170-174`). **Drift:** none observed.
- **`../digital-twin-openrouter-emotion-engine`** is still just the bounded OpenRouter cassette pack owner; README states it owns the OpenRouter replay cassette and router-facing manifest/index packaging (`../digital-twin-openrouter-emotion-engine/README.md:3-10`, `24-27`, `55-82`). **Drift:** none observed.
- **`../digital-twin-emotion-engine-providers`** clearly states it is the canonical provider replay-pack repo and that any copy inside `emotion-engine` would be transitional drift (`../digital-twin-emotion-engine-providers/README.md:5-15`). The cassette metadata also declares `canonicalOwner: digital-twin-emotion-engine-providers` with `consumer: emotion-engine` (`../digital-twin-emotion-engine-providers/cassettes/providers.json:15-19`). **Drift:** none observed in the sibling repo; it preserves the intended ownership line.
- **`../tools`** is still contract-relevant for the runtime, but for the **Phase 2 emotion-analysis tool contract**, not the AI recovery policy itself. Its README says `emotion-lenses-tool.cjs` is the canonical shared implementation that `emotion-engine` should consume (`../tools/README.md:5-19`), and the alignment audit says the earlier hidden-runtime-owner drift was corrected and that `emotion-engine` now imports the sibling tool directly (`../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md:11-18`, `40-58`). The live tool code still owns the validator-loop/structured-output contract (`../tools/emotion-lenses-tool.cjs:449-517`). **Drift:** no current runtime drift; only **historical documentation drift already recorded as fixed** in the audit doc.

Only notable stale artifact found in sibling repos: `../tools/package-lock.json:15-21` still resolves transitive `digital-twin-router` from a local `file:../digital-twin-router` path inside the lockfile. That does **not** currently change the declared package ownership boundary (the router is not declared that way in `../tools/package.json`) and does not imply AI recovery policy drift; treat it as dependency/install-state residue unless later work proves it leaks into committed manifests or CI behavior.

Bottom line for sibling repos: the live polyrepo state still reflects the intended architecture — `emotion-engine` owns mechanical-first then AI-last recovery decisions, `ai-providers` owns provider transport/error metadata, `digital-twin-router`/`digital-twin-core` own replay infrastructure, the twin-pack repos own their cassettes, and `tools` owns the shared emotion-lenses runtime contract. Any remaining drift here is **historical documentation context**, not active runtime contract drift.

---

### Task 4: Decide whether to close the handoff/bead or open bounded follow-up work

**Bead ID:** `ee-ybp`  
**SubAgent:** `primary`  
**Prompt:** Synthesize Tasks 1–3 and decide whether the AI recovery lane handoff can be formally closed as stale/satisfied, whether any still-open bead should be closed with a documented reason, or whether a smaller bounded follow-up bead is required. The decision must explicitly answer whether the current implementation matches Derrick’s intended semantics: mechanical repair first, AI recovery last. Update the plan with the final recommendation and exact next work.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/` (only if evidence supports status cleanup)

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-ai-recovery-handoff-vs-live-polyrepo-state.md`

**Status:** ✅ Complete

**Results:** Synthesized Tasks 1–3 into a close/no-follow-up recommendation. The evidence supports formally treating the older AI recovery lane handoff as **stale but satisfied by later completed work**, not as an actionable unfinished lane. Task 1 established that the supposed old pickup point `ee-32e` is already closed and that the March 14–15 rollout/sanity chain (`ee-d4x*`, `ee-cwi*`, `ee-vaa`) is also closed, so the remembered handoff is historical context rather than live execution guidance. Tasks 2 and 3 then showed that the **current implementation does match Derrick’s intended semantics: mechanical repair first, AI recovery last**. In `emotion-engine`, `server/lib/script-contract.cjs` still prefers deterministic recovery whenever an eligible mechanical option remains and only selects `policy: 'ai_recovery'` after deterministic options are unavailable or exhausted; `server/lib/script-runner.cjs` additionally requires explicit script support plus enabled YAML config before any AI recovery lane runs at all. The sibling polyrepos do not contradict that boundary: transport/replay/tooling ownership remains outside `emotion-engine`, but none of those repos currently override or dilute the mechanical-first / AI-last policy.

Recommendation: **close `ee-ybp` and close epic `ee-4ew`; do not open a new bounded follow-up bead.** There is no remaining runtime or architecture ambiguity to investigate, only optional future documentation tidying if Derrick later wants stale historical plans archived or annotated more aggressively. That possible cleanup is not necessary to preserve the intended semantics or current runtime truth, so creating another bead now would manufacture work rather than resolve an actual gap.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A live-state decision record showing that the older AI recovery handoff is superseded by already-closed rollout work, that the current implementation still enforces Derrick’s intended semantics of **mechanical repair first and AI recovery last**, and that no additional bounded follow-up bead is presently required.

**Commits:**
- None. Per request, no commit was created.

**Lessons Learned:** When older handoff memory conflicts with current repo truth, the reliable source is the live Beads graph plus the current runtime/config contract. In this case, the stale handoff was not a hidden unfinished lane; it was a historical artifact left behind after the real rollout had already closed.

---

*Drafted on 2026-03-18*
