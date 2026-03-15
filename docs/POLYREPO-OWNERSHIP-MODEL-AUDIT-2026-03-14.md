# Peanut Gallery polyrepo ownership model audit — 2026-03-14

**Status:** Audit complete  
**Coordination owner:** `emotion-engine`  
**Task bead:** `ee-9s4`

---

## Purpose

Reconstruct the intended ownership model across the Peanut Gallery sibling repos from durable evidence already in the repos: package metadata, READMEs, active architecture docs, config/import patterns, and existing audit notes.

This is an **ownership-model audit**, not a remediation pass.

---

## Short conclusion

The intended model is a **bounded polyrepo**, not a fake monorepo and not a pure package-per-file split.

`emotion-engine` is the canonical runtime orchestrator and script-contract owner, but it is **not** supposed to absorb every adjacent concern. The sibling repos are intended to keep distinct boundaries:

- `ai-providers` owns provider adapters and transport-level failure classification
- `retry-strategy` owns generic retry primitives
- `goals` owns evaluation-goal content
- `cast` owns persona/content definitions
- `digital-twin-router` owns replay/record interception and recorded-failure refs
- `digital-twin-core` owns cassette schema/validation and replay core
- digital-twin pack repos own committed cassette packs, not runtime policy
- `tools` appears intended as a reusable package surface for shared tools, but current durable evidence says it is now **downstream of** canonical `emotion-engine` contract ownership rather than the source of truth

So the ownership model is **polyrepo with a strong central engine**, plus supporting substrate/content/schema/pack repos around it.

---

## Evidence used

Primary durable evidence:

- `emotion-engine/README.md`
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `emotion-engine/docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- package metadata for every repo in scope
- cross-repo config/import references inside `emotion-engine`
- `tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
- README / manifest structure in the digital-twin repos

Important evidence patterns:

- `emotion-engine/package.json` depends on sibling repos via `git+ssh`
- engine configs reference sibling content/tool paths such as `tools/emotion-lenses-tool.cjs`, `cast/.../SOUL.md`, and `goals/...md`
- engine runtime code imports `ai-providers`
- digital-twin repos clearly separate router/core/schema from pack/cassette content
- existing engine architecture docs explicitly bound sibling scope and say what should remain outside `emotion-engine`

---

## Reconstructed ownership model by repo

### 1) `emotion-engine`

**Intended responsibility boundary**

Canonical runtime orchestrator for the Peanut Gallery analysis pipeline.

It owns:

- pipeline orchestration (`server/run-pipeline.cjs`)
- phase/script execution
- repo-local script result / failure / recovery contracts
- integration of sibling repos into a runnable pipeline
- canonical runtime behavior for the active analysis lanes

**Appears to be**

- **logic/code owner**
- **package surface**
- coordination repo for cross-repo rollout docs/plans

**Durable evidence**

- `README.md` describes it as the primary entrypoint and orchestrator
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` and `docs/IMPLEMENTATION-EXECUTION-GRAPH.md` repeatedly name `emotion-engine` as the repo where shared contract plumbing lands first
- runtime code imports sibling repos rather than inlining their nominal responsibilities as first-class owners

**What should not live in `emotion-engine`**

From current docs and repo boundaries, these concerns should stay outside the engine:

- provider adapter ownership and transport-layer error classification (`ai-providers`)
- generic retry primitives (`retry-strategy`)
- persona content and cast definitions (`cast`)
- goal/evaluation content files (`goals`)
- replay interception and recorded-failure persistence logic (`digital-twin-router`)
- cassette schema/versioning/validation (`digital-twin-core`)
- committed cassette-pack content (`digital-twin-*` pack repos)

**Boundary note**

`emotion-engine` is allowed to be the **canonical contract owner** for the current runtime behavior. That does not mean every shared helper or every content/schema artifact belongs here.

---

### 2) `tools`

**Intended responsibility boundary**

Reusable tool package surface for engine-adjacent helpers, especially `emotion-lenses-tool.cjs`.

**Appears to be**

- primarily a **package surface**
- historically a **logic/code owner** for the shared emotion-lenses tool, but no longer the canonical contract owner based on current evidence

**Durable evidence**

- `tools/package.json` publishes a package with `main: emotion-lenses-tool.cjs`
- `tools/README.md` explicitly says: `emotion-engine` now owns the canonical emotion-lenses contract/runtime and this repo should be treated as a downstream package surface
- `tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md` documents that current runtime ownership has already shifted upstream into `emotion-engine/server/lib/emotion-lenses-tool.cjs`
- `emotion-engine` configs/tests/runtime still reference `tools/emotion-lenses-tool.cjs`, so the package surface still matters in practice

**What should not live in `emotion-engine`**

If the original polyrepo intent is restored more strictly, reusable tool-package ownership should live here rather than as a forked canonical implementation inside the engine.

**What should also not happen**

Current durable docs are equally explicit that `tools` should **not** redefine the canonical contract by accident. If kept, it should be a downstream compatibility surface aligned to `emotion-engine`, not a rival source of truth.

**Boundary note**

`tools` is the one repo whose intended ownership is currently the most ambiguous in practice: historically “tool code should live here,” but current durable docs say canonical contract/runtime ownership is upstream in `emotion-engine`.

---

### 3) `ai-providers`

**Intended responsibility boundary**

Provider adapter substrate and transport boundary for AI calls.

It owns:

- provider interface and adapter implementations
- normalized provider failure classification
- sanitized provider debug/raw capture surfaces
- integration with `digital-twin-router`

**Appears to be**

- **logic/code owner**
- **package surface**

**Durable evidence**

- `README.md` says it is the adapter substrate for Emotion Engine and sibling repos
- `README.md` explicitly says it stays at the provider/transport layer and does **not** own script-level success/failure envelopes or recovery policy
- adapter implementations import `digital-twin-router`
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` calls it “transport/provider substrate, not script-envelope owner”

