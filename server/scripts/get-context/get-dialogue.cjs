#!/usr/bin/env node
/**
 * Get Dialogue Script
 * 
 * Extracts audio from video, transcribes speech, and identifies speakers.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 * 
 * @module scripts/get-context/get-dialogue
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const aiProvider = require('ai-providers/ai-provider-interface.js');
const storage = require('../../lib/storage/storage-interface.js');
const outputManager = require('../../lib/output-manager.cjs');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const execAsync = promisify(exec);

/**
 * Script Input Contract
 * @typedef {Object} GetDialogueInput
 * @property {string} assetPath - Path to video/audio file
 * @property {string} outputDir - Output directory
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} GetDialogueOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.dialogueData - Dialogue analysis results
 * @property {Array} artifacts.dialogueData.dialogue_segments - Dialogue segments
 * @property {string} artifacts.dialogueData.summary - Brief summary
 * @property {number} artifacts.dialogueData.totalDuration - Total duration in seconds
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {GetDialogueInput} input - Script input
 * @returns {Promise<GetDialogueOutput>} - Script output
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;

  console.log('   🎤 Extracting and transcribing dialogue from:', assetPath);

  // Create phase-aware output directory
  const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase1-gather-context');
  
  // Create assets directory for processed files
  const assetsDirs = outputManager.createAssetsDirectory(phaseDir);
  
  // Create temp directory for audio extraction in assets/processed/dialogue/
  const tempDir = path.join(assetsDirs.processedDir, 'dialogue');
  fs.mkdirSync(tempDir, { recursive: true });

  // Check debug config for keeping temp files
  const keepTempFiles = config?.debug?.keepTempFiles === true;
  const keepProcessedAssets = config?.debug?.keepProcessedAssets !== false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  try {
    // Extract audio from video (if needed)
    const audioPath = await extractAudio(assetPath, tempDir);

    // Convert audio to base64 for AI provider
    const audioBase64 = fs.readFileSync(audioPath).toString('base64');
    const audioMimeType = 'audio/wav';

    // Get AI provider from environment
    const provider = aiProvider.getProviderFromEnv();
    // Use script-specific model, fallback to AI_MODEL, then to default
    const model = process.env.DIALOGUE_MODEL || process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b';
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      throw new Error('GetDialogue: AI_API_KEY environment variable is required');
    }

    // Build transcription prompt
    const prompt = buildTranscriptionPrompt();

    // Call AI provider for transcription
    console.log('   🤖 Calling AI provider for transcription...');
    const response = await provider.complete({
      prompt,
      model,
      apiKey,
      attachments: [
        {
          type: 'audio',
          data: audioBase64,
          mimeType: audioMimeType
        }
      ],
      options: {
        temperature: 0.3, // Lower temperature for accurate transcription
        maxTokens: 4096
      }
    });

    // Parse transcription response
    const dialogueData = parseTranscriptionResponse(response.content, audioPath);

    // Write intermediate artifact to phase directory
    const artifactPath = path.join(phaseDir, 'dialogue-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(dialogueData, null, 2));

    console.log('   ✅ Dialogue extraction complete');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Found ${dialogueData.dialogue_segments.length} dialogue segments`);
    console.log(`      Total duration: ${dialogueData.totalDuration.toFixed(1)}s`);

    return {
      artifacts: {
        dialogueData
      }
    };
  } catch (error) {
    console.error('   ❌ Error extracting dialogue:', error.message);
    throw error;
  } finally {
    // Handle temp file cleanup based on config
    if (keepTempFiles && keepProcessedAssets) {
      // Move temp files to assets/processed/dialogue/ with timestamp to avoid overwrites
      const destDir = path.join(phaseDir, 'assets', 'processed', 'dialogue', timestamp);
      fs.mkdirSync(destDir, { recursive: true });
      
      try {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          const srcPath = path.join(tempDir, file);
          const destPath = path.join(destDir, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`   💾 Kept dialogue temp file for debugging: ${file} → ${destPath}`);
        }
        console.log(`   💾 Debug mode: Dialogue temp files preserved in ${destDir}`);
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to copy some dialogue temp files:', e.message);
      }
    } else if (keepTempFiles) {
      console.log(`   💾 Debug mode: Dialogue temp files kept in ${tempDir}`);
    } else {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup dialogue temp files:', e.message);
      }
    }
  }
}

/**
 * Extract audio from video using ffmpeg
 * 
 * @async
 * @function extractAudio
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Output directory for audio file
 * @returns {Promise<string>} - Path to extracted audio file
 */
