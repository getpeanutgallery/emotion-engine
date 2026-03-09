#!/usr/bin/env node
/**
 * Quick validation script for YAML configuration files.
 *
 * Purpose:
 * - Catch YAML parse errors early across configs/*.yaml.
 * - Match the pipeline loader behavior (js-yaml `load` => single-document YAML).
 *
 * NOTE:
 * This script validates *parsing only*.
 * For schema/semantic validation, use:
 *   npm run pipeline -- --config <file> --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configsDir = path.join(__dirname, 'configs');

if (!fs.existsSync(configsDir)) {
  console.error(`❌ configs directory not found: ${configsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(configsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

console.log('🔍 Validating YAML configuration files (single-document)...\n');

const errors = [];
for (const file of files) {
  const filePath = path.join(configsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Single-document load: matches server/lib/config-loader.cjs
    yaml.load(content);
    console.log(`  ✅ ${file} - parsed OK`);
  } catch (e) {
    console.error(`  ❌ ${file} - ERROR: ${e.message}`);
    errors.push(file);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Validation failed for ${errors.length} file(s): ${errors.join(', ')}`);
  process.exit(1);
}

console.log(`\n✅ All ${files.length} YAML file(s) parsed successfully.`);
process.exit(0);
