# emotion-engine: MiMo v2 Omni feasibility and prototype planning

**Date:** 2026-03-31  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Design a safe, benchmarkable implementation plan for testing `xiaomi/mimo-v2-omni` in `emotion-engine` using staged public video URLs, while preserving the current pipeline and building toward both OpenRouter-based and Xiaomi-direct multimodal support.

---

## Overview

The research pass came back favorable enough to justify planning a real prototype lane. The important architectural shift is that MiMo may let us evaluate the whole source video in one multimodal pass instead of forcing us to stitch together separate dialogue, music, and video reasoning across multiple models and chunk seams. If that works, it could simplify the system and eliminate whole classes of errors tied to chunking, cross-model drift, and stitch reconciliation.

The key transport insight is that Xiaomi-direct looks like the stronger long-term path, but the fastest low-risk first move is still to improve our media-delivery abstraction so `emotion-engine` can send either Base64 or public URLs depending on provider capability. That means the earliest implementation value is not “replace everything with Xiaomi immediately”; it is “make full-video multimodal submission a first-class supported path,” then validate it with a narrow cod-test prototype. Once that transport and whole-video script path exists, Xiaomi-direct and OpenRouter become interchangeable routing options at the adapter layer instead of one-off hacks.

The staged public cod-test asset is now available at:
- `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

This should be treated as the canonical first prototype URL for the new MiMo configs and media-delivery contract examples unless Derrick later replaces it with a different staged object.

Derrick’s proposed target shape makes sense: create new cod-test configs that point at the public S3 URL for the existing `cod-test` video, add direct Xiaomi provider support equivalent to the current OpenRouter path, let existing Phase 1 scripts optionally run without chunking when configured, add a new Phase 1 visual-identity pass, and add a new whole-video Phase 2 script that asks MiMo to evaluate the unified video across the same semantic categories we currently split across lanes. The plan below sequences those pieces so we learn quickly without destabilizing the existing benchmarked path.

---

## Rollout Strategy

### Recommended first move

**First move:** build the minimal full-video transport + whole-video Phase 2 prototype path.

That means:
- extend provider transport so media can be sent as either **Base64 or public URL** depending on config/provider
- add a **new whole-video Phase 2 script** for multimodal persona evaluation
- add a **new cod-test OpenRouter URL-based config** for the quickest prototype
- optionally create a **compressed OpenRouter-safe cod-test asset** only if OpenRouter URL handling still imposes practical limits

This first move is the right cut because it proves the core hypothesis quickly:
- can we successfully submit a whole video to MiMo through our pipeline abstraction?
- can we get a useful persona-evaluation artifact back?
- does the output look promising enough to justify deeper Xiaomi-direct integration and expanded Phase 1 metadata work?

### Parallel second move

Once the minimal full-video path exists, we can run two branches in parallel:

1. **Xiaomi-direct provider integration**
   - add official Xiaomi server support as an adapter equivalent to OpenRouter
   - add a Xiaomi-direct cod-test config using the public S3 URL

2. **Expanded Phase 1 multimodal metadata support**
   - allow existing dialogue/music scripts to run non-chunked when config says so
   - add a new Phase 1 video/visual identity script for timeline-aware metadata

That sequencing keeps the first proof-of-value small while still supporting the richer architecture Derrick wants.

---

## Tasks

### Task 1: Research MiMo v2 Omni capabilities, transport limits, provider access, and self-hosting options

**Bead ID:** `ee-gdxc`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, research the latest available information about xiaomi/mimo-v2-omni on OpenRouter and related official/provider docs. Focus on whether it can consume combined audio + visual input in one pass, what exact input/request shapes are supported, whether remote hosted URLs are allowed, whether OpenRouter imposes a 10 MB media limit and under what conditions, and whether direct Xiaomi/provider access exists that could avoid OpenRouter transport limits. Also determine where else MiMo is available besides OpenRouter, whether the model is open source, whether weights are available, what licensing/access constraints apply, and whether self-hosting is technically realistic for us. Evaluate practical delivery strategies for emotion-engine, including ffmpeg compression/downscaling, remote object storage (S3 or equivalent), URL-based submission without base64 inflation, and the operational tradeoffs between OpenRouter, direct provider usage, and self-hosting. Produce a recommendation memo that clearly separates confirmed facts, likely-but-unconfirmed inferences, constraints, risks, and concrete next-step options. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/research/mimo-v2-omni-feasibility-2026-03-31.md`