async function extractAudio(videoPath, outputDir) {
  const audioPath = path.join(outputDir, 'audio.wav');

  // Check if input is already audio
  const ext = path.extname(videoPath).toLowerCase();
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);

  if (isAudio) {
    // Copy audio file directly
    fs.copyFileSync(videoPath, audioPath);
    return audioPath;
  }

  // Extract audio from video using ffmpeg
  try {
    await execAsync(
      `"${ffmpegPath}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}" 2>/dev/null`
    );
    return audioPath;
  } catch (error) {
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

/**
 * Build transcription prompt for AI
 * 
 * @function buildTranscriptionPrompt
 * @returns {string} - Transcription prompt
 */
function buildTranscriptionPrompt() {
  return `Transcribe the audio in this file. Identify different speakers and provide timestamps.

Respond with a JSON object in the following format:

\`\`\`json
{
  "dialogue_segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "speaker": "Speaker 1",
      "text": "Transcribed text here",
      "confidence": 0.95
    }
  ],
  "summary": "Brief summary of the dialogue content",
  "totalDuration": 30.5
}
\`\`\`

IMPORTANT:
- Respond ONLY with valid JSON (no markdown, no explanation)
- Identify speakers as "Speaker 1", "Speaker 2", etc.
- Provide accurate timestamps in seconds
- Include confidence scores (0.0 to 1.0)
- If no speech is detected, return an empty dialogue_segments array`;
}

/**
 * Parse AI transcription response
 * 
 * @function parseTranscriptionResponse
 * @param {string} responseContent - AI response content
 * @param {string} audioPath - Path to audio file (for duration calculation)
 * @returns {Object} - Parsed dialogue data
 */
function parseTranscriptionResponse(responseContent, audioPath) {
  // Try to extract JSON from response
  let jsonData = null;

  try {
    // Try parsing as-is first
    jsonData = JSON.parse(responseContent.trim());
  } catch (e) {
    // Try to extract JSON from markdown code block
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        jsonData = JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        console.warn('GetDialogue: Failed to parse JSON from response, using fallback');
      }
    }
  }

  // Fallback structure if parsing fails
  if (!jsonData) {
    return {
      dialogue_segments: [],
      summary: 'Transcription failed - no speech detected or parsing error',
      totalDuration: getAudioDuration(audioPath)
    };
  }

  // Validate and normalize response
  return {
    dialogue_segments: Array.isArray(jsonData.dialogue_segments) ? jsonData.dialogue_segments : [],
    summary: jsonData.summary || 'Dialogue transcription completed',
    totalDuration: typeof jsonData.totalDuration === 'number' 
      ? jsonData.totalDuration 
      : getAudioDuration(audioPath)
  };
}

/**
 * Get audio duration using ffprobe
 * 
 * @function getAudioDuration
 * @param {string} audioPath - Path to audio file
 * @returns {number} - Duration in seconds
 */
function getAudioDuration(audioPath) {
  try {
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout } = require('child_process').execSync(cmd);
    return parseFloat(stdout.trim()) || 0;
  } catch (e) {
    return 0;
  }
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-audio.wav';
  const outputDir = process.argv[3] || 'output/test-dialogue';

  console.log('Get Dialogue Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio transcription (e.g., Whisper)');
  console.log('');
  console.log('Example usage:');
  console.log('  AI_API_KEY=your-key AI_MODEL=openai/whisper-1 node get-dialogue.cjs video.mp4 output/');
}
