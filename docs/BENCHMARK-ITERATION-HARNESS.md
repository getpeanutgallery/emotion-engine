# Benchmark iteration harness contract

**Status:** Active design contract  
**Established:** 2026-03-30

---

## Purpose

This document defines the reusable **benchmark-iteration harness** for `emotion-engine`.

The harness is the policy and workflow layer wrapped around an existing benchmark runner and comparator system. It answers questions such as:

- what counts as a baseline, challenger, attempt, and lane
- how one benchmark-improvement session should run
- how many attempts are allowed before stopping
- what must be logged so a future session can resume honestly
- how to avoid “winning the fixture” while making the underlying system worse

This contract is intentionally practical. It is meant to support disciplined iteration loops now, without pretending we already need a large autonomous optimizer.

---

## Separation from the truth benchmark comparator core

This harness is **not** the truth benchmark comparator/scoring contract.

The comparator core remains responsible for:

- loading fixture truth and produced artifacts
- validating schemas and paths
- comparing output against truth
- computing artifact/aggregate accuracy and coverage
- writing benchmark reports

That contract already lives in:

- `docs/TRUTH-BENCHMARK-COMPARATOR-SCORING-CONTRACT.md`

The benchmark-iteration harness adds a separate layer on top:

- selecting a narrow benchmark lane to iterate on
- defining session budgets and stop conditions
- requiring challenger review before implementation
- recording every attempt in a durable ledger
- enforcing anti-overfitting / anti-fixture-specialization rules
- making future sessions resumable without rediscovery

**Bottom line:**
- comparator core = *evaluation mechanics*
- iteration harness = *improvement workflow and guardrails*

The harness must stay generic enough to work for dialogue today, and for other artifact types or non-dialogue benchmarks later.

---

## Scope

This contract defines:

- benchmark-iteration terminology
- the standard per-attempt loop
- challenger review expectations
- session caps and stop conditions
- anti-overfitting rules
- required logging and ledger expectations
- guidance for narrow configs and benchmark manifests
- the minimum reusable shape future helper tooling should respect

This contract does **not** define:

- comparator field semantics
- truth fixture authoring rules beyond what iteration needs
- a final CLI/script implementation
- autonomous code-modifying behavior
- repo-wide scheduling or orchestration policy

---

## Core design rules

1. **Optimize against a measured baseline, not vibes.**  
   Every lane starts from a recorded benchmark result.

2. **Keep the comparator core boring and separate.**  
   The harness consumes benchmark outputs; it does not redefine comparator truth/scoring semantics.

3. **One lane, one goal, one narrow rerun surface.**  
   Each iteration lane should target a specific artifact family or benchmark problem, not a giant mixed bag.

4. **One main change per scored attempt.**  
   Bundled fixes make the score unreadable.

5. **Every proposed change gets challenged before implementation.**  
   If the fix sounds fixture-specific or weakly justified, reject it.

6. **Every attempt leaves a durable trail.**  
   A future session must be able to see what was tried, why, and what changed.

7. **Stop while judgment is still honest.**  
   The harness exists to improve systems, not to grind a benchmark until it becomes a local exploit.

---

## Terminology

### Fixture

A named benchmark dataset and truth package used for evaluation.

Examples:
- a specific trailer fixture
- a specific audio corpus fixture
- a specific structured test case pack

A fixture owns:
- source evidence
- truth artifacts
- one or more benchmark manifests

### Artifact

A produced output that can be benchmarked against truth.

Examples:
- dialogue transcript JSON
- music summary JSON
- recommendation JSON
- chunk analysis JSON
- metrics JSON

### Lane

A reusable, resumable optimization track focused on one benchmark question.

A lane defines:
- what is being improved
- which narrow config to run
- which benchmark manifest to use
- what files are in-bounds for changes
- target score / try caps / stop conditions
- where the durable ledger lives

Examples:
- improve generic dialogue extraction against a human-reviewed gold benchmark
- improve chunk alignment behavior for emotional-analysis derivations
- harden summary packaging smoke checks for a release surface

A lane is narrower than “the whole benchmark system.”

### Attempt

One scored iteration cycle inside a lane.

An attempt includes:
- a concrete proposal
- challenger review
- acceptance or rejection
- at most one main implementation change if accepted
- a narrow rerun of the configured benchmark path
- recorded results and deltas

Rejected proposals still count as part of the lane history, but do not count as a scored attempt unless code/config changed and the benchmark was rerun.

