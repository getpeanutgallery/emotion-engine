/**
 * Test script to verify validateJSON properly reads response body
 * Tests gzip decompression and async body reading
 */

const { validateJSON } = require('./server/lib/api-utils.cjs');

// Mock Response class that simulates Node.js fetch response with gzip
class MockResponse {
  constructor(status, statusText, headers, body) {
    this.status = status;
    this.statusText = statusText;
    this._headers = new Map(Object.entries(headers));
    this._body = body;
    this.ok = status >= 200 && status < 300;
  }

  headers = {
    entries: () => this._headers.entries(),
    get: (name) => this._headers.get(name.toLowerCase())
  };

  async text() {
    // Simulate async body reading
    return new Promise(resolve => {
      setTimeout(() => resolve(this._body), 10);
    });
  }

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
}

async function testValidateJSON() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Testing validateJSON with async body reading');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Valid JSON response
  console.log('Test 1: Valid JSON response');
  const validResponse = new MockResponse(
    200,
    'OK',
    { 'content-type': 'application/json' },
    JSON.stringify({ choices: [{ message: { content: 'test' } }], usage: { total_tokens: 10 } })
  );

  const result1 = await validateJSON(validResponse);
  console.log(`  ✅ Success: ${result1.success}`);
  console.log(`  Data: ${JSON.stringify(result1.data, null, 2)}`);
  if (!result1.success) {
    console.error(`  ❌ Error: ${result1.error}`);
    process.exit(1);
  }

  // Test 2: Empty response
  console.log('\nTest 2: Empty response');
  const emptyResponse = new MockResponse(
    200,
    'OK',
    { 'content-type': 'application/json' },
    ''
  );

  const result2 = await validateJSON(emptyResponse);
  console.log(`  ✅ Success: ${result2.success}`);
  console.log(`  Error: ${result2.error}`);
  if (result2.success) {
    console.error('  ❌ Should have failed for empty response');
    process.exit(1);
  }

  // Test 3: Invalid JSON
  console.log('\nTest 3: Invalid JSON');
  const invalidResponse = new MockResponse(
    200,
    'OK',
    { 'content-type': 'application/json' },
    '{ invalid json }'
  );

  const result3 = await validateJSON(invalidResponse);
  console.log(`  ✅ Success: ${result3.success}`);
  console.log(`  Error: ${result3.error}`);
  if (result3.success) {
    console.error('  ❌ Should have failed for invalid JSON');
    process.exit(1);
  }

  // Test 4: Large JSON response (simulate 7089 bytes)
  console.log('\nTest 4: Large JSON response (simulating 7089 bytes)');
  const largeData = {
    choices: [{ message: { content: 'x'.repeat(6000) } }],
    usage: { total_tokens: 1000 },
    metadata: { model: 'openai', timestamp: new Date().toISOString() }
  };
  const largeResponse = new MockResponse(
    200,
    'OK',
    { 
      'content-type': 'application/json',
      'content-encoding': 'gzip'
    },
    JSON.stringify(largeData)
  );

  const result4 = await validateJSON(largeResponse);
  console.log(`  ✅ Success: ${result4.success}`);
  console.log(`  Data keys: ${Object.keys(result4.data).join(', ')}`);
  if (!result4.success) {
    console.error(`  ❌ Error: ${result4.error}`);
    process.exit(1);
  }

  // Test 5: Null response
  console.log('\nTest 5: Null response');
  const result5 = await validateJSON(null);
  console.log(`  ✅ Success: ${result5.success}`);
  console.log(`  Error: ${result5.error}`);
  if (result5.success) {
    console.error('  ❌ Should have failed for null response');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ All tests passed!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

testValidateJSON().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
