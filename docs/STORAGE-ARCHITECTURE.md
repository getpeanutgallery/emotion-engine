# Storage Abstraction Architecture

**Version:** 1.0  
**Date:** 2026-03-04  
**Status:** Implementation Specification

---

## 🎯 Problem Statement

### Current Issues

1. **Tight Coupling to Local Storage**: Scripts write directly to filesystem, making it impossible to use cloud storage without rewriting code
2. **No Standardized Interface**: Different scripts handle file I/O differently
3. **No Abstraction Layer**: Storage logic is duplicated across scripts
4. **Hard to Switch Storage Backends**: Moving from local to S3 requires code changes everywhere

### Requirements

- ✅ **Pluggable Storage**: Switch between local, S3, GCS, Azure without code changes
- ✅ **Standardized Interface**: All storage providers implement the same contract
- ✅ **Git-safe Configs**: Storage configuration in YAML, credentials in environment
- ✅ **Provider-agnostic Scripts**: Scripts don't know which storage backend they're using

---

## 🏗️ Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCRIPT LAYER                                    │
│  (scripts/process/video-chunks.cjs, etc.)                              │
│                                                                          │
│  const storage = require('../../server/lib/storage/                     │
│                    storage-interface.js');                              │
│                                                                          │
│  // Write artifact (doesn't know if local or S3)                        │
│  const artifactPath = await storage.write(                              │
│    `output/${input.outputDir}/chunk-${i}.json`,                         │
│    JSON.stringify(chunkData)                                            │
│  );                                                                     │
│                                                                          │
│  // Read artifact                                                       │
│  const existingData = await storage.read(artifactPath);                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STORAGE INTERFACE                                    │
│  (server/lib/storage/storage-interface.js)                             │
│                                                                          │
│  Contract:                                                              │
│  - write(path, data, options) → Promise<string>                        │
│  - read(path) → Promise<Buffer>                                        │
│  - exists(path) → Promise<boolean>                                     │
│  - list(prefix) → Promise<string[]>                                    │
│  - getUrl(path) → Promise<string>                                      │
│  - delete(path) → Promise<boolean>                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   Local FS        │   │   AWS S3          │   │   Google GCS      │
│   (local-fs.cjs)  │   │   (aws-s3.cjs)    │   │   (gcs.cjs)       │
│                   │   │                   │   │                   │
│ • write()         │   │ • write()         │   │ • write()         │
│ • read()         │   │ • read()         │   │ • read()         │
│ • exists()        │   │ • exists()        │   │ • exists()        │
│ • list()          │   │ • list()          │   │ • list()          │
│ • getUrl()        │   │ • getUrl()        │   │ • getUrl()        │
│ • delete()        │   │ • delete()        │   │ • delete()        │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   Local Disk      │   │   S3 Bucket       │   │   GCS Bucket      │
│   /output/...     │   │   s3://bucket/... │   │   gs://bucket/... │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

### File Structure

```
server/lib/storage/
├── storage-interface.js        # Contract definition (abstract)
├── providers/
│   ├── local-fs.cjs            # Local filesystem (default)
│   ├── aws-s3.cjs              # AWS S3
│   ├── gcs.cjs                 # Google Cloud Storage
│   └── azure-blob.cjs          # Azure Blob Storage
```

---

## 📋 Interface Contract

### Storage Interface

All providers implement this contract:

```javascript
/**
 * Storage Provider Interface - All providers implement this contract
 */
module.exports = {
  /**
   * Provider name identifier
   * @type {string}
   */
  name: 'provider-name',
  
  /**
   * Initialize provider with configuration
   * @param {object} options - Provider options
   * @returns {object} - Provider instance
   */
  initialize(options) { ... },
  
  /**
   * Write artifact to storage
   * @param {string} path - Storage path (abstract, not filesystem path)
   * @param {Buffer|string} data - Data to store
   * @param {object} [options] - Storage-specific options
   * @returns {Promise<string>} - Stored path/URL
   */
  async write(path, data, options) { ... },
  
  /**
   * Read artifact from storage
   * @param {string} path - Storage path
   * @returns {Promise<Buffer>} - File contents
   */
  async read(path) { ... },
  
  /**
   * Check if artifact exists
   * @param {string} path - Storage path
   * @returns {Promise<boolean>}
   */
  async exists(path) { ... },
  
  /**
   * List artifacts by prefix
   * @param {string} prefix - Path prefix
   * @returns {Promise<string[]>} - List of paths
   */
  async list(prefix) { ... },
  
  /**
   * Get URL for artifact (for public access)
   * @param {string} path - Storage path
   * @returns {Promise<string>} - Public URL
   */
  async getUrl(path) { ... },
  
  /**
   * Delete artifact from storage
   * @param {string} path - Storage path
   * @returns {Promise<boolean>} - True if deleted
   */
  async delete(path) { ... },
};
```

---

## 🔧 Configuration

### Environment Variables

#### Local Filesystem (Default)

```bash
# No configuration needed - uses process.cwd() as base
# Optional: override base directory
STORAGE_PROVIDER=local-fs
STORAGE_BASE_DIR=/path/to/storage
```

#### AWS S3

```bash
STORAGE_PROVIDER=aws-s3

# AWS credentials (injected via environment, NEVER in YAML)
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1

# S3 bucket configuration
S3_BUCKET=my-emotion-engine-bucket
S3_PREFIX=emotion-engine  # Optional: prefix for all keys
```

#### Google Cloud Storage

```bash
STORAGE_PROVIDER=gcs

# GCP credentials (service account JSON)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR
GCP_CREDENTIALS_JSON=$(cat /path/to/service-account.json)

# GCS bucket configuration
GCS_BUCKET=my-emotion-engine-bucket
GCS_PREFIX=emotion-engine  # Optional
```

#### Azure Blob Storage

```bash
STORAGE_PROVIDER=azure-blob

# Azure credentials
AZURE_STORAGE_ACCOUNT=myaccount
AZURE_STORAGE_KEY=$AZURE_STORAGE_KEY
# OR (recommended)
AZURE_STORAGE_CONNECTION_STRING=$AZURE_CONNECTION_STRING

# Container configuration
AZURE_CONTAINER=my-emotion-engine-container
```

### YAML Configuration

```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

# Storage configuration (git-safe, no secrets)
storage:
  provider: aws-s3  # or local-fs, gcs, azure-blob
  bucket: my-emotion-engine-bucket
  region: us-east-1
  prefix: emotion-engine  # Optional

# AI provider config
ai:
  provider: openrouter
  model: qwen/qwen-3.5-397b-a17b

gather_context:
  - scripts/get-context/get-dialogue.cjs

process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs

report:
  - scripts/report/evaluation.cjs
```

---

## 🔧 Implementation Guide

### Creating a New Storage Provider

**Step 1: Create provider file**

```javascript
// server/lib/storage/providers/gcs.cjs
const path = require('path');

const name = 'gcs';
let config = {};
let storage = null;
let bucket = null;

/**
 * Get or create GCS client
 */
function getStorage() {
  if (storage) {
    return storage;
  }
  
  try {
    const { Storage } = require('@google-cloud/storage');
    storage = new Storage();
    return storage;
  } catch (error) {
    throw new Error(
      'GCS provider requires @google-cloud/storage. ' +
      'Install with: npm install @google-cloud/storage'
    );
  }
}

/**
 * Initialize GCS provider
 */
function initialize(options = {}) {
  config = {
    bucket: options.bucket || process.env.GCS_BUCKET,
    prefix: options.prefix || '',
  };
  
  if (!config.bucket) {
    throw new Error('GCS: bucket is required. Set GCS_BUCKET environment variable.');
  }
  
  const client = getStorage();
  bucket = client.bucket(config.bucket);
  
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
 * Write artifact to GCS
 */
async function write(storagePath, data, options = {}) {
  const key = path.join(config.prefix, storagePath).replace(/\\/g, '/');
  const file = bucket.file(key);
  
  await file.save(data, {
    contentType: options.contentType || 'application/octet-stream',
    metadata: options.metadata,
  });
  
  return `gs://${config.bucket}/${key}`;
}

