#!/usr/bin/env node
/**
 * Step 3: Chunked Video Analysis WITH Context
 * 
 * NOW ACTUALLY USES:
 * - Dialogue context from 01-dialogue-analysis.md
 * - Music context from 02-music-analysis.md
 * - Previous chunk summary (memory)
 * - Persona definition
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;

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
const videoUtils = require('./lib/video-utils.cjs');

// Quality presets
const QUALITY_PRESETS = {
    low: { maxDuration: 4, targetSize: 4 * 1024 * 1024 },
    medium: { maxDuration: 8, targetSize: 8 * 1024 * 1024 },
    high: { maxDuration: 12, targetSize: 9 * 1024 * 1024 }
};

const CHUNK_QUALITY = process.env.CHUNK_QUALITY || 'medium';
const CHUNK_DURATION = QUALITY_PRESETS[CHUNK_QUALITY]?.maxDuration || 8;
const TARGET_SIZE = QUALITY_PRESETS[CHUNK_QUALITY]?.targetSize || 8 * 1024 * 1024;

// Model selection with fallback
const MODEL = models.getModel('video', 0);

// Rate limiting delay (default 1000ms)
const delay = parseInt(process.env.API_REQUEST_DELAY) || 1000;

// Load persona configuration (user can override via env vars)
const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';

const personaConfig = personaLoader.loadPersonaConfig(SOUL_ID, GOAL_ID, TOOL_ID);

if (!personaConfig) {
    logger.error('Failed to load persona configuration');
    process.exit(1);
}

logger.info(`Loaded persona: ${SOUL_ID} (goal: ${GOAL_ID}, tools: ${TOOL_ID})`);

if (!API_KEY) { 
    logger.error('OPENROUTER_API_KEY not set. Set via: export OPENROUTER_API_KEY=sk-or-...');
    process.exit(1); 
}

// Hardened timestamp parsing (supports MM:SS, H:MM:SS, SS.mmm, SS)
function parseTimestamp(t) {
    if (!t) return 0;
    const str = t.toString();
    const parts = str.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(str) || 0;
}

// Load context files from steps 1 & 2
function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    
    let dialogueData = null;
    let musicData = null;
    
    if (fs.existsSync(dialoguePath)) {
        logger.debug('Loading dialogue context...');
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                dialogueData = JSON.parse(jsonMatch[1]);
                logger.debug(`Loaded ${dialogueData.dialogue_segments?.length || 0} dialogue segments`);
            } catch (e) {
                logger.warn('Failed to parse dialogue JSON');
            }
        }
    } else {
        logger.warn('No dialogue file found (run step 1 first)');
    }
    
    if (fs.existsSync(musicPath)) {
        logger.debug('Loading music context...');
        const content = fs.readFileSync(musicPath, 'utf8');
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                musicData = JSON.parse(jsonMatch[1]);
                logger.debug(`Loaded ${musicData.audio_segments?.length || 0} music segments`);
            } catch (e) {
                logger.warn('Failed to parse music JSON');
            }
        }
    } else {
        logger.warn('No music file found (run step 2 first)');
    }
    
    return { dialogueData, musicData };
}

// Extract relevant dialogue for timestamp range
function getRelevantDialogue(dialogueData, startTime, endTime) {
    if (!dialogueData?.dialogue_segments) return '';
    
    const relevant = dialogueData.dialogue_segments.filter(d => {
        const segStart = parseTimestamp(d.timestamp_start);
        const segEnd = parseTimestamp(d.timestamp_end);
        return (segStart >= startTime && segStart <= endTime) ||
               (segEnd >= startTime && segEnd <= endTime) ||
               (segStart <= startTime && segEnd >= endTime);
    });
    
    if (relevant.length === 0) return '';
    
    return relevant.map(d => 
        `[${d.timestamp_start}] ${d.speaker} (${d.emotion}): "${d.text}"`
    ).join('\n');
}

// Extract relevant music for timestamp range
function getRelevantMusic(musicData, startTime, endTime) {
    if (!musicData?.audio_segments) return '';
    
    const relevant = musicData.audio_segments.filter(m => {
        // Parse timestamp range like "00:28 - 00:42" or "0:28-0:42"
        const parseRange = (range) => {
            // Defensive check: ensure range is a string before splitting
            if (!range || typeof range !== 'string') {
                logger.debug(`Invalid timestamp_range: ${JSON.stringify(range)}`);
                return { start: -1, end: -1 }; // Invalid range won't match
            }
            const times = range.split('-').map(t => t.trim());
            return {
                start: parseTimestamp(times[0]),
                end: parseTimestamp(times[1] || times[0])
            };
        };
        const range = parseRange(m.timestamp_range);
        return (range.start >= startTime && range.start <= endTime) ||
               (range.end >= startTime && range.end <= endTime) ||
               (range.start <= startTime && range.end >= endTime);
    });
    
    if (relevant.length === 0) return '';
    
    return relevant.map(m => 
        `[${m.timestamp_range}] ${m.description} (${m.mood})`
    ).join('\n');
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
            .on('close', (c) => {
                if (c !== 0) return reject(new Error('FFmpeg failed'));
                resolve(fs.statSync(outputPath).size / 1024 / 1024);
            });
    });
}

async function analyzeChunkWithContext(chunkPath, index, total, startTime, endTime, context) {
    const buf = fs.readFileSync(chunkPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    // Build system prompt using persona loader
    const selectedLenses = ['patience', 'boredom', 'excitement'];
    const videoContext = `
Analyzing chunk ${index + 1}/${total} (${startTime}s-${endTime}s).

${context.previousSummary ? `**Previous Emotional State:**\n${context.previousSummary}\n` : ''}
${context.dialogueContext ? `**What You're Hearing (Dialogue):**\n${context.dialogueContext}\n` : ''}
${context.musicContext ? `**What You're Hearing (Music/Audio):**\n${context.musicContext}\n` : ''}
`;
    
    const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
        duration: endTime - startTime,
        selectedLenses,
        videoContext
    });

    logger.debug(`Sending chunk ${index + 1} to Qwen (with persona context)`);
    
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
            max_tokens: 2000
        })
    }, { maxRetries: 3, baseDelay: 1000 });
    
    const result = await utils.validateJSON(res);
    if (!result.success) {
        console.error('Failed to parse API response:', result.error);
        throw new Error('Invalid JSON response from API');
    }
    
    const data = result.data;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    logger.info('Starting Step 3: Chunked Video Analysis WITH Context');
    logger.info('Uses: Dialogue + Music + Memory + Persona');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Load context files
    const { dialogueData, musicData } = loadContextFiles();
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    logger.info(`Video duration: ${duration.toFixed(1)}s, Total chunks: ${numChunks}`);
    
    const tempDir = fs.mkdtempSync('/tmp/chunks-ctx-');
    const results = [];
    let previousSummary = '';
    
    // Process chunks (limit for testing)
    const maxChunks = process.env.MAX_CHUNKS ? parseInt(process.env.MAX_CHUNKS) : 4;
    const startTimeTotal = Date.now();
    
    for (let i = 0; i < numChunks && i < maxChunks; i++) {
        const chunkStartTime = Date.now();
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min(startTime + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        // Progress indicator
        const progress = ((i + 1) / Math.min(numChunks, maxChunks) * 100).toFixed(1);
        const elapsedTotal = ((Date.now() - startTimeTotal) / 1000).toFixed(0);
        const avgTimePerChunk = elapsedTotal / (i + 1);
        const remainingChunks = Math.min(numChunks, maxChunks) - (i + 1);
        const eta = (avgTimePerChunk * remainingChunks / 60).toFixed(1);
        
        logger.info(`Progress: ${i + 1}/${Math.min(numChunks, maxChunks)} (${progress}%) - ETA: ${eta}m`);
        logger.info(`Chunk ${i + 1}: ${startTime}s-${endTime}s | Size: pending`);
        
        try {
            const sizeMB = await extractChunk(startTime, CHUNK_DURATION, chunkPath);
            logger.debug(`Chunk ${i + 1} extracted: ${sizeMB.toFixed(2)} MB in ${((Date.now() - chunkStartTime) / 1000).toFixed(1)}s`);
            
            // Compress if over target size (never skip)
            let finalChunkPath = chunkPath;
            if (sizeMB * 1024 * 1024 > TARGET_SIZE) {
                logger.info(`Chunk ${i + 1}: Compressing (target: ${(TARGET_SIZE / 1024 / 1024).toFixed(1)} MB)`);
                const compressedPath = path.join(tempDir, `chunk-${i}-compressed.mp4`);
                const result = await videoUtils.compressChunk(chunkPath, compressedPath, TARGET_SIZE);
                if (result.success) {
                    logger.info(`Chunk ${i + 1}: Compressed ${(result.originalSize / 1024 / 1024).toFixed(2)} MB → ${(result.compressedSize / 1024 / 1024).toFixed(2)} MB (${Math.round(result.compressedSize / result.originalSize * 100)}%)`);
                    finalChunkPath = compressedPath;
                } else {
                    logger.warn(`Chunk ${i + 1}: Compression failed, using original`);
                }
            }
            
            // Get context for this timestamp range
            const dialogueContext = getRelevantDialogue(dialogueData, startTime, endTime);
            const musicContext = getRelevantMusic(musicData, startTime, endTime);
            
            if (dialogueContext) {
                logger.debug(`Chunk ${i + 1}: ${dialogueContext.split('\n').length} dialogue lines in range`);
            }
            if (musicContext) {
                logger.debug(`Chunk ${i + 1}: ${musicContext.split('\n').length} music segments in range`);
            }
            
            // Analyze with full context
            const analyzeStart = Date.now();
            logger.info(`Chunk ${i + 1}: Sending to API (model: ${MODEL})...`);
            const result = await analyzeChunkWithContext(
                finalChunkPath, i, Math.min(numChunks, maxChunks), startTime, endTime,
                { previousSummary, dialogueContext, musicContext }
            );
            
            logger.info(`Chunk ${i + 1}: Complete - ${result.tokens} tokens in ${((Date.now() - analyzeStart) / 1000).toFixed(1)}s`);
            
            // Extract summary for next chunk
            const summaryMatch = result.analysis.match(/"summary"\s*:\s*"([^"]+)"/) ||
                               result.analysis.match(/summary["']?\s*[:\-]?\s*"([^"]+)"/);
            previousSummary = summaryMatch ? summaryMatch[1] : result.analysis.substring(0, 150);
            
            results.push({
                chunkIndex: i,
                startTime,
                endTime,
                analysis: result.analysis,
                tokens: result.tokens,
                contextUsed: {
                    dialogueLines: dialogueContext ? dialogueContext.split('\n').length : 0,
                    musicSegments: musicContext ? musicContext.split('\n').length : 0
                }
            });
            
        } catch (err) {
            logger.error(`Chunk ${i + 1}: Error - ${err.message}`);
        }
        
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    
    fs.rmdirSync(tempDir);
    
    const output = {
        video: VIDEO_PATH,
        duration,
        persona: {
            id: SOUL_ID,
            goal: GOAL_ID,
            tools: TOOL_ID,
            config: personaConfig
        },
        contextFiles: {
            dialogueLoaded: !!dialogueData,
            musicLoaded: !!musicData,
            dialogueSegments: dialogueData?.dialogue_segments?.length || 0,
            musicSegments: musicData?.audio_segments?.length || 0
        },
        chunks: results,
        totalTokens: results.reduce((a, r) => a + r.tokens, 0),
        generatedAt: new Date().toISOString()
    };
    
    const outPath = path.join(OUTPUT_DIR, '03-chunked-analysis.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    
    const totalTime = ((Date.now() - startTimeTotal) / 1000).toFixed(1);
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('ANALYSIS COMPLETE');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`Chunks processed: ${results.length}`);
    logger.info(`Total tokens: ${output.totalTokens.toLocaleString()}`);
    logger.info(`Total time: ${totalTime}s`);
    logger.info(`Context loaded: Dialogue=${output.contextFiles.dialogueSegments} segments, Music=${output.contextFiles.musicSegments} segments`);
    logger.info(`Output: ${outPath}`);
    logger.info('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