**What should not live in `emotion-engine`**

- raw provider adapter implementations
- provider-specific transport normalization/classification concerns
- canonical provider debug/error-shape ownership

**What should also not live in `ai-providers`**

- script-level success/failure/recovery envelopes
- workflow/pipeline policy

---

### 4) `retry-strategy`

**Intended responsibility boundary**

Generic retry strategy primitives.

It owns:

- retry implementations such as none/fixed-delay/exponential/adaptive
- generic execution wrappers for retries

**Appears to be**

- **logic/code owner**
- **package surface**

**Durable evidence**

- `README.md` is purely about reusable retry primitives
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` explicitly says generic retry primitives that do not own result envelopes or AI-specific failure semantics are out of scope for the current contract rollout

**What should not live in `emotion-engine`**

- generic reusable retry algorithms that are not engine-specific

**What should also not live in `retry-strategy`**

- script contracts
- AI-lane recovery policy semantics
- result-envelope ownership

---

### 5) `goals`

**Intended responsibility boundary**

Goal/evaluation content repo.

It owns:

- markdown goal definitions used as input content
- naming/layout for goal references

**Appears to be**

- **content repo**

**Durable evidence**

- `README.md` defines the repo as GOAL.md-style evaluation objectives
- files are root-level markdown content, not runtime code
- `emotion-engine` configs reference goal files by path
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` explicitly marks `../goals` as content/spec input, not a runtime contract owner

**What should not live in `emotion-engine`**

- durable goal-library content
- canonical goal file layout/curation

---

### 6) `cast`

**Intended responsibility boundary**

Persona/content repo for the cast system.

It owns:

- persona definitions (`SOUL.md`, config, references)
- cast-member content and supporting truth/reference files
- cast-generation workflow docs

**Appears to be**

- **content repo**

**Durable evidence**

