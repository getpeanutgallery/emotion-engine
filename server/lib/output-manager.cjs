#!/usr/bin/env node
/**
 * Output Manager
 * Manages output folder structure for emotion-engine reports
 * 
 * Usage:
 *   const outputManager = require('./lib/output-manager.cjs');
 *   const metricsDir = outputManager.createReportDirectory(outputDir, 'metrics');
 *   const metricsPath = outputManager.getReportPath(outputDir, 'metrics', 'metrics.json');
 *   outputManager.cleanupTempFiles(outputDir);
 */

const fs = require('fs');
const path = require('path');

/**
 * Create report directory structure
 * Creates /output/<run-name>/<report-name>/ directory structure
 * 
 * @param {string} outputDir - Base output directory path
 * @param {string} reportName - Name of the report (creates subdirectory)
 * @returns {string} Full path to the created directory
 * 
 * @example
 * const metricsDir = outputManager.createReportDirectory('/app/output', 'metrics');
 * // Creates: /app/output/metrics/
 * // Returns: '/app/output/metrics'
 */
function createReportDirectory(outputDir, reportName) {
  const reportDir = path.join(outputDir, reportName);
  
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
  createReportDirectory,
  getReportPath,
  cleanupTempFiles
};
