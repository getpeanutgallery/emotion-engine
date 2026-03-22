const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { sanitizeRawCaptureValue, writeRawJson } = require('../server/lib/raw-capture.cjs');

test('sanitizeRawCaptureValue redacts nested headers and key-shaped strings', () => {
  const openRouterKey = ['sk', 'or', 'live', 'secret', 'token'].join('-');
  const googleKey = `AIza${'SyA-very-real-looking-example-secret'}`;
  const sanitized = sanitizeRawCaptureValue({
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'x-api-key': googleKey
    },
    debugUrl: `https://example.test/v1?api_key=${openRouterKey}`,
    nested: {
      token: 'abc123456789',
      providerMessage: `Bearer ${['sk', 'proj', 'secret', 'value'].join('-')}`
    }
  });

  assert.strictEqual(sanitized.headers.Authorization, '[REDACTED]');
  assert.strictEqual(sanitized.headers['x-api-key'], '[REDACTED]');
  assert.ok(!sanitized.debugUrl.includes(openRouterKey));
  assert.strictEqual(sanitized.nested.token, '[REDACTED]');
  assert.strictEqual(sanitized.nested.providerMessage, 'Bearer [REDACTED]');
});

test('writeRawJson persists sanitized payloads', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emotion-engine-raw-'));
  const openRouterKey = ['sk', 'or', 'live', 'secret', 'token'].join('-');
  const googleKey = `AIza${'SyA-very-real-looking-example-secret'}`;
  const filePath = writeRawJson(tempDir, 'capture.json', {
    request: {
      headers: {
        Authorization: `Bearer ${openRouterKey}`
      }
    },
    providerKey: googleKey
  });

  const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(saved.request.headers.Authorization, '[REDACTED]');
  assert.strictEqual(saved.providerKey, '[REDACTED_SECRET]');
});
