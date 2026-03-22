#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const explicitFiles = [];
let mode = 'staged';

for (const arg of argv) {
  if (arg === '--tracked') mode = 'tracked';
  else explicitFiles.push(arg);
}

const SECRET_PATTERNS = [
  { label: 'Authorization bearer token', pattern: /Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}/i },
  { label: 'OpenAI/OpenRouter-style key', pattern: /\bsk-(?:or-|proj-)?[A-Za-z0-9_-]{8,}\b/ },
  { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { label: 'API key assignment', pattern: /(?:api[_-]?key|x-api-key)\s*[:=]\s*["'](?!\[REDACTED\]|REDACTED)[^"'\n]{8,}["']/i }
];

const DISALLOWED_PATHS = [
  { label: 'pipeline output artifacts must stay out of git', pattern: /^output\// },
  { label: 'debug logs must stay out of git', pattern: /^\.logs\// }
];

function getGitFiles() {
  if (explicitFiles.length > 0) return explicitFiles;

  const args = mode === 'tracked'
    ? ['ls-files']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];

  const stdout = execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  }).trim();

  if (!stdout) return [];
  return stdout.split('\n').filter(Boolean);
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    '.cjs', '.js', '.json', '.jsonl', '.md', '.txt', '.yaml', '.yml', '.env', '.log'
  ].includes(ext);
}

function main() {
  const files = getGitFiles();
  const failures = [];

  for (const relPath of files) {
    const normalizedPath = relPath.replace(/\\/g, '/');

    for (const rule of DISALLOWED_PATHS) {
      if (rule.pattern.test(normalizedPath)) {
        failures.push({ file: normalizedPath, reason: rule.label });
      }
    }

    const absolutePath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile() || !isTextFile(absolutePath)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(content)) {
        failures.push({ file: normalizedPath, reason: rule.label });
      }
    }
  }

  if (failures.length > 0) {
    console.error('Secret/artifact guard failed:');
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.reason}`);
    }
    console.error('\nFix or redact the files before committing.');
    process.exit(1);
  }

  console.log(`Secret/artifact guard passed (${files.length} file${files.length === 1 ? '' : 's'} checked, mode=${mode}).`);
}

main();
