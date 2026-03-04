#!/usr/bin/env node
/**
 * Step 1: Extract Dialogue with Timestamps
 * Uses openai/gpt-audio to transcribe speech, identify speakers, and detect emotional inflection
 * 
 * Output: dialogue-analysis.md with JSON data
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '../output/default');

// Log working directory and resolved paths
console.log(`📁 Working directory: ${process.cwd()}`);
console.log(`📁 Script directory: ${__dirname}`);
console.log(`📁 Resolved video path: ${VIDEO_PATH}`);
console.log(`📁 Resolved output dir: ${OUTPUT_DIR}\n`);

// Load utilities
const utils = require('./lib/api-utils.cjs');
const models = require('./lib/models.cjs');

// Model selection with fallback
const MODEL = models.getModel('dialogue', 0);

// Rate limiting delay (default 1000ms)
const delay = parseInt(process.env.API_REQUEST_DELAY) || 1000;

if (!API_KEY) { 
    console.error('❌ OPENROUTER_API_KEY not set');
    console.error('   Set it via: export OPENROUTER_API_KEY=sk-or-...');
    console.error('   Or copy .env.example to .env and fill in your key');
    process.exit(1); 
}

async function extractAudio(videoPath, outputPath) {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
        spawn('ffmpeg', [
            '-i', videoPath,
            '-vn', '-acodec', 'pcm_s16le',
            '-ar', '16000', '-ac', '1',
            '-y', outputPath
        ]).on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function analyzeDialogue(audioPath) {
    const audioBuf = fs.readFileSync(audioPath);
    const base64Audio = audioBuf.toString('base64');
    
    const prompt = `Analyze this audio from a Call of Duty game trailer. 

Extract:
1. All spoken dialogue with precise timestamps [MM:SS]
2. Who is speaking (narrator, character, announcer, etc.)
3. Emotional inflection (excited, serious, ominous, energetic, bored, etc.)
4. Delivery style (whispered, shouting, monotone, dramatic, etc.)

Format as JSON:
{
  "dialogue_segments": [
    {
      "timestamp_start": "00:00",
      "timestamp_end": "00:05",
      "speaker": "Narrator|Character|System|Unknown",
      "text": "exact transcription",
      "emotion": "excited|serious|ominous|energetic|bored|dramatic|neutral",
      "delivery": "whispered|shouting|monotone|dramatic|conversational",
      "confidence": 0.95
    }
  ],
  "summary": "brief summary of dialogue arc across trailer"
}

Be precise with timestamps. If multiple speakers overlap, note this.`;

    // Rate limiting delay
    await new Promise(r => setTimeout(r, delay));
    
    const res = await utils.fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { 
                        type: 'input_audio',
                        input_audio: {
                            data: base64Audio,
                            format: 'wav'
                        }
                    }
                ]
            }],
            max_tokens: 4000
        })
    }, { maxRetries: 3, baseDelay: 1000 });
    
    // Debug: Log raw response before parsing
    console.log('\n🔍 DEBUG: Raw API response received');
    console.log(`   Status: ${res.status} ${res.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(res.headers.entries()));
    
    const result = await utils.validateJSON(res);
    if (!result.success) {
        console.error('\n❌ Failed to parse API response:');
        console.error(`   Error: ${result.error}`);
        console.error(`   Response OK: ${res.ok}`);
        console.error(`   Status: ${res.status}`);
        throw new Error(`Invalid JSON response from API: ${result.error}`);
    }
    
    const data = result.data;
    console.log('✅ API response parsed successfully');
    
    if (!res.ok) {
        console.error('❌ API returned error status:', data.error);
        throw new Error(data.error?.message || 'API failed');
    }
    
    // Return both content and token usage
    return {
        content: data.choices[0].message.content,
        tokens: data.usage?.total_tokens || 0
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Step 1: Dialogue Extraction');
    console.log('  Model: openai/gpt-audio');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const videoName = path.basename(VIDEO_PATH, path.extname(VIDEO_PATH));
    const tempDir = fs.mkdtempSync('/tmp/dialogue-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    try {
        console.log('🎤 Extracting audio...');
        await extractAudio(VIDEO_PATH, audioPath);
        console.log(`   ✅ Audio extracted: ${(fs.statSync(audioPath).size / 1024).toFixed(0)} KB\n`);
        
        console.log('🤖 Analyzing with gpt-audio...');
        const result = await analyzeDialogue(audioPath);
        const analysis = result.content;
        const tokensUsed = result.tokens;
        
        // Parse JSON from response
        const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || 
                         analysis.match(/{[\s\S]*}/);
        const jsonData = jsonMatch ? jsonMatch[1] || jsonMatch[0] : analysis;
        
        // Save as markdown
        const outputPath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
        const markdown = `# Dialogue Analysis: ${videoName}

**Generated:** ${new Date().toISOString()}  
**Model:** ${MODEL}  
**Tokens Used:** ${tokensUsed.toLocaleString()}  
**Source:** ${VIDEO_PATH}

## Extracted Dialogue

\`\`\`json
${JSON.stringify(JSON.parse(jsonData), null, 2)}
\`\`\`

## Raw Analysis

${analysis}
`;
        
        fs.writeFileSync(outputPath, markdown);
        console.log(`\n✅ Saved to: ${outputPath}`);
        
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch(console.error);
