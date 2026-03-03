#!/usr/bin/env node
/**
 * Per-Second Emotion Analysis with STRICT JSON Output
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = process.argv[2] || '../.cache/videos/cod.mp4';
const OUTPUT_DIR = process.argv[3] || '../output/default';
const CHUNK_DURATION = 8;

// Load persona system
const personaLoader = require('./lib/persona-loader.cjs');
const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';

const personaConfig = personaLoader.loadPersonaConfig(SOUL_ID, GOAL_ID, TOOL_ID);

if (!API_KEY) { 
    console.error('❌ OPENROUTER_API_KEY not set');
    console.error('   Set it via: export OPENROUTER_API_KEY=sk-or-...');
    console.error('   Or copy .env.example to .env and fill in your key');
    process.exit(1); 
}
if (!personaConfig) { 
    console.error('❌ Failed to load persona configuration');
    console.error(`   Checked: SOUL_ID=${SOUL_ID}, GOAL_ID=${GOAL_ID}, TOOL_ID=${TOOL_ID}`);
    console.error('   Verify persona files exist in /personas/ directory');
    process.exit(1); 
}

console.log(`🎭 Loaded persona: ${SOUL_ID} (goal: ${GOAL_ID}, tools: ${TOOL_ID})`);

function loadContextFiles() {
    const d = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const m = path.join(OUTPUT_DIR, '02-music-analysis.md');
    const data = { dialogue: null, music: null };
    
    if (fs.existsSync(d)) {
        const c = fs.readFileSync(d, 'utf8');
        const match = c.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) try { data.dialogue = JSON.parse(match[1]); } catch {}
    }
    if (fs.existsSync(m)) {
        const c = fs.readFileSync(m, 'utf8');
        const match = c.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) try { data.music = JSON.parse(match[1]); } catch {}
    }
    return data;
}

function formatPreviousState(state) {
    if (!state) return '';
    const pd = state.patience >= 8 ? 'still patient, giving it a chance' : 
               state.patience >= 5 ? 'getting impatient' : 'about to scroll';
    const bd = state.boredom <= 2 ? 'not bored' : 
               state.boredom <= 5 ? 'slightly bored' : 
               state.boredom <= 7 ? 'pretty bored' : 'extremely bored';
    const ed = state.excitement >= 8 ? 'very hyped' : 
               state.excitement >= 5 ? 'somewhat interested' : 'not feeling it';
    
    return `**Your Emotional State at ${state.timestamp}s:**

- Patience level: ${state.patience}/10 (${pd})
- Boredom level: ${state.boredom}/10 (${bd})
- Excitement level: ${state.excitement}/10 (${ed})
- What you were thinking: "${state.thought}"

`;
}

function getDialogue(data, s, e) {
    if (!data?.dialogue_segments) return '';
    return data.dialogue_segments.filter(d => {
        const p = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const a = p(d.timestamp_start), b = p(d.timestamp_end);
        return (a >= s && a <= e) || (b >= s && b <= e);
    }).map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n');
}

function getMusic(data, s, e) {
    if (!data?.audio_segments) return '';
    return data.audio_segments.filter(m => {
        const p = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const r = m.timestamp_range.split(' - '), a = p(r[0]), b = p(r[1]);
        return (a >= s && a <= e) || (b >= s && b <= e) || (a <= s && b >= e);
    }).map(m => `[${m.timestamp_range}] ${m.description}`).join('\n');
}

function parsePerSecondJSON(analysis) {
    // Extract JSON
    const match = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || analysis.match(/({[\s\S]*})/);
    if (!match) throw new Error('No JSON found');
    
    const parsed = JSON.parse(match[1] || match[0]);
    
    // Validate per_second_analysis array
    if (!Array.isArray(parsed.per_second_analysis)) {
        throw new Error('Missing per_second_analysis array');
    }
    
    // Validate and normalize each second
    return parsed.per_second_analysis.map(s => ({
        timestamp: Number(s.timestamp),
        visuals: String(s.visuals || '').substring(0, 200),
        patience: Math.max(0, Math.min(10, Math.round(Number(s.patience) || 5))),
        boredom: Math.max(0, Math.min(10, Math.round(Number(s.boredom) || 5))),
        excitement: Math.max(0, Math.min(10, Math.round(Number(s.excitement) || 5))),
        thought: String(s.thought || '').substring(0, 200),
        scroll_risk: ['low', 'medium', 'high', 'SCROLLING'].includes(s.scroll_risk) ? s.scroll_risk : 'medium'
    }));
}

async function getDuration(vp) {
    return new Promise((r) => spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', vp]).stdout.on('data', (d) => r(parseFloat(d.toString().trim()))));
}

async function extractChunk(st, d, op) {
    return new Promise((r, j) => spawn('ffmpeg', ['-ss', String(st), '-i', VIDEO_PATH, '-t', String(d), '-c', 'copy', '-y', op]).on('close', (c) => c === 0 ? r(fs.statSync(op).size / 1024 / 1024) : j()));
}

async function analyzeChunk(chunkPath, start, end, prevState, ctxData) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    let context = '';
    if (prevState) context += formatPreviousState(prevState);
    const dCtx = getDialogue(ctxData.dialogue, start, end);
    const mCtx = getMusic(ctxData.music, start, end);
    if (dCtx) context += `**Dialogue:**\n${dCtx}\n\n`;
    if (mCtx) context += `**Music:**\n${mCtx}\n\n`;
    
    // Build system prompt using persona loader
    const selectedLenses = ['patience', 'boredom', 'excitement'];
    const videoContext = `
Analyze this video chunk from ${start}s to ${end}s. Track emotions EVERY SECOND.

${context}RESPOND ONLY WITH VALID JSON. No other text.`;
    
    const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
        duration: end - start,
        selectedLenses,
        videoContext
    });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [{ type: 'text', text: 'Analyze this video chunk using the persona instructions above. Respond with JSON only.' }, { type: 'video_url', video_url: { url: dataUrl } }] }
            ],
            max_tokens: 4000
        })
    });
    
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const analysis = data.choices[0].message.content;
    
    // Parse strict JSON
    const perSecondData = parsePerSecondJSON(analysis);
    
    return {
        analysis: analysis,
        perSecondData: perSecondData,
        tokens: data.usage?.total_tokens
    };
}

async function main() {
    console.log('Per-Second Analysis (Structured JSON)\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    console.log('Loading context files...');
    const ctxData = loadContextFiles();
    console.log('');
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/persec-');
    const allPerSecondData = [];
    let previousState = null;
    let totalTokens = 0;
    
    for (let i = 0; i < Math.min(numChunks, 3); i++) {
        const cs = i * CHUNK_DURATION;
        const ce = Math.min(cs + CHUNK_DURATION, duration);
        const cp = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i + 1}/3] ${cs}s-${ce}s`);
        
        try {
            const sz = await extractChunk(cs, CHUNK_DURATION, cp);
            console.log(`   Size: ${sz.toFixed(2)} MB`);
            if (sz > 10) { console.log('   Skipping (too large)'); continue; }
            
            const r = await analyzeChunk(cp, cs, ce, previousState, ctxData);
            console.log(`   ✅ ${r.tokens} tokens, ${r.perSecondData.length} seconds parsed`);
            
            totalTokens += r.tokens;
            allPerSecondData.push(...r.perSecondData);
            
            // Set previous state from last second of this chunk
            const last = r.perSecondData[r.perSecondData.length - 1];
            previousState = {
                timestamp: last.timestamp,
                patience: last.patience,
                boredom: last.boredom,
                excitement: last.excitement,
                thought: last.thought
            };
            
        } catch (err) {
            console.log(`   ❌ ${err.message}`);
        }
        
        if (fs.existsSync(cp)) fs.unlinkSync(cp);
    }
    
    fs.rmdirSync(tempDir);
    
    // Save outputs
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.json'), JSON.stringify({
        video: VIDEO_PATH,
        duration,
        contextFilesUsed: { dialogue: !!ctxData.dialogue, music: !!ctxData.music },
        total_seconds: allPerSecondData.length,
        totalTokens,
        per_second_data: allPerSecondData,
        generatedAt: new Date().toISOString()
    }, null, 2));
    
    const csv = 'timestamp,patience,boredom,excitement,scroll_risk,thought\n' + 
        allPerSecondData.map(d => `${d.timestamp},${d.patience},${d.boredom},${d.excitement},"${d.scroll_risk}","${(d.thought||'').replace(/"/g,'\"')}"`).join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.csv'), csv);
    
    console.log(`\n✅ Done!`);
    console.log(`   Seconds: ${allPerSecondData.length}`);
    console.log(`   Tokens: ${totalTokens}`);
    console.log(`   All data is structured JSON with validation`);
}

main().catch(console.error);
