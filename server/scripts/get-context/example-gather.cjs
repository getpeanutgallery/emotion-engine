#!/usr/bin/env node
/**
 * Example Gather Context Script
 * 
 * Minimal example script for testing the pipeline.
 * Simulates gathering context from an asset.
 * 
 * @module scripts/get-context/example-gather
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.assetPath - Path to source asset
 * @param {string} input.outputDir - Output directory
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;
  
  console.log('   📥 Gathering context from:', assetPath);
  
  // Simulate gathering context (no actual processing)
  const gatheredData = {
    source: assetPath,
    timestamp: new Date().toISOString(),
    pipelineName: config?.name || 'Unknown',
    settings: config?.settings || {}
  };
  
  console.log('   ✅ Context gathered successfully');
  
  return {
    artifacts: {
      exampleGatherData: gatheredData
    }
  };
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-asset.mp4';
  const outputDir = process.argv[3] || 'output/test';
  
  run({ assetPath, outputDir, config: {} })
    .then(result => {
      console.log('Example gather complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch(console.error);
}
