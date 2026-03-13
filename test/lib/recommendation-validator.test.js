const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRecommendationObject,
  parseRecommendationResponse,
  buildRecommendationRepairPrompt
} = require('../../server/lib/recommendation-validator.cjs');
const {
  TOOL_NAME,
  buildRecommendationValidatorToolContract,
  executeRecommendationValidatorTool,
  parseRecommendationToolCallEnvelope
} = require('../../server/lib/recommendation-validator-tool.cjs');

test('validateRecommendationObject accepts contract-compliant payloads', () => {
  const result = validateRecommendationObject({
    text: 'Keep the hook tight.',
    reasoning: 'The intro performs well but the middle slows.',
    confidence: 0.7,
    keyFindings: ['Strong hook', 'Middle drag'],
    suggestions: ['Trim setup', 'Move payoff earlier']
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.confidence, 0.7);
  assert.deepEqual(result.errors, []);
});

test('parseRecommendationResponse surfaces validation errors for missing and malformed fields', () => {
  const result = parseRecommendationResponse(JSON.stringify({
    text: '',
    reasoning: '  ',
    confidence: 'high',
    keyFindings: ['Real finding', ''],
    suggestions: []
  }));

  assert.equal(result.ok, false);
  assert.equal(result.meta.stage, 'validation');
  assert.match(result.summary, /Recommendation JSON validation failed\./);
  assert.ok(result.errors.some((error) => error.path === '$.text'));
  assert.ok(result.errors.some((error) => error.path === '$.reasoning'));
  assert.ok(result.errors.some((error) => error.path === '$.confidence'));
  assert.ok(result.errors.some((error) => error.path === '$.keyFindings'));
  assert.ok(result.errors.some((error) => error.path === '$.suggestions'));
});

test('buildRecommendationRepairPrompt appends correction instructions', () => {
  const prompt = buildRecommendationRepairPrompt({
    basePrompt: 'BASE PROMPT',
    validationSummary: 'Recommendation JSON validation failed. $.confidence: confidence must be between 0 and 1.'
  });

  assert.match(prompt, /^BASE PROMPT/);
  assert.match(prompt, /PREVIOUS OUTPUT FAILED VALIDATION\./);
  assert.match(prompt, /return corrected JSON only\./i);
});

test('recommendation validator tool contract exposes local JSON tool schema', () => {
  const contract = buildRecommendationValidatorToolContract();

  assert.equal(contract.name, TOOL_NAME);
  assert.equal(contract.inputSchema.type, 'object');
  assert.deepEqual(contract.inputSchema.required, ['recommendation']);
});

test('parseRecommendationToolCallEnvelope accepts the canonical minimal tool call envelope', () => {
  const parsed = parseRecommendationToolCallEnvelope(JSON.stringify({
    tool: TOOL_NAME,
    recommendation: {
      text: 'Tighten the middle.',
      reasoning: 'The pacing drops before payoff.',
      confidence: 0.8,
      keyFindings: ['Hook works'],
      suggestions: ['Trim middle section']
    }
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.tool, TOOL_NAME);
  assert.equal(parsed.value.arguments.recommendation.confidence, 0.8);
});

test('executeRecommendationValidatorTool validates recommendation payloads via tool contract', () => {
  const invalid = executeRecommendationValidatorTool({
    recommendation: {
      text: '  ',
      reasoning: 'Missing executive guidance.',
      confidence: 2,
      keyFindings: ['Good first beat', ''],
      suggestions: []
    }
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.valid, false);
  assert.match(invalid.summary, /Recommendation JSON validation failed\./);

  const valid = executeRecommendationValidatorTool({
    recommendation: {
      text: 'Shorten the setup and land the payoff earlier.',
      reasoning: 'The intro wins attention, but the slower middle reduces momentum before the payoff arrives.',
      confidence: 0.81,
      keyFindings: ['Strong hook', 'Middle drag'],
      suggestions: ['Trim setup', 'Move payoff earlier']
    }
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedRecommendation.confidence, 0.81);
});
