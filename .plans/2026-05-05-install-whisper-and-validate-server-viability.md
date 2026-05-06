# Peanut Gallery Emotion Engine

**Date:** 2026-05-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Install a real Whisper-class local timestamp toolchain for Emotion Engine, verify it can run on this workstation, and confirm the same approach is viable for ephemeral AWS server execution.

---

## Overview

The current timestamp derivation lane is not deterministic at the timestamp-birth step. It reruns the model-backed dialogue/music-vocals extraction scripts with `preserveSegmentTiming: true`, then deterministically reattaches those model-emitted times. That architecture reintroduces the same core problem we were trying to escape: the timing source itself is non-deterministic and can drift onto a compressed pseudo-timeline.

The next lane should therefore install and validate a real local alignment/transcription toolchain. For spoken dialogue, a Whisper-class engine is the right family. Depending on what exact behavior we want, the practical candidate may be bare Whisper, `faster-whisper`, or WhisperX-style alignment. The install/validation lane should stay honest about that distinction instead of pretending every option gives identical timestamp quality or deployment burden.

Research on this workstation keeps `faster-whisper` as the best initial install target, not because it is the final ceiling, but because it is the lightest honest step that gives us deterministic local ASR plus segment and word timestamps without immediately absorbing WhisperX’s extra alignment/diarization complexity. The preflight caveat is concrete: this host is already strong for CPU fallback and likely good for CUDA execution, but the repo is currently Node-first with no Python project environment checked in, and the host visibly has NVIDIA driver/CUDA/cuBLAS surfaces while not yet showing a discoverable cuDNN 9 runtime. That means the install lane should plan for an isolated Python venv and should validate GPU honestly instead of assuming it.

AWS/server viability should still be treated as a first-class acceptance question. The likely answer remains yes: `faster-whisper` is materially easier to mirror onto ephemeral servers than WhisperX because it is a narrower Python stack, can run CPU-only if needed, and only needs model/runtime caching discipline plus optional CUDA/cuDNN packaging when GPU acceleration is desired. The real caveats are packaging, Python/model dependencies, optional GPU/CUDA support, model download/caching strategy, runtime cost, and the fact that music-vocals remains a provisional fit because speech-oriented ASR is strongest on dialogue, not sung lyrics.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current root-cause / next-lane plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-05-review-timestamp-strictness-and-next-lane.md` |
| `REF-02` | Prior timestamp feasibility doc | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/docs/2026-04-30-whisper-timestamp-feasibility.md` |
| `REF-03` | Prior WhisperX prototype plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md` |
| `REF-04` | Current dialogue timestamp derivation script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue-timestamps.cjs` |
| `REF-05` | Current music-vocals timestamp derivation script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-06` | Current deterministic attachment layer | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/phase1-timestamp-derivation.cjs` |
| `REF-07` | COD source video for local validation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/examples/videos/emotion-tests/cod.mp4` |

---

## Tasks

### Task 1: Audit faster-whisper as the initial install target and server constraints

**Bead ID:** `ee-pdoc`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Claim bead ee-pdoc on start with bd update ee-pdoc --status in_progress --json. Treat faster-whisper as the chosen initial install target for Emotion Engine timestamp work unless evidence disproves it. Audit the exact local dependency/runtime shape, GPU/CPU behavior, model choices, likely Python/CUDA constraints, and ephemeral AWS viability. Be explicit about whether dialogue looks like a good fit, whether music-vocals should remain provisional, and what would trigger later escalation to WhisperX. Update the active plan with exact findings and close bead ee-pdoc with bd close ee-pdoc --reason "faster-whisper install target audited" --json only when the install lane is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- docs/inspection paths only

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-install-whisper-and-validate-server-viability.md`

**Status:** ✅ Complete

**Results:**
- **Install-target recommendation:** keep `faster-whisper` as the initial install target. It remains the best first step unless real validation shows its native word/segment timestamps are too weak for Emotion Engine’s deterministic reattachment contract. This is a narrower and more deployment-friendly first move than jumping straight to WhisperX. (`REF-02`, `REF-03`)
- **Why it still wins first:**
  - It gives local Whisper-family transcription plus segment and optional `word_timestamps=True` surfaces without pulling in WhisperX’s extra wav2vec alignment and diarization stack on day one.
  - Emotion Engine already has source transcript artifacts and speaker metadata; we do **not** need diarization to get the first timestamp lane running.
  - Prior repo research already showed the real gap is “no truthful local aligner exists yet,” not “we already proved faster-whisper fails.” (`REF-02`)
