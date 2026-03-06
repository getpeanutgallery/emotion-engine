#!/usr/bin/env node
/**
 * Unit Tests for Output Manager
 * 
 * Run with: node test/output-manager.test.js
 */

const path = require('path');
const fs = require('fs');
const { 
  createPhaseDirectory,
  createAssetsDirectory,
  createReportDirectory,
  getReportPath,
  copyInputAssets,
  cleanupTempFiles
} = require('../server/lib/output-manager.cjs');

let passed = 0;
let failed = 0;
const testOutputDir = path.join(__dirname, 'output-manager-test-output');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

function cleanup() {
  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  }
}

// Setup
cleanup();
fs.mkdirSync(testOutputDir, { recursive: true });

console.log('Output Manager Unit Tests\n');
console.log('=========================\n');

// Test createPhaseDirectory
console.log('Testing createPhaseDirectory():\n');

test('creates phase directory', () => {
  const phaseDir = createPhaseDirectory(testOutputDir, 'phase1-ingest');
  if (!fs.existsSync(phaseDir)) throw new Error('Directory not created');
  if (phaseDir !== path.join(testOutputDir, 'phase1-ingest')) {
    throw new Error(`Wrong path: ${phaseDir}`);
  }
});

test('creates nested phase directory', () => {
  const phaseDir = createPhaseDirectory(testOutputDir, 'phase2-analyze');
  if (!fs.existsSync(phaseDir)) throw new Error('Directory not created');
  if (!phaseDir.includes('phase2-analyze')) {
    throw new Error(`Wrong path: ${phaseDir}`);
  }
});

// Test createAssetsDirectory
console.log('\nTesting createAssetsDirectory():\n');

test('creates assets/input directory', () => {
  const { inputDir } = createAssetsDirectory(testOutputDir);
  if (!fs.existsSync(inputDir)) throw new Error('Input directory not created');
  if (!inputDir.endsWith('assets/input')) {
    throw new Error(`Wrong path: ${inputDir}`);
  }
});

test('creates assets/processed directory', () => {
  const { processedDir } = createAssetsDirectory(testOutputDir);
  if (!fs.existsSync(processedDir)) throw new Error('Processed directory not created');
  if (!processedDir.endsWith('assets/processed')) {
    throw new Error(`Wrong path: ${processedDir}`);
  }
});

test('returns both directories', () => {
  const result = createAssetsDirectory(testOutputDir);
  if (!result.inputDir) throw new Error('Missing inputDir');
  if (!result.processedDir) throw new Error('Missing processedDir');
});

// Test createReportDirectory
console.log('\nTesting createReportDirectory():\n');

test('creates report directory under phase3-report', () => {
  const reportDir = createReportDirectory(testOutputDir, 'metrics');
  if (!fs.existsSync(reportDir)) throw new Error('Directory not created');
  if (!reportDir.includes('phase3-report/metrics')) {
    throw new Error(`Wrong path: ${reportDir}`);
  }
});

test('creates different report types', () => {
  const reportDir = createReportDirectory(testOutputDir, 'summary');
  if (!fs.existsSync(reportDir)) throw new Error('Directory not created');
  if (!reportDir.includes('phase3-report/summary')) {
    throw new Error(`Wrong path: ${reportDir}`);
  }
});

// Test getReportPath
console.log('\nTesting getReportPath():\n');

test('returns full path to report file', () => {
  const filePath = getReportPath(testOutputDir, 'metrics', 'metrics.json');
  const expected = path.join(testOutputDir, 'phase3-report', 'metrics', 'metrics.json');
  if (filePath !== expected) {
    throw new Error(`Expected ${expected}, got ${filePath}`);
  }
});

// Test copyInputAssets
console.log('\nTesting copyInputAssets():\n');

test('copies input assets', () => {
  // Create test files
  const assetPath = path.join(testOutputDir, 'test-assets');
  fs.mkdirSync(assetPath, { recursive: true });
  
  const testVideo = path.join(assetPath, 'test-video.mp4');
  fs.writeFileSync(testVideo, 'fake video content');
  
  const testConfig = path.join(assetPath, 'test-config.yaml');
  fs.writeFileSync(testConfig, 'test: config');
  
  const soulFile = path.join(assetPath, 'SOUL.md');
  fs.writeFileSync(soulFile, '# SOUL');
  
  const goalFile = path.join(assetPath, 'GOAL.md');
  fs.writeFileSync(goalFile, '# GOAL');
  
  const config = {
    input: { path: testVideo },
    configPath: testConfig
  };
  
  copyInputAssets(testOutputDir, config, assetPath);
  
  // Verify files were copied
  const inputDir = path.join(testOutputDir, 'assets', 'input');
  if (!fs.existsSync(path.join(inputDir, 'test-video.mp4'))) {
    throw new Error('Video not copied');
  }
  if (!fs.existsSync(path.join(inputDir, 'config.yaml'))) {
    throw new Error('Config not copied');
  }
  
  const personasDir = path.join(inputDir, 'personas');
  if (!fs.existsSync(path.join(personasDir, 'SOUL.md'))) {
    throw new Error('SOUL.md not copied');
  }
  if (!fs.existsSync(path.join(personasDir, 'GOAL.md'))) {
    throw new Error('GOAL.md not copied');
  }
});

// Test cleanupTempFiles
console.log('\nTesting cleanupTempFiles():\n');

test('removes temporary files', () => {
  const tempFile = path.join(testOutputDir, 'test.tmp');
  fs.writeFileSync(tempFile, 'temp content');
  
  cleanupTempFiles(testOutputDir);
  
  if (fs.existsSync(tempFile)) {
    throw new Error('Temp file not removed');
  }
});

test('keeps JSON files', () => {
  const jsonFile = path.join(testOutputDir, 'test.json');
  fs.writeFileSync(jsonFile, '{"test": true}');
  
  cleanupTempFiles(testOutputDir);
  
  if (!fs.existsSync(jsonFile)) {
    throw new Error('JSON file was removed');
  }
});

test('keeps MD files', () => {
  const mdFile = path.join(testOutputDir, 'test.md');
  fs.writeFileSync(mdFile, '# Test');
  
  cleanupTempFiles(testOutputDir);
  
  if (!fs.existsSync(mdFile)) {
    throw new Error('MD file was removed');
  }
});

// Cleanup
cleanup();

// Summary
console.log('\n=========================');
console.log(`Tests: ${passed + failed} total`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('=========================\n');

if (failed > 0) {
  process.exit(1);
}
