#!/usr/bin/env node
/**
 * Emotion Lenses Tool
 * 
 * Evaluates media against a persona using emotion lenses.
 * This tool is called by process scripts (video-chunks, video-per-second) to perform
 * AI-powered emotion analysis.
 * 
 * @module tools/emotion-lenses-tool
 */

const fs = require('fs');
const path = require('path');
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');
const retryStrategy = require('../server/lib/retry-strategy.cjs');

/**
 * Convert file to base64 data URL
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type (e.g., 'video/mp4')
 * @returns {string} Base64 data URL
 */
function fileToBase64(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Tool Input Contract
 * @typedef {Object} EmotionLensesInput
 * @property {Object} toolVariables - Tool configuration
 * @property {string} toolVariables.soulPath - Path to SOUL.md
 * @property {string} toolVariables.goalPath - Path to GOAL.md
 * @property {Object} toolVariables.variables - Additional variables
 * @property {string[]} toolVariables.variables.lenses - Emotion lenses to evaluate
 * @property {string} [toolVariables.file_transfer] - File transfer strategy: "base64", "web_url", or "youtube_url"
 * @property {Object} [videoContext] - Video context
 * @property {Array} videoContext.frames - Video frames (base64 or paths) - deprecated, use chunkPath
 * @property {string} [videoContext.chunkPath] - Path to video chunk file
 * @property {string} [videoContext.url] - URL for web_url strategy
 * @property {number} videoContext.startTime - Start time of chunk in seconds
 * @property {number} videoContext.endTime - End time of chunk in seconds
 * @property {number} videoContext.duration - Duration in seconds
 * @property {number} [videoContext.chunkIndex] - Index of this chunk
 * @property {number} [videoContext.splitIndex] - Index of split this chunk belongs to
 * @property {Object} [dialogueContext] - Dialogue context
 * @property {Array} dialogueContext.segments - Dialogue segments
 * @property {Object} [musicContext] - Music context
 * @property {Array} musicContext.segments - Music segments
 * @property {Object} [previousState] - State from previous chunk (for continuity)
 * @property {string} previousState.summary - Previous summary
 * @property {Object} previousState.emotions - Previous emotion scores
 */

/**
 * Tool Output Contract
 * @typedef {Object} EmotionLensesOutput
 * @property {string} prompt - The prompt sent to AI
 * @property {Object} state - Analysis state
 * @property {string} state.summary - AI summary of this chunk
 * @property {Object} state.emotions - Emotion scores per lens
 * @property {string} state.previousSummary - Summary from previous chunk
 * @property {Object} usage - Token usage
 * @property {number} usage.input - Input tokens
 * @property {number} usage.output - Output tokens
 */

/**
 * Analyze media using emotion lenses
 * 
 * @async
 * @function analyze
 * @param {EmotionLensesInput} input - Tool input
 * @returns {Promise<EmotionLensesOutput>} - Analysis results
 */
async function analyze(input) {
  const {
    toolVariables,
    videoContext = { frames: [], duration: 0 },
    dialogueContext = { segments: [] },
    musicContext = { segments: [] },
    previousState = { summary: '', emotions: {} }
  } = input;

  // Validate required inputs
  if (!toolVariables?.soulPath || !toolVariables?.goalPath) {
    throw new Error('EmotionLensesTool: soulPath and goalPath are required in toolVariables');
  }

  const lenses = toolVariables.variables?.lenses || ['patience', 'boredom', 'excitement'];
  const fileTransferStrategy = toolVariables.file_transfer || 'base64';

  // Load persona configuration directly from paths (no ID lookup)
  const personaConfig = loadPersonaFromPaths(
    toolVariables.soulPath,
    toolVariables.goalPath
  );

  if (!personaConfig) {
    throw new Error(`EmotionLensesTool: Failed to load persona from soulPath=${toolVariables.soulPath} and goalPath=${toolVariables.goalPath}`);
  }

  // Build the prompt with video context info
  const prompt = buildPrompt(personaConfig, {
    lenses,
    videoContext,
    dialogueContext,
    musicContext,
    previousState
  });

  // Prepare message content for OpenRouter with video support
  let messageContent = null;
  let base64VideoOrUrl = null;

  // Check if videoContext contains a chunkPath (video file path)
  if (videoContext.chunkPath) {
    const chunkPath = videoContext.chunkPath;
    
    // Validate file exists
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`EmotionLensesTool: Video chunk file not found: ${chunkPath}`);
    }

    // Validate file size if maxFileSize is configured
    const stats = fs.statSync(chunkPath);
    const maxFileSize = toolVariables.variables?.maxFileSize || 100 * 1024 * 1024; // Default 100MB
    if (stats.size > maxFileSize) {
      throw new Error(`EmotionLensesTool: Video file exceeds maxFileSize limit (${stats.size} > ${maxFileSize})`);
    }

    // Convert video using the appropriate strategy
    if (fileTransferStrategy === 'base64') {
      base64VideoOrUrl = fileToBase64(chunkPath, 'video/mp4');
    } else if (fileTransferStrategy === 'web_url') {
      base64VideoOrUrl = videoContext.url;
      if (!base64VideoOrUrl) {
        throw new Error('EmotionLensesTool: videoContext.url is required for web_url strategy');
      }
    } else if (fileTransferStrategy === 'youtube_url') {
      base64VideoOrUrl = videoContext.url;
      if (!base64VideoOrUrl) {
        throw new Error('EmotionLensesTool: videoContext.url is required for youtube_url strategy');
      }
      // Basic YouTube URL validation
      if (!base64VideoOrUrl.includes('youtube.com') && !base64VideoOrUrl.includes('youtu.be')) {
        console.warn('EmotionLensesTool: URL may not be a valid YouTube URL');
      }
    } else {
      throw new Error(`EmotionLensesTool: Unknown file_transfer strategy: ${fileTransferStrategy}`);
    }

    // Build the message content for OpenRouter with video support
    messageContent = [
      { type: 'text', text: prompt },
      { 
        type: 'video_url', 
        video_url: { url: base64VideoOrUrl } 
      }
    ];
  } else {
    // Backward compatibility: support image frames if they exist
    const attachments = [];
    if (videoContext.frames && videoContext.frames.length > 0) {
      for (const frame of videoContext.frames) {
        if (frame.path) {
          attachments.push({
            type: 'image',
            path: frame.path
          });
        } else if (frame.data) {
          attachments.push({
            type: 'image',
            data: frame.data,
            mimeType: frame.mimeType || 'image/jpeg'
          });
        }
      }
    }
    
    // For backward compatibility, use prompt with attachments
    messageContent = {
      prompt,
      attachments: attachments.length > 0 ? attachments : undefined
    };
  }

  // Get AI provider from environment
  const provider = aiProvider.getProviderFromEnv();
  // Default model supports video input, can be overridden via config or env
  const model = process.env.AI_MODEL || 'qwen/qwen3.5-35b-a3b';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('EmotionLensesTool: AI_API_KEY environment variable is required');
  }

  // Get retry strategy from config
  const retryConfig = toolVariables.variables?.retry_strategy || {
    type: 'exponential-backoff',
    config: { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000, exponentialBase: 2, jitter: true }
  };

  const strategy = retryStrategy.getRetryStrategy(retryConfig.type, retryConfig.config);

  console.log(`   🔄 Retry strategy: ${retryConfig.type} (maxRetries: ${retryConfig.config.maxRetries})`);

  // Call AI provider with retry logic
  let response;
  try {
    if (Array.isArray(messageContent)) {
      // Video input mode (OpenRouter format) - pass as prompt array
      const result = await strategy.execute(async () => {
        return await provider.complete({
          prompt: messageContent,
          model,
          apiKey,
          options: {
            temperature: 0.7,
            maxTokens: 2048
          }
        });
      }, { 
        operation: 'AI completion', 
        context: { 
          model, 
          chunkIndex: videoContext.chunkIndex,
          splitIndex: videoContext.splitIndex || 0
        } 
      });
      response = result;
    } else {
      // Backward compatibility mode (image attachments)
      const result = await strategy.execute(async () => {
        return await provider.complete({
          prompt: messageContent.prompt,
          model,
          apiKey,
          attachments: messageContent.attachments,
          options: {
            temperature: 0.7,
            maxTokens: 2048
          }
        });
      }, { 
        operation: 'AI completion', 
        context: { 
          model, 
          chunkIndex: videoContext.chunkIndex,
          splitIndex: videoContext.splitIndex || 0
        } 
      });
      response = result;
    }
  } catch (error) {
    console.error(`❌ AI completion failed after retries: ${error.message}`);
    throw error;
  }

  // Parse response into structured state
  const state = parseResponse(response.content, previousState, lenses);

  // Cleanup: delete video chunk file after processing if it's a temp file
  if (videoContext.chunkPath && fileTransferStrategy === 'base64') {
    try {
      // Only delete if it's in a temp directory
      if (videoContext.chunkPath.includes('tmp') || videoContext.chunkPath.includes('temp')) {
        fs.unlinkSync(videoContext.chunkPath);
        console.log(`EmotionLensesTool: Cleaned up temp video chunk: ${videoContext.chunkPath}`);
      }
    } catch (err) {
      console.warn(`EmotionLensesTool: Failed to cleanup temp file: ${err.message}`);
    }
  }

  return {
    prompt,
    state,
    usage: {
      input: response.usage?.input || 0,
      output: response.usage?.output || 0
    }
  };
}