**Status:** ✅ Complete

**Results:** Research memo completed at `docs/research/mimo-v2-omni-feasibility-2026-03-31.md`. Confirmed that MiMo-V2-Omni is a true `text+image+audio+video->text` model and that OpenRouter’s API contract allows mixed-modality requests, but Xiaomi first-party docs are the more practical transport path for emotion-engine because they explicitly support remote image/audio/video URLs with larger URL-mode limits (image 10 MB, audio 100 MB, video 300 MB) while documenting a 10 MB cap for Base64 strings. OpenRouter docs do not expose a blanket 10 MB media cap in the reviewed sources, but they do currently require Base64 audio input, which makes them a weaker fit for large-media ingestion. Recommendation: proceed with prototype planning, with Xiaomi-direct as the preferred long-term integration and OpenRouter as the fastest comparison route.

---

### Task 2: Design the shared media-delivery contract for Base64 vs public-URL submission

**Bead ID:** `ee-jrtc`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the config and adapter contract needed so providers can receive media either as inline Base64 or as public/presigned URL references depending on the target provider and payload rules. Keep this as planning only. Cover YAML shape, adapter expectations, media metadata requirements, validation rules, and how cod-test should point at the staged public S3 URL. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/MIMO-MEDIA-DELIVERY-CONTRACT-2026-03-31.md`

**Status:** ✅ Complete

**Results:** Design note completed at `docs/MIMO-MEDIA-DELIVERY-CONTRACT-2026-03-31.md`. Recommended an additive `asset.media.refs` catalog plus `ai.<domain>.inputRefs` references and capability-driven adapter delivery resolution so each provider can receive either inline Base64 or staged URL media without script-specific branching. The note also defines required media metadata, preflight validation rules, explicit adapter capability expectations, and a cod-test prototype pattern that keeps local `asset.inputPath` for provenance while pointing `source_video.staged.url` at the public S3 object with `preferredMode: url` and `allowFallback: false`.

---

### Task 3: Plan the minimum viable whole-video Phase 2 MiMo prototype

**Bead ID:** `ee-k3ls`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the minimum viable whole-video Phase 2 prototype for MiMo-style persona evaluation. It should load the full video via staged public URL, ask the multimodal model to evaluate the same categories we currently split across dialogue/music/video passes, and produce an artifact comparable enough to inspect against the existing chunked Phase 2 system. Keep this as planning only. Define prompt scope, artifact shape, comparison method, and rollback boundaries. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `docs/design/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md` with the minimum viable whole-video Phase 2 plan. Recommendation: keep this as a benchmark-honest side-path with a staged public video URL, a new `whole-video-analysis.json` sidecar artifact, primary whole-video lens scores for `patience`/`boredom`/`excitement`, secondary cross-modal categories (hook, clarity, dialogue authenticity, music alignment, visual momentum, CTA, trust), sparse timed evidence moments instead of fake timeseries, and an explicit sidecar comparison against the current chunked cod-test baseline. Also defined rollback boundaries and the criteria for promising output before any deeper rollout.

---

### Task 4: Plan the OpenRouter comparison path using public URLs and a cod-test full-video config

**Bead ID:** `ee-fx19`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the quickest OpenRouter-based comparison path for MiMo using the existing cod-test video staged in a public S3 bucket. Cover the new cod-test YAML, any payload-shape changes needed so OpenRouter can accept public URLs where supported, fallback to compressed media if required, and what success/failure signals would tell us whether OpenRouter is viable enough for a prototype. Keep this as planning only. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/research/mimo-openrouter-comparison-path-2026-03-31.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/research/mimo-openrouter-comparison-path-2026-03-31.md` with the fastest credible OpenRouter comparison route for `xiaomi/mimo-v2-omni`: a new `cod-test-mimo-openrouter-compare` config that keeps local `asset.inputPath` for current repo validation, sends the staged public S3 MP4 as the first-choice `video_url`, and keeps reporting off for a narrow prototype lane. Documented the exact payload-shape change needed so `public-url` delivery is honored over the current implicit Base64-from-`chunkPath` path, recommended fallback order (smaller public MP4 URL before compressed inline Base64), and defined the success/failure signals that decide whether OpenRouter is viable enough for a prototype. Explicitly called out that OpenRouter’s generic docs are weaker than Xiaomi-first-party docs on model-specific URL behavior, so this should remain a fast comparison route rather than the default architecture.