### Baseline

The current reference result for a lane before a new attempt is judged.

The baseline may be:
- the first recorded run in a lane, or
- the best accepted prior attempt, or
- the most recent trusted rerun chosen by lane policy

A lane ledger must state which result is currently considered baseline.

### Challenger

The candidate change being proposed to beat the current baseline.

A challenger is the combination of:
- the change hypothesis
- the actual implementation delta, if accepted
- the resulting benchmark run

### Challenger review

A pre-implementation challenge step that asks whether the proposed fix is actually valid, generalizable, and worth spending a try on.

This is a guardrail against:
- fixture-specific hacks
- vague changes with no prediction
- changes that widen scope unnecessarily
- multiple bundled hypotheses disguised as one attempt

### Target score

A predeclared score or quality threshold at which the lane may stop early.

Examples:
- accuracy `>= 0.90`
- zero hard benchmark errors
- “good enough for now” based on a specific acceptance threshold recorded in the lane

### Session cap

The maximum number of scored attempts allowed in one human/agent work session unless explicitly extended.

Session caps prevent score-chasing fatigue and accidental overfitting.

### Stop condition

Any rule that says the lane should stop for now.

Typical stop conditions include:
- hit the target score
- no clear improvement over recent attempts
- regressions outweigh gains
- overfitting risk rises
- next step requires broader design work rather than another tweak
- session cap reached

### Narrow config

A purpose-built run configuration that executes only the minimum pipeline surface required for the lane’s artifact and benchmark.

### Benchmark manifest

The benchmark definition used by the runner for a specific fixture or sub-fixture scope.

For iteration lanes, the manifest should usually be narrower than the full benchmark when that narrower scope gives faster, cleaner feedback.

### Ledger

The durable, append-only or carefully updated record of lane state across sessions.

A ledger must preserve:
- baseline
- attempt history
- acceptance/rejection rationale
- result deltas
- current stopping rationale
- next hypothesis pool

---

## Lane contract

Each benchmark-iteration lane should define, at minimum:

- **lane id or stable name**
- **goal**
- **artifact scope**
- **benchmark fixture / manifest path**
- **narrow config path**
- **ledger path**
- **allowed change surfaces**
- **target score or completion threshold**
- **session try cap**
- **required stop conditions**
- **anti-overfitting constraints**

The lane definition may live in:
- a machine-readable config file
- a human-readable plan or ledger doc
- both

Future helper tooling should assume the lane is the unit of resumable work.

---

## Standard per-attempt loop

Every scored benchmark-iteration attempt should follow this order.

### 0) Resume context

Before proposing anything new:

- read the current lane ledger
- identify the active baseline
- review the last accepted attempt and recent failures/rejections
- confirm remaining try budget for the session

### 1) Propose one concrete change

Write down:
- the hypothesis
- why it might improve the score
- what specific mismatch bucket or failure mode it targets
- what files/surfaces would be touched
- what result you predict

Good proposal qualities:
- narrow
- testable
- grounded in benchmark evidence
- generic enough to plausibly help outside the current fixture

### 2) Run challenger review

Before implementation, challenge the proposal.

Required challenger-review questions:

1. **What exact benchmark evidence suggests this change?**
2. **Is the proposal generic, or is it secretly using fixture lore?**
3. **Could this hurt non-benchmarked cases even if the score rises?**
4. **Is this actually one hypothesis, or multiple bundled changes?**
5. **Is the narrow config still sufficient, or is the proposal widening scope?**
6. **What would count as success, regression, or inconclusive outcome?**

### 3) Accept or reject the challenger

If rejected:
- record the rejection in the ledger
- state why it was rejected
- move to a new proposal or stop

If accepted:
- record the acceptance rationale
- name the exact files allowed to change
- proceed with one main change

### 4) Implement the smallest useful change

Implementation rules:
- keep the change source-owned in the correct repo
- keep it narrow
- avoid opportunistic unrelated cleanup in the same attempt
- avoid benchmark-only branches, constants, or fixture name checks

### 5) Run the narrow benchmark path

Use the lane’s configured narrow config and benchmark manifest.

The run should:
- regenerate only the relevant artifact surface when possible
- preserve exact command lines used
- write benchmark output/report artifacts in a stable place

### 6) Record results

For the attempt, record at minimum:
- benchmark status
- accuracy and coverage
- baseline vs challenger delta
- main improvement buckets
- main regressions/error buckets
- whether the change becomes the new baseline

### 7) Decide next state