/**
 * Build prompt for AI analysis
 * 
 * @function buildPrompt
 * @param {Object} personaConfig - Loaded persona config
 * @param {Object} options - Prompt options
 * @returns {string} - Complete prompt
 */
function buildPrompt(personaConfig, options) {
  const { soul, goal, tools } = personaConfig;
  const {
    lenses,
    videoContext,
    dialogueContext,
    musicContext,
    previousState
  } = options;

  let prompt = '';

  // SOUL section
  if (soul) {
    prompt += '# PERSONA\n\n';
    for (const [section, content] of Object.entries(soul)) {
      prompt += `## ${section}\n${content}\n\n`;
    }
    prompt += '\n';
  }

  // GOAL section
  if (goal) {
    prompt += '# EVALUATION GOAL\n\n';
    for (const [section, content] of Object.entries(goal)) {
      prompt += `## ${section}\n${content}\n\n`;
    }
    prompt += '\n';
  }

  // Emotion Lenses section
  prompt += '# EMOTION LENSES TO TRACK\n\n';
  prompt += `Evaluate the following emotions on a scale of 1-10:\n\n`;
  for (const lens of lenses) {
    prompt += `- **${capitalize(lens)}**: Rate from 1 (lowest) to 10 (highest)\n`;
  }
  prompt += '\n';

  // Context section
  prompt += '# CONTEXT\n\n';

  // Previous state (for continuity)
  if (previousState?.summary) {
    prompt += `## Previous Summary\n${previousState.summary}\n\n`;
  }

  // Video context
  if (videoContext?.duration) {
    prompt += `## Video Segment\n`;
    
    // Add chunk timing info
    if (videoContext.startTime !== undefined && videoContext.endTime !== undefined) {
      prompt += `Time Range: ${formatTime(videoContext.startTime)} - ${formatTime(videoContext.endTime)}\n`;
    }
    
    prompt += `Duration: ${videoContext.duration} seconds\n`;
    
    // Add chunk index and split index for tracking
    if (videoContext.chunkIndex !== undefined) {
      prompt += `Chunk Index: ${videoContext.chunkIndex}\n`;
    }
    if (videoContext.splitIndex !== undefined) {
      prompt += `Split Index: ${videoContext.splitIndex}\n`;
    }
    
    if (videoContext.frames?.length > 0) {
      prompt += `Attached: ${videoContext.frames.length} frame(s) for visual analysis\n`;
    }
    if (videoContext.chunkPath) {
      prompt += `Video file: ${videoContext.chunkPath}\n`;
    }
    prompt += '\n';
  }

  // Dialogue context
  if (dialogueContext?.segments && dialogueContext.segments.length > 0) {
    prompt += `## Dialogue\n`;
    for (const seg of dialogueContext.segments) {
      const timeRange = formatTimeRange(seg.start, seg.end);
      prompt += `[${timeRange}] ${seg.speaker || 'Speaker'}: ${seg.text}\n`;
    }
    prompt += '\n';
  }

  // Music context
  if (musicContext?.segments && musicContext.segments.length > 0) {
    prompt += `## Music/Audio\n`;
    for (const seg of musicContext.segments) {
      const timeRange = formatTimeRange(seg.start, seg.end);
      prompt += `[${timeRange}] ${seg.description || seg.mood || 'Audio'} (intensity: ${seg.intensity || 'N/A'})\n`;
    }
    prompt += '\n';
  }

  // Instructions
  prompt += '# INSTRUCTIONS\n\n';
  prompt += `Analyze the provided media and context. Respond with a JSON object in the following format:\n\n`;
  prompt += '```json\n';
  prompt += JSON.stringify({
    summary: "Brief summary of what happens in this segment",
    emotions: {
      [lenses[0]]: {
        score: 5,
        reasoning: "Why this score was given"
      }
    },
    dominant_emotion: "lens_name",
    confidence: 0.85
  }, null, 2);
  prompt += '\n```\n\n';

  prompt += 'IMPORTANT:\n';
  prompt += '- Respond ONLY with valid JSON (no markdown, no explanation)\n';
  prompt += '- Be honest and critical—this persona\'s job is to provide authentic feedback\n';
  prompt += '- Consider the previous context for continuity\n';

  return prompt;
}

