const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TOOL_NAME,
  DEFAULT_PRIMARY_LENSES,
  WHOLE_VIDEO_CATEGORY_KEYS,
  validateWholeVideoAnalysisObject,
  parseWholeVideoAnalysisResponse,
  buildWholeVideoAnalysisValidatorToolContract,
  executeWholeVideoAnalysisValidatorTool
} = require('../../server/lib/whole-video-analysis-validator.cjs');

function buildValidAnalysisCore() {
  const wholeVideoScores = {};
  for (const lens of DEFAULT_PRIMARY_LENSES) {
    wholeVideoScores[lens] = {
      score: 6,
      reasoning: `${lens} reasoning grounded in the full video.`
    };
  }

  const wholeVideoCategories = {};
  for (const category of WHOLE_VIDEO_CATEGORY_KEYS) {
    wholeVideoCategories[category] = {
      score: 7,
      reasoning: `${category} reasoning grounded in the full video.`
    };
  }

  return {
    wholeVideoScores,
    wholeVideoCategories,
    overallSummary: 'The middle carries the strongest energy, but the opening and ending still need tightening.',
    retentionVerdict: {
      wouldComplete: 'maybe',
      confidence: 0.82,
      reasoning: 'The strongest action beats recover attention after a soft opening.'
    },
    evidenceMoments: [
      {
        timestamp: 0,
        timeRange: { start: 0, end: 3 },
        type: 'friction',
        driver: 'cross_modal',
        category: 'hookEffectiveness',
        impact: 'high',
        summary: 'The opener does not fully earn commitment before the story settles in.'
      },
      {
        timestamp: 44,
        timeRange: { start: 42, end: 48 },
        type: 'positive',
        driver: 'visual',
        category: 'visualMomentum',
        impact: 'high',
        summary: 'The action-heavy middle sequence creates the clearest excitement spike.'
      }
    ],
    strongestMoments: ['The action-heavy middle sequence lands as the clearest payoff.'],
    biggestRisks: ['The CTA packaging feels heavy relative to the payoff.'],
    recommendationSeeds: ['Rebuild the opening around the strongest reveal.']
  };
}

test('validateWholeVideoAnalysisObject accepts contract-compliant payloads', () => {
  const result = validateWholeVideoAnalysisObject(buildValidAnalysisCore());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.retentionVerdict.wouldComplete, 'maybe');
  assert.equal(result.value.evidenceMoments.length, 2);
});

test('parseWholeVideoAnalysisResponse surfaces validation errors', () => {
  const result = parseWholeVideoAnalysisResponse(JSON.stringify({
    wholeVideoScores: {
      patience: { score: 11, reasoning: '' }
    },
    wholeVideoCategories: {},
    overallSummary: '   ',
    retentionVerdict: {
      wouldComplete: 'absolutely',
      confidence: 2,
      reasoning: ''
    },
    evidenceMoments: [
      {
        timestamp: -1,
        timeRange: { start: 5, end: 1 },
        type: 'mystery',
        driver: 'magic',
        category: '',
        impact: 'max',
        summary: ''
      }
    ],
    strongestMoments: [],
    biggestRisks: [''],
    recommendationSeeds: []
  }));

  assert.equal(result.ok, false);
  assert.equal(result.meta.stage, 'validation');
  assert.match(result.summary, /Whole-video analysis JSON validation failed\./);
  assert.ok(result.errors.some((error) => error.path === '$.wholeVideoScores.patience.score'));
  assert.ok(result.errors.some((error) => error.path === '$.overallSummary'));
  assert.ok(result.errors.some((error) => error.path === '$.retentionVerdict.wouldComplete'));
  assert.ok(result.errors.some((error) => error.path === '$.evidenceMoments[0].driver'));
});

test('whole-video validator tool contract exposes local JSON tool schema', () => {
  const contract = buildWholeVideoAnalysisValidatorToolContract();

  assert.equal(contract.name, TOOL_NAME);
  assert.equal(contract.inputSchema.type, 'object');
  assert.deepEqual(contract.inputSchema.required, ['wholeVideoAnalysis']);
});

test('executeWholeVideoAnalysisValidatorTool validates whole-video analysis payloads via tool contract', () => {
  const invalid = executeWholeVideoAnalysisValidatorTool({
    wholeVideoAnalysis: {
      ...buildValidAnalysisCore(),
      evidenceMoments: []
    }
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.valid, false);
  assert.match(invalid.summary, /Whole-video analysis JSON validation failed\./);

  const valid = executeWholeVideoAnalysisValidatorTool({
    wholeVideoAnalysis: buildValidAnalysisCore()
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedValue.retentionVerdict.confidence, 0.82);
});
