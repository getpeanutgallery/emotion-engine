const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TOOL_NAME,
  ARGUMENT_KEY,
  buildAiRecoveryValidatorToolContract,
  validateAiRecoveryDecisionCandidate,
  executeAiRecoveryValidatorTool
} = require('../../server/lib/ai-recovery-validator-tool.cjs');

test('ai recovery validator tool contract exposes the lane-specific schema', () => {
  const contract = buildAiRecoveryValidatorToolContract();

  assert.equal(contract.name, TOOL_NAME);
  assert.equal(contract.argumentKey, ARGUMENT_KEY);
  assert.deepEqual(contract.inputSchema.required, [ARGUMENT_KEY]);
});

test('validateAiRecoveryDecisionCandidate accepts bounded same-script reentry decisions', () => {
  const result = validateAiRecoveryDecisionCandidate({
    decision: {
      outcome: 'reenter_script',
      reason: 'Need a stricter repair instruction for malformed JSON.',
      confidence: 'medium',
      hardFail: false,
      humanReviewRequired: false
    },
    revisedInput: {
      kind: 'same-script-revised-input',
      changes: [
        { path: 'repairInstructions', op: 'set', value: ['Return the required JSON object only.'] },
        { path: 'boundedContextSummary', op: 'set', value: 'Previous output contained trailing commentary.' }
      ]
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.revisedInput.changes.map((entry) => entry.path), ['repairInstructions', 'boundedContextSummary']);
});

test('executeAiRecoveryValidatorTool rejects out-of-contract mutable inputs deterministically', () => {
  const result = executeAiRecoveryValidatorTool({
    recoveryDecision: {
      decision: {
        outcome: 'reenter_script',
        reason: 'Try mutating upstream artifacts.',
        confidence: 'high',
        hardFail: false,
        humanReviewRequired: false
      },
      revisedInput: {
        kind: 'same-script-revised-input',
        changes: [
          { path: 'upstreamArtifacts', op: 'set', value: ['forbidden'] }
        ]
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.valid, false);
  assert.match(result.summary, /Only repairInstructions and boundedContextSummary may be mutated/i);
});

test('executeAiRecoveryValidatorTool rejects revisedInput changes for terminal outcomes', () => {
  const result = executeAiRecoveryValidatorTool({
    recoveryDecision: {
      decision: {
        outcome: 'hard_fail',
        reason: 'Unsafe to retry.',
        confidence: 'high',
        hardFail: true,
        humanReviewRequired: false
      },
      revisedInput: {
        kind: 'same-script-revised-input',
        changes: [
          { path: 'repairInstructions', op: 'set', value: ['Do not retry.'] }
        ]
      }
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.summary, /must be omitted or empty unless decision.outcome is reenter_script/i);
});
