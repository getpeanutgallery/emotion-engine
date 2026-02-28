#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'openai/gpt-audio';
const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv[3] || './analysis-output';

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

async function extractAudio(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        spawn('ffmpeg', ['-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '2', '-y', outputPath])
            .on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function analyzeMusic(audioPath) {
    const audioBuf = fs.readFileSync(audioPath);
    const base64Audio = audioBuf.toString('base64');
    
    const prompt = `Analyze the music and audio design in this Call of Duty trailer. For each section provide: timestamp range [MM:SS - MM:SS], description, genre/style, instruments, tempo/mood, sound effects present, and emotional impact. Format as JSON with audio_segments array.`;
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } }] }],
            max_tokens: 4000
        })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API failed');
    return data.choices[0].message.content;
}

async function main() {
    console.log('Step 2: Music Analysis');
    console.log('Model: openai/gpt-audio\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const tempDir = fs.mkdtempSync('/tmp/music-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    try {
        console.log('Extracting audio...');
        await extractAudio(VIDEO_PATH, audioPath);
        
        console.log('Analyzing music...');
        const analysis = await analyzeMusic(audioPath);
        
        const outputPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
        fs.writeFileSync(outputPath, `# Music Analysis\n\n${analysis}`);
        console.log(`✅ Saved: ${outputPath}`);
        
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch(console.error);