After the run, choose one:
- adopt as new baseline and continue
- keep old baseline and reject the change for future work
- stop because a stop condition has been met

This final decision must be explicit in the ledger.

---

## Challenger rubric

A challenger should be accepted only if it clears most of the following rubric.

### Strong challenger

A strong challenger:
- names a specific observed mismatch bucket
- predicts why the score should move
- stays within allowed change surfaces
- remains generic across fixtures/artifact sources
- can be validated with the lane’s narrow rerun
- does not require bundled unrelated fixes

### Weak challenger

A weak challenger:
- says only “improve prompt” or “make it smarter”
- has no measurable prediction
- depends on fixture-specific vocabulary or named entities
- changes multiple systems at once
- requires a broader rerun without justification
- cannot explain likely regression risk

### Rejection triggers

Reject or heavily challenge a proposal if it:
- mentions the current fixture, franchise, character, brand, or scenario in the actual product logic/prompt
- adds rules that appear tailored to one benchmark artifact shape without broader justification
- broadens the run unnecessarily
- changes truth/comparator semantics just to make the score look better
- bundles multiple primary fixes into one attempt
- spends a try on a hypothesis already disproven in recent history without new evidence

---

## Session caps and stop conditions

Each lane must declare its own caps, but the following defaults are recommended.

### Recommended default caps

- **Scored attempts per session:** `3-5`
- **Primary implementation delta per attempt:** `1`
- **Broader-scope redesigns per lane session:** `0-1`

### Required stop conditions

Stop the current lane session when any of these is true:

1. **Target score reached.**
2. **Session cap reached.**
3. **Two consecutive attempts are flat or noisy without a clear signal.**
4. **A score increase appears to come from fixture specialization rather than system improvement.**
5. **The next likely fix requires changing comparator/truth contracts instead of the system under test.**
6. **The next step is clearly a larger design lane, not another small iteration.**
7. **Human review is needed before trusting further optimization.**

### Recommended “flattening” heuristic

A lane should consider stopping when recent attempts produce one or more of:
- tiny score movement with no meaningful reduction in root error buckets
- score tradeoffs that just shuffle failures between adjacent fields
- repeated transcript/timing shifts with no structural stabilization
- growing complexity in prompts/code for diminishing gains

### Stop note requirement

When stopping, the ledger must say:
- why we stopped
- whether the current best result is trusted
- what the most promising next hypothesis is, if any

---

## Anti-overfitting / anti-fixture-specialization rules

These rules are mandatory.

### Hard prohibitions

Do **not**:
- add fixture-name checks or path-specific behavior
- add brand/franchise/character-specific prompt hints just because they help one benchmark
- hardcode expected transcript fragments, labels, or truth values into product logic
- change truth data or comparator tolerances to hide system weaknesses unless the truth/comparator was genuinely wrong and that correction is handled in its own owning lane
- use ledger knowledge to silently bias the product output toward the current fixture

### Strong caution areas

Treat these as suspicious and require explicit justification:
- prompt wording that mirrors the current fixture’s language too closely
- rules that only make sense for one media type while being presented as general
- normalization rules that erase meaningful disagreement instead of improving extraction quality
- broad “fallbacks” that mostly turn hard mistakes into vague output

### Positive guidance

Prefer changes that improve:
- segmentation continuity
- speaker continuity and abstention behavior
- structural validity and consistency
- stable normalization of harmless formatting noise
- generic timestamp handling
- reusable schema-conforming output behavior
- generic evidence-grounding rules

### Comparative sanity check

Before accepting a “good” score jump, ask:
- would this change still make sense if the fixture were totally different?
- does the change improve the underlying extraction/generation contract, or just this one benchmark?

If the second answer is “just this benchmark,” do not bless it as a valid win.

---

## Required logging and ledger expectations

Every active lane needs a durable ledger. A markdown ledger is acceptable for the first version, even if a machine-readable file is added later.

### Ledger must include

#### Lane header

- lane name / id
- goal
- artifact scope
- narrow config path
- benchmark manifest path
- target score / try cap
- active status

#### Baseline block

- date/time established
- command(s) used
- benchmark status
- accuracy / coverage
- important artifact report references
- current known mismatch buckets

#### Attempt entries

For each attempt, record:
- attempt number
- proposal
- challenger review
- decision: accepted / rejected
- exact files touched
- exact benchmark command(s)
- resulting status / accuracy / coverage
- delta vs prior baseline
- observed regressions or tradeoffs
- whether it becomes the new baseline
- next hypothesis or stop reason

