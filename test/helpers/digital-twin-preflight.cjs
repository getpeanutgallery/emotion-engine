#!/usr/bin/env node
/**
 * Digital Twin preflight for cassette-backed provider/integration tests.
 *
 * Validates:
 *  - DIGITAL_TWIN_PACK exists
 *  - cassette file exists at: $DIGITAL_TWIN_PACK/cassettes/$DIGITAL_TWIN_CASSETTE.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIGITAL_TWIN_PACK = path.resolve(__dirname, '..', '..', '..', 'digital-twin-emotion-engine-providers');
const DEFAULT_DIGITAL_TWIN_CASSETTE = 'providers';

function applyDefaultDigitalTwinEnv() {
  process.env.DIGITAL_TWIN_PACK = process.env.DIGITAL_TWIN_PACK || DEFAULT_DIGITAL_TWIN_PACK;
  process.env.DIGITAL_TWIN_CASSETTE = process.env.DIGITAL_TWIN_CASSETTE || DEFAULT_DIGITAL_TWIN_CASSETTE;

  return {
    pack: process.env.DIGITAL_TWIN_PACK,
    cassette: process.env.DIGITAL_TWIN_CASSETTE,
  };
}

function preflightDigitalTwin() {
  const pack = process.env.DIGITAL_TWIN_PACK;
  const cassette = process.env.DIGITAL_TWIN_CASSETTE;

  if (!pack || !cassette) {
    throw new Error(
      [
        'Digital Twin cassette preflight failed.',
        '',
        'Required environment variables:',
        '  - DIGITAL_TWIN_PACK (path to a cassette pack directory)',
        '  - DIGITAL_TWIN_CASSETTE (cassette name without .json)',
        '',
        'Example (repo-relative sibling default):',
        `  DIGITAL_TWIN_PACK=${DEFAULT_DIGITAL_TWIN_PACK}`,
        `  DIGITAL_TWIN_CASSETTE=${DEFAULT_DIGITAL_TWIN_CASSETTE}`,
        '  npm test',
        '',
        'Expected cassette file location:',
        '  $DIGITAL_TWIN_PACK/cassettes/$DIGITAL_TWIN_CASSETTE.json',
      ].join('\n')
    );
  }

  if (!fs.existsSync(pack)) {
    throw new Error(
      [
        'Digital Twin cassette preflight failed.',
        '',
        `DIGITAL_TWIN_PACK does not exist: ${pack}`,
        '',
        'Fix:',
        '  - Set DIGITAL_TWIN_PACK to a valid pack directory, or',
        `  - Clone the pack next to emotion-engine (suggested): ${DEFAULT_DIGITAL_TWIN_PACK}`,
      ].join('\n')
    );
  }

  const cassettePath = path.join(pack, 'cassettes', `${cassette}.json`);

  if (!fs.existsSync(cassettePath)) {
    throw new Error(
      [
        'Digital Twin cassette preflight failed.',
        '',
        `Cassette not found: ${cassette}`,
        `Expected: ${cassettePath}`,
        '',
        'Fix:',
        '  - Put the cassette JSON file at the expected path, or',
        '  - Set DIGITAL_TWIN_PACK / DIGITAL_TWIN_CASSETTE to point at an existing cassette.',
        '',
        'Example:',
        `  DIGITAL_TWIN_PACK=${pack}`,
        `  DIGITAL_TWIN_CASSETTE=${cassette}`,
      ].join('\n')
    );
  }

  return { pack, cassette, cassettePath };
}

module.exports = {
  DEFAULT_DIGITAL_TWIN_PACK,
  DEFAULT_DIGITAL_TWIN_CASSETTE,
  applyDefaultDigitalTwinEnv,
  preflightDigitalTwin,
};