---

### Task 5: Plan direct Xiaomi provider support equivalent to OpenRouter adapter support

**Bead ID:** `ee-7m6f`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the implementation plan for official Xiaomi server support as a provider/adapter equivalent to the current OpenRouter integration so a YAML config can select Xiaomi directly. Cover adapter surface, auth/env expectations, request-shape normalization, media URL handling, error capture, retries, and configuration examples. Keep this as planning only. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/design/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/design/2026-03-31-xiaomi-direct-provider-support.md`

**Status:** ✅ Complete

**Results:** Added a Xiaomi-direct provider design note that keeps support inside the existing adapter system. Recommended a new `xiaomi` adapter in `ai-providers`, provider-aware env resolution (`XIAOMI_API_KEY` preferred, `AI_API_KEY` fallback), OpenAI-compatible request normalization for image/audio/video, URL-first media handling for Xiaomi, shared provider-debug error capture, adapter-level timeout resolution with repo-level retries/failover in `ai-targets`, and concrete YAML examples for direct Xiaomi selection.

---

### Task 6: Plan Phase 1 non-chunked support and new visual-identity metadata pass

**Bead ID:** `ee-6bsi`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the plan for expanding Phase 1 so dialogue and music scripts can run in a non-chunked mode when configured, and so a new Phase 1 video/visual identity script can generate timeline-aware metadata across the video. The goal is to preserve richer reporting and recommendation capabilities even if whole-video MiMo evaluation becomes viable. Keep this as planning only. Define expected artifacts, config toggles, interoperability with current phase reporting, and how this metadata would support stronger Phase 3 outputs. Claim the bead on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-v2-omni-feasibility-and-test-plan.md`
- `docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md`

**Status:** ✅ Complete

**Results:** Design note completed at `docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md`. Recommendation: keep `dialogueData` and `musicData` contract-stable and extend them additively with `analysisMode`/`provenance`, introduce a separate `visualIdentityData` Phase 1 artifact for timeline-aware visual metadata, and prefer `auto`/`hybrid` modes so whole-asset extraction can coexist with chunked fallback, timing refinement, and future whole-video MiMo evaluation without losing richer Phase 3 grounding.

---

## First execution tranche recommendation

If we execute this plan, I recommend the first coding tranche be only these items:

1. **OpenRouter adapter media contract update**
   - support Base64 **and** public URL payload modes where the provider allows it
2. **New full-video Phase 2 script**
   - persona-evaluate the whole staged video at once with MiMo
3. **New cod-test OpenRouter MiMo config**
   - hard-code the public S3 URL for the existing cod-test asset
4. **Optional compressed comparison asset**
   - only if OpenRouter URL mode still hits practical constraints

Then in the second tranche, parallelize:
- **Xiaomi-direct provider support + Xiaomi cod-test config**
- **Phase 1 non-chunked dialogue/music support + new video metadata script**

That gives us the fastest honest answer with the least architectural thrash.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

## Questions this prototype plan must answer

1. Can we treat staged public media URLs as a first-class provider input mode in `emotion-engine`?
2. Can OpenRouter accept the required MiMo request shape well enough to serve as a fast comparison path?
3. Can direct Xiaomi support be added cleanly as an adapter-equivalent provider without breaking the current provider model?
4. What artifact should the new whole-video Phase 2 script produce so it is useful before full downstream integration?
5. How should YAML express provider choice, model choice, staged-media location, and chunked vs non-chunked Phase 1 behavior?
6. How do we preserve richer reporting/metadata if whole-video evaluation becomes the main analysis path?
7. At what point does the MiMo path beat enough of the current stitched system to justify deeper rollout?

---

## References

- Research memo: `docs/research/mimo-v2-omni-feasibility-2026-03-31.md`
- Prior dialogue benchmark lane: `.plans/2026-03-30-dialogue-benchmark-iteration-against-human-gold.md`
- Prior model-swap continuation draft: `.plans/2026-03-31-dialogue-model-swap-benchmark-lane.md`
- Repo: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`