- **Exact local workstation/runtime shape:**
  - Host: Alienware Aurora R13 on Linux x86_64.
  - CPU/RAM/GPU from workspace notes: i7-12700KF, 128 GB RAM, RTX 3080 10 GB.
  - Live GPU probe: `nvidia-smi` reports RTX 3080, driver `580.142`, CUDA runtime visibility `13.0`, with `/usr/bin/nvcc` at CUDA toolkit `12.0.140`.
  - Python on PATH is Homebrew-managed `/home/linuxbrew/.linuxbrew/bin/python3` at `3.14.2` with `pip 25.3`.
  - The repo is currently **Node-first**, with `package.json` only and **no** checked-in `pyproject.toml`, `requirements.txt`, `Pipfile`, or repo-local `.venv`.
  - System `ffmpeg` already exists at `/usr/bin/ffmpeg` version `6.1.1`, but `faster-whisper` itself uses PyAV-bundled FFmpeg libs, so host ffmpeg is helpful for surrounding media workflows rather than a hard requirement for the Python package.
- **Python packaging shape / risk:**
  - `faster-whisper 1.2.1` advertises `Python >=3.9`.
  - Current PyPI metadata shows downloadable wheels for this host stack are available for the critical dependencies we checked: `ctranslate2 4.7.1` includes `cp314` Linux wheels and `av 17.0.1` resolves via an ABI3 wheel that pip accepts on Python 3.14.
  - Conclusion: Python `3.14.2` is **not** an immediate blocker here.
  - Even so, the install lane should use an **isolated repo-local venv** rather than polluting the Homebrew global Python.
- **CUDA/GPU reality on this host:**
  - Upstream `faster-whisper` currently expects `cuBLAS for CUDA 12` plus `cuDNN 9 for CUDA 12` for current `ctranslate2` GPU execution.
  - This host **does** expose `libcublas.so.12` and `libcublasLt.so.12` under `/usr/lib` / `/lib`.
  - This host did **not** show a discoverable `libcudnn*` runtime in the probes run for this audit.
  - Therefore: **CPU execution looks immediately viable; GPU execution looks plausible but not yet proven.** The likely install-lane posture is “stand up faster-whisper in a venv first, then test CUDA honestly; if cuDNN is missing, either add the narrow runtime dependency or accept CPU mode for the first validation pass.”
- **Model/runtime constraints to plan around:**
  - On a 10 GB RTX 3080, upstream benchmarks suggest `large-v2` / `large-v3` class GPU use is realistic, but the first installation/validation pass does not need to start there.
  - For Emotion Engine’s first deterministic timestamp lane, start with a smaller proven English-oriented model posture such as `small.en` / `medium.en` or `distil-large-v3` only if accuracy/latency testing justifies it.
  - `faster-whisper` also supports CPU `int8`, which is important as the “works anywhere” fallback for both this workstation and ephemeral AWS without GPU.
- **Dialogue fit:**
  - Dialogue remains a strong fit and the main reason to proceed. Prior repo research already concluded Whisper-family alignment is strongest on spoken dialogue and that a new local aligner is the missing dependency. (`REF-02`)
  - `faster-whisper` is a good initial install target for dialogue because it should let the next lane compare emitted ASR timing against the persisted source transcript without immediately requiring the heavier WhisperX alignment stack.
- **Music-vocals fit:**
  - Music-vocals should stay explicitly **provisional**.
  - `faster-whisper` may still be useful there as a first empirical probe, especially for obvious lyric-bearing windows, but it should not be marketed as dialogue-grade timing truth for sung/chant/refrain-heavy material.
  - Prior repo research remains unchanged: repeated hooks, compressed lyric fragments, melodic stretching, and masking make music-vocals much more likely to end up `partial` or `unresolved` than dialogue. (`REF-02`)
- **Ephemeral AWS viability:**
  - Viable, and more viable than WhisperX as the first server target.
  - CPU-only viability is straightforward: ephemeral instance + Python venv + package install + model download/cache volume.
  - GPU viability is also realistic, but only when the image/container explicitly carries the expected CUDA/cuBLAS/cuDNN runtime combination for the chosen `ctranslate2` version.
  - Packaging/caching caveats that matter:
    - ephemeral servers should not redownload Whisper weights every invocation; use a persistent cache path, pre-baked image layer, or startup warm-cache strategy;
    - if using GPU containers, pin the CUDA/cuDNN combo rather than assuming “latest NVIDIA image” will stay compatible forever;
    - cold-start cost and model size matter, so first validation should prefer a smaller model before large-v3-class server defaults;
    - if Lambda-style constraints are ever considered, weight size and cold starts may become awkward enough that ECS/Fargate/EC2-style ephemeral workers are the cleaner fit.
