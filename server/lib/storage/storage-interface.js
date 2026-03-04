#!/usr/bin/env node
/**
 * Storage Interface - Contract Definition
 * 
 * Pluggable storage abstraction for artifacts. All storage providers implement
 * this contract, allowing scripts to be storage-agnostic.
 * 
 * Supports:
 * - Local filesystem (default)
 * - AWS S3
 * - Google Cloud Storage
 * - Azure Blob Storage
 * 
 * @module storage/storage-interface
 */

const path = require('path');
const fs = require('fs');

/**
 * Storage provider instance (initialized on first use)
 * @type {Object|null}
 */
let _provider = null;

/**
 * Storage configuration
 * @typedef {Object} StorageConfig
 * @property {string} provider - Storage provider name ('local-fs', 'aws-s3', 'gcs', 'azure-blob')
 * @property {string} [bucket] - Bucket/container name (for cloud providers)
 * @property {string} [region] - Region (for AWS/Azure)
 * @property {Object} [options] - Provider-specific options
 */

/**
 * Initialize storage provider from environment or config
 * 
 * @function initialize
 * @param {StorageConfig} [config] - Storage configuration
 * @returns {Object} - Storage provider instance
 * 
 * @example
 * // Via environment variables
 * // export STORAGE_PROVIDER=aws-s3
 * // export S3_BUCKET=my-emotion-engine-bucket
 * // export AWS_REGION=us-east-1
 * const storage = require('./storage-interface.js');
 * storage.initialize();
 * 
 * @example
 * // Via config object
 * storage.initialize({
 *   provider: 'aws-s3',
 *   bucket: 'my-emotion-engine-bucket',
 *   region: 'us-east-1'
 * });
 */
function initialize(config) {
  if (_provider) {
    return _provider;
  }

  // Determine provider from config or environment
  const providerName = config?.provider || process.env.STORAGE_PROVIDER || 'local-fs';
  
  // Load provider implementation
  const providerPath = path.join(__dirname, 'providers', `${providerName}.cjs`);
  
  if (!fs.existsSync(providerPath)) {
    throw new Error(
      `Storage provider "${providerName}" not found. ` +
      `Available providers: ${getAvailableProviders().join(', ')}`
    );
  }
  
  const providerModule = require(providerPath);
  
  // Initialize provider with config
  _provider = providerModule.initialize({
    ...config,
    provider: providerName,
  });
  
  return _provider;
}

/**
 * Write artifact to storage
 * 
 * @async
 * @function write
 * @param {string} storagePath - Storage path (abstract, not filesystem path)
 * @param {Buffer|string} data - Data to store
 * @param {Object} [options] - Storage-specific options
 * @returns {Promise<string>} - Stored path/URL
 * 
 * @example
 * // Write JSON artifact
 * const artifactPath = await storage.write(
 *   `output/${input.outputDir}/chunk-${i}.json`,
 *   JSON.stringify(chunkData)
 * );
 * 
 * @example
 * // Write binary data
 * const imagePath = await storage.write(
 *   `output/frames/frame-001.jpg`,
 *   imageBuffer,
 *   { contentType: 'image/jpeg' }
 * );
 */
async function write(storagePath, data, options) {
  const provider = initialize();
  return await provider.write(storagePath, data, options);
}

/**
 * Read artifact from storage
 * 
 * @async
 * @function read
 * @param {string} storagePath - Storage path
 * @returns {Promise<Buffer>} - File contents
 * 
 * @example
 * const existingData = await storage.read(artifactPath);
 * const jsonData = JSON.parse(existingData.toString());
 */
async function read(storagePath) {
  const provider = initialize();
  return await provider.read(storagePath);
}

/**
 * Check if artifact exists
 * 
 * @async
 * @function exists
 * @param {string} storagePath - Storage path
 * @returns {Promise<boolean>}
 * 
 * @example
 * if (await storage.exists('output/results.json')) {
 *   console.log('Results already exist');
 * }
 */
async function exists(storagePath) {
  const provider = initialize();
  return await provider.exists(storagePath);
}

/**
 * List artifacts by prefix
 * 
 * @async
 * @function list
 * @param {string} prefix - Path prefix
 * @returns {Promise<string[]>} - List of paths
 * 
 * @example
 * const allChunks = await storage.list('output/chunk-');
 * // ['output/chunk-1.json', 'output/chunk-2.json', ...]
 */
async function list(prefix) {
  const provider = initialize();
  return await provider.list(prefix);
}

/**
 * Get URL for artifact (for public access)
 * 
 * @async
 * @function getUrl
 * @param {string} storagePath - Storage path
 * @returns {Promise<string>} - Public URL
 * 
 * @example
 * const publicUrl = await storage.getUrl('output/results.json');
 * // 'https://my-bucket.s3.amazonaws.com/output/results.json'
 */
async function getUrl(storagePath) {
  const provider = initialize();
  return await provider.getUrl(storagePath);
}

/**
 * Delete artifact from storage
 * 
 * @async
 * @function delete
 * @param {string} storagePath - Storage path
 * @returns {Promise<boolean>} - True if deleted
 * 
 * @example
 * await storage.delete('output/temp.json');
 */
async function del(storagePath) {
  const provider = initialize();
  return await provider.delete(storagePath);
}

/**
 * Get list of available storage providers
 * 
 * @function getAvailableProviders
 * @returns {string[]} - Array of provider names
 */
function getAvailableProviders() {
  const providersDir = path.join(__dirname, 'providers');
  
  if (!fs.existsSync(providersDir)) {
    return [];
  }
  
  return fs.readdirSync(providersDir)
    .filter(file => file.endsWith('.cjs'))
    .map(file => file.replace('.cjs', ''));
}

/**
 * Get storage provider from environment variables
 * 
 * @function getProviderFromEnv
 * @returns {Object} - Storage provider instance
 * 
 * @example
 * // Set env vars:
 * // export STORAGE_PROVIDER=aws-s3
 * // export S3_BUCKET=my-emotion-engine-bucket
 * 
 * const storage = getProviderFromEnv();
 * await storage.write('test.txt', 'Hello');
 */
function getProviderFromEnv() {
  return initialize();
}

module.exports = {
  initialize,
  write,
  read,
  exists,
  list,
  getUrl,
  delete: del,
  getAvailableProviders,
  getProviderFromEnv,
};
