#!/usr/bin/env node
/**
 * Get Music Script
 * 
 * Extracts and analyzes music/audio from video to identify mood, intensity, and segments.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 * 
 * @module scripts/get-context/get-music
 */

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const aiProvider = require('ai-providers/ai-provider-interface.js');
const outputManager = require('../../lib/output-manager.cjs');
const { shouldKeepProcessedIntermediates } = require('../../lib/processed-assets-policy.cjs');
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ffmpegPath, ffprobePath } = require('../../lib/ffmpeg-path.cjs');

const execAsync = promisify(exec);

/**
 * Script Input Contract
 * @typedef {Object} GetMusicInput
 * @property {string} assetPath - Path to video/audio file
 * @property {string} outputDir - Output directory
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} GetMusicOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.musicData - Music analysis results
 * @property {Array} artifacts.musicData.segments - Music segments
 * @property {string} artifacts.musicData.summary - Brief summary
 * @property {boolean} artifacts.musicData.hasMusic - True if music detected
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {GetMusicInput} input - Script input
 * @returns {Promise<GetMusicOutput>} - Script output
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;

  console.log('   🎵 Extracting and analyzing music/audio from:', assetPath);

  // Create phase-aware output directory
  const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase1-gather-context');
  
  // Create assets directory for processed files (canonical run-level assets)
  const assetsDirs = outputManager.createAssetsDirectory(outputDir);
  
  // Create temp directory for audio extraction in assets/processed/music/
  const tempDir = path.join(assetsDirs.processedDir, 'music');
  fs.mkdirSync(tempDir, { recursive: true });

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const captureRaw = shouldCaptureRaw(config);
  const rawDir = getRawPhaseDir(outputDir, 'phase1-extract');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg');
  const aiRawDir = path.join(rawDir, 'ai');

  try {
    // Extract audio from video (if needed)
    const audioPath = await extractAudio(assetPath, tempDir, {
      captureRaw,
      ffmpegRawDir,
      logName: 'extract-audio.json'
    });

    // Get audio duration
    const duration = getAudioDuration(audioPath, {
      captureRaw,
      ffmpegRawDir,
      logName: 'ffprobe-audio-duration.json'
    });

    // Segment audio (e.g., every 30 seconds)
    const segmentDuration = config?.settings?.music_segment_duration || 30;
    const numSegments = Math.ceil(duration / segmentDuration);

    console.log(`   📊 Audio duration: ${duration.toFixed(1)}s (${numSegments} segments)`);

    const segments = [];
    let hasMusic = false;

    // Analyze each segment
    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min(startTime + segmentDuration, duration);
      const segmentDurationActual = endTime - startTime;

      console.log(`   Analyzing segment ${i + 1}/${numSegments} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

      // Extract segment
      const segmentPath = path.join(tempDir, `segment-${i}.wav`);
      await extractAudioSegment(audioPath, startTime, segmentDurationActual, segmentPath, {
        captureRaw,
        ffmpegRawDir,
        logName: `extract-segment-${i}.json`
      });

      // Convert to base64
      const audioBase64 = fs.readFileSync(segmentPath).toString('base64');

      // Get AI provider from YAML config
      const provider = typeof aiProvider.getProviderFromConfig === 'function'
        ? aiProvider.getProviderFromConfig(config)
        : aiProvider.loadProvider(config?.ai?.provider || 'openrouter');
      // Require explicit music model
      const model = config?.ai?.music?.model;
      if (!model) {
        throw new Error('GetMusic: config.ai.music.model is required (missing in YAML config)');
      }
      const apiKey = process.env.AI_API_KEY;

      if (!apiKey) {
        throw new Error('GetMusic: AI_API_KEY environment variable is required');
      }

      // Build analysis prompt
      const prompt = buildAnalysisPrompt(startTime, endTime);

      // Call AI provider for analysis
      const response = await provider.complete({
        prompt,
        model,
        apiKey,
        attachments: [
          {
            type: 'audio',
            data: audioBase64,
            mimeType: 'audio/wav'
          }
        ],
        options: {
          temperature: 0.5,
          maxTokens: 512
        }
      });

      // Parse segment analysis
      const segmentAnalysis = parseSegmentResponse(response.content, startTime, endTime);
      segments.push(segmentAnalysis);

      if (captureRaw) {
        writeRawJson(aiRawDir, `music-segment-${i}.json`, {
          segmentIndex: i,
          startTime,
          endTime,
          prompt,
          rawResponse: response,
          parsed: segmentAnalysis,
          error: null,
          provider: config?.ai?.provider || 'openrouter',
          model
        });
      }

      if (segmentAnalysis.type === 'music' || segmentAnalysis.mood) {
        hasMusic = true;
      }
    }

    // Build music data
    const musicData = {
      segments,
      summary: generateSummary(segments),
      hasMusic
    };

    // Write intermediate artifact to phase directory
    const artifactPath = path.join(phaseDir, 'music-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(musicData, null, 2));

    console.log('   ✅ Music/audio analysis complete');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Found ${segments.length} segments`);
    console.log(`      Music detected: ${hasMusic ? 'Yes' : 'No'}`);

    return {
      artifacts: {
        musicData
      }
    };
  } catch (error) {
    if (captureRaw) {
      writeRawJson(aiRawDir, 'music-analysis.error.json', {
        error: error.message,
        stack: error.stack,
        provider: config?.ai?.provider || 'openrouter',
        model: config?.ai?.music?.model || null
      });
    }
    console.error('   ❌ Error analyzing music:', error.message);
    throw error;
  } finally {
    // Handle temp file cleanup based on config
    if (keepProcessedIntermediates) {
      console.log(`   💾 Keeping music temp files in ${tempDir}`);
    } else {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup music temp files:', e.message);
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
async function extractAudio(videoPath, outputDir, rawCapture = {}) {
  const audioPath = path.join(outputDir, 'audio.wav');

  // Check if input is already audio
  const ext = path.extname(videoPath).toLowerCase();
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);

  if (isAudio) {
    // Copy audio file directly
    fs.copyFileSync(videoPath, audioPath);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'copy',
        command: 'fs.copyFileSync',
        input: videoPath,
        output: audioPath,
        status: 'success'
      });
    }
    return audioPath;
  }

  const command = `"${ffmpegPath}" -v error -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}"`;

  // Extract audio from video using ffmpeg
  try {
    const { stdout, stderr } = await execAsync(command);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        stdout,
        stderr,
        status: 'success'
      });
    }
    return audioPath;
  } catch (error) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

/**
 * Extract audio segment using ffmpeg
 * 
 * @async
 * @function extractAudioSegment
 * @param {string} audioPath - Path to audio file
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @param {string} outputPath - Output path for segment
 * @returns {Promise<void>}
 */