- **What should later trigger escalation to WhisperX:**
  - If `faster-whisper` word timestamps are too soft to anchor Emotion Engine segments without frequent boundary smear on ordinary dialogue.
  - If repeated or nearby similar dialogue lines cannot be reliably disambiguated from native timestamps alone.
  - If music-vocals needs stronger forced alignment than plain ASR timing can provide and the team still wants to push beyond a mostly `partial` / `unresolved` contract.
  - If we later need built-in diarization/alignment machinery rather than reusing Emotion Engine’s existing speaker/text artifacts.
  - If QA shows that deterministic attachment still drifts materially because the ASR surface and the preserved source text need an explicit second-stage aligner rather than just native word timestamps.
- **Execution-readiness decision:** yes. The install lane is execution-ready **without** changing the chosen target. The next lane should create a narrow Python venv, install `faster-whisper`, test CPU first if needed, then attempt CUDA and record whether cuDNN is the only missing runtime piece.

---

### Task 2: Install faster-whisper locally on this workstation

**Bead ID:** `ee-11xy`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-07`  
**Prompt:** `Claim bead ee-11xy on start with bd update ee-11xy --status in_progress --json. Install faster-whisper locally with the narrowest durable setup that is honest for Emotion Engine timestamp work, using sudo only where truly needed. Prefer a setup that can be mirrored on ephemeral AWS servers later. Document exact commands, packages, models, and runtime assumptions. Do not broaden into WhisperX unless blocked.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.venv-faster-whisper/`
- `.cache/faster-whisper/`
- `.cache/huggingface/`
- `.tmp/whisper/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-install-whisper-and-validate-server-viability.md`
- `.gitignore`

**Status:** ✅ Complete

**Results:**
- **Install posture used:** repo-local Python venv, no sudo, no global pip mutation outside the venv. This keeps the setup narrow and plausible for ephemeral AWS mirroring.
- **Exact local install commands that succeeded:**
  ```bash
  cd /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine
  python3 -m venv .venv-faster-whisper
  source .venv-faster-whisper/bin/activate
  python -m pip install --upgrade pip setuptools wheel
  python -m pip install faster-whisper==1.2.1
  ```
- **Exact helper/runtime paths now in use:**
  - venv: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.venv-faster-whisper`
  - model cache: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.cache/faster-whisper`
  - HF cache: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.cache/huggingface`
  - scratch validation audio: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp/whisper/cod-20s.wav`
- **Minimal package set actually installed in the venv:** `faster-whisper==1.2.1` plus its resolved dependencies, including `ctranslate2==4.7.1`, `av==17.0.1`, `onnxruntime==1.25.1`, `tokenizers==0.23.1`, and `huggingface-hub==1.13.0`.
- **CPU validation succeeded.** I extracted a short local audio sample from `REF-07` and ran `tiny.en` with repo-local caches and word timestamps:
  ```bash
  ffmpeg -y -i examples/videos/emotion-tests/cod.mp4 -vn -ac 1 -ar 16000 -t 20 .tmp/whisper/cod-20s.wav
  source .venv-faster-whisper/bin/activate
  HF_HOME="$PWD/.cache/huggingface" python - <<'PY'
  from faster_whisper import WhisperModel
  model = WhisperModel('tiny.en', device='cpu', compute_type='int8', download_root='.cache/faster-whisper')
  segments, info = model.transcribe('.tmp/whisper/cod-20s.wav', word_timestamps=True, vad_filter=True)
  print(info.language, info.duration)
  for seg in list(segments)[:3]:
      print(seg.start, seg.end, seg.text)
  PY
  ```
  - Result: successful English transcription with segment and word timestamps on the first local pass.
- **GPU validation also succeeded.** Contrary to the preflight suspicion, this workstation did not need any extra pip-installed CUDA/cuDNN packages or sudo-installed runtime changes for the tested path:
  ```bash
  source .venv-faster-whisper/bin/activate
  HF_HOME="$PWD/.cache/huggingface" python - <<'PY'
  from faster_whisper import WhisperModel
  model = WhisperModel('tiny.en', device='cuda', compute_type='float16', download_root='.cache/faster-whisper')
  segments, info = model.transcribe('.tmp/whisper/cod-20s.wav', word_timestamps=True, vad_filter=True)
  first = next(iter(segments))
  print(info.language, first.start, first.end, first.text)
  PY
  ```
  - Result: successful CUDA inference on the RTX 3080.
- **What made GPU work on this host:**
  - NVIDIA driver/runtime visible via `nvidia-smi`: driver `580.142`, GPU `NVIDIA GeForce RTX 3080`.
  - Local toolkit visibility via `nvcc --version`: CUDA `12.0.140`.
  - `ctypes.util.find_library` and `LD_DEBUG=libs` during the successful GPU run showed `ctranslate2` loading:
    - `/lib/x86_64-linux-gnu/libcuda.so.1`
    - `/lib/x86_64-linux-gnu/libcublas.so.12`
    - `/lib/x86_64-linux-gnu/libcublasLt.so.12`
  - I did **not** install `nvidia-cublas-cu12`, `nvidia-cudnn-cu12`, or any other extra GPU runtime wheels into the venv for this task.
  - I did **not** observe `libcudnn` being loaded in the traced successful `tiny.en` GPU pass, so the earlier “cuDNN is probably the blocker” suspicion was too pessimistic for this exact machine/runtime combination.
- **Runtime assumptions to carry forward honestly:**
  - CPU path is durable anywhere with Python 3.9+ and enough RAM/disk for the selected model cache.
  - GPU path is durable on this workstation as-is, but server mirroring should still pin an NVIDIA image/AMI that exposes a compatible driver plus CUDA 12-class runtime libraries rather than relying on luck.
  - Repo-local caches should be preserved or pre-warmed on ephemeral servers to avoid repeated model downloads on every worker bootstrap.
  - `tiny.en` was used only as the fastest honest install proof; later validation can choose a stronger model once QA measures accuracy/latency tradeoffs against Emotion Engine needs.
- **Narrow repo hygiene change:** `.gitignore` now ignores `.venv/` and `.venv-*/` so the local Python environment stays bounded and untracked.

---

### Task 3: Validate faster-whisper on COD media and confirm AWS/server viability

**Bead ID:** `ee-8prf`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-07`  
**Prompt:** `Claim bead ee-8prf on start with bd update ee-8prf --status in_progress --json. Run faster-whisper against COD media, confirm it actually emits usable timestamps locally, and document the exact conditions under which the same stack can run on ephemeral AWS servers. Record any caveats around GPU, model download, caching, and whether the results are strong enough to avoid immediate escalation to WhisperX. Close bead ee-8prf with bd close ee-8prf --reason "faster-whisper validated and escalation posture documented" --json only when findings are fully documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.tmp/whisper/qa/`
- `.tmp/whisper/qa/results/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-05-install-whisper-and-validate-server-viability.md`
- `.tmp/whisper/qa/cod-dialogue-00-40.wav`
- `.tmp/whisper/qa/cod-dialogue-44-66.wav`
- `.tmp/whisper/qa/cod-dialogue-96-114.wav`
- `.tmp/whisper/qa/results/cpu_small_00_40.json`
- `.tmp/whisper/qa/results/gpu_small_00_40.json`
- `.tmp/whisper/qa/results/gpu_small_44_66.json`
- `.tmp/whisper/qa/results/gpu_small_44_66_no_vad.json`
- `.tmp/whisper/qa/results/gpu_small_96_114.json`
- `.tmp/whisper/qa/results/gpu_tiny_full_mp4.json`
- `.tmp/whisper/qa/results/gpu_small_full_mp4_vad.json`
- `.tmp/whisper/qa/results/gpu_small_full_mp4_no_vad.json`
- `.tmp/whisper/qa/results/gpu_medium_44_66_no_vad.json`

