#!/usr/bin/env node
/**
 * LEGACY / DEPRECATED
 *
 * This CLI was an older "nice" interface that attempted to resolve persona IDs
 * and then run the pipeline.
 *
 * In the current repo state it is not maintained and was drifting/broken.
 *
 * Use the canonical orchestrator instead:
 *   npm run pipeline -- --config <config.yaml>
 *
 * Or via the published bin shim (equivalent):
 *   npm exec emotion-engine -- --config <config.yaml>
 */

'use strict';

console.error('❌ bin/run-analysis.js is deprecated and not supported.');
console.error('');
console.error('Use one of:');
console.error('  npm run pipeline -- --config configs/cod-test.yaml');
console.error('  npm exec emotion-engine -- --config configs/cod-test.yaml');
process.exit(1);
