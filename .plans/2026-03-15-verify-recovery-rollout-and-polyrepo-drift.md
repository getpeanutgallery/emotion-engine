---
plan_id: plan-2026-03-15-verify-recovery-rollout-and-polyrepo-drift
bead_ids:
  - ee-ce9
  - ee-dkv
  - ee-vaa
  - ee-fyk
---
# emotion-engine: verify recovery rollout and polyrepo drift

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Confirm that the recent recovery-contract rollout and sibling polyrepo sync work are actually in a truthful, current state before we spend more money on live validation runs.

---

## Overview

We left the repo with two overlapping realities: the older Phase 3 validation lane (`ee-5dv` and friends) was still the next known live test path, but the newer March 13–14 architecture work substantially expanded the system contract. That newer work claims that every meaningful script now participates in the shared success/failure/recovery runtime, that sibling repos were rolled forward to match the new contract boundaries, and that `ee-vaa` is now the intended final sanity sweep after rollout.

Before we run another live Phase3-only or full `cod-test`, we need to re-ground the source of truth. That means checking which plans are still pretending to be active, which Beads are actually still open, whether the YAML/config and docs reflect the current recovery system, whether the AI recovery lane is wired the way Derrick expects, and whether any emotion-engine sibling repos are still drifting from emotion-engine’s canonical runtime contract.

This plan keeps `emotion-engine` as the owning repo because the architecture, execution graph, open validation bugs, and final sanity-sweep bead all live here. Sibling repos are in scope for inspection and drift verification, but the coordination source of truth remains this repo’s `.plans/` and `.beads/`.

---

## Tasks

### Task 1: Reconstruct current truth from Beads + plans

**Bead ID:** `ee-ce9`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current open Beads, recent architecture Beads, and active vs archived plans. Produce a concise truth report: what is actually open, what is complete, which plans are stale/superseded, and what the current intended execution lane should be. Do not implement code changes in this task; update the active plan with exact findings.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/` (read/possibly status updates only after approval)

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-verify-recovery-rollout-and-polyrepo-drift.md`

**Status:** ✅ Complete

