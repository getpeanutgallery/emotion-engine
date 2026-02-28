#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv[3] || './analysis-output';
const CHUNK_DURATION = 8;

const PERSONA = { name: 'The Impatient Teenager', description: '17yo Gen Z, scrolls if bored' };

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

async function getDuration(videoPath) {
    return new Promise((resolve) => {
        spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
            .stdout.on('data', (d) => resolve(parseFloat(d.toString().trim())));
    });
}

async function extractChunk(startTime, duration, outputPath) {
    return new Promise((resolve, reject) => {
        spawn('ffmpeg', ['-ss', String(startTime), '-i', VIDEO_PATH, '-t', String(duration), '-c', 'copy', '-y', outputPath])
            .on('close', (c) => {
                if (c !== 0) return reject(new Error('FFmpeg failed'));
                resolve(fs.statSync(outputPath).size / 1024 / 1024);
            });
    });
}

async function analyzeChunkPerSecond(chunkPath, startTime, endTime, prevState) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    const context = prevState ? ` Previous state at ${startTime - 1}s: P:${prevState.patience} B:${prevState.boredom} E:${prevState.excitement}` : '';
    
    const prompt = `You are ${PERSONA.name}, ${PERSONA.description}. Watch this ${CHUNK_DURATION}s segment (${startTime}s-${endTime}s) and track emotions EVERY SECOND.${context}

For each second ${startTime} to ${endTime}, provide in JSON:
{
  "per_second_analysis": [
    {"timestamp": ${startTime}, "visuals": "what you see", "patience": 0-10, "boredom": 0-10, "excitement": 0-10, "thought": "internal monologue", "scroll_risk": "low|medium|high"}
  ]
}

Be brutally honest. Use Gen Z voice. Include EVERY SECOND.`;
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 4000
        })
    });
    
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    console.log('Per-Second Emotion Analysis\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/persec-');
    const perSecondData = [];
    let previousState = null;
    let totalTokens = 0;
    
    // Process 3 chunks for demo
    for (let i = 0; i < Math.min(numChunks, 3); i++) {
        const chunkStart = i * CHUNK_DURATION;
        const chunkEnd = Math.min(chunkStart + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i + 1}/3] ${chunkStart}s-${chunkEnd}s`);
        
        try {
            const sizeMB = await extractChunk(chunkStart, CHUNK_DURATION, chunkPath);
            console.log(`   Size: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 10) { console.log('   Skipping (too large)'); continue; }
            
            const result = await analyzeChunkPerSecond(chunkPath, chunkStart, chunkEnd, previousState);
            console.log(`   ✅ ${result.tokens} tokens`);
            totalTokens += result.tokens;
            
            // Parse JSON
            let parsed;
            try {
                const match = result.analysis.match(/```json\s*\n([\s\S]*?)\n```/) || result.analysis.match(/{[\s\S]*}/);
                parsed = JSON.parse(match ? (match[1] || match[0]) : result.analysis);
            } catch (e) {
                console.log('   Parse error');
                continue;
            }
            
            if (parsed.per_second_analysis) {
                perSecondData.push(...parsed.per_second_analysis);
                const last = parsed.per_second_analysis[parsed.per_second_analysis.length - 1];
                previousState = { patience: last.patience, boredom: last.boredom, excitement: last.excitement };
            }
        } catch (err) {
            console.log(`   ❌ ${err.message}`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    // Save outputs
    const output = {
        video: VIDEO_PATH, duration,
        persona: PERSONA,
        total_seconds: perSecondData.length,
        totalTokens,
        per_second_data: perSecondData,
        generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.json'), JSON.stringify(output, null, 2));
    
    // CSV for marketers
    const csv = 'timestamp,patience,boredom,excitement,scroll_risk,thought\n' + 
        perSecondData.map(d => `${d.timestamp},${d.patience},${d.boredom},${d.excitement},"${d.scroll_risk}","${(d.thought||'').replace(/"/g,'\"')}"`).join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.csv'), csv);
    
    console.log('\n✅ Done!');
    console.log(`   Seconds: ${perSecondData.length}`);
    console.log(`   Tokens: ${totalTokens}`);
    console.log(`   Files saved to ${OUTPUT_DIR}/`);
}

main().catch(console.error);
