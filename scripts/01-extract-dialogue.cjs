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
        spawn('ffmpeg', ['-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-y', outputPath])
            .on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function analyzeDialogue(audioPath) {
    const audioBuf = fs.readFileSync(audioPath);
    const base64Audio = audioBuf.toString('base64');
    
    const prompt = `Analyze this audio from a Call of Duty trailer. Extract all dialogue with timestamps [MM:SS], speaker identification, emotional inflection, and delivery style. Format as JSON with dialogue_segments array containing timestamp_start, timestamp_end, speaker, text, emotion, delivery, confidence.`;
    
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
    console.log('Step 1: Dialogue Extraction');
    console.log('Model: openai/gpt-audio\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const tempDir = fs.mkdtempSync('/tmp/dialogue-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    try {
        console.log('Extracting audio...');
        await extractAudio(VIDEO_PATH, audioPath);
        
        console.log('Analyzing with gpt-audio...');
        const analysis = await analyzeDialogue(audioPath);
        
        const outputPath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
        fs.writeFileSync(outputPath, `# Dialogue Analysis\n\n${analysis}`);
        console.log(`✅ Saved: ${outputPath}`);
        
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch(console.error);