**Results:** Truth reconstruction completed against live Beads + plan files. The March 12 Phase3-only lane is no longer the truthful active source of execution, even though `.plans/2026-03-12-reconstruct-cod-test-state-and-next-step.md` still says `Current (canonical plan)`. The actually open repo-local work is: `ee-dkv` (this plan's recovery/config/doc audit), `ee-vaa` (the intended post-rollout sanity sweep), `ee-fyk` (blocked synthesis/next-lane decision), plus still-open residual investigations/bugs `ee-58s`, `ee-bao`, `ee-0gv`, `ee-03m`, `ee-5dv`, and `ee-2fs`. The actually complete architecture/rollout chain is much larger than the older validation plan reflects: `ee-32e`, `ee-cib`, `ee-ok2`, `ee-d4x`, `ee-d4x.1`–`ee-d4x.4`, and sibling rollout epic `ee-cwi` with children `ee-cwi.1`–`ee-cwi.4` are all closed. That means the truthful current execution lane is **not** "Phase3-only live run next"; it is **finish the verification/audit tail of the rollout first** — complete `ee-dkv`, complete `ee-vaa`, then let `ee-fyk` decide whether live validation is warranted or whether drift/config cleanup still comes first. Plan normalization is clearly needed: many historical plans are still top-level despite being complete/superseded, and at least four top-level plans are misleadingly still presented as active (`2026-03-12-reconstruct-cod-test-state-and-next-step.md`, `2026-03-13-pre-golden-run-bead-sequence.md`, `2026-03-13-schema-validator-rollout-across-ai-lanes.md`, `2026-03-13-unified-output-failure-and-ai-recovery-architecture.md`). Recommendation documented here only: archive/normalize those stale top-level plans after this verification pass, but do not mutate their status opportunistically inside Task 1.

---

### Task 2: Verify the AI recovery lane contract in code, config, and docs

**Bead ID:** `ee-dkv`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the implemented AI recovery lane against the current docs and YAML/config story. Verify the exact recovery prompt addendum, what recovery package/result contracts are used, which scripts support same-script re-entry, what YAML keys/budgets are active, what tool calls/validator tools are expected for each AI lane, and whether any docs/configs/plans are stale or misleading. Update the active plan with precise findings and file-level evidence. Do not change behavior yet unless a tiny truth-fix is required to keep docs honest.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/`
- `configs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-verify-recovery-rollout-and-polyrepo-drift.md`
- any docs/config truth-fixes discovered during the audit

**Status:** ✅ Complete

**Results:** Audited the live AI recovery implementation against code, configs, and docs. The runtime is genuinely wired in code, but it is **not active in the runnable configs currently checked in**, because no file under `configs/` defines a top-level `recovery:` block (verified by grep across `configs/*.yaml`; `configs/cod-test.yaml` and `configs/cod-test-phase3.yaml` both omit it entirely). The shared runtime defaults live in `server/lib/script-contract.cjs:11-66`: AI recovery defaults to `enabled: false`, lane `structured-output-repair`, `timeoutMs: 45000`, attempts `{ maxPerFailure: 1, maxPerScriptRun: 1, maxPerPipelineRun: 3 }`, budgets `{ maxInputTokens: 12000, maxOutputTokens: 2000, maxTotalTokens: 14000, maxCostUsd: 0.25 }`, context `{ maxSnippetChars: 8000, maxRawRefs: 12, includePromptRef: true, includeLastInvalidOutput: true, includeValidationSummary: true, includeProviderMetadata: true }`, and re-entry mode `same-script-revised-input` with only prompt/context/schema-preserving patching allowed. `validateRecoveryConfig(...)` in `server/lib/script-contract.cjs:196-275` proves those YAML keys are live schema/runtime inputs, but current runnable configs never set them, so real runs fall back to defaults with AI recovery off.

The orchestrated AI recovery lane itself is implemented in `server/lib/script-runner.cjs:66-88` and `server/lib/ai-recovery-lane.cjs:45-320`. `executeScript(...)` only invokes AI recovery when the failure envelope selects `nextAction.policy === 'ai_recovery'`, the script exports `aiRecovery`, and the config explicitly sets `config.recovery.ai.enabled`, `adapter`, and `model` (`server/lib/script-runner.cjs:66-70`). The recovery failure package uses the exact contract version `ee.ai-recovery-input/v1` (`server/lib/script-contract.cjs:8`; `server/lib/ai-recovery-lane.cjs:55-99`). The emitted recovery result uses `ee.ai-recovery-result/v1` (`server/lib/script-contract.cjs:9`; `server/lib/ai-recovery-lane.cjs:273-307`). The actual bounded prompt is in `server/lib/ai-recovery-lane.cjs:102-133`: the lane is told to return JSON only with `decision.outcome` in `{ reenter_script, hard_fail, human_review, no_change_fail }` plus an optional `revisedInput` of kind `same-script-revised-input` containing only `repairInstructions` and `boundedContextSummary` changes. `normalizeRevisedInput(...)` hard-enforces that narrower implementation (`server/lib/ai-recovery-lane.cjs:157-167`), and `applyRevisedInput(...)` injects those changes into `input.recoveryRuntime` before same-script re-entry (`server/lib/ai-recovery-lane.cjs:169-209`).

The exact re-entry prompt addendum is live and shared. `server/lib/ai-recovery-runtime.cjs:11-33` extracts `recoveryRuntime`, and `buildRecoveryPromptAddendum(...)` in `server/lib/ai-recovery-runtime.cjs:36-60` appends this heading and guidance: `AI RECOVERY RE-ENTRY:`, `This is a bounded same-script recovery re-entry attempt.`, `Preserve the original task and schema; only repair the failing output behavior.`, `Return JSON only with the exact required schema.`, and `Do not change unrelated semantics or invent new upstream facts.` It optionally appends `Bounded context summary:` and `Repair instructions:` blocks from the recovery runtime. Same-script re-entry support is present only in the four AI lanes that both consume that runtime and export `aiRecovery`: `server/scripts/get-context/get-dialogue.cjs` (`getRecoveryRuntime`/prompt addendum at lines 36, 180, 1300, 1468, 1500; `aiRecovery` export at 1572-1580), `server/scripts/get-context/get-music.cjs` (35, 175, 817, 857; export 1018-1026), `server/scripts/process/video-chunks.cjs` (35, 221, 632; export 1025-1033), and `server/scripts/report/recommendation.cjs` (37, 197, 537; export 937-945). No computed/report-only scripts expose `aiRecovery`.

Validator-tool expectations are also concrete and lane-specific. The shared tool-loop prompt in `server/lib/local-validator-tool-loop.cjs:128-157` requires exactly one JSON object, either the canonical tool-call envelope or the final artifact, and explicitly forbids wrapper keys like `type`, `toolName`, `arguments`, `args`, or `input`. Phase 1 tool names/contracts are defined in `server/lib/phase1-validator-tools.cjs:7-205`: `validate_dialogue_transcription_json` with canonical envelope `{"tool":"validate_dialogue_transcription_json","transcription":{...}}` (`80-123`), `validate_dialogue_stitch_json` with `{"tool":"validate_dialogue_stitch_json","stitch":{...}}` (`126-166`), and `validate_music_analysis_json` with `{"tool":"validate_music_analysis_json","musicAnalysis":{...}}` (`168-205`). Phase 2 uses `validate_emotion_analysis_json`, built from `../tools/emotion-lenses-tool.cjs`, and `video-chunks.cjs` routes through that contract via the local validator loop (see `docs/AI-LANE-CONTRACT.md:267-271` plus the runtime hook at `server/scripts/process/video-chunks.cjs:632`). Phase 3 recommendation uses `validate_recommendation_json` with the exact canonical envelope `{"tool":"validate_recommendation_json","recommendation":{...}}`, enforced by `server/lib/recommendation-validator-tool.cjs:4-35` and strict malformed-envelope parsing at `128-226`.

Doc/config drift found: (1) `docs/AI-RECOVERY-LANE-CONTRACT.md` is directionally right on contract versions, YAML shape, and one-shot same-script re-entry, but its examples overstate the mutable surface: it shows `promptPackage` in `reentryContract.allowedMutableInputs` (`docs/AI-RECOVERY-LANE-CONTRACT.md:209-216`) and `revisedInput.kind: "prompt_package_patch"` (`280-320`), while the implementation only accepts `same-script-revised-input` with `repairInstructions` and `boundedContextSummary` (`server/lib/ai-recovery-lane.cjs:157-167`). (2) That same doc’s YAML/context story is broader than the current implementation: `includePromptRef`/`includeProviderMetadata` are documented as live context controls (`386-445`), but `buildFailurePackage(...)` currently always includes a prompt ref when found and does not currently include provider metadata in the failure package context (`server/lib/ai-recovery-lane.cjs:74-98`). (3) `docs/CONFIG-GUIDE.md` is stale by omission: it presents `server/lib/config-loader.cjs` plus `configs/cod-test.yaml` as canonical config truth (`1-7`) but contains no `recovery:` section at all even though `server/lib/script-contract.cjs:196-275` validates and normalizes that runtime config. (4) `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` is now stale historical architecture text in at least two places: it still says AI recovery invocation / same-script re-entry are not yet integrated (`94-100`) and that YAML is not yet the canonical source for AI recovery selection/budgeting in running code (`197-202`), both contradicted by `server/lib/script-runner.cjs`, `server/lib/ai-recovery-lane.cjs`, and `docs/IMPLEMENTATION-EXECUTION-GRAPH.md:68-72,105-108`. No behavior changes were made in this task; only this plan was updated with exact findings.

---

### Task 3: Run the post-rollout polyrepo drift sweep

**Bead ID:** `ee-vaa` / `Pending child beads if new drift is found`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, execute the final sanity sweep intended by bead ee-vaa. Compare emotion-engine’s canonical validator/recovery/runtime contract against the relevant sibling repos (ai-providers, digital-twin-router, digital-twin-core, digital-twin-openrouter-emotion-engine, tools, and any other currently contract-relevant siblings). Confirm whether code, READMEs, docs, configs, and plans are in sync with the current emotion-engine state. If you find real drift, document exact files and create bounded follow-up bead recommendations instead of hand-waving. Update the active plan with exact evidence.`

**Folders Created/Deleted/Modified:**
- sibling repo roots as needed for inspection
- `.plans/`
- `docs/` (only if truth/docs fixes are required)

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-verify-recovery-rollout-and-polyrepo-drift.md`
- any follow-up plan/docs artifacts required by verified drift

**Status:** ✅ Complete

**Results:** Completed the post-rollout sweep across the current contract surface and found the runtime/code path itself is now aligned, with only bounded historical doc/plan drift left behind. Files/repos inspected for evidence: `emotion-engine/server/lib/script-contract.cjs`, `server/lib/ai-recovery-lane.cjs`, `server/lib/tool-wrapper-contract.cjs`, `server/scripts/process/video-chunks.cjs`, `test/helpers/digital-twin-preflight.cjs`, `configs/video-analysis.yaml`, `configs/video-analysis-parallel.yaml`, `configs/full-analysis.yaml`, `README.md`, `docs/POLYREPO-OWNERSHIP-MODEL-AUDIT-2026-03-14.md`, `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md`, `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`; sibling repos `../ai-providers` (`README.md`, `ai-provider-interface.js`), `../digital-twin-router` (`README.md`, `index.js`), `../digital-twin-core` (`README.md`, `lib/cassette.js`), `../digital-twin-openrouter-emotion-engine` (`README.md`, `manifest.json`, `index.js`), `../digital-twin-emotion-engine-providers` (`README.md`, `manifest.json`, `package.json`), and `../tools` (`README.md`, `emotion-lenses-tool.cjs`, `lib/local-validator-tool-loop.cjs`, `lib/structured-output.cjs`, `docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`).

Confirmed in-sync runtime boundaries:
- `emotion-engine` remains the canonical script/recovery/runtime owner (`script-contract.cjs`, `ai-recovery-lane.cjs`, `tool-wrapper-contract.cjs`).
- Provider/transport failure classification stays in `../ai-providers`, and its README explicitly keeps script-level envelopes/policy upstream.
- Replay/recorded-failure refs stay in `../digital-twin-router`, and cassette schema/validation stays in `../digital-twin-core`.
- Pack repos are aligned with current cassette reality: `../digital-twin-openrouter-emotion-engine/README.md` matches `manifest.json`, and `emotion-engine/test/helpers/digital-twin-preflight.cjs` now points at the sibling `../digital-twin-emotion-engine-providers` pack with no in-repo fixture copy remaining.
- Phase 2 runtime/config usage is aligned on the sibling tools implementation: `server/scripts/process/video-chunks.cjs` imports `../../../../tools/emotion-lenses-tool.cjs`, and the shipped configs still point to `../tools/emotion-lenses-tool.cjs`.

Real remaining drift is documentation/history drift, not runtime drift:
1. `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md` still says the “next repo task” is to remove the accidental engine-local ownership surface, but that cutover has already happened: `emotion-engine` now imports the sibling `../tools/emotion-lenses-tool.cjs` directly and no `server/lib/emotion-lenses-tool.cjs` remains.
2. `emotion-engine/.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md` still contains mid-rollout text saying `ee-cwi.4` should stay open / is conditional, while Beads now shows `ee-cwi.4` closed and the tools ownership restoration already landed.
3. The dated audit docs `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` and related remediation narrative remain useful as historical records, but they should not be mistaken for current-state docs because their findings about a hidden in-engine `emotion-lenses-tool` owner are now superseded.

Recommended bounded follow-up beads if Derrick wants the docs layer cleaned up:
- historical truth-fix bead: update `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md` with a brief “follow-up complete” addendum.
- plan hygiene bead: append a closure note to `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md` clarifying that `ee-cwi.4` is complete and that the direct `../tools` cutover is already live.
- optional docs-index bead: add a short pointer from current top-level docs/README to note that the March 14 drift audits are historical snapshots, not the live contract state.

Because the sanity sweep itself is complete and no substantive cross-repo contract drift remains in code/config/runtime ownership, `ee-vaa` can be closed after this update. Residual cleanup is bounded documentation hygiene rather than a blocker on the rollout contract.

---

### Task 4: Decide the correct next execution lane before another live run

**Bead ID:** `ee-fyk`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize Tasks 1-3 into a go/no-go decision for the next live validation. Decide whether the truthful next step is: (a) Phase3-only live validation, (b) full cod-test, (c) drift remediation first, or (d) recovery-contract/config cleanup first. Update the plan with the reasoning, exact blockers, and which currently open Beads should be worked next.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-verify-recovery-rollout-and-polyrepo-drift.md`

**Status:** ✅ Complete

**Results:** Synthesized Tasks 1-3 into a go/no-go decision for the next paid validation step. The truthful next move is **(d) recovery-contract/config cleanup first**, not another live Phase3-only run yet. Reasoning: the runtime rollout itself is now implemented and the sibling polyrepo surface is aligned, so there is no longer a cross-repo code-drift blocker; however, the verification audit found a more important truth gap that directly affects any attempted live validation of the new architecture: the runnable configs do **not** currently enable the AI recovery lane at all. `server/lib/script-contract.cjs` clearly supports and validates `recovery.*` with defaults/budgets, but `configs/cod-test.yaml` and `configs/cod-test-phase3.yaml` currently omit any top-level `recovery:` block, which means runs fall back to `recovery.ai.enabled: false`. So if we ran a live Phase3-only test right now, we would not actually be validating the newly implemented AI-recovery path Derrick asked about; we would mostly be retesting the pre-recovery recommendation failure lane under the newer envelope runtime.

That makes a live run now both ambiguous and lower-value: it would not answer the key product questions about (1) whether the YAML is updated for recovery, (2) what exact AI-recovery prompt/runtime is used during real runs, and (3) whether same-script bounded re-entry works end-to-end under real config. The truthful blocker is therefore **config/documentation activation + truth-fix cleanup**, not sibling runtime drift. The bounded cleanup lane should do four things before another paid run: (1) add/normalize explicit `recovery:` config in the intended runnable validation configs (`cod-test` and any Phase3-only config); (2) truth-fix stale docs so they match the narrower live implementation, especially `docs/AI-RECOVERY-LANE-CONTRACT.md`, `docs/CONFIG-GUIDE.md`, and stale rollout-history wording in `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`; (3) add a small historical closure note to the March 14 rollout plan and the tools alignment audit so the docs layer stops implying unfinished rollout work; and then (4) run a live **Phase3-only** validation as the first paid verification step after config activation. Only if that Phase3-only run succeeds should the next lane advance to full `cod-test`, followed by any remaining grounding/quality investigations (`ee-2fs`, `ee-bao`, `ee-58s`) as needed.

Recommended next Beads/work order after this plan: create/execute a bounded recovery-config-and-doc-truth bead first; then reopen the live validation lane against `ee-5dv` with Phase3-only; keep `ee-03m` and `ee-0gv` separate because they are still non-blocking architectural cleanups, and keep `ee-2fs` available immediately after the live run if recommendation outputs remain hallucination-smelling even when recovery is actually active.

---

## Current known context before execution

### What is actually open now
- Active verification/audit lane:
  - `ee-dkv` — audit implemented AI recovery lane, YAML/config, prompts, and validator-tool contracts
  - `ee-vaa` — final emotion-engine + polyrepo sanity sweep for missed AI call sites
  - `ee-fyk` — decide the truthful next execution lane after the verification sweep (blocked by `ee-ce9`, `ee-dkv`, and `ee-vaa`)
- Still-open residual investigations / bugs outside the rollout tail:
  - `ee-58s` — investigate provider_no_content failures / budget pathology
  - `ee-bao` — investigate stock-assets language grounding vs persona-consistent judgment
  - `ee-0gv` — investigate run-root raw folder structure
  - `ee-03m` — expose FFmpeg settings via YAML
  - `ee-5dv` — Phase 3 recommendation invalid JSON live failure
  - `ee-2fs` — audit recommendation input payload / grounding provenance

### What is actually complete
- The architecture/spec chain is closed: `ee-32e`, `ee-cib`, `ee-ok2`, and `ee-d4x`.
- The emotion-engine implementation chain is closed: `ee-d4x.1`, `ee-d4x.2`, `ee-d4x.3`, and `ee-d4x.4`.
- The sibling rollout chain is also closed: epic `ee-cwi` plus `ee-cwi.1`, `ee-cwi.2`, `ee-cwi.3`, and `ee-cwi.4`.
- Therefore the March 14 rollout is materially implemented; what remains is verification/sanity-sweep work, not the bulk rollout itself.

### Plan state drift discovered during Task 1
- Only three plans are archived (`2026-03-14-polyrepo-drift-audit.md`, `2026-03-14-polyrepo-drift-remediation.md`, `2026-03-15-local-dependency-refresh-hygiene.md`), while many clearly historical plans still sit top-level.
- Most top-level files correctly self-label as `Complete` or `Superseded`, but they still violate the repo rule that completed plans move to `.plans/archive/`.
- Four top-level plans are actively misleading because they still read like live execution state despite later work overtaking them:
  - `2026-03-12-reconstruct-cod-test-state-and-next-step.md` (`Current (canonical plan)` but no longer current)
  - `2026-03-13-pre-golden-run-bead-sequence.md` (`In Progress`, but its remaining queue was overtaken by the recovery rollout)
  - `2026-03-13-schema-validator-rollout-across-ai-lanes.md` (`In Progress`, but it is a planning scaffold superseded by `ee-d4x` / `ee-cwi` execution)
  - `2026-03-13-unified-output-failure-and-ai-recovery-architecture.md` (`In Progress`, but it is an earlier architecture scaffold superseded by the March 14 rollout plan)
- `2026-03-14-ai-recovery-contract-and-sibling-rollout.md` is still useful as the durable historical implementation record, but it now functions as a mostly-complete handoff/history document rather than the current execution coordinator.

### Truthful current execution lane
- Do **not** treat the March 12 plan's "Phase3-only live validation next" guidance as canonical anymore.
- The truthful near-term lane is:
  1. finish `ee-dkv` and capture any recovery/config/doc drift,
  2. finish `ee-vaa` and confirm whether any missed contract-bypassing call sites remain,
  3. let `ee-fyk` decide whether the next paid move is live validation or cleanup/remediation first.
- Normalization recommendation: after this verification pass, archive clearly historical top-level plans and remove stale "current/in progress" signals from superseded planning documents so `.plans/` reflects the real execution lane.

---

## Questions this plan must answer

1. Which plan is the true active source of truth right now: the March 12 validation plan, the March 14 rollout plan, or this new March 15 verification plan?
2. Are any older top-level `.plans/` files still incorrectly sitting as active when they should be archived or marked superseded?
3. Does the implemented AI recovery lane match the docs in:
   - `docs/AI-RECOVERY-LANE-CONTRACT.md`
   - `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`
   - `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
4. Which scripts currently use lane-specific validator tools, and what exact tool names / prompt expectations / re-entry behavior are wired in code?
5. Is the YAML/config actually prepared for this recovery system in real runnable configs like `configs/cod-test.yaml` and any Phase3-only configs?
6. Are sibling repos and their READMEs/docs/plans in sync with the current emotion-engine contract, or do we still have drift to clean up before another live run?
7. After the verification sweep, what should Derrick pay for next: a live run, a drift fix pass, or a narrower bug/debug lane?

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A truthful verification pass over the current emotion-engine recovery rollout and sibling polyrepo state. The plan now records: (1) the real open-vs-complete Beads truth, (2) the fact that the March 12 Phase3-only plan is no longer the active source of truth, (3) the exact live AI-recovery contracts, re-entry mechanics, validator-tool contracts, and runtime limits implemented in code, (4) confirmation that the sibling runtime/code surface is aligned and that the remaining cross-repo drift is historical docs only, and (5) the actual next blocker before another paid run: runnable configs do not yet activate the AI recovery lane, so a live run now would not meaningfully validate the newly implemented recovery path.

**Commits:**
- None in this verification pass.

**Lessons Learned:** The risky drift is no longer hidden polyrepo code drift; it is truth drift between implementation, config, and docs. The repo can look “architecturally done” while still failing the more practical test of whether the shipped runnable YAML actually turns the new system on. That means the right pre-run discipline here is: verify activation/config truth first, then spend money on live validation.

---

*Drafted on 2026-03-15*