/**
 * Read artifact from GCS
 */
async function read(storagePath) {
  const key = path.join(config.prefix, storagePath).replace(/\\/g, '/');
  const file = bucket.file(key);
  
  const [contents] = await file.download();
  return contents;
}

/**
 * Check if artifact exists
 */
async function exists(storagePath) {
  const key = path.join(config.prefix, storagePath).replace(/\\/g, '/');
  const file = bucket.file(key);
  
  const [exists] = await file.exists();
  return exists;
}

/**
 * List artifacts by prefix
 */
async function list(prefix) {
  const fullPrefix = path.join(config.prefix, prefix).replace(/\\/g, '/');
  
  const [files] = await bucket.getFiles({ prefix: fullPrefix });
  return files.map(file => file.name);
}

/**
 * Get public URL
 */
async function getUrl(storagePath) {
  const key = path.join(config.prefix, storagePath).replace(/\\/g, '/');
  return `https://storage.googleapis.com/${config.bucket}/${key}`;
}

/**
 * Delete artifact
 */
async function del(storagePath) {
  const key = path.join(config.prefix, storagePath).replace(/\\/g, '/');
  const file = bucket.file(key);
  
  await file.delete();
  return true;
}

module.exports = { name, initialize };
```

**Step 2: Test the provider**

```javascript
// test provider
const storage = require('../../server/lib/storage/storage-interface.js');

