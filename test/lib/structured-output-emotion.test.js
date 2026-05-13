const test = require('node:test');
const assert = require('node:assert');
const { validateEmotionStateObject } = require('../../server/lib/structured-output.cjs');

test('validateEmotionStateObject preserves restored persona fields', async (t) => {
  await t.test('accepts required thought with optional continuationThought and bounded personaMeta', () => {
    const result = validateEmotionStateObject({
      summary: 'A steady action beat keeps building.',
      thought: 'Okay, this is finally giving me something to latch onto.',
      continuationThought: 'If the trailer cashes this out, I stay onboard.',
      emotions: {
        patience: { score: 8, reasoning: 'The pacing stays measured and readable.' },
        boredom: { score: 2, reasoning: 'The visual pattern keeps changing.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.88,
      personaMeta: { scrollRisk: 'low' }
    }, ['patience', 'boredom']);

    assert.ok(result.ok);
    assert.strictEqual(result.value.thought, 'Okay, this is finally giving me something to latch onto.');
    assert.strictEqual(result.value.continuationThought, 'If the trailer cashes this out, I stay onboard.');
    assert.deepStrictEqual(result.value.personaMeta, { scrollRisk: 'low' });
  });

  await t.test('rejects missing thought, redundant continuationThought, and unknown personaMeta keys', () => {
    const result = validateEmotionStateObject({
      summary: 'A noisy chunk.',
      continuationThought: 'Same line.',
      emotions: {
        patience: { score: 5, reasoning: 'The pace is neutral.' },
        boredom: { score: 5, reasoning: 'The footage is mixed.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.5,
      personaMeta: { mood: 'curious' }
    }, ['patience', 'boredom']);

    assert.ok(!result.ok);
    assert.ok(result.summary.includes('$.thought'));
    assert.ok(result.summary.includes('$.personaMeta'));
  });

  await t.test('rejects continuationThought when it duplicates thought exactly', () => {
    const result = validateEmotionStateObject({
      summary: 'A rising tension beat.',
      thought: 'This is finally getting somewhere.',
      continuationThought: 'This is finally getting somewhere.',
      emotions: {
        patience: { score: 7, reasoning: 'The pacing stays focused.' },
        boredom: { score: 2, reasoning: 'The beat keeps evolving.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.77
    }, ['patience', 'boredom']);

    assert.ok(!result.ok);
    assert.ok(result.summary.includes('continuationThought'));
  });

  await t.test('rejects local-relative numeric timestamp phrasing in thought fields', () => {
    const thoughtResult = validateEmotionStateObject({
      summary: 'An over-timestamped opener.',
      thought: '0.0s in and this already wants applause.',
      emotions: {
        patience: { score: 4, reasoning: 'The pacing keeps shifting.' },
        boredom: { score: 3, reasoning: 'The beat still changes.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.61
    }, ['patience', 'boredom']);

    const continuationResult = validateEmotionStateObject({
      summary: 'A timestamped follow-on.',
      thought: 'Still curious.',
      continuationThought: '2.0s later and it is still posturing.',
      emotions: {
        patience: { score: 5, reasoning: 'The pace stays readable.' },
        boredom: { score: 2, reasoning: 'The visuals keep moving.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.64
    }, ['patience', 'boredom']);

    const naturalLanguageResult = validateEmotionStateObject({
      summary: 'A naturally framed continuation.',
      thought: 'Still with me by this point.',
      continuationThought: 'Now land the next beat.',
      emotions: {
        patience: { score: 7, reasoning: 'The pacing stays composed.' },
        boredom: { score: 2, reasoning: 'The reveal keeps building.' }
      },
      dominant_emotion: 'patience',
      confidence: 0.84
    }, ['patience', 'boredom']);

    assert.ok(!thoughtResult.ok);
    assert.ok(thoughtResult.summary.includes('$.thought'));
    assert.ok(!continuationResult.ok);
    assert.ok(continuationResult.summary.includes('$.continuationThought'));
    assert.ok(naturalLanguageResult.ok);
  });
});
