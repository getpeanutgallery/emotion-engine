# Polyrepo Drift Classification and Remediation Notes — 2026-03-14

**Status:** Audit classification complete  
**Coordination owner:** `emotion-engine`  
**Task bead:** `ee-hdr`

---

## Purpose

Classify the concrete drift findings already documented in:

- `docs/POLYREPO-OWNERSHIP-MODEL-AUDIT-2026-03-14.md`
- `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md`

This document is still **classification only**. It does **not** move code, packages, or fixture packs yet.

---

## Classification legend

- **(a) intentional / coherent** — current state is consistent with the ownership model and should generally be left alone
- **(b) mild drift but acceptable** — not ideal, but not a true repo-boundary violation; should usually be fixed opportunistically
- **(c) real ownership violation requiring code/package/fixture relocation** — boundary is materially broken and remediation should move ownership back to the correct repo
- **(d) ambiguous and needing Derrick’s architectural decision** — evidence supports more than one coherent end-state, so remediation should wait for an explicit repo-boundary call

---

## Executive classification summary

### Real ownership violations requiring relocation

1. **`tools` runtime shim inside `emotion-engine`** → **(c)**
2. **`tools/emotion-lenses-tool.cjs` lagging behind the engine-local canonical implementation** → **(c)**

### Mild drift but acceptable / should be cleaned up

3. **Dependency pinning + locally mutated installed dependency obscuring true package ownership** → **(b)**
5. **`digital-twin-openrouter-emotion-engine` README drift from manifest/runtime** → **(b)**

### Ambiguous and needs Derrick’s architectural decision

4. **Duplicated provider twin-pack in `emotion-engine` vs sibling pack repo** → **(d)**

There were **no findings in category (a)** among the concrete drift cases already documented.

---

## Detailed classification by finding

## Finding 1 — `tools` package entrypoint inside `emotion-engine` is a shim back into `emotion-engine`

**Finding reference:** `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` §1  
**Classification:** **(c) real ownership violation requiring code/package relocation**

### Why this classification

This is more than a harmless wrapper.

`emotion-engine/node_modules/tools/emotion-lenses-tool.cjs` resolves back into `emotion-engine/server/lib/emotion-lenses-tool.cjs`, which means:

- package/config references imply sibling ownership by `tools`
- runtime behavior is actually owned by `emotion-engine`
- the sibling repo no longer acts as the visible source of truth for the code being executed

That is a direct repo-boundary break, not just documentation drift.

### Correct owning repo

**Recommended owner:** `tools`

Rationale:

- Derrick’s clarified architectural intent in the active plan is that shared tool code should live in the sibling polyrepo rather than remain engine-local
- `tools` already exists as the reusable package surface for this exact area
- leaving the code canonical in `emotion-engine` would effectively bless the current monorepo-in-disguise behavior that the audit was started to detect

### Safest remediation path

1. Treat `tools` as the target canonical owner for `emotion-lenses-tool`
2. Diff the engine-local implementation against the sibling implementation and identify the canonical behavior that must be preserved
3. Port the validator-tool-loop / structured-output / metadata behavior into `../tools`
4. Add contract tests in `tools` that lock the current engine-observed behavior before any runtime rewiring
5. Switch `emotion-engine` to consume the sibling implementation directly rather than a locally rewritten installed file
6. Remove the local `node_modules/tools/emotion-lenses-tool.cjs` shim back into `../../server/lib/...`
7. Leave behind, at most, a thin engine-local adapter only if the engine truly needs repo-local wiring around a sibling-owned implementation

### Major migration risks / validation needs

- preserving the current validator-tool-loop contract and JSON-only response semantics
- preserving current exported helpers and returned completion metadata
- ensuring configs/tests that reference `tools/emotion-lenses-tool.cjs` still resolve correctly after ownership is restored
- avoiding a transient split where both repos partially own the same contract
- validating that npm/git dependency installation produces the same runtime behavior on a clean checkout, not only in the local workspace

### Blocker or deferrable?

**Should block later work that changes `emotion-lenses-tool` semantics or shared tool contracts.**

It does **not** need to block unrelated engine work, but it should block any further contract rollout or tool-behavior changes that would deepen the ownership split.

---

