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
        // Use -c copy for speed, no re-encoding
        spawn('ffmpeg', ['-ss', String(startTime), '-i', VIDEO_PATH, '-t', String(duration), '-c', 'copy', '-y', outputPath])
            .on('close', (c) => {
                if (c !== 0) return reject(new Error('FFmpeg failed'));
                const size = fs.statSync(outputPath).size / 1024 / 1024;
                resolve(size);
            });
    });
}

async function analyzeChunk(chunkPath, index, total, startTime, endTime, prevSummary) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    const context = prevSummary ? ` Previous state: ${prevSummary}` : '';
    const prompt = `You are ${PERSONA.name}, ${PERSONA.description}. Chunk ${index + 1}/${total} (${startTime}s-${endTime}s).${context} Describe visuals. Rate patience/boredom/excitement 1-10. Scroll intent? 2-sentence summary. JSON format.`;
    
    console.log('   Sending to Qwen...');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 1200
        })
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
    }
    
    const data = await res.json();
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    console.log('Step 3: Chunked Video Analysis');
    console.log('Model: qwen/qwen3.5-122b-a10b\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/chunks-');
    const results = [];
    let prevSummary = '';
    
    for (let i = 0; i < numChunks && i < 4; i++) { // Limit to 4 chunks for testing
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min(startTime + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i + 1}/${numChunks}] ${startTime}s-${endTime}s`);
        
        try {
            const sizeMB = await extractChunk(startTime, CHUNK_DURATION, chunkPath);
            console.log(`   Size: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 10) {
                console.log('   ⚠️  Chunk too large, skipping');
                continue;
            }
            
            const result = await analyzeChunk(chunkPath, i, numChunks, startTime, endTime, prevSummary);
            console.log(`   ✅ ${result.tokens} tokens`);
            
            prevSummary = result.analysis.substring(0, 100);
            results.push({ chunkIndex: i, startTime, endTime, analysis: result.analysis, tokens: result.tokens });
            
        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    const output = {
        video: VIDEO_PATH, duration, persona: PERSONA,
        chunks: results, totalTokens: results.reduce((a, r) => a + r.tokens, 0),
        generatedAt: new Date().toISOString()
    };
    
    const outPath = path.join(OUTPUT_DIR, '03-chunked-analysis.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Saved: ${outPath}`);
    console.log(`   Chunks: ${results.length}, Tokens: ${output.totalTokens}`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
