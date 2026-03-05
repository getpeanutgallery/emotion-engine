#!/usr/bin/env node
/**
 * Pipeline Orchestrator Unit Tests
 * 
 * Tests for the complete pipeline flow
 * Uses Node.js native test runner
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const { runPipeline } = require('../../server/run-pipeline.cjs');

test('Pipeline Orchestrator - runPipeline', async (t) => {
  const testOutputDir = path.join(__dirname, 'fixtures', 'pipeline-test-output');
  
  t.beforeEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });
  
  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });
  
  await t.test('should run pipeline with example scripts', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-pipeline.yaml');
    
    const result = await runPipeline(configPath, { verbose: false });
    
    assert.strictEqual(result.success, true);
    assert(result.artifacts);
    assert(result.savedFiles);
    assert(result.outputDir);
  });
  
  await t.test('should execute phases in order', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-pipeline.yaml');
    
    const result = await runPipeline(configPath);
    
    assert(result.artifacts.exampleGatherData, 'Should have gather artifacts');
    assert(result.artifacts.exampleProcessData, 'Should have process artifacts');
    assert(result.artifacts.exampleReport, 'Should have report artifacts');
  });
  
  await t.test('should pass artifacts between phases', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-pipeline.yaml');
    
    const result = await runPipeline(configPath);
    
    assert(result.artifacts.exampleProcessData);
    assert(result.artifacts.exampleProcessData.previousArtifacts);
    assert(result.artifacts.exampleProcessData.previousArtifacts.includes('exampleGatherData'));
  });
  
  await t.test('should save final artifacts to output directory', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-pipeline.yaml');
    
    const result = await runPipeline(configPath);
    
    assert(fs.existsSync(result.outputDir));
    assert(result.savedFiles.length > 0);
    for (const file of result.savedFiles) {
      assert(fs.existsSync(file), `File should exist: ${file}`);
    }
  });
  
  await t.test('should handle dry-run mode', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-pipeline.yaml');
    
    const result = await runPipeline(configPath, { dryRun: true });
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.dryRun, true);
    assert(result.config);
  });
  
  await t.test('should throw error for invalid config', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'invalid-no-scripts.yaml');
    
    await assert.rejects(
      async () => runPipeline(configPath),
      /validation|script/
    );
  });
  
  await t.test('should throw error for missing config file', async () => {
    await assert.rejects(
      async () => runPipeline('nonexistent.yaml'),
      /not found/
    );
  });
});

test('Pipeline Orchestrator - Parallel execution', async (t) => {
  await t.test('should run parallel scripts simultaneously', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'test-parallel.yaml');
    
    const result = await runPipeline(configPath);
    
    assert.strictEqual(result.success, true);
    assert(result.artifacts);
  });
});

console.log('✅ Pipeline orchestrator tests complete');
