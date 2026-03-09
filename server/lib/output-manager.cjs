#!/usr/bin/env node
/**
 * Output Manager
 * Manages output folder structure for emotion-engine reports
 *
 * Usage:
 *   const outputManager = require('./lib/output-manager.cjs');
 *   const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase1-ingest');
 *   const assetsDir = outputManager.createAssetsDirectory(outputDir);
 *   const metricsDir = outputManager.createReportDirectory(outputDir, 'metrics');
 *   const metricsPath = outputManager.getReportPath(outputDir, 'metrics', 'metrics.json');
 *   outputManager.copyInputAssets(outputDir, config, assetPath);
 *   outputManager.cleanupTempFiles(outputDir);
 */

const fs = require('fs');
const path = require('path');

/**
 * Create phase directory structure
 * Creates /output/<run-name>/phase<N>-<phase-name>/ directory structure
 *
 * @param {string} outputDir - Base output directory path
 * @param {string} phaseName - Name of the phase (e.g., 'phase1-ingest', 'phase2-analyze')
 * @returns {string} Full path to the created directory
 *
 * @example
 * const phaseDir = outputManager.createPhaseDirectory('/app/output', 'phase1-ingest');
 * // Creates: /app/output/phase1-ingest/
 * // Returns: '/app/output/phase1-ingest'
 */
function createPhaseDirectory(outputDir, phaseName) {
  const phaseDir = path.join(outputDir, phaseName);

  // Create directory recursively if it doesn't exist
  if (!fs.existsSync(phaseDir)) {
    fs.mkdirSync(phaseDir, { recursive: true });
  }

  return phaseDir;
}

/**
 * Resolve canonical run output directory.
 *
 * Backward compatibility: older callers occasionally pass a phase directory
 * (e.g. /output/<run>/phase1-gather-context) when creating assets folders.
 * Assets are canonical at /output/<run>/assets, so normalize phase paths
 * back to the run root.
 *
 * @param {string} outputDir - Run output dir or phase output dir
 * @returns {string} Canonical run output directory
 */
function resolveRunOutputDir(outputDir) {
  const baseName = path.basename(outputDir);
  if (/^phase\d+-/.test(baseName)) {
    return path.dirname(outputDir);
  }
  return outputDir;
}

/**
 * Create assets directory structure
 * Creates /output/<run-name>/assets/input/ and /output/<run-name>/assets/processed/ directories
 *
 * @param {string} outputDir - Base output directory path (run or phase dir)
 * @returns {object} Object with inputDir and processedDir paths
 *
 * @example
 * const assetsDirs = outputManager.createAssetsDirectory('/app/output');
 * // Creates: /app/output/assets/input/ and /app/output/assets/processed/
 * // Returns: { inputDir: '/app/output/assets/input', processedDir: '/app/output/assets/processed' }
 */
function createAssetsDirectory(outputDir) {
  const runOutputDir = resolveRunOutputDir(outputDir);
  const assetsDir = path.join(runOutputDir, 'assets');
  const inputDir = path.join(assetsDir, 'input');
  const processedDir = path.join(assetsDir, 'processed');

  // Create directories recursively if they don't exist
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }

  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  return { inputDir, processedDir };
}

/**
 * Create report directory structure
 * Creates /output/<run-name>/phase3-report/<report-name>/ directory structure
 *
 * @param {string} outputDir - Base output directory path
 * @param {string} reportName - Name of the report (creates subdirectory under phase3-report)
 * @returns {string} Full path to the created directory
 *
 * @example
 * const metricsDir = outputManager.createReportDirectory('/app/output', 'metrics');
 * // Creates: /app/output/phase3-report/metrics/
 * // Returns: '/app/output/phase3-report/metrics'
 */
function createReportDirectory(outputDir, reportName) {
  const reportDir = path.join(outputDir, 'phase3-report', reportName);

  // Create directory recursively if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  return reportDir;
}

/**
 * Get full path to a file within a report directory
 * Returns /output/<run-name>/<report-name>/<filename>
 *
 * @param {string} outputDir - Base output directory path
 * @param {string} reportName - Name of the report subdirectory
 * @param {string} filename - Name of the file
 * @returns {string} Full path to the file
 *
 * @example
 * const metricsPath = outputManager.getReportPath('/app/output', 'metrics', 'metrics.json');
 * // Returns: '/app/output/metrics/metrics.json'
 */
function getReportPath(outputDir, reportName, filename) {
  const reportDir = createReportDirectory(outputDir, reportName);
  return path.join(reportDir, filename);
}