**Status:** ✅ Complete

**Results:**
- **Validation posture used:** bounded but meaningful dialogue-first QA against `REF-07`, with observed outputs compared to the repo’s human-reviewed COD dialogue truth in `docs/cod-benchmark-truth-dialogue-speaker-map.md` and `docs/cod-test-dialogue-truth-provenance-2026-03-30.md`.
- **Exact media-prep commands run:**
  ```bash
  cd /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine
  mkdir -p .tmp/whisper/qa
  ffmpeg -y -i examples/videos/emotion-tests/cod.mp4 -vn -ac 1 -ar 16000 -ss 0 -t 40 .tmp/whisper/qa/cod-dialogue-00-40.wav
  ffmpeg -y -i examples/videos/emotion-tests/cod.mp4 -vn -ac 1 -ar 16000 -ss 44 -t 22 .tmp/whisper/qa/cod-dialogue-44-66.wav
  ffmpeg -y -i examples/videos/emotion-tests/cod.mp4 -vn -ac 1 -ar 16000 -ss 96 -t 18 .tmp/whisper/qa/cod-dialogue-96-114.wav
  ```
- **Exact repo-local runtime used for validation:**
  ```bash
  source .venv-faster-whisper/bin/activate
  export HF_HOME="$PWD/.cache/huggingface"
  ```
