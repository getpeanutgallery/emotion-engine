/**
 * Standard Tool Interface for Emotion Engine
 * 
 * All tools must implement this interface:
 * 
 * @typedef {Object} ToolInput
 * @property {Object} toolVariables - Parsed TOOL_VARIABLES from environment
 * @property {Object} videoContext - Video chunk or second metadata
 * @property {string} dialogueContext - Relevant dialogue for timestamp range
 * @property {string} musicContext - Relevant music/audio for timestamp range
 * @property {Object} previousState - Generic state from previous iteration
 * 
 * @typedef {Object} ToolOutput
 * @property {string} prompt - System prompt built by tool
 * @property {Object} state - New state for next iteration
 * 
 * @typedef {Object} Tool
 * @property {function(ToolInput): Promise<ToolOutput>} analyze - Main analysis function
 * @property {function(Object): {valid: boolean, error?: string}} validateVariables - Validate TOOL_VARIABLES
 */

/**
 * Example tool implementation:
 * 
 * const emotionTool = require('./tools/emotion-lenses-tool.cjs');
 * 
 * const result = await emotionTool.analyze({
 *   toolVariables: { lenses: ['patience', 'boredom', 'excitement'] },
 *   videoContext: { startTime: 0, endTime: 8, duration: 8 },
 *   dialogueContext: '[00:05] Speaker: "Hello"',
 *   musicContext: '[00:00-00:08] Upbeat music',
 *   previousState: { patience: 7, boredom: 3 }
 * });
 * 
 * console.log(result.prompt);  // Tool-built prompt
 * console.log(result.state);   // New state for next iteration
 */

/**
 * Tool Input Example:
 * {
 *   toolVariables: {
 *     lenses: ['patience', 'boredom', 'excitement'],
 *     thresholds: { patience: 3, boredom: 7 }
 *   },
 *   videoContext: {
 *     startTime: 0,
 *     endTime: 8,
 *     duration: 8,
 *     chunkIndex: 0
 *   },
 *   dialogueContext: '[00:05] Speaker (excited): "Check this out!"',
 *   musicContext: '[00:00-00:08] Upbeat electronic music (energetic)',
 *   previousState: {
 *     patience: 7,
 *     boredom: 3,
 *     excitement: 5,
 *     thought: 'This seems interesting so far'
 *   }
 * }
 * 
 * Tool Output Example:
 * {
 *   prompt: 'You are Alex, 17. Track patience, boredom, excitement...\n\n[full system prompt]',
 *   state: {
 *     patience: 6,
 *     boredom: 4,
 *     excitement: 5,
 *     thought: 'Getting a bit impatient with the intro',
 *     timestamp: 8
 *   }
 * }
 */

module.exports = {
  /**
   * @type {Tool}
   */
  analyze: async (input) => {
    // Tool implementation goes here
    // This is a placeholder for the interface definition
    throw new Error('Tool interface: implement analyze() in your tool script');
  },
  
  /**
   * Validate TOOL_VARIABLES for this tool
   * @param {Object} toolVariables - Parsed TOOL_VARIABLES
   * @returns {{valid: boolean, error?: string}}
   */
  validateVariables: (toolVariables) => {
    // Tool implementation goes here
    // This is a placeholder for the interface definition
    return {
      valid: false,
      error: 'Tool interface: implement validateVariables() in your tool script'
    };
  },
  
  /**
   * Format state after receiving API response (optional)
   * @param {Object} apiResponse - Parsed API response
   * @param {Object} previousState - Previous state
   * @returns {Object} New state for next iteration
   */
  formatStateAfterResponse: (apiResponse, previousState) => {
    // Tool implementation goes here
    // This is optional - tools can handle state formatting inline
    return previousState || {};
  }
};

/**
 * IMPLEMENTATION CHECKLIST FOR NEW TOOLS:
 * 
 * 1. Create tool script: tools/<your-tool>-tool.cjs
 * 
 * 2. Implement required functions:
 *    - analyze(input) → returns { prompt, state }
 *    - validateVariables(toolVariables) → returns { valid, error? }
 * 
 * 3. Optionally implement:
 *    - formatStateAfterResponse(apiResponse, previousState) → returns new state
 * 
 * 4. Document TOOL_VARIABLES schema in tool script header:
 *    // TOOL_VARIABLES Schema:
 *    // {
 *    //   "yourField": "type (required/optional)",
 *    //   ...
 *    // }
 * 
 * 5. Test tool:
 *    TOOL_ID=your-tool TOOL_VARIABLES='{"yourField":"value"}' \
 *      node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
 * 
 * 6. Verify:
 *    - Tool loads without errors
 *    - TOOL_VARIABLES validation works
 *    - Prompt is built correctly
 *    - State persists across iterations
 */