storage.initialize({
  provider: 'gcs',
  bucket: 'test-bucket',
});

await storage.write('test.txt', 'Hello, World!');
const exists = await storage.exists('test.txt');
console.log('File exists:', exists);

const data = await storage.read('test.txt');
console.log('Content:', data.toString());

await storage.delete('test.txt');
```

### Using Storage in Scripts

**Storage-agnostic Script Pattern:**

```javascript
// scripts/process/video-chunks.cjs
const storage = require('../../server/lib/storage/storage-interface.js');

async function run(input) {
  const { assetPath, outputDir, artifacts = {} } = input;
  
  // Process video chunks
  const chunks = await processVideo(assetPath);
  
  const chunkAnalysis = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Analyze chunk
    const analysis = await analyzeChunk(chunk);
    
    // Write artifact (doesn't know if local or S3)
    const artifactPath = await storage.write(
      `output/${outputDir}/chunk-${i}.json`,
      JSON.stringify(analysis, null, 2)
    );
    
    chunkAnalysis.push({
      chunkIndex: i,
      timestamp: chunk.timestamp,
      artifactPath,
      analysis,
    });
  }
  
  // Read existing artifact (example)
  const existingPath = `output/${outputDir}/metadata.json`;
  if (await storage.exists(existingPath)) {
    const existingData = await storage.read(existingPath);
    const metadata = JSON.parse(existingData.toString());
    
    // Merge with existing metadata
    artifacts.metadata = metadata;
  }
  
  return {
    artifacts: {
      ...artifacts,
      chunkAnalysis,
    },
  };
}

module.exports = { run };
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Run Emotion Engine

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Emotion Engine
        env:
          # Storage configuration
          STORAGE_PROVIDER: aws-s3
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
          S3_BUCKET: ${{ secrets.S3_BUCKET }}
          
          # AI provider configuration
          AI_PROVIDER: openrouter
          AI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          AI_MODEL: qwen/qwen-3.5-397b-a17b
        run: |
          node server/run-pipeline.cjs --config configs/video-analysis.yaml
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: emotion-analysis
          path: output/
```

---

## 🛡️ Security Best Practices

### NEVER Commit Credentials

```bash
# ❌ WRONG: Credentials in YAML
storage:
  provider: aws-s3
  accessKeyId: AKIA...  # NEVER DO THIS
  secretAccessKey: ...   # NEVER DO THIS