### Required artifact references

The ledger should point to durable evidence where possible, such as:
- log file path
- output directory path
- aggregate benchmark summary path
- per-artifact report path

### Precision rule

Avoid vague entries like:
- “improved score a bit”
- “changed prompt stuff”
- “seems better”

Prefer exact entries like:
- `accuracy 0.4244 -> 0.5177`
- `speaker_id mismatches dropped from 20 to 8`
- `timing failures improved, but summary drift regressed`

### Resume rule

A fresh session should be able to resume by reading:
1. the lane definition
2. the ledger’s baseline + most recent attempts
3. linked benchmark report artifacts

If that is not possible, the logging is insufficient.

---

## Guidance for narrow configs and benchmark manifests

Iteration lanes should prefer **narrow reruns**.

### Why narrow configs exist

A narrow config:
- reduces rerun cost and latency
- isolates the artifact under improvement
- keeps benchmark feedback legible
- lowers the chance of unrelated drift confusing the lane

### Narrow config rules

A narrow config should:
- preserve the real production path for the target artifact as much as possible
- run only the minimal required phases/scripts
- write outputs to a lane-specific or clearly named output location when useful
- avoid hidden behavior that differs materially from the full pipeline without documenting the difference

A narrow config should **not**:
- bypass the real logic being improved
- inject benchmark-only helper behavior into the product path
- silently relax validation just to make iteration easier

### Benchmark manifest rules for iteration

A lane may use a narrower benchmark manifest than the full fixture benchmark when that helps isolate signal.

Examples:
- dialogue-only benchmark manifest for dialogue iterations
- a chunk-analysis-only manifest for chunk alignment work
- a presentation smoke-check manifest for packaging validation

This is good practice when:
- the manifest still evaluates the real artifact contract
- the narrower scope matches the lane goal
- the ledger records exactly which manifest was used

### Escalation rule

If repeated narrow wins fail to survive a broader rerun later, the lane should record that and may need:
- a broader validation pass
- a new lane
- or a revised narrow config/manifest definition

---

## Minimum helper-tool expectations

The first helper script now exists at:

- `scripts/benchmark-iteration-runner.cjs`

Current supported commands:

```bash
node scripts/benchmark-iteration-runner.cjs inspect --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json
node scripts/benchmark-iteration-runner.cjs scaffold --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-tuning --proposal "Tighten generic speaker continuity handling"
node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-tuning --dry-run --verbose
node scripts/benchmark-iteration-runner.cjs run --lane benchmarks/iterations/lanes/dialogue-gold-optimization.json --session-id 2026-03-30-dialogue-tuning --verbose
```

The current lightweight helper can:
- load lane metadata plus the durable ledger
- validate that the lane, ledger, narrow config, and benchmark manifest are aligned
- surface target score, session cap, baseline metrics, baseline artifact references, and next attempt number
- optionally count recorded attempts for a supplied `--session-id`
- scaffold a JSON attempt record with the contract-required fields and the exact inspect/run commands to use
- execute the configured narrow benchmark loop through `server/run-pipeline.cjs` and summarize score deltas versus the active baseline

The current helper intentionally does **not** yet:
- mutate the durable ledger automatically
- invent benchmark-improvement strategies on its own
- perform broad multi-step automation beyond the configured narrow loop
- replace the benchmark comparator/reporting core

That keeps v1 small, inspectable, and useful without pretending we already need a giant autonomous system.

---

## Generic lane template

A first-version lane should be able to answer these questions clearly:

- What are we trying to improve?
- Which artifact is in scope?
- Which fixture/manifest is the judge?
- Which narrow config reruns the minimum useful surface?
- What is the current baseline?
- What score would count as “good enough”?
- How many attempts are allowed this session?
- What files are allowed to change?
- What counts as overfitting here?
- Where is the durable ledger?

If any of those are missing, the lane is underspecified.

---

## Bottom line

The reusable benchmark-iteration harness for `emotion-engine` is:

- keep evaluation mechanics in the comparator core
- define improvement work as narrow, resumable lanes
- require one concrete challenger at a time
- challenge each proposal before implementation
- rerun the smallest honest benchmark surface
- record exact commands, files, reports, and score deltas
- stop when gains flatten, budgets run out, or overfitting risk rises
- optimize the underlying system, not the current fixture

That is the contract future lane configs, ledgers, and helper tooling should follow.