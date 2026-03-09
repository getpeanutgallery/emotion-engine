#!/usr/bin/env node
/**
 * CLI shim for the `emotion-engine` bin entry.
 *
 * Forwards execution to the canonical orchestrator entrypoint:
 *   server/run-pipeline.cjs
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const target = path.resolve(__dirname, '..', 'server', 'run-pipeline.cjs');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [target, ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