# ✅ CORRECT: Credentials in environment
export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
```

### Use IAM Roles in Production

**AWS (EC2, Lambda, ECS):**
```bash
# Don't set AWS_ACCESS_KEY_ID - use IAM role
# The SDK will automatically use instance credentials
STORAGE_PROVIDER=aws-s3
S3_BUCKET=my-emotion-engine-bucket
```

**GCP (GCE, GKE, Cloud Run):**
```bash
# Don't set GOOGLE_APPLICATION_CREDENTIALS - use workload identity
STORAGE_PROVIDER=gcs
GCS_BUCKET=my-emotion-engine-bucket
```

**Azure (VM, AKS, Functions):**
```bash
# Use managed identity
STORAGE_PROVIDER=azure-blob
AZURE_STORAGE_ACCOUNT=myaccount
```

### Add Sensitive Files to .gitignore

```gitignore
# .gitignore

# Credentials
.env
.env.local
.env.*.local
*.credentials.json
service-account.json

# Runtime configs with secrets
.pipeline-runtime.yaml
*.runtime.yaml
```

---

## 📊 Provider Comparison

| Provider | Best For | Cost | Setup Complexity |
|----------|----------|------|------------------|
| **local-fs** | Development, local testing | Free | ⭐ Easy |
| **aws-s3** | Production, large scale | Pay-per-use | ⭐⭐ Medium |
| **gcs** | GCP ecosystems, ML workloads | Pay-per-use | ⭐⭐ Medium |
| **azure-blob** | Azure ecosystems, enterprise | Pay-per-use | ⭐⭐ Medium |

### Feature Matrix

| Feature | local-fs | aws-s3 | gcs | azure-blob |
|---------|----------|--------|-----|------------|
| **write()** | ✅ | ✅ | ✅ | ✅ |
| **read()** | ✅ | ✅ | ✅ | ✅ |
| **exists()** | ✅ | ✅ | ✅ | ✅ |
| **list()** | ✅ | ✅ | ✅ | ✅ |
| **getUrl()** | file:// | https:// | https:// | https:// |
| **delete()** | ✅ | ✅ | ✅ | ✅ |
| **Versioning** | ❌ | ✅ | ✅ | ✅ |
| **Lifecycle Rules** | ❌ | ✅ | ✅ | ✅ |
| **CDN Integration** | ❌ | CloudFront | Cloud CDN | CDN |

---

## 🧪 Testing

### Unit Test Example

```javascript
// test/storage/local-fs.test.js
const storage = require('../../server/lib/storage/storage-interface.js');
const fs = require('fs');
const path = require('path');

describe('Local FS Storage', () => {
  const testDir = path.join(__dirname, 'tmp-storage');
  
  beforeAll(() => {
    storage.initialize({
      provider: 'local-fs',
      baseDir: testDir,
    });
  });
  
  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });
  
  test('writes and reads data', async () => {
    const testData = 'Hello, World!';
    const filePath = 'test/hello.txt';
    
    const writtenPath = await storage.write(filePath, testData);
    expect(writtenPath).toContain('test/hello.txt');
    
    const readData = await storage.read(filePath);
    expect(readData.toString()).toBe(testData);
  });
  
  test('checks existence', async () => {
    await storage.write('exists.txt', 'test');
    
    expect(await storage.exists('exists.txt')).toBe(true);
    expect(await storage.exists('not-exists.txt')).toBe(false);
  });
  
  test('lists files by prefix', async () => {
    await storage.write('chunk-1.json', '{}');
    await storage.write('chunk-2.json', '{}');
    await storage.write('other.txt', 'test');
    
    const chunks = await storage.list('chunk-');
    expect(chunks).toHaveLength(2);
    expect(chunks).toContainEqual(expect.stringContaining('chunk-1.json'));
    expect(chunks).toContainEqual(expect.stringContaining('chunk-2.json'));
  });
});
```

---

## 📚 References

- **Interface Definition**: `server/lib/storage/storage-interface.js`
- **Provider Implementations**: `server/lib/storage/providers/*.cjs`
- **Example Script Usage**: `scripts/process/video-chunks.cjs`
- **Config Examples**: `configs/*.yaml`

---

*Generated by OpenTruth Emotion Engine - Storage Architecture Module*
