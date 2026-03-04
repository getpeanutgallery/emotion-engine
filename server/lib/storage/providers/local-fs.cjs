#!/usr/bin/env node
/**
 * Local Filesystem Storage Provider
 * 
 * Default storage provider - writes to local filesystem.
 * Used for development and local deployments.
 * 
 * @module storage/providers/local-fs
 */

const fs = require('fs');
const path = require('path');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'local-fs';

/**
 * Storage configuration
 * @type {Object}
 */
let config = {};

/**
 * Base directory for local storage
 * @type {string}
 */
let baseDir = '';

/**
 * Initialize local filesystem provider
 * 
 * @function initialize
 * @param {Object} options - Provider options
 * @param {string} [options.baseDir] - Base directory (defaults to process.cwd())
 * @returns {Object} - Provider instance
 */
function initialize(options = {}) {
  config = {
    baseDir: options.baseDir || process.cwd(),
  };
  
  baseDir = config.baseDir;
  
  // Ensure base directory exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  return {
    name,
    write,
    read,
    exists,
    list,
    getUrl,
    delete: del,
  };
}

/**
 * Write artifact to local filesystem
 * 
 * @async
 * @function write
 * @param {string} storagePath - Storage path (relative to baseDir)
 * @param {Buffer|string} data - Data to store
 * @param {Object} [options] - Storage-specific options
 * @param {string} [options.encoding] - Encoding for string data (default: 'utf8')
 * @returns {Promise<string>} - Absolute file path
 */
async function write(storagePath, data, options = {}) {
  const fullPath = path.join(baseDir, storagePath);
  
  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write data
  const writeOptions = {};
  if (typeof data === 'string') {
    writeOptions.encoding = options.encoding || 'utf8';
  }
  
  fs.writeFileSync(fullPath, data, writeOptions);
  
  return fullPath;
}

/**
 * Read artifact from local filesystem
 * 
 * @async
 * @function read
 * @param {string} storagePath - Storage path (relative to baseDir)
 * @returns {Promise<Buffer>} - File contents
 */
async function read(storagePath) {
  const fullPath = path.join(baseDir, storagePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  
  return fs.readFileSync(fullPath);
}

/**
 * Check if artifact exists
 * 
 * @async
 * @function exists
 * @param {string} storagePath - Storage path (relative to baseDir)
 * @returns {Promise<boolean>}
 */
async function exists(storagePath) {
  const fullPath = path.join(baseDir, storagePath);
  return fs.existsSync(fullPath);
}

/**
 * List artifacts by prefix
 * 
 * @async
 * @function list
 * @param {string} prefix - Path prefix (relative to baseDir)
 * @returns {Promise<string[]>} - List of relative paths
 */
async function list(prefix) {
  const fullPrefix = path.join(baseDir, prefix);
  const dir = path.dirname(fullPrefix);
  
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = fs.readdirSync(dir, { recursive: true });
  
  return files
    .filter(file => {
      const fullPath = path.join(dir, file);
      return fullPath.startsWith(fullPrefix) && fs.statSync(fullPath).isFile();
    })
    .map(file => {
      const fullPath = path.join(dir, file);
      return path.relative(baseDir, fullPath);
    });
}

/**
 * Get URL for artifact (file:// URL for local files)
 * 
 * @async
 * @function getUrl
 * @param {string} storagePath - Storage path (relative to baseDir)
 * @returns {Promise<string>} - file:// URL
 */
async function getUrl(storagePath) {
  const fullPath = path.join(baseDir, storagePath);
  return `file://${fullPath}`;
}

/**
 * Delete artifact from local filesystem
 * 
 * @async
 * @function delete
 * @param {string} storagePath - Storage path (relative to baseDir)
 * @returns {Promise<boolean>} - True if deleted
 */
async function del(storagePath) {
  const fullPath = path.join(baseDir, storagePath);
  
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  
  fs.unlinkSync(fullPath);
  return true;
}

module.exports = {
  name,
  initialize,
};