/**
 * Parse AI response into structured state
 * 
 * @function parseResponse
 * @param {string} responseContent - AI response content
 * @param {Object} previousState - Previous state
 * @param {string[]} lenses - Emotion lenses
 * @returns {Object} - Parsed state
 */
function parseResponse(responseContent, previousState, lenses) {
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
        console.warn('EmotionLensesTool: Failed to parse JSON from response, using fallback');
      }
    }
  }

  // Build state from parsed JSON or create fallback
  const state = {
    summary: jsonData?.summary || 'Analysis completed',
    emotions: {},
    previousSummary: previousState?.summary || ''
  };

  // Parse emotion scores
  if (jsonData?.emotions) {
    for (const lens of lenses) {
      const emotionData = jsonData.emotions[lens];
      state.emotions[lens] = {
        score: typeof emotionData?.score === 'number' ? emotionData.score : 5,
        reasoning: emotionData?.reasoning || 'No reasoning provided'
      };
    }
  } else {
    // Fallback: default scores
    for (const lens of lenses) {
      state.emotions[lens] = {
        score: 5,
        reasoning: 'Default score (parsing failed)'
      };
    }
  }

  // Add dominant emotion if provided
  if (jsonData?.dominant_emotion) {
    state.dominant_emotion = jsonData.dominant_emotion;
  }

  // Add confidence if provided
  if (typeof jsonData?.confidence === 'number') {
    state.confidence = jsonData.confidence;
  }

  return state;
}

