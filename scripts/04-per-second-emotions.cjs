#!/usr/bin/env node
// Per-Second WITH explicit emotional state descriptions
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const API_KEY = process.env.OPENROUTER_API_KEY, MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4', OUTPUT_DIR = process.argv[3] || './analysis-output';
const CHUNK_DURATION = 8, PERSONA = { name: 'The Impatient Teenager', description: '17yo Gen Z, scrolls if bored' };

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

function loadContextFiles() {
    const d = path.join(OUTPUT_DIR, '01-dialogue-analysis.md'), m = path.join(OUTPUT_DIR, '02-music-analysis.md');
    const data = { dialogue: null, music: null };
    if (fs.existsSync(d)) { const c = fs.readFileSync(d, 'utf8'), m = c.match(/```json\s*\n([\s\S]*?)\n```/); if (m) try { data.dialogue = JSON.parse(m[1]); } catch {} }
    if (fs.existsSync(m)) { const c = fs.readFileSync(m, 'utf8'), m = c.match(/```json\s*\n([\s\S]*?)\n```/); if (m) try { data.music = JSON.parse(m[1]); } catch {} }
    return data;
}

function formatPreviousState(state) {
    if (!state) return '';
    const pd = state.patience >= 8 ? 'still patient, giving it a chance' : state.patience >= 5 ? 'getting impatient' : 'about to scroll';
    const bd = state.boredom <= 2 ? 'not bored' : state.boredom <= 5 ? 'slightly bored' : state.boredom <= 7 ? 'pretty bored' : 'extremely bored';
    const ed = state.excitement >= 8 ? 'very hyped' : state.excitement >= 5 ? 'somewhat interested' : 'not feeling it';
    return `**How you felt at ${state.timestamp}s:**\n- Patience level: ${state.patience}/10 (${pd})\n- Boredom level: ${state.boredom}/10 (${bd})\n- Excitement level: ${state.excitement}/10 (${ed})\n- What you were thinking: "${state.thought}"\n\n`;
}

async function getDuration(vp) { return new Promise((r) => spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', vp]).stdout.on('data', (d) => r(parseFloat(d.toString().trim()))); }
async function extractChunk(st, d, op) { return new Promise((r, j) => spawn('ffmpeg', ['-ss', String(st), '-i', VIDEO_PATH, '-t', String(d), '-c', 'copy', '-y', op]).on('close', (c) => c === 0 ? r(fs.statSync(op).size / 1024 / 1024) : j())); }

function getDialogue(data, s, e) { if (!data?.dialogue_segments) return ''; return data.dialogue_segments.filter(d => { const p = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]); const a = p(d.timestamp_start), b = p(d.timestamp_end); return (a >= s && a <= e) || (b >= s && b <= e); }).map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n'); }
function getMusic(data, s, e) { if (!data?.audio_segments) return ''; return data.audio_segments.filter(m => { const p = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]); const r = m.timestamp_range.split(' - '), a = p(r[0]), b = p(r[1]); return (a >= s && a <= e) || (b >= s && b <= e) || (a <= s && b >= e); }).map(m => `[${m.timestamp_range}] ${m.description}`).join('\n'); }

async function analyzeChunk(chunkPath, start, end, prevState, ctxData) {
    const buf = fs.readFileSync(chunkPath), dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    let context = '';
    if (prevState) context += formatPreviousState(prevState);
    const dCtx = getDialogue(ctxData.dialogue, start, end), mCtx = getMusic(ctxData.music, start, end);
    if (dCtx) context += `**Dialogue:**\n${dCtx}\n\n`;
    if (mCtx) context += `**Music:**\n${mCtx}\n\n`;
    
    const prompt = `You are ${PERSONA.name}, ${PERSONA.description}. Track emotions EVERY SECOND for ${start}s-${end}s.\n\n${context}JSON format with per_second_analysis array. Be brutally honest. Gen Z voice.`;
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }], max_tokens: 4000 }) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    console.log('Per-Second Analysis WITH Explicit Context\n');
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Loading context files...');
    const ctxData = loadContextFiles(); console.log('');
    const duration = await getDuration(VIDEO_PATH), numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/persec-'), perSecondData = [];
    let previousState = null, totalTokens = 0;
    
    for (let i = 0; i < Math.min(numChunks, 3); i++) {
        const cs = i * CHUNK_DURATION, ce = Math.min(cs + CHUNK_DURATION, duration), cp = path.join(tempDir, `chunk-${i}.mp4`);
        console.log(`[${i + 1}/3] ${cs}s-${ce}s`);
        try {
            const sz = await extractChunk(cs, CHUNK_DURATION, cp);
            console.log(`   Size: ${sz.toFixed(2)} MB`);
            if (sz > 10) { console.log('   Skipping'); continue; }
            const r = await analyzeChunk(cp, cs, ce, previousState, ctxData);
            console.log(`   ✅ ${r.tokens} tokens`);
            totalTokens += r.tokens;
            let parsed;
            try { const m = r.analysis.match(/```json\s*\n([\s\S]*?)\n```/) || r.analysis.match(/{[\s\S]*}/); parsed = JSON.parse(m ? (m[1] || m[0]) : r.analysis); } catch (e) { console.log('   Parse error'); continue; }
            if (parsed.per_second_analysis) {
                perSecondData.push(...parsed.per_second_analysis);
                const last = parsed.per_second_analysis[parsed.per_second_analysis.length - 1];
                previousState = { timestamp: last.timestamp, patience: last.patience, boredom: last.boredom, excitement: last.excitement, thought: last.thought };
            }
        } catch (err) { console.log(`   ❌ ${err.message}`); }
        if (fs.existsSync(cp)) fs.unlinkSync(cp);
    }
    fs.rmdirSync(tempDir);
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.json'), JSON.stringify({ video: VIDEO_PATH, duration, contextFilesUsed: { dialogue: !!ctxData.dialogue, music: !!ctxData.music }, total_seconds: perSecondData.length, totalTokens, per_second_data: perSecondData, generatedAt: new Date().toISOString() }, null, 2));
    const csv = 'timestamp,patience,boredom,excitement,scroll_risk,thought\n' + perSecondData.map(d => `${d.timestamp},${d.patience},${d.boredom},${d.excitement},"${d.scroll_risk}","${(d.thought||'').replace(/"/g,'\"')}"`).join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, '04-per-second-emotions.csv'), csv);
    console.log(`\n✅ Done! Seconds: ${perSecondData.length}, Tokens: ${totalTokens}`);
}

main().catch(console.error);
