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

// Load persona configuration (user can override via env vars)
const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';

const personaConfig = personaLoader.loadPersonaConfig(SOUL_ID, GOAL_ID, TOOL_ID);

if (!personaConfig) {
    console.error('❌ Failed to load persona configuration');
    process.exit(1);
}

console.log(`🎭 Loaded persona: ${SOUL_ID} (goal: ${GOAL_ID}, tools: ${TOOL_ID})`);

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

// Load context files from steps 1 & 2
function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    
    let dialogueData = null;
    let musicData = null;
    
    if (fs.existsSync(dialoguePath)) {
        console.log('   📚 Loading dialogue context...');
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                dialogueData = JSON.parse(jsonMatch[1]);
                console.log(`      ✓ ${dialogueData.dialogue_segments?.length || 0} dialogue segments`);
            } catch (e) {
                console.log('      ⚠️  Failed to parse dialogue JSON');
            }
        }
    } else {
        console.log('   ⚠️  No dialogue file found (run step 1 first)');
    }
    
    if (fs.existsSync(musicPath)) {
        console.log('   📚 Loading music context...');
        const content = fs.readFileSync(musicPath, 'utf8');
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                musicData = JSON.parse(jsonMatch[1]);
                console.log(`      ✓ ${musicData.audio_segments?.length || 0} music segments`);
            } catch (e) {
                console.log('      ⚠️  Failed to parse music JSON');
            }
        }
    } else {
        console.log('   ⚠️  No music file found (run step 2 first)');
    }
    
    return { dialogueData, musicData };
}

// Extract relevant dialogue for timestamp range
function getRelevantDialogue(dialogueData, startTime, endTime) {
    if (!dialogueData?.dialogue_segments) return '';
    
    const relevant = dialogueData.dialogue_segments.filter(d => {
        // Parse timestamp like "00:07" to seconds
        const parseTime = (t) => {
            const parts = t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        const segStart = parseTime(d.timestamp_start);
        const segEnd = parseTime(d.timestamp_end);
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
        // Parse timestamp range like "00:28 - 00:42"
        const parseRange = (range) => {
            const times = range.split(' - ');
            return {
                start: parseInt(times[0].split(':')[0]) * 60 + parseInt(times[0].split(':')[1]),
                end: parseInt(times[1].split(':')[0]) * 60 + parseInt(times[1].split(':')[1])
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
    
    const prompt = personaLoader.buildSystemPrompt(personaConfig, {
        duration: endTime - startTime,
        selectedLenses,
        videoContext
    });

    console.log('   Sending to Qwen (with persona context)...');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
            max_tokens: 2000
        })
    });
    
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return { analysis: data.choices[0].message.content, tokens: data.usage?.total_tokens };
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  Step 3: Chunked Video Analysis WITH Context             ║');
    console.log('║  Uses: Dialogue + Music + Memory + Persona             ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Load context files
    const { dialogueData, musicData } = loadContextFiles();
    
    const duration = await getDuration(VIDEO_PATH);
    const numChunks = Math.ceil(duration / CHUNK_DURATION);
    console.log(`\n🎬 Video: ${duration.toFixed(1)}s → ${numChunks} chunks\n`);
    
    const tempDir = fs.mkdtempSync('/tmp/chunks-ctx-');
    const results = [];
    let previousSummary = '';
    
    // Process chunks (limit for testing)
    const maxChunks = process.env.MAX_CHUNKS ? parseInt(process.env.MAX_CHUNKS) : 4;
    
    for (let i = 0; i < numChunks && i < maxChunks; i++) {
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min(startTime + CHUNK_DURATION, duration);
        const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);
        
        console.log(`[${i + 1}/${Math.min(numChunks, maxChunks)}] ${startTime}s-${endTime}s`);
        
        try {
            const sizeMB = await extractChunk(startTime, CHUNK_DURATION, chunkPath);
            console.log(`   File size: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 10) {
                console.log('   ⚠️  Chunk too large (>10MB), skipping');
                continue;
            }
            
            // Get context for this timestamp range
            const dialogueContext = getRelevantDialogue(dialogueData, startTime, endTime);
            const musicContext = getRelevantMusic(musicData, startTime, endTime);
            
            if (dialogueContext) {
                console.log(`   🗣️  ${dialogueContext.split('\n').length} dialogue lines in range`);
            }
            if (musicContext) {
                console.log(`   🎵 ${musicContext.split('\n').length} music segments in range`);
            }
            
            // Analyze with full context
            const result = await analyzeChunkWithContext(
                chunkPath, i, Math.min(numChunks, maxChunks), startTime, endTime,
                { previousSummary, dialogueContext, musicContext }
            );
            
            console.log(`   ✅ ${result.tokens} tokens`);
            
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
            console.log(`   ❌ Error: ${err.message}`);
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
    
    console.log('\n' + '═'.repeat(60));
    console.log('  ✅ ANALYSIS COMPLETE');
    console.log('═'.repeat(60));
    console.log(`   Chunks: ${results.length}`);
    console.log(`   Total tokens: ${output.totalTokens.toLocaleString()}`);
    console.log(`   Context loaded:`);
    console.log(`      • Dialogue: ${output.contextFiles.dialogueSegments} segments`);
    console.log(`      • Music: ${output.contextFiles.musicSegments} segments`);
    console.log(`   Output: ${outPath}`);
    console.log('═'.repeat(60) + '\n');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