/**
 * Copy input assets to the assets directory structure
 * Copies input video/audio, config file, and persona files to appropriate locations
 * 
 * @param {string} outputDir - Base output directory path
 * @param {object} config - Configuration object with paths to assets
 * @param {string} assetPath - Base path to asset files
 * @param {string} configPath - Path to the config file (needed to read tool_variables)
 * 
 * @example
 * outputManager.copyInputAssets('/app/output', config, '/path/to/assets', '/path/to/config.yaml');
 * // Copies:
 * // - Input video/audio to assets/input/
 * // - Config file to assets/input/config.yaml
 * // - SOUL.md, GOAL.md from tool_paths to assets/input/personas/
 */
function copyInputAssets(outputDir, config, assetPath, configPath) {
  const { inputDir } = createAssetsDirectory(outputDir);
  const personasDir = path.join(inputDir, 'personas');
  
  // Create personas directory
  if (!fs.existsSync(personasDir)) {
    fs.mkdirSync(personasDir, { recursive: true });
  }
  
  // Copy input video/audio to assets/input/
  // Support both old (config.input.path) and new (config.asset.inputPath) structures
  let inputPath = null;
  if (config.input && config.input.path) {
    inputPath = config.input.path;
  } else if (config.asset && config.asset.inputPath) {
    inputPath = config.asset.inputPath;
  }
  
  if (inputPath) {
    const inputFilename = path.basename(inputPath);
    const destPath = path.join(inputDir, inputFilename);
    
    if (fs.existsSync(inputPath)) {
      fs.copyFileSync(inputPath, destPath);
    }
  }
  
  // Copy config file to assets/input/config.yaml
  if (configPath) {
    const configDest = path.join(inputDir, 'config.yaml');
    
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, configDest);
    }
  }
  
  // Copy persona files (SOUL.md, GOAL.md) from tool_variables paths
  // Read the config file to get the actual paths
  if (configPath && fs.existsSync(configPath)) {
    const yaml = require('js-yaml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = yaml.load(configContent);
    
    // Get tool_variables from config
    const toolVariables = parsedConfig.tool_variables;
    
    if (toolVariables) {
      // Resolve paths relative to peanut-gallery workspace root
      // Config is in emotion-engine/configs/, so we need to go up 2 levels to reach peanut-gallery
      // The config paths (e.g., "cast/impatient-teenager/SOUL.md") are relative to peanut-gallery root
      const workspaceRoot = path.resolve(path.dirname(configPath), '..', '..');
      
      // Copy SOUL.md from soulPath
      if (toolVariables.soulPath) {
        const soulPath = path.resolve(workspaceRoot, toolVariables.soulPath);
        const soulDest = path.join(personasDir, 'SOUL.md');
        
        if (fs.existsSync(soulPath)) {
          fs.copyFileSync(soulPath, soulDest);
        }
      }
      
      // Copy GOAL.md from goalPath
      if (toolVariables.goalPath) {
        const goalPath = path.resolve(workspaceRoot, toolVariables.goalPath);
        const goalDest = path.join(personasDir, 'GOAL.md');
        
        if (fs.existsSync(goalPath)) {
          fs.copyFileSync(goalPath, goalDest);
        }
      }
    }
  }
  
  // Copy tool files if they exist in assetPath
  const toolFilesPattern = path.join(assetPath, 'tools-*');
  try {
    const toolFiles = fs.readdirSync(path.dirname(assetPath))
      .filter(file => file.startsWith('tools-') && file.endsWith('.md'));
    
    for (const toolFile of toolFiles) {
      const sourcePath = path.join(path.dirname(assetPath), toolFile);
      const destPath = path.join(personasDir, toolFile);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  } catch (error) {
    // Ignore if tool files don't exist
  }
}

/**
 * Clean up temporary files from report directories
 * Removes temporary files while keeping final artifacts (.json, .md files)
 *
 * @param {string} outputDir - Base output directory to clean
 *
 * @example
 * outputManager.cleanupTempFiles('/app/output');
 * // Removes: .tmp, .bak, .cache files
 * // Keeps: .json, .md files
 */
function cleanupTempFiles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return;
  }

  // Extensions to keep (final artifacts)
  const keepExtensions = ['.json', '.md'];

  // Extensions to remove (temporary files)
  const tempExtensions = ['.tmp', '.bak', '.cache', '.temp', '.log'];

  // Process all files in output directory
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(outputDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively clean subdirectories (report folders)
      cleanupTempFiles(fullPath);

      // Remove empty directories after cleanup
      const remainingFiles = fs.readdirSync(fullPath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      // Remove temporary files
      if (tempExtensions.includes(ext)) {
        fs.unlinkSync(fullPath);
      }

      // Keep final artifacts (.json, .md) - do nothing
      // Remove other unknown files if needed in future
    }
  }
}

module.exports = {
  createPhaseDirectory,
  createAssetsDirectory,
  createReportDirectory,
  getReportPath,
  copyInputAssets,
  cleanupTempFiles,
  resolveRunOutputDir
};