- `README.md` describes it as the collection of personas behind the feedback
- repo structure is per-cast-member content/config rather than runtime pipeline code
- `emotion-engine` configs reference cast paths like `cast/impatient-teenager/SOUL.md`
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` explicitly excludes `../cast` from the current runtime contract boundary

**What should not live in `emotion-engine`**

- canonical cast-member definitions and content-library curation
- persona truth/reference documents

---

### 7) `digital-twin-router`

**Intended responsibility boundary**

Replay/record interception boundary between provider transports and cassette persistence.

It owns:

- transport wrapping for record/replay/off modes
- stable recorded-failure refs and metadata
- replay fidelity for provider failures

**Appears to be**

- **logic/code owner**
- **package surface**
- **replay/schema-adjacent repo**

**Durable evidence**

- `README.md` defines it as router/interceptor wrapper for recording/replay with AI provider and engine transports
- it depends on `digital-twin-core`
- `README.md` emphasizes recorded failure refs and fidelity, not pipeline policy
- engine docs say its contract role is the failure persistence/replay boundary for provider interactions

**What should not live in `emotion-engine`**

- canonical transport interception logic
- stable recorded-failure identifier format
- replay persistence rules for provider interactions

**What should also not live in `digital-twin-router`**

- script-level recovery policy
- engine workflow semantics

---

### 8) `digital-twin-core`

**Intended responsibility boundary**

Core replay/cassette schema and validation library.

It owns:

- cassette schema/versioning
- cassette validation
- hashing/normalization/redaction primitives
- TwinStore / TwinEngine core runtime

**Appears to be**

- **logic/code owner**
- **package surface**
- **replay/schema repo**

**Durable evidence**

- `README.md` defines it as the core library for recording/storing/replaying HTTP interactions
- `README.md` explicitly documents cassette schema v1.1 and validation of richer recorded failure metadata
- `emotion-engine/docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` says it is the durable schema owner for replay artifacts, not the policy owner for script recovery

**What should not live in `emotion-engine`**

- cassette schema ownership
- cassette version evolution
- replay artifact validation core

---

### 9) `digital-twin-openrouter-emotion-engine`

**Intended responsibility boundary**

Committed cassette/twin pack for OpenRouter emotion-engine interactions.

**Appears to be**

- **pack repo**

**Durable evidence**

- package description says “Twin pack for OpenRouter emotion engine digital twin recordings”
- `manifest.json` defines a default cassette
- repo structure is pack-oriented (`cassettes/`, `manifest.json`, `index.js`), not runtime policy or adapter logic

**What should not live in `emotion-engine`**

- canonical committed OpenRouter cassette-pack content
- pack-manifest ownership for reusable replay datasets

---

### 10) `digital-twin-emotion-engine-providers`

**Intended responsibility boundary**

Committed cassette/twin pack for provider-oriented engine tests.

**Appears to be**

- **pack repo**

**Durable evidence**

- package description says “Digital twin pack for emotion-engine AI provider tests”
- `manifest.json` maps cassette ids to pack files
- exported surface is a manifest/cassette pack, not provider logic or replay-core logic
- engine tests explicitly assume a provider-focused cassette pack layout

**What should not live in `emotion-engine`**

- committed provider-test cassette pack ownership
- reusable pack manifest/layout as a standalone artifact set

---

## Cross-repo ownership rules implied by the evidence

### Rule 1: `emotion-engine` is the canonical runtime orchestrator, not the owner of every adjacent layer

The engine is the center of the system, but the architecture docs repeatedly split provider transport, replay persistence, cassette schema, content, and pack data into sibling repos.

### Rule 2: provider, replay, schema, content, and pack concerns are intentionally split

The current docs do not describe a monorepo collapsed into `emotion-engine`. They describe a layered system where:

- provider substrate -> `ai-providers`
- replay interception -> `digital-twin-router`
- cassette schema/core -> `digital-twin-core`
- content inputs -> `goals`, `cast`
- cassette packs -> digital-twin pack repos

### Rule 3: `retry-strategy`, `goals`, and `cast` are explicitly out of the current contract-rollout boundary

This is a strong signal that they are recognized as sibling repos with valid boundaries, but not runtime contract owners for the engine’s success/failure/recovery layer.

### Rule 4: `tools` is a special-case sibling

The durable evidence does **not** support “`tools` is currently the canonical owner of the emotion-lenses runtime.” It supports a narrower statement:

- `tools` still matters as a package surface
- but canonical runtime/contract ownership for the active emotion-lenses path has already moved to `emotion-engine`

That means any future correction has to make a conscious architectural choice:

1. restore stricter sibling ownership by moving canonical reusable tool logic back into `tools`, or
2. accept `emotion-engine` as the canonical owner and keep `tools` as a thin downstream compatibility surface

Today’s durable docs currently align with option 2.

---

## Practical ownership map

| Repo | Reconstructed role | Classification |
| --- | --- | --- |
| `emotion-engine` | Canonical runtime orchestrator and script-contract owner | logic/code owner; package surface |
| `tools` | Downstream shared-tool package surface; canonical ownership currently ambiguous historically but upstream docs now point to `emotion-engine` | package surface |
| `ai-providers` | Provider adapter/transport substrate | logic/code owner; package surface |
| `retry-strategy` | Generic retry primitives | logic/code owner; package surface |
| `goals` | Goal/evaluation content library | content repo |
| `cast` | Persona/cast content library | content repo |
| `digital-twin-router` | Replay interception + recorded-failure refs | logic/code owner; package surface; replay-boundary repo |
| `digital-twin-core` | Cassette schema/validation/core replay library | logic/code owner; package surface; replay/schema repo |
| `digital-twin-openrouter-emotion-engine` | OpenRouter cassette pack | pack repo |
| `digital-twin-emotion-engine-providers` | Provider-test cassette pack | pack repo |

---

## Bottom line

The intended ownership model is not “everything important belongs in `emotion-engine`.”

It is:

- **engine-centric orchestration in `emotion-engine`**
- **provider substrate in `ai-providers`**
- **generic retry primitives in `retry-strategy`**
- **persona/goal content in `cast` and `goals`**
- **replay/persistence/schema split across `digital-twin-router`, `digital-twin-core`, and the pack repos**
- **a still-unsettled-but-currently downstream `tools` package surface**

The clearest durable ownership ambiguity is `tools`; everything else reads as intentionally separated and still conceptually coherent.
