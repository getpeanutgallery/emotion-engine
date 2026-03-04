#!/usr/bin/env node
/**
 * AWS S3 Storage Provider
 * 
 * Stores artifacts in Amazon S3 buckets.
 * Requires AWS credentials via environment variables or IAM role.
 * 
 * Environment Variables:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_REGION: AWS region (e.g., 'us-east-1')
 * - S3_BUCKET: S3 bucket name
 * 
 * @module storage/providers/aws-s3
 */

const path = require('path');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'aws-s3';

/**
 * Storage configuration
 * @type {Object}
 */
let config = {};

/**
 * S3 client instance (lazy-loaded)
 * @type {Object|null}
 */
let s3Client = null;

/**
 * Get or create S3 client
 * @returns {Object} - AWS S3 client
 */
function getS3Client() {
  if (s3Client) {
    return s3Client;
  }
  
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    
    s3Client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    });
    
    return s3Client;
  } catch (error) {
    throw new Error(
      'AWS S3 provider requires @aws-sdk/client-s3. ' +
      'Install with: npm install @aws-sdk/client-s3'
    );
  }
}

/**
 * Get S3 SDK commands
 * @returns {Object} - S3 command constructors
 */
function getS3Commands() {
  try {
    const {
      PutObjectCommand,
      GetObjectCommand,
      HeadObjectCommand,
      ListObjectsV2Command,
      DeleteObjectCommand,
    } = require('@aws-sdk/client-s3');
    
    return {
      PutObjectCommand,
      GetObjectCommand,
      HeadObjectCommand,
      ListObjectsV2Command,
      DeleteObjectCommand,
    };
  } catch (error) {
    throw new Error(
      'AWS S3 provider requires @aws-sdk/client-s3. ' +
      'Install with: npm install @aws-sdk/client-s3'
    );
  }
}

/**
 * Initialize AWS S3 provider
 * 
 * @function initialize
 * @param {Object} options - Provider options
 * @param {string} options.bucket - S3 bucket name
 * @param {string} [options.region] - AWS region (defaults from env)
 * @param {string} [options.prefix] - Key prefix for all objects
 * @returns {Object} - Provider instance
 */
function initialize(options = {}) {
  config = {
    bucket: options.bucket || process.env.S3_BUCKET,
    region: options.region || process.env.AWS_REGION || 'us-east-1',
    prefix: options.prefix || '',
  };
  
  if (!config.bucket) {
    throw new Error(
      'AWS S3: bucket is required. ' +
      'Set S3_BUCKET environment variable or pass bucket option.'
    );
  }
  
  // Validate AWS credentials are available
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
    console.warn(
      'AWS S3: AWS_ACCESS_KEY_ID not set. ' +
      'Ensure credentials are available via IAM role or environment.'
    );
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
 * Get full S3 key for a storage path
 * @param {string} storagePath - Storage path
 * @returns {string} - S3 key
 */
function getKey(storagePath) {
  const key = path.join(config.prefix, storagePath);
  // Normalize to forward slashes for S3
  return key.replace(/\\/g, '/');
}

/**
 * Write artifact to S3
 * 
 * @async
 * @function write
 * @param {string} storagePath - Storage path
 * @param {Buffer|string} data - Data to store
 * @param {Object} [options] - Storage-specific options
 * @param {string} [options.contentType] - Content type (MIME type)
 * @param {Object} [options.metadata] - S3 metadata
 * @returns {Promise<string>} - S3 URL
 */
async function write(storagePath, data, options = {}) {
  const client = getS3Client();
  const { PutObjectCommand } = getS3Commands();
  
  const key = getKey(storagePath);
  
  // Convert string to Buffer if needed
  const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  
  // Build put command
  const putCommand = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType || 'application/octet-stream',
    Metadata: options.metadata || {},
  });
  
  await client.send(putCommand);
  
  // Return S3 URL
  return `s3://${config.bucket}/${key}`;
}

/**
 * Read artifact from S3
 * 
 * @async
 * @function read
 * @param {string} storagePath - Storage path
 * @returns {Promise<Buffer>} - File contents
 */
async function read(storagePath) {
  const client = getS3Client();
  const { GetObjectCommand } = getS3Commands();
  
  const key = getKey(storagePath);
  
  const getCommand = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  
  const response = await client.send(getCommand);
  
  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Check if artifact exists in S3
 * 
 * @async
 * @function exists
 * @param {string} storagePath - Storage path
 * @returns {Promise<boolean>}
 */
async function exists(storagePath) {
  const client = getS3Client();
  const { HeadObjectCommand } = getS3Commands();
  
  const key = getKey(storagePath);
  
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    
    await client.send(headCommand);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * List artifacts by prefix
 * 
 * @async
 * @function list
 * @param {string} prefix - Path prefix
 * @returns {Promise<string[]>} - List of S3 keys
 */
async function list(prefix) {
  const client = getS3Client();
  const { ListObjectsV2Command } = getS3Commands();
  
  const fullPrefix = getKey(prefix);
  
  const listCommand = new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: fullPrefix,
  });
  
  const response = await client.send(listCommand);
  
  return (response.Contents || []).map(obj => obj.Key);
}

/**
 * Get public URL for artifact
 * 
 * @async
 * @function getUrl
 * @param {string} storagePath - Storage path
 * @returns {Promise<string>} - S3 URL
 */
async function getUrl(storagePath) {
  const key = getKey(storagePath);
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Delete artifact from S3
 * 
 * @async
 * @function delete
 * @param {string} storagePath - Storage path
 * @returns {Promise<boolean>} - True if deleted
 */
async function del(storagePath) {
  const client = getS3Client();
  const { DeleteObjectCommand } = getS3Commands();
  
  const key = getKey(storagePath);
  
  const deleteCommand = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  
  await client.send(deleteCommand);
  return true;
}

module.exports = {
  name,
  initialize,
};
