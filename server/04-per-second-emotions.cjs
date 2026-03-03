#!/usr/bin/env node
/**
 * Per-Second Emotion Analysis with STRICT JSON Output
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const CHUNK_DURATION = 8;

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '../output/default');

// Log working directory and resolved paths
console.log(`📁 Working directory: ${process.cwd()}`);
console.log(`📁 Script directory: ${__dirname}`);
console.log(`📁 Resolved video path: ${VIDEO_PATH}`);
console.log(`📁 Resolved output dir: ${OUTPUT_DIR}\n`);

// Load utilities
const logger = require('./lib/logger.cjs');
const utils = require('./lib/api-utils.cjs');
const models = require('./lib/models.cjs');
const personaLoader = require('./lib/persona-loader.cjs');

// Model selection with fallback
const MODEL = models.getModel('video', 0);

// Rate limiting delay (default 1000ms)
const delay = parseInt(process.env.API_REQUEST_DELAY) || 1000;
const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';

const personaConfig = personaLoader.loadPersonaConfig(SOUL_ID, GOAL_ID, TOOL_ID);

if (!API_KEY) { 
    logger.error('OPENROUTER_API_KEY not set. Set via: export OPENROUTER_API_KEY=sk-or-...');
    process.exit(1); 
}
if (!personaConfig) { 
    logger.error(`Failed to load persona configuration. Checked: SOUL_ID=${SOUL_ID}, GOAL_ID=${GOAL_ID}, TOOL_ID=${TOOL_ID}`);
    process.exit(1); 
}

logger.info(`Loaded persona: ${SOUL_ID} (goal: ${GOAL_ID}, tools: ${TOOL_ID})`);

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

function parseTimestamp(t) {
    if (!t) return 0;
    const str = t.toString();
    const parts = str.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(str) || 0;
}

function getDialogue(data, s, e) {
    if (!data?.dialogue_segments) return '';
    return data.dialogue_segments.filter(d => {
        const a = parseTimestamp(d.timestamp_start), b = parseTimestamp(d.timestamp_end);
        return (a >= s && a <= e) || (b >= s && b <= e);
    }).map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n');
}

function getMusic(data, s, e) {
    if (!data?.audio_segments) return '';
    return data.audio_segments.filter(m => {
        // Support both timestamp_range format AND timestamp_start/timestamp_end format
        let timestampStr, start, end;
        
        if (m.timestamp_range && typeof m.timestamp_range === 'string') {
            // Old format: "00:00-00:08"
            timestampStr = m.timestamp_range;
            const r = timestampStr.split('-').map(t => t.trim());
            start = parseTimestamp(r[0]);
            end = parseTimestamp(r[1] || r[0]);
        } else if (m.timestamp_start && m.timestamp_end) {
            // New format: separate fields
            timestampStr = `${m.timestamp_start}-${m.timestamp_end}`;
            start = parseTimestamp(m.timestamp_start);
            end = parseTimestamp(m.timestamp_end);
        } else {
            logger.debug(`Invalid timestamp format in music segment: ${JSON.stringify(m)}`);
            return false; // Skip segments without valid timestamps
        }
        
        return (start >= s && start <= e) || (end >= s && end <= e) || (start <= s && end >= e);
    }).map(m => {
        const ts = m.timestamp_range || `${m.timestamp_start}-${m.timestamp_end}`;
        return `[${ts}] ${m.description}`;
    }).join('\n');
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

    // Rate limiting delay
    await new Promise(r => setTimeout(r, delay));
    
    const res = await utils.fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
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
    }, { maxRetries: 3, baseDelay: 1000 });
    
    const result = await utils.validateJSON(res);
    if (!result.success) {
        console.error('Failed to parse API response:', result.error);
        throw new Error('Invalid JSON response from API');
    }
    
    const data = result.data;
    if (!res.ok) throw new Error(`API ${res.status}`);
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
    logger.info('Starting Per-Second Analysis (Structured JSON)');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    logger.debug('Loading context files...');
    const ctxData = loadContextFiles();
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    logger.info(`Video duration: ${duration.toFixed(1)}s, Total chunks: ${numChunks}`);
    
    const tempDir = fs.mkdtempSync('/tmp/persec-');
    const allPerSecondData = [];
    let previousState = null;
    let totalTokens = 0;
    const startTimeTotal = Date.now();
    const maxChunks = Math.min(numChunks, 3);
    
    for (let i = 0; i < maxChunks; i++) {
        const chunkStartTime = Date.now();
        const cs = i * CHUNK_DURATION;
        const ce = Math.min(cs + CHUNK_DURATION, duration);
        const cp = path.join(tempDir, `chunk-${i}.mp4`);
        
        // Progress indicator
        const progress = ((i + 1) / maxChunks * 100).toFixed(1);
        const elapsedTotal = ((Date.now() - startTimeTotal) / 1000).toFixed(0);
        const avgTimePerChunk = elapsedTotal / (i + 1);
        const remainingChunks = maxChunks - (i + 1);
        const eta = (avgTimePerChunk * remainingChunks / 60).toFixed(1);
        
        logger.info(`Progress: ${i + 1}/${maxChunks} (${progress}%) - ETA: ${eta}m`);
        logger.info(`Chunk ${i + 1}: ${cs}s-${ce}s`);
        
        try {
            const sz = await extractChunk(cs, CHUNK_DURATION, cp);
            logger.debug(`Chunk ${i + 1} extracted: ${sz.toFixed(2)} MB in ${((Date.now() - chunkStartTime) / 1000).toFixed(1)}s`);
            if (sz > 10) { 
                logger.warn(`Chunk ${i + 1}: Skipping (too large: ${sz.toFixed(2)} MB)`);
                continue; 
            }
            
            const analyzeStart = Date.now();
            const r = await analyzeChunk(cp, cs, ce, previousState, ctxData);
            logger.info(`Chunk ${i + 1}: Complete - ${r.tokens} tokens, ${r.perSecondData.length} seconds parsed in ${((Date.now() - analyzeStart) / 1000).toFixed(1)}s`);
            
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
            logger.error(`Chunk ${i + 1}: Error - ${err.message}`);
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
    
    const totalTime = ((Date.now() - startTimeTotal) / 1000).toFixed(1);
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('PER-SECOND ANALYSIS COMPLETE');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`Total seconds: ${allPerSecondData.length}`);
    logger.info(`Total tokens: ${totalTokens}`);
    logger.info(`Total time: ${totalTime}s`);
    logger.info('All data is structured JSON with validation');
    logger.info('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
