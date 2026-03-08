#!/usr/bin/env node
/**
 * Quick validation script for YAML configuration files.
 * Checks that all configs in configs/*.yaml can be parsed.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configsDir = path.join(__dirname, 'configs');
const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.yaml'));

console.log('🔍 Validating YAML configuration files...\n');

let errors = [];
for (const file of files) {
  const filePath = path.join(configsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Load all documents (support multi-doc YAML)
    const docs = yaml.loadAll(content);
    console.log(`  ✅ ${file} - loaded OK (${docs.length} document(s))`);
  } catch (e) {
    console.error(`  ❌ ${file} - ERROR: ${e.message}`);
    errors.push(file);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Validation failed for ${errors.length} file(s): ${errors.join(', ')}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${files.length} YAML file(s) are valid.`);
  process.exit(0);
}