- **Exact faster-whisper command pattern used:** the QA pass used inline Python so the tested parameters are explicit and reproducible:
  ```python
  from faster_whisper import WhisperModel
  model = WhisperModel("small.en", device="cuda", compute_type="float16", download_root=".cache/faster-whisper")
  segments, info = model.transcribe(
      "examples/videos/emotion-tests/cod.mp4",
      word_timestamps=True,
      vad_filter=False,
  )
  ```
  Variants also tested `device="cpu", compute_type="int8"`, `vad_filter=True`, `model_name="tiny.en"`, and `model_name="medium.en"` on the hardest dialogue slice.
- **Artifacts written:** raw JSON outputs are under `.tmp/whisper/qa/results/` so later implementation work can inspect exact segment and word timestamps rather than relying on prose.
- **Models / runtime combinations actually exercised:**
  - `small.en` on CPU (`int8`) over the first 40 seconds dialogue slice.
  - `small.en` on CUDA (`float16`) over the first 40 seconds dialogue slice.
  - `small.en` on CUDA (`float16`) over the 44s–66s dialogue slice with and without VAD.
  - `small.en` on CUDA (`float16`) over the 96s–114s late dialogue slice.
  - `tiny.en` on CUDA (`float16`) over the whole `cod.mp4`.
  - `small.en` on CUDA (`float16`) over the whole `cod.mp4`, both with VAD and without VAD.
  - `medium.en` on CUDA (`float16`) over the problematic 44s–66s dialogue slice without VAD.
- **CPU/GPU behavior observed:**
  - `small.en` CPU on `00:00-00:40`: `model_load_seconds=47.146`, `transcribe_seconds=2.34`, `wall_seconds_total=49.486`. This includes the first substantial model download/load penalty.
  - `small.en` GPU on `00:00-00:40`: `model_load_seconds=0.504`, `transcribe_seconds=0.747`, `wall_seconds_total=1.25`.
  - `small.en` GPU on the whole 140s MP4 with `vad_filter=True`: `wall_seconds_total=1.666`.
  - `small.en` GPU on the whole 140s MP4 with `vad_filter=False`: `wall_seconds_total=2.359`.
  - `medium.en` GPU on the 22s hard slice: `model_load_seconds=147.015`, `transcribe_seconds=0.675`, `wall_seconds_total=147.689`, showing that stronger-model cold start is the real server/bootstrap cost, not steady-state inference.
- **Dialogue quality observations against COD truth:**
  - **Early clean dialogue (0s–40s) is promising.** `small.en` produced near-exact text and credible timing for the opening truth lines: `They want you afraid`, `Fear makes you easier to control`, `It's/Time to wake up`, `Your streets shall once again run red with your blood`, `Menendez is a terrorist`, `We're bringing peace and security to the world`, `Stop looking backwards, David`, `What matters is what we do next`, and `A lot of people counting on us for answers`.
  - **The timestamps in that early slice look usable enough to continue.** Observed starts/endings were generally close to the truth-map ranges and definitely on the real trailer clock rather than a compressed pseudo-timeline. Example: truth line `00:30–00:33 Stop looking backwards, David. What matters is what we do next.` came back as two segments at `30.34–31.40` and `31.58–33.10`; truth line `00:35–00:36 A lot of people counting on us for answers.` came back at `35.05–36.71`.
  - **Mid trailer comms/processed-voice slice (44s–66s) is the weak spot.** With `small.en` + `vad_filter=True`, the isolated slice returned **no segments at all** (`duration_after_vad=0.0`). On the full-asset VAD run, the model collapsed a huge `36.69–62.87` span into a single hallucinated `This isn't real.` segment. This is the clearest sign that VAD defaults are risky for this trailer’s louder / filtered / music-backed windows.
  - **Disabling VAD recovers timing structure, but not clean text, in the hard slice.** `small.en` without VAD found segment positions close to the truth windows, but content quality degraded: `You shall know fear.` became `You shall not be here.`; `Specter one, report.` became `Inspector, one report.`; `Need a sitrep.` became `Need a sit-back.`; `This isn't real.` and `The hell it ain't!` were correct; the final line in that slice was hallucinated as `I'll fail your bastard.` rather than a truth-mapped line.
  - **A stronger non-aligned model did not magically fix that hard slice.** `medium.en` without VAD still misheard the processed/comms lines (`You shall not be in my head.`, `Respect the one report.`, `I need a shit head.`), even though segment timing remained plausibly near the right moments.
  - **Late dialogue (96s–125s) is again encouraging.** `small.en` without VAD recovered the later truth lines with mostly minor lexical drift: `Pull it together, man!` → `Pull it together, men!`; `So eager to leave David.` was exact except for punctuation; `Killing a man is a hell of a lot easier than killing the idea.` was exact; `You were never cut out to be a Mason.` came back exact except lowercase `mason`; `No more games. This ends now.` was exact; `Get the Reznov challenge pack when you preorder now!` came back with only casing/hyphenation differences.
