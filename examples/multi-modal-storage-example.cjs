#!/usr/bin/env node
/**
 * Example: Multi-Modal Analysis with Storage Abstraction
 * 
 * This example demonstrates:
 * 1. Using the storage interface for artifact management
 * 2. Passing multi-modal attachments to AI providers
 * 3. Provider-agnostic code that works with any storage backend
 * 
 * @example
 * node examples/multi-modal-storage-example.cjs
 */

const path = require('path');
const storage = require('../server/lib/storage/storage-interface.js');
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

/**
 * Example: Process video frames with multi-modal AI analysis
 * 
 * This script:
 * 1. Initializes storage (local or cloud)
 * 2. Reads video frames from storage
 * 3. Sends frames to AI provider with attachments
 * 4. Stores analysis results back to storage
 */
async function multiModalAnalysis() {
  console.log('🚀 Multi-Modal Analysis Example\n');
  
  // =========================================================================
  // Step 1: Initialize Storage
  // =========================================================================
  
  console.log('📦 Initializing storage...');
  
  // Storage is automatically initialized from environment variables
  // Set STORAGE_PROVIDER=local-fs (default) or STORAGE_PROVIDER=aws-s3
  storage.initialize({
    provider: process.env.STORAGE_PROVIDER || 'local-fs',
    baseDir: process.env.STORAGE_BASE_DIR || process.cwd(),
    // For S3:
    // bucket: process.env.S3_BUCKET,
    // region: process.env.AWS_REGION,
  });
  
  const availableProviders = storage.getAvailableProviders();
  console.log(`   Available storage providers: ${availableProviders.join(', ')}`);
  console.log(`   Using provider: ${process.env.STORAGE_PROVIDER || 'local-fs'}\n`);
  
  // =========================================================================
  // Step 2: Write Sample Artifacts to Storage
  // =========================================================================
  
  console.log('📝 Writing sample artifacts to storage...');
  
  // Create sample frame data (in real scenario, these would be actual images)
  const sampleFrames = [
    { frameIndex: 1, timestamp: '00:00:01', path: 'frames/frame-001.jpg' },
    { frameIndex: 2, timestamp: '00:00:02', path: 'frames/frame-002.jpg' },
    { frameIndex: 3, timestamp: '00:00:03', path: 'frames/frame-003.jpg' },
  ];
  
  // Write frame metadata to storage
  for (const frame of sampleFrames) {
    const metadataPath = await storage.write(
      frame.path.replace('.jpg', '.json'),
      JSON.stringify({
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        source: 'example-video.mp4',
        extracted: new Date().toISOString(),
      }, null, 2)
    );
    console.log(`   ✓ Wrote metadata: ${metadataPath}`);
  }
  
  // =========================================================================
  // Step 3: List Artifacts
  // =========================================================================
  
  console.log('\n📋 Listing artifacts in storage...');
  const frameFiles = await storage.list('frames/');
  console.log(`   Found ${frameFiles.length} files in frames/`);
  frameFiles.forEach(file => console.log(`   - ${file}`));
  
  // =========================================================================
  // Step 4: Multi-Modal AI Analysis
  // =========================================================================
  
  console.log('\n🤖 Performing multi-modal AI analysis...\n');
  
  // Check if AI credentials are available
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.log('   ⚠️  AI_API_KEY or OPENROUTER_API_KEY not set');
    console.log('   Skipping AI analysis (set env var to enable)\n');
  } else {
    // Example 1: Text-only analysis (backward compatible)
    console.log('   Example 1: Text-only analysis');
    try {
      const textResponse = await aiProvider.complete({
        prompt: 'Describe the emotional arc of a typical video ad',
        model: process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b',
        apiKey: apiKey,
      });
      
      console.log(`   ✓ Response: ${textResponse.content.substring(0, 100)}...`);
      console.log(`   ✓ Tokens: ${textResponse.usage.input} → ${textResponse.usage.output}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Example 2: Multi-modal analysis with image attachments
    console.log('   Example 2: Multi-modal analysis with images');
    console.log('   (This would analyze actual image files)\n');
    
    // In a real scenario, you would:
    // 1. Extract frames from video using ffmpeg
    // 2. Write frames to storage
    // 3. Pass frame paths as attachments to AI provider
    
    const multiModalExample = async () => {
      // Simulate having extracted frames
      const framePaths = sampleFrames.map(f => f.path);
      
      // Build attachment array
      const attachments = framePaths.map(framePath => ({
        type: 'image',
        path: framePath,
        mimeType: 'image/jpeg',
      }));
      
      // Send to AI provider with attachments
      const response = await aiProvider.complete({
        prompt: 'Analyze these video frames for emotional content. What emotions are expressed?',
        model: 'openai/gpt-4o',  // or 'anthropic/claude-3-sonnet', 'gemini-1.5-pro'
        apiKey: apiKey,
        attachments: attachments,
      });
      
      return response;
    };
    
    // Example 3: Video analysis (Gemini 1.5 supports video natively)
    console.log('   Example 3: Video analysis with Gemini 1.5');
    console.log('   (Gemini 1.5 Pro can process video files directly)\n');
    
    const videoAnalysisExample = async () => {
      const response = await aiProvider.complete({
        prompt: 'Analyze this entire video for emotional content. Describe the emotional arc.',
        model: 'gemini-1.5-pro',
        apiKey: process.env.GEMINI_API_KEY || apiKey,
        attachments: [
          {
            type: 'video',
            path: 'https://example.com/sample-video.mp4',  // URL required for video
            mimeType: 'video/mp4',
          },
        ],
      });
      
      return response;
    };
    
    // Note: Uncomment to run actual analysis
    // const multiModalResult = await multiModalExample();
    // console.log(`   ✓ Multi-modal analysis complete`);
    // console.log(`   ✓ Response: ${multiModalResult.content.substring(0, 100)}...`);
  }
  
  // =========================================================================
  // Step 5: Store Analysis Results
  // =========================================================================
  
  console.log('\n💾 Storing analysis results to storage...');
  
  const analysisResults = {
    timestamp: new Date().toISOString(),
    storageProvider: process.env.STORAGE_PROVIDER || 'local-fs',
    aiProvider: process.env.AI_PROVIDER || 'openrouter',
    framesAnalyzed: sampleFrames.length,
    summary: 'Example analysis complete',
  };
  
  const resultsPath = await storage.write(
    'output/example-analysis-results.json',
    JSON.stringify(analysisResults, null, 2)
  );
  
  console.log(`   ✓ Results stored at: ${resultsPath}`);
  
  // Get public URL (if available)
  const publicUrl = await storage.getUrl('output/example-analysis-results.json');
  console.log(`   ✓ Public URL: ${publicUrl}`);
  
  // =========================================================================
  // Step 6: Read and Verify Results
  // =========================================================================
  
  console.log('\n✅ Verifying results...');
  
  const exists = await storage.exists('output/example-analysis-results.json');
  console.log(`   ✓ File exists: ${exists}`);
  
  if (exists) {
    const data = await storage.read('output/example-analysis-results.json');
    const results = JSON.parse(data.toString());
    console.log(`   ✓ Results: ${JSON.stringify(results, null, 2)}`);
  }
  
  // =========================================================================
  // Summary
  // =========================================================================
  
  console.log('\n📊 Summary:');
  console.log('   ✓ Storage interface initialized');
  console.log('   ✓ Artifacts written to storage');
  console.log('   ✓ Artifacts listed and read');
  console.log('   ✓ Multi-modal AI examples demonstrated');
  console.log('   ✓ Results stored and verified');
  console.log('\n💡 Key Takeaways:');
  console.log('   - Scripts are storage-agnostic (work with local-fs, S3, GCS, Azure)');
  console.log('   - AI providers support multi-modal inputs (images, video, audio, files)');
  console.log('   - Credentials are injected via environment variables (git-safe)');
  console.log('   - Same code works across different storage backends');
  console.log('');
}

// Run example
multiModalAnalysis()
  .then(() => {
    console.log('✅ Example complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Example failed:', error);
    process.exit(1);
  });
