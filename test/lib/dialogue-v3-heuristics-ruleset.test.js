const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  SUPPORTED_BOOLEAN_CONDITION_KEYS,
  SUPPORTED_INTEGER_CONDITION_KEYS,
  SUPPORTED_SCALAR_ENUM_CONDITION_KEYS,
  SUPPORTED_ARRAY_ENUM_CONDITION_KEYS,
  loadDialogueV3HeuristicsRulesetFromFile,
  parseDialogueV3HeuristicsRulesetString,
  validateDialogueV3HeuristicsRulesetObject
} = require('../../server/lib/dialogue-v3-heuristics-ruleset.cjs');

const RULESET_PATH = path.resolve(
  __dirname,
  '../../docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml'
);

function loadFixtureObject() {
  return yaml.load(fs.readFileSync(RULESET_PATH, 'utf8'));
}

test('loadDialogueV3HeuristicsRulesetFromFile accepts the locked review-ready v3 ruleset', () => {
  const result = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.meta.sourcePath, RULESET_PATH);
  assert.equal(result.value.compatibility.required_contract.artifact, 'dialogue-data');
  assert.equal(result.value.blocker_policy.rules[4].id, 'whispered_line_vs_nonwhispered_group_guard');
  assert.equal(result.value.field_policies.accent_family.blocker_when[0].require_accent_strength_support, 'clear_non_neutral');
  assert.deepEqual(result.value.tie_breakers[1], {
    most_exact_matches_in_bucket: 'stable_identity_cues'
  });
});

test('ruleset compiler allowlists only the predicate vocabulary required by the locked ruleset', () => {
  const allowedKeys = new Set([
    ...SUPPORTED_BOOLEAN_CONDITION_KEYS,
    ...SUPPORTED_INTEGER_CONDITION_KEYS,
    ...SUPPORTED_SCALAR_ENUM_CONDITION_KEYS,
    ...SUPPORTED_ARRAY_ENUM_CONDITION_KEYS,
    'action'
  ]);

  const result = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);
  assert.equal(result.ok, true);

  const seenKeys = new Set();

  function collectConditionKeys(value) {
    if (Array.isArray(value)) {
      value.forEach(collectConditionKeys);
      return;
    }

    if (!value || typeof value !== 'object') return;

    for (const [key, entry] of Object.entries(value)) {
      if (key === 'applies_when' || key === 'only_when' || key === 'blocker_when') {
        if (Array.isArray(entry)) {
          entry.forEach((condition) => {
            for (const conditionKey of Object.keys(condition)) {
              seenKeys.add(conditionKey);
              assert.equal(allowedKeys.has(conditionKey), true, `unexpected condition key ${conditionKey}`);
            }
          });
        } else if (entry && typeof entry === 'object') {
          for (const conditionKey of Object.keys(entry)) {
            seenKeys.add(conditionKey);
            assert.equal(allowedKeys.has(conditionKey), true, `unexpected condition key ${conditionKey}`);
          }
        }
      }

      collectConditionKeys(entry);
    }
  }

  collectConditionKeys(result.value);
  assert.ok(seenKeys.has('line_value'));
  assert.ok(seenKeys.has('line_value_in'));
  assert.ok(seenKeys.has('line_value_not_in'));
  assert.ok(seenKeys.has('group_value'));
  assert.ok(seenKeys.has('group_value_in'));
  assert.ok(seenKeys.has('group_value_not_in'));
  assert.ok(seenKeys.has('neither_value_in'));
  assert.ok(seenKeys.has('additional_stable_identity_mismatches_at_least'));
});

test('validateDialogueV3HeuristicsRulesetObject fails closed on unknown keys and unsupported predicate shapes', () => {
  const invalid = loadFixtureObject();
  invalid.not_supported_here = true;
  invalid.blocker_policy.rules[0].only_when.line_value_regex = '^fem';

  const result = validateDialogueV3HeuristicsRulesetObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.not_supported_here' && error.code === 'unknown_key'));
  assert.ok(result.errors.some((error) => error.path === '$.blocker_policy.rules[0].only_when.line_value_regex' && error.code === 'unknown_key'));
});

test('validateDialogueV3HeuristicsRulesetObject fails closed on bad enum references', () => {
  const invalid = loadFixtureObject();
  invalid.positive_evidence_rules[0].applies_to_bucket = 'identityish';
  invalid.blocker_policy.rules[0].source_field = 'speaker_id';
  invalid.warning_level_guardrails.cross_field_checks[0].level = 'error';

  const result = validateDialogueV3HeuristicsRulesetObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.positive_evidence_rules[0].applies_to_bucket' && error.code === 'invalid_enum_reference'));
  assert.ok(result.errors.some((error) => error.path === '$.blocker_policy.rules[0].source_field' && error.code === 'invalid_enum_reference'));
  assert.ok(result.errors.some((error) => error.path === '$.warning_level_guardrails.cross_field_checks[0].level' && error.code === 'invalid_enum_reference'));
});

test('validateDialogueV3HeuristicsRulesetObject fails closed on wrong scalar and array types', () => {
  const invalid = loadFixtureObject();
  invalid.thresholds.assign_threshold = '4.0';
  invalid.blocker_policy.rules[1].only_when.line_value_in = 'feminine';
  invalid.tie_breakers = { first: 'highest_score' };

  const result = validateDialogueV3HeuristicsRulesetObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.thresholds.assign_threshold' && error.code === 'required_number'));
  assert.ok(result.errors.some((error) => error.path === '$.blocker_policy.rules[1].only_when.line_value_in' && error.code === 'required_array'));
  assert.ok(result.errors.some((error) => error.path === '$.tie_breakers' && error.code === 'required_array'));
});

test('validateDialogueV3HeuristicsRulesetObject rejects invalid trait enum references inside the bounded loader/compiler', () => {
  const invalid = loadFixtureObject();
  invalid.reliability_policy.clean_reuse_gate.audibility_must_be = 'loud';
  invalid.field_policies.audibility.reliable_values = ['clear', 'loud'];

  const result = validateDialogueV3HeuristicsRulesetObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.reliability_policy.clean_reuse_gate.audibility_must_be' && error.code === 'invalid_enum_reference'));
  assert.ok(result.errors.some((error) => error.path === '$.field_policies.audibility.reliable_values[1]' && error.code === 'invalid_enum_reference'));
});

test('parseDialogueV3HeuristicsRulesetString reports YAML parse failures with parse-stage metadata', () => {
  const result = parseDialogueV3HeuristicsRulesetString('ruleset:\n  id: default\n  [', { sourcePath: RULESET_PATH });

  assert.equal(result.ok, false);
  assert.equal(result.meta.stage, 'parse');
  assert.match(result.summary, /Failed to parse YAML/);
});
