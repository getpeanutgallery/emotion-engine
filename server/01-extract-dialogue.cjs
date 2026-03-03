#!/usr/bin/env node
/**
 * Step 1: Extract Dialogue with Timestamps
 * Uses openai/gpt-audio to transcribe speech, identify speakers, and detect emotional inflection
 * 
 * Output: dialogue-analysis.md with JSON data
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'openai/gpt-audio';  // Audio input model
const VIDEO_PATH = process.argv[2] || '../.cache/videos/cod.mp4';
const OUTPUT_DIR = process.argv[3] || '../output/default';

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

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

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API failed');
    return data.choices[0].message.content;
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
        const analysis = await analyzeDialogue(audioPath);
        
        // Parse JSON from response
        const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || 
                         analysis.match(/{[\s\S]*}/);
        const jsonData = jsonMatch ? jsonMatch[1] || jsonMatch[0] : analysis;
        
        // Save as markdown
        const outputPath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
        const markdown = `# Dialogue Analysis: ${videoName}

**Generated:** ${new Date().toISOString()}  
**Model:** ${MODEL}  
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
