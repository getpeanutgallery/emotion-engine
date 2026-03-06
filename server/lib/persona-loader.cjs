#!/usr/bin/env node
/**
 * Persona System Loader
 * Composes SOUL.md + GOAL.md + TOOLS.md into system prompts
 * 
 * Usage: 
 *   const loader = require('./lib/persona-loader.cjs');
 *   const config = loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation');
 *   const prompt = loader.buildSystemPrompt(config, { duration: 30, selectedLenses: ['patience', 'boredom', 'excitement'] });
 */

const fs = require('fs');
const path = require('path');

const PERSONAS_ROOT = path.join(__dirname, '../../personas');

/**
 * @typedef {Object} PersonaConfig
 * @property {Object} soul - SOUL.md content
 * @property {Object} goal - GOAL.md content
 * @property {Object} tools - TOOLS.md content
 * @property {string} systemPrompt - Composed system prompt
 */



/**
 * Load SOUL.md for a persona
 * @param {string} soulPath - Path to SOUL.md (relative to project root or absolute)
 * @returns {Object|null} Parsed SOUL.md or null if not found
 */
function loadSoul(soulPath) {
    // Path must be provided directly (no ID lookup)
    if (!soulPath) {
        console.error('❌ soulPath is required');
        return null;
    }
    
    // Resolve relative paths from project root
    if (!soulPath.startsWith('/')) {
        soulPath = path.join(path.dirname(__dirname), '..', soulPath);
    }
    
    if (!fs.existsSync(soulPath)) {
        console.error(`❌ SOUL.md not found at path: ${soulPath}`);
        return null;
    }
    
    const content = fs.readFileSync(soulPath, 'utf8');
    return parseMarkdown(content);
}

/**
 * Load GOAL.md for a goal
 * @param {string} goalPath - Path to GOAL.md (relative to project root or absolute)
 * @returns {Object|null} Parsed GOAL.md or null if not found
 */
function loadGoal(goalPath) {
    // Path must be provided directly (no ID lookup)
    if (!goalPath) {
        console.error('❌ goalPath is required');
        return null;
    }
    
    // Resolve relative paths from project root
    if (!goalPath.startsWith('/')) {
        goalPath = path.join(path.dirname(__dirname), '..', goalPath);
    }
    
    if (!fs.existsSync(goalPath)) {
        console.error(`❌ GOAL.md not found at path: ${goalPath}`);
        return null;
    }
    
    const content = fs.readFileSync(goalPath, 'utf8');
    return parseMarkdown(content);
}

/**
 * Load complete persona configuration
 * @param {string} soulPath - Path to SOUL.md
 * @param {string} goalPath - Path to GOAL.md
 * @returns {PersonaConfig|null}
 */
function loadPersonaConfig(soulPath, goalPath) {
    const soul = loadSoul(soulPath);
    const goal = loadGoal(goalPath);
    
    if (!soul || !goal) {
        return null;
    }
    
    return { soul, goal, tools: null };
}

/**
 * Build system prompt from persona config
 * @param {PersonaConfig} config - Loaded persona config
 * @param {Object} options - Prompt options
 * @param {number} options.duration - Video duration in seconds
 * @param {string[]} options.selectedLenses - Emotional lenses to track
 * @param {string} options.videoContext - Optional video description
 * @returns {string} Complete system prompt
 */
function buildSystemPrompt(config, options = {}) {
    const { soul, goal, tools } = config;
    const { duration = 30, selectedLenses = ['patience', 'boredom', 'excitement'], videoContext = '' } = options;
    
    // Extract key sections from SOUL
    const soulName = extractValue(soul, 'Name') || 'Persona';
    const soulAge = extractValue(soul, 'Age') || '';
    const soulDemographic = extractValue(soul, 'Demographic') || '';
    const soulCoreTruth = extractSection(soul, 'Core Truth') || '';
    const soulBehavioral = extractSection(soul, 'Behavioral Profile') || '';
    
    // Extract from GOAL
    const goalObjective = extractSection(goal, 'Primary Objective') || '';
    const goalCriteria = extractSection(goal, 'Success Criteria') || '';
    
    // Build lenses section
    const lensesText = selectedLenses.map(lens => {
        const lensInfo = findLensInfo(tools, lens);
        return `- **${capitalize(lens)}**: ${lensInfo?.description || 'Emotional metric'} (scale 1-10)`;
    }).join('\n');
    
    // Compose full prompt
    let prompt = `You are ${soulName}`;
    if (soulAge) prompt += `, ${soulAge}`;
    if (soulDemographic) prompt += `, ${soulDemographic}`;
    prompt += `.\n\n`;
    
    prompt += `${soulCoreTruth}\n\n`;
    prompt += `${soulBehavioral}\n\n`;
    prompt += `---\n\n`;
    prompt += `YOUR EVALUATION GOAL:\n${goalObjective}\n\n`;
    prompt += `Success criteria:\n${goalCriteria}\n\n`;
    prompt += `---\n\n`;
    prompt += `TRACK THESE EMOTIONS:\n${lensesText}\n\n`;
    prompt += `Video duration: ${duration} seconds\n`;
    if (videoContext) {
        prompt += `Context: ${videoContext}\n\n`;
    }
    prompt += `---\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `- Respond ONLY with valid JSON\n`;
    prompt += `- Use the persona's authentic voice in "thought" fields\n`;
    prompt += `- Be brutally honest—this persona's job is to fail content that doesn't work\n`;
    prompt += `- Score every second from 0 to ${duration}\n`;
    prompt += `- Mark scroll_risk as "SCROLLING" the moment this persona would abandon\n\n`;
    prompt += `Required JSON format:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{
  "per_second_analysis": [
    {
      "timestamp": 0,
      "visuals": "describe what you see",
      "patience": 0-10,
      "boredom": 0-10,
      "excitement": 0-10,
      "thought": "internal monologue in persona voice",
      "scroll_risk": "low|medium|high|SCROLLING"
    }
  ]
}\n`;
    prompt += `\`\`\`\n`;
    
    return prompt;
}

/**
 * Parse markdown into sections
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
 * Extract a value from parsed markdown (e.g., "Name: Alex")
 * @param {Object} parsed - Parsed markdown
 * @param {string} key - Key to find
 * @returns {string|null}
 */
function extractValue(parsed, key) {
    const identity = parsed['Identity'] || parsed['Core Identity'] || '';
    const match = identity.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`));
    return match ? match[1].trim() : null;
}

/**
 * Extract a section from parsed markdown
 * @param {Object} parsed - Parsed markdown
 * @param {string} sectionName - Section name
 * @returns {string|null}
 */
function extractSection(parsed, sectionName) {
    return parsed[sectionName] || null;
}

/**
 * Find emotional lens info in TOOLS.md
 * @param {Object} tools - Parsed TOOLS.md
 * @param {string} lensName - Lens name
 * @returns {Object|null}
 */
function findLensInfo(tools, lensName) {
    const lensesSection = tools['Emotional Lenses (Composable)'] || tools['Emotional Lenses'] || '';
    const lines = lensesSection.split('\n');
    
    for (const line of lines) {
        if (line.toLowerCase().includes(lensName.toLowerCase())) {
            // Parse table row: | **Patience** | Description | 1-10 | ≤ 3 = risk |
            const parts = line.split('|').map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                return {
                    name: parts[0].replace(/\*\*/g, ''),
                    description: parts[1]
                };
            }
        }
    }
    
    return null;
}

/**
 * Capitalize first letter
 * @param {string} str - Input string
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    loadSoul,
    loadGoal,
    loadPersonaConfig,
    buildSystemPrompt,
    parseMarkdown
};
