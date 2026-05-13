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
});
