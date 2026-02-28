#!/usr/bin/env node
/**
 * Step 3: Chunked Video Analysis WITH Context
 * NOW ACTUALLY USES dialogue and music files!
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

// Load context files
function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    
    const data = { dialogue: null, music: null };
    
    if (fs.existsSync(dialoguePath)) {
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) {
            try { data.dialogue = JSON.parse(match[1]); } catch {}
        }
    }
    
    if (fs.existsSync(musicPath)) {
        const content = fs.readFileSync(musicPath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) {
            try { data.music = JSON.parse(match[1]); } catch {}
        }
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
    
    return relevant.map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n');
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
    
    return relevant.map(m => `[${m.timestamp_range}] ${m.description} (${m.mood})`).join('\n');
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

async function analyzeChunk(chunkPath, index, total, startTime, endTime, prevSummary, dialogueCtx, musicCtx) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    // BUILD CONTEXT
    let context = '';
    if (prevSummary) context += `Previous state: ${prevSummary}\n`;
    if (dialogueCtx) context += `DIALOGUE:\n${dialogueCtx}\n`;
    if (musicCtx) context += `MUSIC:\n${musicCtx}\n`;
    
    const prompt = `You are ${PERSONA.name}, ${PERSONA.description}. Chunk ${index+1}/${total} (${startTime}s-${endTime}s).\n${context}\nDescribe visuals. Rate patience/boredom/excitement 1-10. What's your honest thought right now? Scroll intent? JSON format.`;
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 1500
        })
    });
    
    const data = await res.json();
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    console.log('Step 3: Chunked Video Analysis WITH Context\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // LOAD CONTEXT FILES
    console.log('Loading context files...');
    const contextData = loadContextFiles();
    console.log(`  Dialogue segments: ${contextData.dialogue?.dialogue_segments?.length || 0}`);
    console.log(`  Music segments: ${contextData.music?.audio_segments?.length || 0}\n`);
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/chunks-');
    const results = [];
    let prevSummary = '';
    
    for (let i = 0; i < numChunks && i < 4; i++) {
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min(startTime + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i+1}] ${startTime}s-${endTime}s`);
        
        try {
            const sizeMB = await extractChunk(startTime, CHUNK_DURATION, chunkPath);
            console.log(`   Size: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 10) { console.log('   Skipping (too large)'); continue; }
            
            // GET RELEVANT CONTEXT FOR THIS TIME RANGE
            const dialogueCtx = getDialogueForTime(contextData.dialogue, startTime, endTime);
            const musicCtx = getMusicForTime(contextData.music, startTime, endTime);
            
            if (dialogueCtx) console.log(`   🗣️  Dialogue: ${dialogueCtx.split('\n')[0]}...`);
            if (musicCtx) console.log(`   🎵 Music: ${musicCtx.split('\n')[0]}...`);
            
            const result = await analyzeChunk(chunkPath, i, numChunks, startTime, endTime, prevSummary, dialogueCtx, musicCtx);
            console.log(`   ✅ ${result.tokens} tokens`);
            
            prevSummary = result.analysis.substring(0, 100);
            results.push({ chunkIndex: i, startTime, endTime, analysis: result.analysis, tokens: result.tokens });
            
        } catch (err) {
            console.log(`   ❌ ${err.message}`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '03-chunked-analysis.json'), JSON.stringify({
        video: VIDEO_PATH, duration, persona: PERSONA,
        contextFilesUsed: {
            dialogue: !!contextData.dialogue,
            music: !!contextData.music
        },
        chunks: results,
        totalTokens: results.reduce((a, r) => a + r.tokens, 0),
        generatedAt: new Date().toISOString()
    }, null, 2));
    
    console.log('\n✅ Done!');
    console.log(`   Chunks: ${results.length}`);
    console.log(`   Context used: dialogue=${!!contextData.dialogue}, music=${!!contextData.music}`);
}

main().catch(console.error);
