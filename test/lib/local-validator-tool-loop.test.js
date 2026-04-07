const test = require('node:test');
const assert = require('node:assert/strict');

const {
  executeLocalValidatorToolLoop
} = require('../../server/lib/local-validator-tool-loop.cjs');

function createBaseArgs(overrides = {}) {
  const emittedEvents = [];

  return {
    emittedEvents,
    args: {
      provider: {},
      adapter: { name: 'test-provider', model: 'test-model' },
      basePrompt: 'Return valid JSON only.',
      toolContract: {
        name: 'validate_demo_json',
        argumentKey: 'demo',
        canonicalEnvelope: {
          tool: 'validate_demo_json',
          demo: { value: 'ok' }
        }
      },
      toolLoopConfig: {
        maxTurns: 3,
        maxValidatorCalls: 2
      },
      promptRef: null,
      events: {
        emit(event) {
          emittedEvents.push(event);
        }
      },
      ctx: {
        attempt: 1,
        attemptInTarget: 1,
        targetIndex: 0
      },
      phaseKey: 'phase-test',
      scriptId: 'script-test',
      domain: 'unit-test',
      artifactLabel: 'demo artifact',
      finalArtifactDescription: 'The final artifact must be a demo JSON object.',
      finalArtifactRules: ['Return JSON only.'],
      callProvider: async () => ({
        content: JSON.stringify({
          tool: 'validate_demo_json',
          demo: { value: 'ok' }
        })
      }),
      executeValidatorTool: ({ demo }) => ({
        ok: true,
        valid: true,
        toolName: 'validate_demo_json',
        summary: 'Accepted.',
        errors: [],
        normalizedValue: {
          normalized: true,
          value: demo.value
        }
      }),
      ...overrides
    }
  };
}

test('executeLocalValidatorToolLoop terminates immediately on canonical validator success', async () => {
  const { args, emittedEvents } = createBaseArgs();

  const result = await executeLocalValidatorToolLoop(args);

  assert.deepEqual(result.parsed, {
    normalized: true,
    value: 'ok'
  });
  assert.equal(result.toolLoop.turns, 1);
  assert.equal(result.toolLoop.validatorCalls, 1);
  assert.equal(result.toolLoop.history.length, 2);
  assert.equal(result.toolLoop.history[0].kind, 'model_output');
  assert.equal(result.toolLoop.history[1].kind, 'validator_acceptance');
  assert.deepEqual(result.toolLoop.finalArtifact, {
    normalized: true,
    value: 'ok'
  });
  assert.deepEqual(
    emittedEvents.map((event) => event.kind),
    ['tool.loop.provider.await.start', 'tool.loop.provider.await.end', 'tool.loop.complete']
  );
});

test('executeLocalValidatorToolLoop does not request an extra provider turn after canonical validator success', async () => {
  let providerCalls = 0;
  const { args } = createBaseArgs({
    callProvider: async () => {
      providerCalls += 1;
      return {
        content: JSON.stringify({
          tool: 'validate_demo_json',
          demo: { value: 'ok' }
        })
      };
    }
  });

  const result = await executeLocalValidatorToolLoop(args);

  assert.equal(providerCalls, 1);
  assert.equal(result.toolLoop.turns, 1);
  assert.equal(result.requestPrompt.mode, 'tool_loop');
});

test('executeLocalValidatorToolLoop preserves failure diagnostics for rejected canonical tool calls', async () => {
  const { args } = createBaseArgs({
    toolLoopConfig: {
      maxTurns: 2,
      maxValidatorCalls: 2
    },
    executeValidatorTool: () => ({
      ok: false,
      valid: false,
      toolName: 'validate_demo_json',
      summary: 'demo failed validation',
      errors: [{ path: '$.demo.value', code: 'invalid', message: 'value is invalid' }],
      normalizedValue: null
    })
  });

  await assert.rejects(
    () => executeLocalValidatorToolLoop(args),
    (error) => {
      assert.match(error.message, /demo artifact tool loop exhausted after 2 turns/);
      assert.equal(error.aiTargets.validationSummary, 'demo artifact tool loop exhausted after 2 turns. Ensure the model validates the demo artifact and then returns final JSON only.');
      assert.equal(error.aiTargets.toolLoop.validatorCalls, 2);
      assert.equal(error.aiTargets.toolLoop.history.filter((entry) => entry.kind === 'validator_rejection').length, 2);
      return true;
    }
  );
});

test('executeLocalValidatorToolLoop repairs unquoted m:ss(.d) dialogue timestamps before validation', async () => {
  const { args } = createBaseArgs({
    toolContract: {
      name: 'validate_dialogue_transcription_json',
      argumentKey: 'transcription',
      canonicalEnvelope: {
        tool: 'validate_dialogue_transcription_json',
        transcription: {
          dialogue_segments: []
        }
      }
    },
    artifactLabel: 'dialogue transcription',
    callProvider: async () => ({
      content: `{
  "tool": "validate_dialogue_transcription_json",
  "transcription": {
    "dialogue_segments": [
      {
        "start": 1:20,
        "end": 1:23.5,
        "speaker": "Speaker 1",
        "text": "Need a sit-rep.",
        "confidence": 0.95
      }
    ],
    "summary": "Whole asset summary",
    "totalDuration": 140.04
  }
}`
    }),
    executeValidatorTool: ({ transcription }) => ({
      ok: true,
      valid: true,
      toolName: 'validate_dialogue_transcription_json',
      summary: 'Accepted.',
      errors: [],
      normalizedValue: transcription
    })
  });

  const result = await executeLocalValidatorToolLoop(args);

  assert.equal(result.parsed.dialogue_segments[0].start, 80);
  assert.equal(result.parsed.dialogue_segments[0].end, 83.5);
});

