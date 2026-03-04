#!/usr/bin/env node
/**
 * User-Facing CLI for Emotion Engine
 * 
 * Accepts persona IDs and resolves them to paths, then calls pipeline.
 * This is the "nice" interface; pipeline is the "dumb" engine.
 * 
 * Usage:
 *   node bin/run-analysis.js --soul impatient-teenager --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/
 * 
 * Or with versions:
 *   node bin/run-analysis.js --soul impatient-teenager --soul-version 1.0.0 --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/
 */

const { spawn } = require('child_process');
const path = require('path');
const resolver = require('../lib/persona-resolver.cjs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  soul: null,
  soulVersion: 'latest',
  goal: null,
  goalVersion: 'latest',
  tool: null,
  videoPath: null,
  outputDir: null
};

// Parse flags
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--soul' && args[i + 1]) {
    options.soul = args[++i];
  } else if (args[i] === '--soul-version' && args[i + 1]) {
    options.soulVersion = args[++i];
  } else if (args[i] === '--goal' && args[i + 1]) {
    options.goal = args[++i];
  } else if (args[i] === '--goal-version' && args[i + 1]) {
    options.goalVersion = args[++i];
  } else if (args[i] === '--tool' && args[i + 1]) {
    options.tool = args[++i];
  } else if (!args[i].startsWith('--')) {
    // Positional arguments: video path, output dir
    if (!options.videoPath) {
      options.videoPath = args[i];
    } else if (!options.outputDir) {
      options.outputDir = args[i];
    }
  }
}

// Validate required arguments
if (!options.soul || !options.goal || !options.tool) {
  console.error('❌ Missing required arguments');
  console.error('');
  console.error('Usage:');
  console.error('  node bin/run-analysis.js --soul <id> --goal <id> --tool <id> <video-path> [output-dir]');
  console.error('');
  console.error('Options:');
  console.error('  --soul <id>              Soul/persona ID (required)');
  console.error('  --soul-version <ver>     Soul version (default: latest)');
  console.error('  --goal <id>              Goal ID (required)');
  console.error('  --goal-version <ver>     Goal version (default: latest)');
  console.error('  --tool <id>              Tool ID (required)');
  console.error('  <video-path>             Path to video file');
  console.error('  [output-dir]             Output directory (default: ./output/default)');
  console.error('');
  console.error('Example:');
  console.error('  node bin/run-analysis.js --soul impatient-teenager --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/');
  process.exit(1);
}

if (!options.videoPath) {
  console.error('❌ Video path is required');
  process.exit(1);
}

// Resolve IDs to paths
console.log('🔍 Resolving persona IDs to paths...');

const resolved = resolver.resolveAll({
  soulId: options.soul,
  soulVersion: options.soulVersion,
  goalId: options.goal,
  goalVersion: options.goalVersion,
  toolId: options.tool
});

// Check if all paths were resolved
if (!resolved.soulPath) {
  console.error(`❌ Soul not found: ${options.soul}@${options.soulVersion}`);
  process.exit(1);
}

if (!resolved.goalPath) {
  console.error(`❌ Goal not found: ${options.goal}@${options.goalVersion}`);
  process.exit(1);
}

if (!resolved.toolPath) {
  console.error(`❌ Tool not found: ${options.tool}`);
  process.exit(1);
}

console.log(`✅ Soul: ${resolved.soulPath}`);
console.log(`✅ Goal: ${resolved.goalPath}`);
console.log(`✅ Tool: ${resolved.toolPath}`);

// Set environment variables for pipeline
process.env.SOUL_PATH = resolved.soulPath;
process.env.GOAL_PATH = resolved.goalPath;
process.env.TOOL_PATH = resolved.toolPath;

// Set TOOL_VARIABLES if not already set
if (!process.env.TOOL_VARIABLES) {
  process.env.TOOL_VARIABLES = JSON.stringify({
    lenses: ['patience', 'boredom', 'excitement']
  });
}

// Spawn pipeline
console.log('');
console.log('🚀 Starting pipeline...');
console.log('');

const pipelinePath = path.join(__dirname, '../server/run-pipeline.cjs');
const pipelineArgs = [pipelinePath, options.videoPath];

if (options.outputDir) {
  pipelineArgs.push(options.outputDir);
}

const pipeline = spawn('node', pipelineArgs, {
  stdio: 'inherit',
  env: process.env
});

pipeline.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ Analysis complete!');
  } else {
    console.log('');
    console.error(`❌ Pipeline failed with code ${code}`);
  }
  process.exit(code);
});

pipeline.on('error', (err) => {
  console.error(`❌ Failed to start pipeline: ${err.message}`);
  process.exit(1);
});
