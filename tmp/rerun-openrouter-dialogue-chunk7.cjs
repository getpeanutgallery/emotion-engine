const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getProviderForTarget, buildProviderOptions } = require('../server/lib/ai-targets.cjs');
const { resolveProviderRuntimeConfigForTarget, buildProviderOptionDefaults } = require('../server/lib/provider-runtime-config.cjs');
const { executeLocalValidatorToolLoop } = require('../server/lib/local-validator-tool-loop.cjs');
const { buildDialogueTranscriptionValidatorToolContract, executeDialogueTranscriptionValidatorTool } = require('../server/lib/phase1-validator-tools.cjs');

const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, 'configs/cod-test-mimo-openrouter-compare.yaml');
const promptPath = path.join(repoRoot, 'output/cod-test-mimo-openrouter-compare/_meta/ai/_prompts/ed9b0e17bc1692a6cb330a4562c6bf06d7a2227e9769dda58ebad2a78ebb86f4.json');
const audioPath = path.join(repoRoot, 'output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_007.mp3');

function sanitize(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: value.code,
      aiTargets: sanitize(value.aiTargets, seen),
      debug: sanitize(value.debug, seen),
      response: sanitize(value.response, seen)
    };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/authorization|api[_-]?key/i.test(k)) {
      out[k] = '[REDACTED]';
    } else if (k === 'data' && typeof v === 'string' && v.length > 120) {
      out[k] = `[Truncated data length=${v.length}]`;
    } else {
      out[k] = sanitize(v, seen);
    }
  }
  return out;
}

async function main() {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const target = config.ai.dialogue.targets[0];
  const provider = getProviderForTarget({ configForTarget: config, target });
  const runtimeConfig = resolveProviderRuntimeConfigForTarget({ configForTarget: config, target });
  const prompt = JSON.parse(fs.readFileSync(promptPath, 'utf8'));
  const audioBase64 = fs.readFileSync(audioPath).toString('base64');
  const toolLoopConfig = {
    maxTurns: Number.isInteger(config?.ai?.dialogue?.toolLoop?.maxTurns) && config.ai.dialogue.toolLoop.maxTurns > 1 ? config.ai.dialogue.toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(config?.ai?.dialogue?.toolLoop?.maxValidatorCalls) && config.ai.dialogue.toolLoop.maxValidatorCalls > 0 ? config.ai.dialogue.toolLoop.maxValidatorCalls : 3
  };
  const output = {
    startedAt: new Date().toISOString(),
    configPath: path.relative(repoRoot, configPath),
    promptPath: path.relative(repoRoot, promptPath),
    audioPath: path.relative(repoRoot, audioPath),
    adapter: target.adapter,
    runtimeConfig: {
      provider: runtimeConfig.provider,
      apiKeySource: runtimeConfig.apiKeySource,
      baseUrl: runtimeConfig.baseUrl,
      timeoutMs: runtimeConfig.timeoutMs,
      authMode: runtimeConfig.authMode
    }
  };

  try {
    const result = await executeLocalValidatorToolLoop({
      provider,
      adapter: target.adapter,
      basePrompt: prompt,
      toolContract: buildDialogueTranscriptionValidatorToolContract({ requireHandoff: true }),
      toolLoopConfig,
      promptRef: {
        sha256: path.basename(promptPath, '.json'),
        file: path.relative(path.join(repoRoot, 'output/cod-test-mimo-openrouter-compare'), promptPath).split(path.sep).join('/')
      },
      events: { emit() {} },
      ctx: { attempt: 1, attemptInTarget: 1, targetIndex: 0, targetCount: 1 },
      phaseKey: 'phase1-gather-context',
      scriptId: 'get-dialogue',
      domain: 'dialogue',
      artifactLabel: 'dialogue transcription chunk',
      finalArtifactDescription: 'The final artifact must include handoffContext so the next chunk can preserve continuity.',
      finalArtifactRules: [
        'Timestamps must be relative to this chunk and start at 0.',
        'Keep speaker labels and anonymous speaker_id values consistent with the prior handoff when possible.',
        'Keep grounded speaker identity separate from any inferred_traits guesswork.',
        'handoffContext must stay brief and continuity-focused.'
      ],
      callProvider: ({ prompt }) => provider.complete({
        prompt,
        model: target.adapter.model,
        apiKey: runtimeConfig.apiKey,
        baseUrl: runtimeConfig.baseUrl,
        attachments: [
          {
            type: 'audio',
            data: audioBase64,
            mimeType: 'audio/mpeg'
          }
        ],
        options: buildProviderOptions({
          adapter: target.adapter,
          defaults: buildProviderOptionDefaults(runtimeConfig, { temperature: 0.3 })
        })
      }),
      executeValidatorTool: (args) => executeDialogueTranscriptionValidatorTool(args, { requireHandoff: true }),
      normalizeValidatedValue: (value) => JSON.stringify(value)
    });
    output.ok = true;
    output.result = sanitize(result);
  } catch (error) {
    output.ok = false;
    output.error = sanitize(error);
    output.errorAiTargets = sanitize(error?.aiTargets || null);
    output.errorDebug = sanitize(error?.debug || null);
  }

  output.finishedAt = new Date().toISOString();
  const stamp = output.finishedAt.replace(/[:.]/g, '-');
  const outPath = path.join(repoRoot, 'tmp', `rerun-openrouter-dialogue-chunk7-${stamp}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(outPath);
  console.log(JSON.stringify({ ok: output.ok, outPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