/**
 * Format time as MM:SS
 * 
 * @function formatTime
 * @param {number} time - Time in seconds
 * @returns {string} - Formatted time
 */
function formatTime(time) {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format time range as MM:SS
 * 
 * @function formatTimeRange
 * @param {number} start - Start time in seconds
 * @param {number} end - End time in seconds
 * @returns {string} - Formatted time range
 */
function formatTimeRange(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

/**
 * Capitalize first letter
 * 
 * @function capitalize
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Resolve a path that may be a package path (e.g., 'cast/impatient-teenager/SOUL.md')
 * @param {string} inputPath - Path to resolve
 * @param {string} emotionEngineRoot - Root directory of emotion-engine
 * @returns {string} Resolved absolute path
 */
function resolvePersonaPath(inputPath, emotionEngineRoot) {
  // If path starts with '/', it's already absolute
  if (inputPath.startsWith('/')) {
    return inputPath;
  }
  
  // Try to resolve from emotion-engine root first
  const rootPath = path.join(emotionEngineRoot, inputPath);
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }
  
  // Try to resolve from node_modules (package path)
  // e.g., 'cast/impatient-teenager/SOUL.md' -> 'node_modules/cast/impatient-teenager/SOUL.md'
  const packagePath = path.join(emotionEngineRoot, 'node_modules', inputPath);
  if (fs.existsSync(packagePath)) {
    return packagePath;
  }
  
  // If neither works, return the original path (will fail validation later)
  return inputPath;
}

/**
 * Load persona configuration directly from file paths
 * @param {string} soulPath - Full path to SOUL.md (can be absolute or package path like 'cast/impatient-teenager/SOUL.md')
 * @param {string} goalPath - Full path to GOAL.md (can be absolute or package path like 'cast/impatient-teenager/GOAL.md')
 * @returns {Object|null} Persona config or null if failed
 */
function loadPersonaFromPaths(soulPath, goalPath) {
  try {
    // Get the emotion-engine root directory (parent of tools/)
    const emotionEngineRoot = path.resolve(__dirname, '..');
    
    // Resolve paths (handle both absolute and package paths)
    const resolvedSoulPath = resolvePersonaPath(soulPath, emotionEngineRoot);
    const resolvedGoalPath = resolvePersonaPath(goalPath, emotionEngineRoot);
    
    // Validate paths exist
    if (!fs.existsSync(resolvedSoulPath)) {
      console.error(`❌ SOUL.md not found: ${resolvedSoulPath}`);
      return null;
    }
    if (!fs.existsSync(resolvedGoalPath)) {
      console.error(`❌ GOAL.md not found: ${resolvedGoalPath}`);
      return null;
    }

    // Load SOUL.md
    const soulContent = fs.readFileSync(resolvedSoulPath, 'utf8');
    const soul = parseMarkdown(soulContent);

    // Load GOAL.md
    const goalContent = fs.readFileSync(resolvedGoalPath, 'utf8');
    const goal = parseMarkdown(goalContent);

    if (!soul || !goal) {
      return null;
    }

    return { soul, goal, tools: null };
  } catch (error) {
    console.error(`❌ Error loading persona from paths: ${error.message}`);
    return null;
  }
}

/**
 * Parse markdown into sections (copied from persona-loader for independence)
 * @param {string} markdown - Markdown content
 * @returns {Object} Parsed sections
 */
function parseMarkdown(markdown) {
  const sections = {};
  const lines = markdown.split('\n');
  let currentSection = 'header';
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      // Start new section
      currentSection = line.replace('## ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Validate tool variables
 * 
 * @function validateVariables
 * @param {Object} toolVariables - Tool variables to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
function validateVariables(toolVariables) {
  if (!toolVariables) {
    return { valid: false, error: 'toolVariables is required' };
  }

  if (!toolVariables.soulPath) {
    return { valid: false, error: 'toolVariables.soulPath is required' };
  }

  if (!toolVariables.goalPath) {
    return { valid: false, error: 'toolVariables.goalPath is required' };
  }

  if (!toolVariables.variables?.lenses || !Array.isArray(toolVariables.variables.lenses)) {
    return { 
      valid: false, 
      error: 'toolVariables.variables.lenses must be an array of emotion lens names' 
    };
  }

  return { valid: true };
}

module.exports = {
  analyze,
  validateVariables,
  buildPrompt,
  parseResponse,
  loadPersonaFromPaths,
  resolvePersonaPath
};

// Allow standalone execution for testing
if (require.main === module) {
  console.log('Emotion Lenses Tool - Test Mode');
  console.log('Usage: Set AI_API_KEY and run with test input');
  
  // Example test (won't run without actual files and API key)
  const testInput = {
    toolVariables: {
      soulPath: '/path/to/SOUL.md',
      goalPath: '/path/to/GOAL.md',
      variables: {
        lenses: ['patience', 'boredom', 'excitement']
      }
    },
    videoContext: {
      frames: [],
      duration: 8
    },
    dialogueContext: {
      segments: []
    },
    musicContext: {
      segments: []
    },
    previousState: {
      summary: '',
      emotions: {}
    }
  };
  
  console.log('Test input structure:', JSON.stringify(testInput, null, 2));
}