## Finding 2 — `tools/emotion-lenses-tool.cjs` has materially drifted behind the in-engine implementation

**Finding reference:** `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` §2  
**Classification:** **(c) real ownership violation requiring code relocation**

### Why this classification

This is the duplicate-implementation side of Finding 1.

The engine-local copy now owns the meaningful behavior, while the sibling copy lags behind. That means:

- bug fixes can land in one place and silently miss the other
- the sibling package is no longer trustworthy as a canonical implementation
- runtime ownership cannot be inferred from the sibling repo itself

That is substantive ownership drift, not just stale docs.

### Correct owning repo

**Recommended owner:** `tools`

This finding should be remediated as the same stream as Finding 1, not as an independent parallel rewrite.

### Safest remediation path

1. Snapshot current engine behavior with regression/contract tests first
2. Port the missing behavior into `../tools` instead of trying to preserve long-term canonical ownership in both places
3. Make `emotion-engine` consume that sibling implementation directly
4. Reduce the engine-local copy to either:
   - no copy at all, or
   - a thin compatibility wrapper that clearly delegates to `tools`
5. Delete any remaining duplicated logic once parity is proven

### Major migration risks / validation needs

- validator-tool-loop behavior drift under real provider retries
- exported helper surface differences breaking current imports or tests
- subtle differences in invalid-output handling, recovery behavior, or metadata shape
- accidentally regressing current production behavior while “moving code back home”

Validation should include:

- contract tests for exported helpers
- replayed/fixture-backed behavior checks for representative analysis flows
- at least one clean-install verification where `emotion-engine` runs with the sibling package as the actual source

### Blocker or deferrable?

**Same blocker level as Finding 1.**

This should be treated as part of the same ownership-restoration effort and should block further feature work in this tool surface until the owner is made explicit again.

---

## Finding 3 — Dependency pinning + locally mutated installed dependency obscures true package owners

**Finding reference:** `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` §3  
**Classification:** **(b) mild drift but acceptable**

### Why this classification

This finding mixes two different things:

- **git SHA pinning across sibling repos** — normal and acceptable in a polyrepo
- **local rewrite of an installed dependency to point back into `emotion-engine`** — bad, but already captured more directly by Findings 1 and 2

The pinning itself is not a repo-boundary violation. It becomes misleading mainly when paired with the hidden runtime rewrite.

So this finding is best treated as **packaging clarity drift**, not as its own separate ownership violation.

### Correct owning repo

Ownership here is split by concern:

- `emotion-engine` owns its dependency declarations and lockfile clarity
- sibling repos own their own source histories

There is no single “move this whole thing to another repo” answer for Finding 3.

### Safest remediation path

1. First resolve the canonical owner for the `tools` implementation path (Findings 1 and 2)
2. After that, refresh dependency pins intentionally to the chosen canonical commits
3. Stop mutating installed package files in ways that hide the true owner
4. If special wiring is needed for local development, make it explicit in source/dev tooling rather than inside committed installed artifacts

### Major migration risks / validation needs

- lockfile churn across sibling repos
- accidental mismatch between workspace state and clean-install CI state
- developers believing they are testing a sibling package when they are actually testing engine-local code

Validation should include:

- clean-install runs
- lockfile review
- verification that runtime owner is inferable from source + dependency graph without manual workspace knowledge

### Blocker or deferrable?

**Deferrable as a standalone item.**

It should be cleaned up as part of the `tools` ownership restoration, but it does not need to block unrelated work by itself.

---

## Finding 4 — `emotion-engine` ships and uses a duplicated provider twin-pack instead of the sibling pack repo

**Finding reference:** `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` §4  
**Classification:** **(d) ambiguous and needing Derrick’s architectural decision**

### Why this classification

This is the finding that most clearly still needs an explicit architectural call.

There are **two coherent models**:

#### Model A — sibling pack repo is canonical

- `digital-twin-emotion-engine-providers` owns the provider cassette pack
- `emotion-engine` should consume that pack directly for tests/replay
- the in-engine fixture copy should be removed or reduced to a generated cache

#### Model B — engine-local fixtures are canonical for engine tests