test('executeLocalValidatorToolLoop lean mode retries invalid JSON with a bounded repair follow-up', async () => {
  let providerCalls = 0;
  const prompts = [];
  const { args } = createBaseArgs({
    runtimeStyle: 'lean',
    toolContract: {
      name: 'validate_dialogue_transcription_json',
      argumentKey: 'transcription',
      canonicalEnvelope: {
        tool: 'validate_dialogue_transcription_json',
        transcription: {
          dialogue_segments: []
        }
      }
    },
    artifactLabel: 'dialogue transcription',
    basePrompt: 'Transcribe the audible spoken dialogue in this audio.\nReturn JSON only.',
    callProvider: async ({ prompt }) => {
      providerCalls += 1;
      prompts.push(prompt);
      if (providerCalls === 1) {
        return { content: '{"summary":"missing fields"}' };
      }
      return {
        content: JSON.stringify({
          dialogue_segments: [],
          speaker_profiles: [],
          summary: 'Recovered dialogue summary',
          totalDuration: 10
        })
      };
    },
    executeValidatorTool: ({ transcription }) => {
      const valid = Array.isArray(transcription?.dialogue_segments)
        && Array.isArray(transcription?.speaker_profiles)
        && typeof transcription?.summary === 'string'
        && typeof transcription?.totalDuration === 'number';
      return {
        ok: valid,
        valid,
        toolName: 'validate_dialogue_transcription_json',
        summary: valid ? 'Accepted.' : 'speaker_profiles is required.',
        errors: valid ? [] : [{ path: '$.speaker_profiles', code: 'required', message: 'speaker_profiles is required.' }],
        normalizedValue: valid ? transcription : null
      };
    }
  });

  const result = await executeLocalValidatorToolLoop(args);

  assert.equal(providerCalls, 2);
  assert.equal(result.requestPrompt.mode, 'lean_repair');
  assert.match(prompts[0], /Return JSON only\./);
  assert.doesNotMatch(prompts[0], /LOCAL TOOL LOOP:/);
  assert.match(prompts[1], /LOCAL VALIDATION REPAIR:/);
  assert.match(prompts[1], /speaker_profiles is required\./);
  assert.match(prompts[1], /Return the final JSON object directly\./);
  assert.equal(result.parsed.summary, 'Recovered dialogue summary');
});


test('executeLocalValidatorToolLoop lean mode preserves a final validator pass after earlier retries consume the configured budget', async () => {
  let providerCalls = 0;
  const { args } = createBaseArgs({
    runtimeStyle: 'lean',
    toolLoopConfig: {
      maxTurns: 3,
      maxValidatorCalls: 2
    },
    toolContract: {
      name: 'validate_dialogue_transcription_json',
      argumentKey: 'transcription',
      canonicalEnvelope: {
        tool: 'validate_dialogue_transcription_json',
        transcription: {
          dialogue_segments: []
        }
      }
    },
    artifactLabel: 'dialogue transcription',
    callProvider: async () => {
      providerCalls += 1;
      if (providerCalls < 3) {
        return {
          content: JSON.stringify({
            dialogue_segments: [],
            summary: 'Missing speaker profiles',
            totalDuration: 10
          })
        };
      }
      return {
        content: JSON.stringify({
          dialogue_segments: [],
          speaker_profiles: [],
          summary: 'Recovered on final turn',
          totalDuration: 10
        })
      };
    },
    executeValidatorTool: ({ transcription }) => {
      const valid = Array.isArray(transcription?.dialogue_segments)
        && Array.isArray(transcription?.speaker_profiles)
        && typeof transcription?.summary === 'string'
        && typeof transcription?.totalDuration === 'number';
      return {
        ok: valid,
        valid,
        toolName: 'validate_dialogue_transcription_json',
        summary: valid ? 'Accepted.' : 'speaker_profiles is required.',
        errors: valid ? [] : [{ path: '$.speaker_profiles', code: 'required', message: 'speaker_profiles is required.' }],
        normalizedValue: valid ? transcription : null
      };
    }
  });

  const result = await executeLocalValidatorToolLoop(args);

  assert.equal(providerCalls, 3);
  assert.equal(result.parsed.summary, 'Recovered on final turn');
  assert.equal(result.toolLoop.turns, 3);
  assert.equal(result.toolLoop.validatorCalls, 3);
  assert.equal(result.toolLoop.history.filter((entry) => entry.kind === 'validator_rejection').length, 2);
});
