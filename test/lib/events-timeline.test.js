const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { getCaptureMode, getEventsLogger } = require('../../server/lib/events-timeline.cjs');

function withDigitalTwinMode(mode, fn) {
  const hadOriginal = Object.prototype.hasOwnProperty.call(process.env, 'DIGITAL_TWIN_MODE');
  const original = process.env.DIGITAL_TWIN_MODE;

  if (mode === undefined) {
    delete process.env.DIGITAL_TWIN_MODE;
  } else {
    process.env.DIGITAL_TWIN_MODE = mode;
  }

  try {
    return fn();
  } finally {
    if (hadOriginal) {
      process.env.DIGITAL_TWIN_MODE = original;
    } else {
      delete process.env.DIGITAL_TWIN_MODE;
    }
  }
}

test('getCaptureMode reports replay only for replay mode', () => {
  withDigitalTwinMode('replay', () => {
    assert.equal(getCaptureMode(), 'replay');
  });
});

test('getCaptureMode reports record only for record mode', () => {
  withDigitalTwinMode('record', () => {
    assert.equal(getCaptureMode(), 'record');
  });
});

test('getCaptureMode reports live when DIGITAL_TWIN_MODE is unset or non-recording', () => {
  withDigitalTwinMode(undefined, () => {
    assert.equal(getCaptureMode(), 'live');
  });

  withDigitalTwinMode('off', () => {
    assert.equal(getCaptureMode(), 'live');
  });

  withDigitalTwinMode('  ', () => {
    assert.equal(getCaptureMode(), 'live');
  });
});

test('events timeline emits truthful live mode for non-record runs', () => {
  withDigitalTwinMode(undefined, () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-timeline-live-'));
    const logger = getEventsLogger({ outputDir, config: {} });

    logger.emit({ kind: 'test.event', detail: 'live run' });

    const eventsPath = path.join(outputDir, '_meta', 'events.jsonl');
    const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
    const payload = JSON.parse(lines[lines.length - 1]);

    assert.equal(payload.mode, 'live');
    assert.equal(payload.kind, 'test.event');

    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
