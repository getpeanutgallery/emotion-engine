#!/usr/bin/env node
/**
 * Pipeline Orchestrator - Main Entry Point
 * 
 * Executes the modular pipeline workflow:
 * 1. Load and validate configuration
 * 2. Execute Phase 1: Gather Context (0-N scripts)
 * 3. Execute Phase 2: Process (0-N scripts)
 * 4. Execute Phase 3: Report (0-N scripts)
 * 5. Save final artifacts
 * 
 * @module run-pipeline
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file (if exists)
require('dotenv').config();

// Import pipeline components
const { loadConfig, validateConfig, getScriptsFromPhase } = require('./lib/config-loader.cjs');
const { createArtifactContext, mergeArtifacts, serializeArtifacts } = require('./lib/artifact-manager.cjs');
const { parseArgs, printHelp, printVersion, validateArgs } = require('./lib/cli-parser.cjs');
const { runGatherContext } = require('./lib/phases/gather-context-runner.cjs');
const { runProcess } = require('./lib/phases/process-runner.cjs');
const { runReport } = require('./lib/phases/report-runner.cjs');

/**
 * Run the complete pipeline
 * 
 * @async
 * @function runPipeline
 * @param {string} configPath - Path to config file
 * @param {object} [options] - Runtime options
 * @param {boolean} [options.verbose] - Enable verbose logging
 * @param {boolean} [options.dryRun] - Validate only, don't execute
 * @returns {Promise<object>} - Pipeline result: { success: boolean, artifacts: object }
 * @throws {Error} - If pipeline execution fails
 * 
 * @example
 * // Programmatic usage
 * const result = await runPipeline('configs/video-analysis.yaml', { verbose: true });
 * console.log('Pipeline complete:', result.success);
 */
async function runPipeline(configPath, options = {}) {
  const { verbose = false, dryRun = false } = options;
  
  console.log('🚀 Emotion Engine Pipeline Orchestrator');
  console.log('========================================\n');
  
  // Step 1: Load configuration
  console.log('📄 Loading configuration...');
  const config = await loadConfig(configPath);
  
  if (verbose) {
    console.log('   Config loaded:', configPath);
    if (config.name) console.log('   Name:', config.name);
    if (config.description) console.log('   Description:', config.description);
  }
  
  // Step 2: Validate configuration
  console.log('✅ Validating configuration...');
  const validation = validateConfig(config);
  
  if (!validation.valid) {
    console.error('   ❌ Validation failed:');
    for (const error of validation.errors) {
      console.error(`      - ${error}`);
    }
    throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
  }
  
  console.log(`   ✅ Valid (${validation.totalScripts} script(s) across all phases)`);
  
  // Step 3: Dry run mode
  if (dryRun) {
    console.log('\n🔍 Dry run mode - configuration is valid, not executing scripts');
    return { success: true, dryRun: true, config };
  }
  
  // Step 4: Prepare execution environment
  const assetPath = path.resolve(config.asset.inputPath);
  const outputDir = path.resolve(config.asset.outputDir);
  
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Initialize artifact context
  let artifacts = createArtifactContext();
  
  // Step 5: Execute phases
  console.log('\n🎯 Executing pipeline...\n');
  
  // Phase 1: Gather Context
  if (config.gather_context) {
    try {
      const result = await runGatherContext({
        assetPath,
        outputDir,
        config,
        scripts: config.gather_context,
        artifacts
      });
      artifacts = mergeArtifacts(artifacts, result.artifacts);
      console.log('   ✅ Phase 1 complete\n');
    } catch (error) {
      console.error('   ❌ Phase 1 failed:', error.message);
      throw error;
    }
  } else {
    console.log('   ⏭️  Phase 1: Gather Context (skipped - no scripts)\n');
  }
  
  // Phase 2: Process
  if (config.process) {
    try {
      const result = await runProcess({
        assetPath,
        outputDir,
        artifacts,
        config,
        scripts: config.process
      });
      artifacts = mergeArtifacts(artifacts, result.artifacts);
      console.log('   ✅ Phase 2 complete\n');
    } catch (error) {
      console.error('   ❌ Phase 2 failed:', error.message);
      throw error;
    }
  } else {
    console.log('   ⏭️  Phase 2: Process (skipped - no scripts)\n');
  }
  
  // Phase 3: Report
  if (config.report) {
    try {
      const result = await runReport({
        outputDir,
        artifacts,
        config,
        scripts: config.report
      });
      artifacts = mergeArtifacts(artifacts, result.artifacts);
      console.log('   ✅ Phase 3 complete\n');
    } catch (error) {
      console.error('   ❌ Phase 3 failed:', error.message);
      throw error;
    }
  } else {
    console.log('   ⏭️  Phase 3: Report (skipped - no scripts)\n');
  }
  
  // Step 6: Save final artifacts
  console.log('💾 Saving final artifacts...');
  const savedFiles = await serializeArtifacts(artifacts, outputDir);
  console.log(`   ✅ Saved ${savedFiles.length} file(s) to ${outputDir}`);
  
  // Step 7: Report results
  console.log('\n✅ Pipeline complete!');
  console.log('========================================');
  console.log(`Total scripts executed: ${validation.totalScripts}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Artifacts saved: ${savedFiles.length} files`);
  
  return {
    success: true,
    artifacts,
    savedFiles,
    outputDir
  };
}

/**
 * CLI entry point
 * Runs when script is executed directly
 */
async function main() {
  try {
    // Parse command-line arguments
    const args = parseArgs(process.argv.slice(2));
    
    // Validate arguments
    const validation = validateArgs(args);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }
    
    // Handle help and version
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    
    if (args.version) {
      printVersion();
      process.exit(0);
    }
    
    // Run pipeline
    await runPipeline(args.config, {
      verbose: args.verbose,
      dryRun: args.dryRun
    });
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

// Export for programmatic usage
module.exports = {
  runPipeline,
};