- **Timestamp posture decision:** the native segment/word timestamps are promising enough to continue with `faster-whisper` for dialogue-first work. They look like real source-clock timestamps, not the pseudo-timeline failure mode that motivated this plan. The weak point is recognition quality in noisier processed/comms windows, not obvious timestamp collapse across all dialogue.
- **Immediate WhisperX escalation decision:** **do not escalate immediately.** First continue with `faster-whisper` on dialogue-oriented implementation work, but do it with conservative settings and explicit QA gates.
- **What should trigger later escalation to WhisperX:**
  - if deterministic reattachment needs cleaner boundary precision than the native word timestamps can provide on ordinary spoken dialogue;
  - if the hard COD windows (processed villain lines, radio/comms, music-backed shouted lines) remain too noisy after trying better clip conditioning and model choice;
  - if VAD-free runs are required to preserve lines but create too much junk elsewhere;
  - if we need an explicit second-stage aligner to keep source transcript text while borrowing only timing from ASR.
- **AWS / server viability decision:** viable for ephemeral servers, with caveats that are now evidence-backed rather than speculative.
  - **What this proves:** the stack works from a repo-local venv; CPU fallback works; workstation-local CUDA works; warm-cache GPU inference is extremely fast; model/timestamp artifacts can be produced deterministically to JSON.
  - **What it does not yet prove:** that every server image will expose the same NVIDIA runtime compatibility automatically; that cold-start time is acceptable for larger models; that the current model/settings are accurate enough on every noisy dialogue window; or that music-vocals deserves the same confidence level as dialogue.
  - **Practical server caveats:**
    - keep a persistent model cache or pre-baked image layer; the local cache is already `2.0G` under `.cache/faster-whisper`, and cold-start model fetch/load dominates latency far more than inference;
    - CPU-only workers are realistic as a slower but honest fallback;
    - GPU workers should pin a known-good NVIDIA/CUDA image/AMI instead of assuming ambient compatibility;
    - if this is invoked per-request on ephemeral infrastructure, a warm-pool / prewarmed-worker design is much safer than a cold Lambda-style posture for `medium.en`-class models.
- **Recommendation after QA:** keep scope on `faster-whisper` for the next dialogue implementation lane, default to **no VAD or very carefully tuned VAD** for adversarial trailer material, and postpone WhisperX until actual reattachment QA shows native timestamps are insufficient rather than merely imperfect.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A working repo-local `faster-whisper` setup plus a bounded COD validation pack showing exact commands, raw JSON timestamp artifacts, CPU/GPU behavior, model cold-start costs, and a dialogue-first recommendation to continue with `faster-whisper` before escalating to WhisperX.

**Reference Check:** `REF-02` remains correct on the core posture: dialogue is the strongest fit, music-vocals should stay provisional, and WhisperX is the escalation path when native timestamps prove insufficient. `REF-03` remains the heavier next lane if second-stage alignment becomes necessary.

**Commits:**
- None.

**Lessons Learned:** The big catnip here is that timestamp viability and transcription quality are separable. `faster-whisper` already proves the timestamp clock is honest enough to keep testing, but VAD defaults and hard processed/comms windows can still wreck text quality. For servers, the operational risk is mostly cache/runtime packaging and cold-start cost, not raw inference speed once a worker is warm.

---

*Completed on 2026-05-05*