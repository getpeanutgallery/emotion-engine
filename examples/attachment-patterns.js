#!/usr/bin/env node
/**
 * Attachment Patterns Examples
 * 
 * Demonstrates all three attachment input patterns:
 * - Pattern 1: URL (Publicly Accessible)
 * - Pattern 2: Local Path (Auto-convert to Base64)
 * - Pattern 3: Direct Base64 Data (Already Converted)
 * 
 * Run with: node examples/attachment-patterns.js
 */

const path = require('path');

// Import the AI provider interface
const aiProvider = require('ai-providers/ai-provider-interface.js');

// Example configuration
const CONFIG = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || 'sk-or-example-key',
    model: 'openai/gpt-4o',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-example-key',
    model: 'claude-3-5-sonnet-20241022',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'AIza-example-key',
    model: 'gemini-1.5-pro',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'sk-example-key',
    model: 'gpt-4-turbo',
  },
};

/**
 * Pattern 1: URL (Publicly Accessible)
 * 
 * Use when files are hosted on S3, CDN, or any public URL.
 * The URL is passed directly to the API without conversion.
 */
async function examplePattern1_Url() {
  console.log('\n=== Pattern 1: URL (Publicly Accessible) ===\n');
  
  const provider = aiProvider.loadProvider('gemini');
  
  try {
    const response = await provider.complete({
      prompt: 'Analyze this product demo video and describe the key features shown.',
      model: CONFIG.gemini.model,
      apiKey: CONFIG.gemini.apiKey,
      attachments: [
        {
          type: 'video',
          url: 'https://storage.googleapis.com/gemini-examples/product-demo.mp4',
          // mimeType is auto-detected from URL extension as 'video/mp4'
        }
      ]
    });
    
    console.log('Response:', response.content);
    console.log('Token usage:', response.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Pattern 2: Local Path (Auto-convert to Base64)
 * 
 * Use for local files on your filesystem.
 * The provider automatically reads the file and converts to base64.
 * MIME type is auto-detected from the file extension.
 */
async function examplePattern2_LocalPath() {
  console.log('\n=== Pattern 2: Local Path (Auto-convert to Base64) ===\n');
  
  const provider = aiProvider.loadProvider('anthropic');
  
  try {
    const response = await provider.complete({
      prompt: 'Describe this image in detail and identify any text visible.',
      model: CONFIG.anthropic.model,
      apiKey: CONFIG.anthropic.apiKey,
      attachments: [
        {
          type: 'image',
          path: path.join(__dirname, 'sample-image.jpg'),
          // mimeType auto-detected as 'image/jpeg'
        }
      ]
    });
    
    console.log('Response:', response.content);
    console.log('Token usage:', response.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Pattern 3: Direct Base64 Data (Already Converted)
 * 
 * Use when you've already converted the file to base64.
 * MIME type is REQUIRED for this pattern.
 */
async function examplePattern3_DirectData() {
  console.log('\n=== Pattern 3: Direct Base64 Data (Already Converted) ===\n');
  
  const fs = require('fs');
  const provider = aiProvider.loadProvider('openai');
  
  try {
    // Pre-convert file to base64 (e.g., from stream, database, or cache)
    const imagePath = path.join(__dirname, 'sample-image.jpg');
    const imageData = fs.readFileSync(imagePath).toString('base64');
    
    const response = await provider.complete({
      prompt: 'What emotions are expressed by the person in this photo?',
      model: CONFIG.openai.model,
      apiKey: CONFIG.openai.apiKey,
      attachments: [
        {
          type: 'image',
          data: imageData,  // Already base64-encoded
          mimeType: 'image/jpeg'  // REQUIRED for data pattern!
        }
      ]
    });
    
    console.log('Response:', response.content);
    console.log('Token usage:', response.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Mixed Patterns Example
 * 
 * You can mix different patterns in a single request.
 */
async function exampleMixedPatterns() {
  console.log('\n=== Mixed Patterns (URL + Path + Data) ===\n');
  
  const fs = require('fs');
  const provider = aiProvider.loadProvider('gemini');
  
  try {
    // Pre-convert one file to base64
    const logoPath = path.join(__dirname, 'logo.png');
    const logoData = fs.readFileSync(logoPath).toString('base64');
    
    const response = await provider.complete({
      prompt: 'Compare these three images and describe the visual differences.',
      model: CONFIG.gemini.model,
      apiKey: CONFIG.gemini.apiKey,
      attachments: [
        // Pattern 1: URL
        {
          type: 'image',
          url: 'https://example.com/reference-image.jpg'
        },
        // Pattern 2: Local path
        {
          type: 'image',
          path: path.join(__dirname, 'comparison.png')
        },
        // Pattern 3: Direct base64 data
        {
          type: 'image',
          data: logoData,
          mimeType: 'image/png'
        }
      ]
    });
    
    console.log('Response:', response.content);
    console.log('Token usage:', response.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Provider-Specific Examples
 */
async function exampleProviderSpecific() {
  console.log('\n=== Provider-Specific Examples ===\n');
  
  // OpenRouter: Images only (video/audio must be URLs)
  console.log('--- OpenRouter (Images via base64, Video via URL) ---');
  const openrouter = aiProvider.loadProvider('openrouter');
  
  try {
    // This works - local image converted to base64
    const imageResponse = await openrouter.complete({
      prompt: 'Describe this image',
      model: CONFIG.openrouter.model,
      apiKey: CONFIG.openrouter.apiKey,
      attachments: [
        {
          type: 'image',
          path: path.join(__dirname, 'sample.jpg')
        }
      ]
    });
    console.log('Image response:', imageResponse.content);
    
    // This also works - video via URL
    const videoResponse = await openrouter.complete({
      prompt: 'Summarize this video',
      model: CONFIG.openrouter.model,
      apiKey: CONFIG.openrouter.apiKey,
      attachments: [
        {
          type: 'video',
          url: 'https://example.com/video.mp4'
        }
      ]
    });
    console.log('Video response:', videoResponse.content);
    
    // This will fail - local video (OpenRouter doesn't support base64 video)
    // Uncomment to see the error:
    /*
    const localVideoResponse = await openrouter.complete({
      prompt: 'Summarize this video',
      model: CONFIG.openrouter.model,
      apiKey: CONFIG.openrouter.apiKey,
      attachments: [
        {
          type: 'video',
          path: '/local/path/video.mp4'  // Error!
        }
      ]
    });
    */
    
  } catch (error) {
    console.error('OpenRouter error:', error.message);
  }
  
  // Anthropic: Images and documents (no video/audio)
  console.log('\n--- Anthropic (Images and PDF/TXT documents) ---');
  const anthropic = aiProvider.loadProvider('anthropic');
  
  try {
    const docResponse = await anthropic.complete({
      prompt: 'Summarize this document',
      model: CONFIG.anthropic.model,
      apiKey: CONFIG.anthropic.apiKey,
      attachments: [
        {
          type: 'file',
          path: path.join(__dirname, 'document.pdf')
        }
      ]
    });
    console.log('Document response:', docResponse.content);
  } catch (error) {
    console.error('Anthropic error:', error.message);
  }
  
  // Gemini: Best multi-modal support (all types via base64)
  console.log('\n--- Gemini (All types: video, audio, images, files) ---');
  const gemini = aiProvider.loadProvider('gemini');
  
  try {
    const multiModalResponse = await gemini.complete({
      prompt: 'Analyze this video with audio track',
      model: CONFIG.gemini.model,
      apiKey: CONFIG.gemini.apiKey,
      attachments: [
        {
          type: 'video',
          path: path.join(__dirname, 'video.mp4')  // Works! Converted to base64
        }
      ]
    });
    console.log('Multi-modal response:', multiModalResponse.content);
  } catch (error) {
    console.error('Gemini error:', error.message);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Attachment Patterns Examples');
  console.log('============================\n');
  
  console.log('Note: These examples require valid API keys.');
  console.log('Set environment variables before running:\n');
  console.log('  export OPENROUTER_API_KEY=your-key');
  console.log('  export ANTHROPIC_API_KEY=your-key');
  console.log('  export GEMINI_API_KEY=your-key');
  console.log('  export OPENAI_API_KEY=your-key\n');
  
  // Uncomment to run examples:
  // await examplePattern1_Url();
  // await examplePattern2_LocalPath();
  // await examplePattern3_DirectData();
  // await exampleMixedPatterns();
  // await exampleProviderSpecific();
  
  console.log('Examples ready to run. Uncomment the function calls above to execute.');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  examplePattern1_Url,
  examplePattern2_LocalPath,
  examplePattern3_DirectData,
  exampleMixedPatterns,
  exampleProviderSpecific,
};
