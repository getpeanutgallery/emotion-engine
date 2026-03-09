#!/usr/bin/env node
/**
 * Test Debug Config Functionality
 * 
 * Tests that the debug.keepTempFiles and debug.keepProcessedAssets
 * configuration options work correctly.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./server/lib/config-loader.cjs');

async function testDebugConfig() {
  console.log('🧪 Testing Debug Config Functionality\n');
  
  // Test 1: Load quick-test.yaml (has debug.keepTempFiles: true)
  console.log('Test 1: Loading quick-test.yaml config...');
  const quickTestConfig = await loadConfig('configs/quick-test.yaml');
  
  if (quickTestConfig.debug?.keepTempFiles === true) {
    console.log('   ✅ debug.keepTempFiles is true');
  } else {
    console.error('   ❌ debug.keepTempFiles is not true:', quickTestConfig.debug?.keepTempFiles);
    process.exit(1);
  }
  
  if (quickTestConfig.debug?.keepProcessedAssets === true) {
    console.log('   ✅ debug.keepProcessedAssets is true');
  } else {
    console.error('   ❌ debug.keepProcessedAssets is not true:', quickTestConfig.debug?.keepProcessedAssets);
    process.exit(1);
  }
  
  // Test 2: Load video-analysis.yaml (has debug.keepTempFiles: false)
  console.log('\nTest 2: Loading video-analysis.yaml config...');
  const videoAnalysisConfig = await loadConfig('configs/video-analysis.yaml');
  
  if (videoAnalysisConfig.debug?.keepTempFiles === false) {
    console.log('   ✅ debug.keepTempFiles is false');
  } else {
    console.error('   ❌ debug.keepTempFiles is not false:', videoAnalysisConfig.debug?.keepTempFiles);
    process.exit(1);
  }
  
  // Test 3: Verify scripts can read the config
  console.log('\nTest 3: Verifying scripts can access debug config...');
  
  // Simulate what the scripts do
  const config = quickTestConfig;
  const keepTempFiles = config?.debug?.keepTempFiles === true;
  const keepProcessedAssets = config?.debug?.keepProcessedAssets !== false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  console.log(`   keepTempFiles: ${keepTempFiles}`);
  console.log(`   keepProcessedAssets: ${keepProcessedAssets}`);
  console.log(`   timestamp: ${timestamp}`);
  
  if (keepTempFiles && keepProcessedAssets) {
    console.log('   ✅ Scripts will keep temp files for debugging');
  } else {
    console.error('   ❌ Scripts will not keep temp files as expected');
    process.exit(1);
  }
  
  // Test 4: Verify timestamp format is safe for filenames
  console.log('\nTest 4: Verifying timestamp format...');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(timestamp)) {
    console.log(`   ✅ Timestamp format is safe: ${timestamp}`);
  } else {
    console.error(`   ❌ Timestamp format may be unsafe: ${timestamp}`);
    process.exit(1);
  }
  
  console.log('\n✅ All debug config tests passed!\n');
  console.log('Summary:');
  console.log('  - Config files correctly define debug.keepTempFiles and debug.keepProcessedAssets');
  console.log('  - Scripts can read and interpret the debug config');
  console.log('  - Timestamp format is safe for file paths');
  console.log('\nTo test with actual files:');
  console.log('  1. Run: node bin/run-analysis.js --config configs/quick-test.yaml');
  console.log('  2. Check output/quick-test/phase1-gather-context/assets/processed/dialogue/');
  console.log('  3. Check output/quick-test/phase2-process/assets/processed/chunks/');
}

// Run the test
testDebugConfig().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
