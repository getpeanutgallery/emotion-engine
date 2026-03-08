/**
 * Test helper for Node.js native test runner
 * Provides Jest-like assertion helpers for compatibility
 */

const assert = require('node:assert/strict');

/**
 * Check that an object has a property (like jest's assert.property)
 */
function property(obj, prop) {
  if (!(prop in obj)) {
    throw new Error(`Expected object to have property '${prop}'`);
  }
}

/**
 * Check that an object's property is defined (not undefined)
 */
function defined(obj, prop) {
  if (obj[prop] === undefined) {
    throw new Error(`Expected property '${prop}' to be defined`);
  }
}

/**
 * Check that a value is strictly equal to something
 */
function is(value, expected) {
  assert.strictEqual(value, expected);
}

/**
 * Check that something is truthy
 */
function ok(value) {
  assert.ok(value);
}

/**
 * Check that something matches a regex
 */
function match(value, regex) {
  if (!regex.test(value)) {
    throw new Error(`Expected "${value}" to match ${regex}`);
  }
}

/**
 * Check that a promise rejects with a specific error message pattern
 */
async function rejects(promise, expectedPattern) {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error) {
    // If no pattern provided, any rejection is ok
    if (expectedPattern === undefined) {
      return;
    }
    const message = error?.message || String(error);
    if (expectedPattern instanceof RegExp) {
      if (!expectedPattern.test(message)) {
        throw new Error(`Expected error message "${message}" to match ${expectedPattern}`);
      }
    } else if (error !== expectedPattern) {
      // For exact match comparisons
      throw error;
    }
  }
}

module.exports = {
  property,
  defined,
  is,
  ok,
  match,
  rejects
};
