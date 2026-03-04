#!/usr/bin/env node
/**
 * Step 2: Extract Music & Audio Analysis
 * Uses openai/gpt-audio to analyze music, SFX, and audio atmosphere
 * 
 * Output: music-analysis.md with timestamped tags
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
const MODEL = models.getModel('music', 0);

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
            '-ar', '16000', '-ac', '2',  // Stereo for music analysis
            '-y', outputPath
        ]).on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function analyzeMusic(audioPath) {
    const audioBuf = fs.readFileSync(audioPath);
    const base64Audio = audioBuf.toString('base64');
    
    const prompt = `Analyze the music and audio design in this Call of Duty game trailer.

For each distinct musical or audio section, provide:
- Timestamp range [MM:SS - MM:SS]
- Description of what's happening musically
- Genre/style and instrumentation
- Tempo/mood
- Sound effects present
- Audio's emotional impact

Format as JSON:
{
  "audio_segments": [
    {
      "timestamp_start": "00:00",
      "timestamp_end": "00:08",
      "description": "Tension building. Heavy percussion, fast tempo.",
      "genre": "Orchestral Hybrid / Electronic",
      "instruments": ["synthesizers", "brass", "percussion", "strings"],
      "tempo": "fast|moderate|slow|building",
      "mood": "tense|epic|ominous|triumphant|calm|chaotic",
      "sfx": ["explosions", "gunfire", "radio chatter", "mechanical sounds"],
      "emotional_impact": "creates anxiety and anticipation"
    }
  ],
  "overall_arc": "brief description of how music evolves across trailer",
  "notable_moments": [
    {
      "timestamp": "00:12",
      "description": "bass drop with explosion"
    }
  ]
}

Focus on how the audio enhances the visual experience.`;

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
    
    const result = await utils.validateJSON(res);
    if (!result.success) {
        console.error('Failed to parse API response:', result.error);
        throw new Error('Invalid JSON response from API');
    }
    
    const data = result.data;
    if (!res.ok) throw new Error(data.error?.message || 'API failed');
    
    // Return both content and token usage
    return {
        content: data.choices[0].message.content,
        tokens: data.usage?.total_tokens || 0
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Step 2: Music & Audio Analysis');
    console.log('  Model: openai/gpt-audio');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const videoName = path.basename(VIDEO_PATH, path.extname(VIDEO_PATH));
    const tempDir = fs.mkdtempSync('/tmp/music-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    try {
        console.log('🎵 Extracting audio...');
        await extractAudio(VIDEO_PATH, audioPath);
        console.log(`   ✅ Audio extracted\n`);
        
        console.log('🤖 Analyzing music with gpt-audio...');
        const result = await analyzeMusic(audioPath);
        const analysis = result.content;
        const tokensUsed = result.tokens;
        
        // Parse JSON
        const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || 
                         analysis.match(/{[\s\S]*}/);
        const jsonData = jsonMatch ? jsonMatch[1] || jsonMatch[0] : analysis;
        
        // Save as markdown
        const outputPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
        const markdown = `# Music & Audio Analysis: ${videoName}

**Generated:** ${new Date().toISOString()}  
**Model:** ${MODEL}  
**Tokens Used:** ${tokensUsed.toLocaleString()}  
**Source:** ${VIDEO_PATH}

## Audio Segments

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
