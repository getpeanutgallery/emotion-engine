#!/usr/bin/env node
/**
 * Per-Second Emotion Analysis WITH Context
 * Tracks emotional state every 1 second with dialogue + music context
 */

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

// Load context files from steps 1 & 2
function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    const data = { dialogue: null, music: null };
    
    if (fs.existsSync(dialoguePath)) {
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.dialogue = JSON.parse(match[1]); } catch {} }
        console.log(`   📚 Dialogue: ${data.dialogue?.dialogue_segments?.length || 0} segments`);
    }
    if (fs.existsSync(musicPath)) {
        const content = fs.readFileSync(musicPath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.music = JSON.parse(match[1]); } catch {} }
        console.log(`   📚 Music: ${data.music?.audio_segments?.length || 0} segments`);
    }
    return data;
}

// Get dialogue for this time range
function getDialogueForTime(data, start, end) {
    if (!data?.dialogue_segments) return '';
    const relevant = data.dialogue_segments.filter(d => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const s = parse(d.timestamp_start), e = parse(d.timestamp_end);
        return (s >= start && s <= end) || (e >= start && e <= end);
    });
    return relevant.map(d => \`[\${d.timestamp_start}] \${d.speaker}: "\${d.text}"\`).join('\\n');
}

// Get music for this time range  
function getMusicForTime(data, start, end) {
    if (!data?.audio_segments) return '';
    const relevant = data.audio_segments.filter(m => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const range = m.timestamp_range.split(' - ');
        const s = parse(range[0]), e = parse(range[1]);
        return (s >= start && s <= end) || (e >= start && e <= end) || (s <= start && e >= end);
    });
    return relevant.map(m => \`[\${m.timestamp_range}] \${m.description}\`).join('\\n');
}

async function getDuration(videoPath) {
    return new Promise((resolve) => {
        spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
            .stdout.on('data', (d) => resolve(parseFloat(d.toString().trim())));
    });
}

async function extractChunk(startTime, duration, outputPath) {
    return new Promise((resolve, reject) => {
        spawn('ffmpeg', ['-ss', String(startTime), '-i', VIDEO_PATH, '-t', String(duration), '-c', 'copy', '-y', outputPath])
            .on('close', (c) => c === 0 ? resolve(fs.statSync(outputPath).size / 1024 / 1024) : reject());
    });
}

async function analyzeChunkPerSecond(chunkPath, startTime, endTime, prevState, contextData) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = \`data:video/mp4;base64,\${buf.toString('base64')}\`;
    
    let context = '';
    if (prevState) context += \` Previous state: P:\${prevState.patience} B:\${prevState.boredom} E:\${prevState.excitement}\\n\`;
    
    // ADD DIALOGUE AND MUSIC CONTEXT
    const dialogueCtx = getDialogueForTime(contextData.dialogue, startTime, endTime);
    const musicCtx = getMusicForTime(contextData.music, startTime, endTime);
    if (dialogueCtx) context += \`DIALOGUE:\\n\${dialogueCtx}\\n\\n\`;
    if (musicCtx) context += \`MUSIC:\\n\${musicCtx}\\n\\n\`;
    
    const prompt = \`You are \${PERSONA.name}, \${PERSONA.description}. Watch this \${CHUNK_DURATION}s segment (\${startTime}s-\${endTime}s) and track emotions EVERY SECOND.\${context} JSON format with per_second_analysis array. Include EVERY SECOND.\`;
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${API_KEY}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 4000
        })
    });
    
    const data = await res.json();
    return { 
        analysis: data.choices[0].message.content, 
        tokens: data.usage?.total_tokens,
        contextUsed: { dialogue: !!dialogueCtx, music: !!musicCtx }
    };
}

async function main() {
    console.log('Per-Second Analysis WITH Context\\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    console.log('Loading context files...');
    const contextData = loadContextFiles();
    console.log('');
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(\`Video: \${duration.toFixed(1)}s → \${numChunks} chunks\\n\`);
    
    const tempDir = fs.mkdtempSync('/tmp/persec-');
    const perSecondData = [];
    let previousState = null;
    let totalTokens = 0;
    
    for (let i = 0; i < Math.min(numChunks, 3); i++) {
        const chunkStart = i * CHUNK_DURATION;
        const chunkEnd = Math.min(chunkStart + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, \`chunk-\${i}.mp4\`);
        
        console.log(\`[\${i + 1}/3] \${chunkStart}s-\${chunkEnd}s\`);
        
        try {
            const sizeMB = await extractChunk(chunkStart, CHUNK_DURATION, chunkPath);
            console.log(\`   Size: \${sizeMB.toFixed(2)} MB\`);
            if (sizeMB > 10) { console.log('   Skipping (too large)'); continue; }
            
            const result = await analyzeChunkPerSecond(chunkPath, chunkStart, chunkEnd, previousState, contextData);
            console.log(\`   ✅ \${result.tokens} tokens\`);
            if (result.contextUsed.dialogue) console.log('   🗣️  Dialogue included');
            if (result.contextUsed.music) console.log('   🎵 Music included');
            
            totalTokens += result.tokens;
            
            let parsed;
            try {
                const match = result.analysis.match(/```json\s*\n([\s\S]*?)\n```/) || result.analysis.match(/{[\s\S]*}/);
                parsed = JSON.parse(match ? (match[1] || match[0]) : result.analysis);
            } catch (e) { console.log('   Parse error'); continue; }
            
            if (parsed.per_second_analysis) {
                perSecondData.push(...parsed.per_second_analysis);
                const last = parsed.per_second_analysis[parsed.per_second_analysis.length - 1];
                previousState = { patience: last.patience, boredom: last.boredom, excitement: last.excitement };
            }
        } catch (err) {
            console.log(\`   ❌ \${err.message}\`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.json'), JSON.stringify({
        video: VIDEO_PATH, duration,
        contextFilesUsed: {
            dialogue: !!contextData.dialogue,
            music: !!contextData.music
        },
        total_seconds: perSecondData.length,
        totalTokens,
        per_second_data: perSecondData,
        generatedAt: new Date().toISOString()
    }, null, 2));
    
    const csv = 'timestamp,patience,boredom,excitement,scroll_risk,thought\\n' + 
        perSecondData.map(d => \`\${d.timestamp},\${d.patience},\${d.boredom},\${d.excitement},"\${d.scroll_risk}","\${(d.thought||'').replace(/"/g,'\\"')}"\`).join('\\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.csv'), csv);
    
    console.log('\\n✅ Done!');
    console.log(\`   Seconds: \${perSecondData.length}, Tokens: \${totalTokens}\`);
    console.log(\`   Context: dialogue=\${!!contextData.dialogue}, music=\${!!contextData.music}\`);
}

main().catch(console.error);