- `emotion-engine/test/fixtures/...` is the real owner of test cassettes used by engine tests
- the sibling pack repo is optional, secondary, or should be archived/reduced
- test ergonomics and repo-local determinism are valued over strict external pack ownership

The ownership-model audit says pack repos are the nominal owners of committed cassette packs, but the live test setup currently behaves like Model B. That is exactly the kind of mismatch that needs Derrick to choose the intended end-state.

### Correct owning repo

**Needs Derrick’s decision.**

If Derrick reaffirms strict polyrepo pack ownership, the correct owner is:

- `digital-twin-emotion-engine-providers`

If Derrick decides engine tests should own their default fixtures locally, the correct owner becomes:

- `emotion-engine/test/fixtures/digital-twin-emotion-engine-providers`

Both are viable; the repo boundary just needs to be explicit.

### Safest remediation path

Do **not** move fixtures yet.

Instead:

1. Derrick chooses canonical ownership model A or B
2. Then perform one of these paths:

**If Model A (sibling pack canonical):**
- make the sibling pack the single source of truth
- update tests to consume the sibling pack by default
- remove or generate the engine-local duplicate from the pack repo
- add a sync/validation check so future cassette divergence is caught immediately

**If Model B (engine-local fixtures canonical):**
- bless the in-engine fixture pack as canonical for tests
- demote, deprecate, or archive the sibling pack repo
- update docs so pack ownership is no longer misleading

### Major migration risks / validation needs

- test determinism and local developer ergonomics
- whether CI/test runners can reliably resolve sibling-pack paths
- cassette drift during migration if both copies continue to receive edits
- replay compatibility assumptions in `digital-twin-router` / pack preflight helpers
- whether downstream repos or docs assume the sibling pack remains published/canonical

Validation should include:

- green provider tests on clean checkout/CI
- explicit verification of default `DIGITAL_TWIN_PACK` resolution path
- a no-divergence check if two copies temporarily coexist during migration

### Blocker or deferrable?

**Blocks pack-boundary remediation, but can be deferred for unrelated runtime work.**

Do not start moving provider cassette fixtures until Derrick chooses the canonical owner.

---

## Finding 5 — `digital-twin-openrouter-emotion-engine` docs have drifted from the current manifest/runtime shape

**Finding reference:** `docs/POLYREPO-DRIFT-FINDINGS-AUDIT-2026-03-14.md` §5  
**Classification:** **(b) mild drift but acceptable**

### Why this classification

This is classic docs drift:

- manifest/runtime points at the newer cassette id
- README still describes the older cassette/layout

It is misleading, but it is not a meaningful ownership violation.

### Correct owning repo

`digital-twin-openrouter-emotion-engine`

### Safest remediation path

- update the README to match `manifest.json`
- optionally add a tiny docs check or release checklist item so future pack renames update the README at the same time

### Major migration risks / validation needs

- very low risk
- mainly validate that examples, cassette id, and file tree in the README reflect the actual manifest

### Blocker or deferrable?

**Deferrable.**

Should be fixed, but it should not block the ownership-restoration work.

---

## Recommended remediation ordering

### Priority 1 — restore explicit `tools` ownership

Address Findings **1** and **2** together, with Finding **3** cleanup folded in.

Recommended sequence:

1. choose `tools` as canonical owner for `emotion-lenses-tool`
2. capture engine behavior with regression tests
3. port missing behavior into `tools`
4. switch engine runtime to the real sibling implementation
5. remove local installed-package rewrites and refresh dependency pins

### Priority 2 — get a decision on provider twin-pack ownership

Address Finding **4** only after Derrick picks the canonical owner.

### Priority 3 — clean up docs drift

Address Finding **5** opportunistically.

---

## Bottom line

The audit findings are **not** all the same kind of problem.

- The `tools` findings are real ownership violations and should be remediated by restoring explicit sibling ownership.
- The provider twin-pack duplication is real drift, but it still needs Derrick to choose which repo is supposed to be canonical.
- The dependency-resolution and pack-README findings are secondary cleanup items, not the core architectural break.

That means the safest next step is **not** to move everything at once. It is to:

1. create implementation work for the `tools` ownership correction
2. get Derrick’s explicit decision on provider pack ownership
3. then perform the lower-risk packaging/docs cleanup around those decisions
