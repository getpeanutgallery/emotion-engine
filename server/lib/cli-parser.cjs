#!/usr/bin/env node
/**
 * CLI Argument Parser
 * 
 * Parses command-line arguments for the pipeline orchestrator.
 * 
 * @module cli-parser
 */

const path = require('path');

/**
 * Parse command-line arguments
 * 
 * Supported arguments:
 * - --config <path> (required)
 * - --verbose (optional)
 * - --dry-run (optional)
 * - --help, -h (print help)
 * - --version, -v (print version)
 * 
 * @function parseArgs
 * @param {string[]} argv - Command-line arguments (without node/script path)
 * @returns {object} - Parsed arguments
 * @throws {Error} - If required arguments missing or invalid
 * 
 * @example
 * const args = parseArgs(['--config', 'configs/test.yaml', '--verbose']);
 * // { config: 'configs/test.yaml', verbose: true, dryRun: false }
 */
function parseArgs(argv) {
  const args = {
    config: null,
    verbose: false,
    dryRun: false,
    help: false,
    version: false,
    _: [] // Non-flag arguments
  };
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === '--config' || arg === '-c') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        throw new Error('--config requires a path argument');
      }
      args.config = value;
    } else if (arg === '--config=') {
      // Handle --config=value syntax
      const value = arg.substring('--config='.length);
      if (!value) {
        throw new Error('--config requires a path argument');
      }
      args.config = value;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-V') {
      args.version = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args._.push(arg);
    }
  }
  
  return args;
}

/**
 * Print usage information
 * 
 * @function printHelp
 * 
 * @example
 * printHelp();
 */
function printHelp() {
  const version = getVersion();
  
  console.log(`
Emotion Engine v8.0 - Pipeline Orchestrator
Version ${version}

Usage: node server/run-pipeline.cjs --config <config-file> [options]

Options:
  --config, -c <path>    Path to YAML/JSON config file (REQUIRED)
  --verbose              Enable verbose logging
  --dry-run              Validate config without executing scripts
  --help, -h             Print this help message
  --version, -V          Print version information

Examples:
  node server/run-pipeline.cjs --config configs/video-analysis.yaml
  node server/run-pipeline.cjs --config configs/quick-test.yaml --verbose
  node server/run-pipeline.cjs --config configs/test.yaml --dry-run

Note: Asset paths (inputPath and outputDir) are specified in the YAML config file,
not as CLI arguments. This ensures reproducible, source-controllable pipeline runs.

Config File Format:
  The config file can be YAML (.yaml, .yml) or JSON (.json).
  It must contain:
  - asset.inputPath: Path to source asset
  - asset.outputDir: Where to write output
  - At least 1 script in gather_context, process, or report phases

For more information, see docs/MODULAR-PIPELINE-WORKFLOW.md
`);
}

/**
 * Print version information
 * 
 * @function printVersion
 * 
 * @example
 * printVersion();
 */
function printVersion() {
  const version = getVersion();
  console.log(`Emotion Engine Pipeline Orchestrator v${version}`);
}

/**
 * Get version from package.json
 * 
 * @function getVersion
 * @returns {string} - Version string
 */
function getVersion() {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = require(packageJsonPath);
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

/**
 * Validate parsed arguments
 * 
 * @function validateArgs
 * @param {object} args - Parsed arguments
 * @returns {object} - Validation result: { valid: boolean, error?: string }
 */
function validateArgs(args) {
  if (args.help || args.version) {
    return { valid: true };
  }
  
  if (!args.config) {
    return {
      valid: false,
      error: 'Missing required argument: --config <path>\nUse --help for usage information.'
    };
  }
  
  return { valid: true };
}

module.exports = {
  parseArgs,
  printHelp,
  printVersion,
  getVersion,
  validateArgs,
};