async function extractAudioSegment(audioPath, startTime, duration, outputPath, rawCapture = {}) {
  const command = `"${ffmpegPath}" -v error -i "${audioPath}" -ss ${startTime} -t ${duration} -acodec pcm_s16le -ar 16000 -ac 1 -y "${outputPath}"`;
  try {
    const { stdout, stderr } = await execAsync(command);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-segment.json', {
        tool: 'ffmpeg',
        command,
        stdout,
        stderr,
        status: 'success'
      });
    }
  } catch (error) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-segment.json', {
        tool: 'ffmpeg',
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    throw new Error(`Failed to extract audio segment: ${error.message}`);
  }
}

/**
 * Get audio duration using ffprobe
 * 
 * @function getAudioDuration
 * @param {string} audioPath - Path to audio file
 * @returns {number} - Duration in seconds
 */
function getAudioDuration(audioPath, rawCapture = {}) {
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    const stdoutText = typeof stdout === 'string' ? stdout : stdout.toString();
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: stdoutText,
        status: 'success'
      });
    }
    return parseFloat(stdoutText.trim()) || 0;
  } catch (e) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: e.stdout ? e.stdout.toString() : '',
        stderr: e.stderr ? e.stderr.toString() : '',
        status: 'failed',
        error: e.message
      });
    }
    return 0;
  }
}

/**
 * Build analysis prompt for AI
 * 
 * @function buildAnalysisPrompt
 * @param {number} startTime - Segment start time
 * @param {number} endTime - Segment end time
 * @returns {string} - Analysis prompt
 */
function buildAnalysisPrompt(startTime, endTime) {
  return `Analyze the audio in this segment (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

Identify:
1. Type of audio: music, speech, silence, ambient noise, sound effects
2. If music: describe the mood (upbeat, calm, tense, sad, energetic, etc.)
3. Intensity level from 1-10
4. Brief description

Respond with a JSON object in the following format:

\`\`\`json
{
  "type": "music|speech|silence|ambient|sfx",
  "description": "Brief description of the audio",
  "mood": "upbeat|calm|tense|sad|energetic|neutral",
  "intensity": 5
}
\`\`\`

IMPORTANT:
- Respond ONLY with valid JSON (no markdown, no explanation)
- Be specific about the mood and characteristics
- If it's speech, set type to "speech" and mood to "neutral"`;
}

/**
 * Parse AI segment analysis response
 * 
 * @function parseSegmentResponse
 * @param {string} responseContent - AI response content
 * @param {number} startTime - Segment start time
 * @param {number} endTime - Segment end time
 * @returns {Object} - Parsed segment analysis
 */
function parseSegmentResponse(responseContent, startTime, endTime) {
  // Try to extract JSON from response
  let jsonData = null;

  try {
    jsonData = JSON.parse(responseContent.trim());
  } catch (e) {
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        jsonData = JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Fallback
      }
    }
  }

  // Fallback if parsing fails
  if (!jsonData) {
    return {
      start: startTime,
      end: endTime,
      type: 'unknown',
      description: 'Analysis failed',
      mood: null,
      intensity: 0
    };
  }

  return {
    start: startTime,
    end: endTime,
    type: jsonData.type || 'unknown',
    description: jsonData.description || 'No description',
    mood: jsonData.mood || null,
    intensity: typeof jsonData.intensity === 'number' ? jsonData.intensity : 0
  };
}

/**
 * Generate summary from all segments
 * 
 * @function generateSummary
 * @param {Array} segments - All segment analyses
 * @returns {string} - Summary text
 */
function generateSummary(segments) {
  const musicSegments = segments.filter(s => s.type === 'music' && s.mood);
  const speechSegments = segments.filter(s => s.type === 'speech');

  if (musicSegments.length === 0 && speechSegments.length === 0) {
    return 'No significant music or speech detected in the audio.';
  }

  let summary = '';

  if (musicSegments.length > 0) {
    const moods = [...new Set(musicSegments.map(s => s.mood).filter(Boolean))];
    summary += `Music detected with moods: ${moods.join(', ')}. `;
  }

  if (speechSegments.length > 0) {
    const speechDuration = speechSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    summary += `Speech present for approximately ${speechDuration.toFixed(0)} seconds. `;
  }

  return summary.trim();
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-audio.wav';
  const outputDir = process.argv[3] || 'output/test-music';

  console.log('Get Music Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - config.ai.music.model (set in pipeline YAML)');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio analysis');
  console.log('');
  console.log('Note: This script is designed to be run within the pipeline.');
  console.log('      The model must be explicitly configured in the YAML.');
}
