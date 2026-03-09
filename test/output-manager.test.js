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
  createRawDirectories,
  getPhaseRawDirectory,
  getReportPath,
  copyInputAssets,
  cleanupTempFiles,
  resolveRunOutputDir
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

test('normalizes phase directory input to run-level assets directory', () => {
  const phaseDir = createPhaseDirectory(testOutputDir, 'phase1-gather-context');
  const { inputDir, processedDir } = createAssetsDirectory(phaseDir);

  const expectedInputDir = path.join(testOutputDir, 'assets', 'input');
  const expectedProcessedDir = path.join(testOutputDir, 'assets', 'processed');

  if (inputDir !== expectedInputDir) {
    throw new Error(`Expected input dir ${expectedInputDir}, got ${inputDir}`);
  }

  if (processedDir !== expectedProcessedDir) {
    throw new Error(`Expected processed dir ${expectedProcessedDir}, got ${processedDir}`);
  }

  const phaseAssetsDir = path.join(phaseDir, 'assets');
  if (fs.existsSync(phaseAssetsDir)) {
    throw new Error(`Unexpected phase assets directory created: ${phaseAssetsDir}`);
  }
});

test('resolveRunOutputDir maps phase dir to parent run dir', () => {
  const phaseDir = path.join(testOutputDir, 'phase2-process');
  const runDir = resolveRunOutputDir(phaseDir);
  if (runDir !== testOutputDir) {
    throw new Error(`Expected ${testOutputDir}, got ${runDir}`);
  }
});

// Test raw directory helpers
console.log('\nTesting raw directories helpers:\n');

test('createRawDirectories creates raw folders for all phases (canonical only by default)', () => {
  const dirs = createRawDirectories(testOutputDir);

  if (!fs.existsSync(dirs.phase1RawDir)) throw new Error('phase1 raw dir missing');
  if (!fs.existsSync(dirs.phase2RawDir)) throw new Error('phase2 raw dir missing');
  if (!fs.existsSync(dirs.phase3RawDir)) throw new Error('phase3 raw dir missing');

  if (!dirs.phase1RawDir.endsWith(path.join('phase1-gather-context', 'raw'))) {
    throw new Error(`Wrong phase1 raw path: ${dirs.phase1RawDir}`);
  }

  const legacyPhase1RawDir = path.join(testOutputDir, 'phase1-extract', 'raw');
  if (fs.existsSync(legacyPhase1RawDir)) {
    throw new Error('legacy phase1 raw dir should not be created by default');
  }
});

test('createRawDirectories can optionally create legacy phase1-extract/raw', () => {
  const dirs = createRawDirectories(testOutputDir, { includeLegacyPhase1RawDir: true });

  const legacyPhase1RawDir = path.join(testOutputDir, 'phase1-extract', 'raw');
  if (!fs.existsSync(legacyPhase1RawDir)) {
    throw new Error('legacy phase1 raw dir missing when includeLegacyPhase1RawDir=true');
  }

  if (!dirs.legacyPhase1RawDir || dirs.legacyPhase1RawDir !== legacyPhase1RawDir) {
    throw new Error(`Expected legacyPhase1RawDir to be ${legacyPhase1RawDir}, got ${dirs.legacyPhase1RawDir}`);
  }
});

test('getPhaseRawDirectory creates and returns requested phase raw directory', () => {
  const phase2Raw = getPhaseRawDirectory(testOutputDir, 'phase2-process');
  if (!fs.existsSync(phase2Raw)) throw new Error('phase2 raw dir not created');
  if (!phase2Raw.endsWith(path.join('phase2-process', 'raw'))) {
    throw new Error(`Wrong phase2 raw path: ${phase2Raw}`);
  }
});

test('getPhaseRawDirectory supports legacy phase1 key and maps to canonical phase1 directory', () => {
  const phase1Raw = getPhaseRawDirectory(testOutputDir, 'phase1-extract');
  if (!phase1Raw.endsWith(path.join('phase1-gather-context', 'raw'))) {
    throw new Error(`Legacy phase1 key did not resolve to canonical phase1 raw path: ${phase1Raw}`);
  }
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
  fs.writeFileSync(testConfig, [
    'tool_variables:',
    '  soulPath: "test-assets/SOUL.md"',
    '  goalPath: "test-assets/GOAL.md"'
  ].join('\n'));
  
  const soulFile = path.join(assetPath, 'SOUL.md');
  fs.writeFileSync(soulFile, '# SOUL');
  
  const goalFile = path.join(assetPath, 'GOAL.md');
  fs.writeFileSync(goalFile, '# GOAL');
  
  const config = {
    asset: { inputPath: testVideo }
  };
  
  copyInputAssets(testOutputDir, config, assetPath, testConfig);
  
  // Verify files were copied
  const inputDir = path.join(testOutputDir, 'assets', 'input');
  if (!fs.existsSync(path.join(inputDir, 'test-video.mp4'))) {
    throw new Error('Video not copied');
  }
  if (!fs.existsSync(path.join(inputDir, 'config.yaml'))) {
    throw new Error('Config not copied');
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
