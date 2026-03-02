#!/usr/bin/env node
/**
 * Step 3: Chunked Video Analysis with STRUCTURED JSON
 * Ensures consistent previous state formatting
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'qwen/qwen3.5-122b-a10b';
const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv[3] || './analysis-output';
const CHUNK_DURATION = 8;

const PERSONA = { 
    name: 'The Impatient Teenager', 
    description: '17yo Gen Z, 200+ TikToks/day, scrolls if bored',
    traits: ['zero patience', 'authentic', 'brutally honest']
};

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

// Load context files
function loadContextFiles() {
    const dialoguePath = path.join(OUTPUT_DIR, '01-dialogue-analysis.md');
    const musicPath = path.join(OUTPUT_DIR, '02-music-analysis.md');
    const data = { dialogue: null, music: null };
    
    if (fs.existsSync(dialoguePath)) {
        const content = fs.readFileSync(dialoguePath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.dialogue = JSON.parse(match[1]); } catch {} }
    }
    if (fs.existsSync(musicPath)) {
        const content = fs.readFileSync(musicPath, 'utf8');
        const match = content.match(/```json\s*\n([\s\S]*?)\n```/);
        if (match) { try { data.music = JSON.parse(match[1]); } catch {} }
    }
    return data;
}

// Get dialogue/music for time range
function getDialogueForTime(data, start, end) {
    if (!data?.dialogue_segments) return '';
    const relevant = data.dialogue_segments.filter(d => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const s = parse(d.timestamp_start), e = parse(d.timestamp_end);
        return (s >= start && s <= end) || (e >= start && e <= end);
    });
    return relevant.map(d => `[${d.timestamp_start}] ${d.speaker}: "${d.text}"`).join('\n');
}

function getMusicForTime(data, start, end) {
    if (!data?.audio_segments) return '';
    return data.audio_segments.filter(m => {
        const parse = (t) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const range = m.timestamp_range.split(' - ');
        const s = parse(range[0]), e = parse(range[1]);
        return (s >= start && s <= end) || (e >= start && e <= end) || (s <= start && e >= end);
    }).map(m => `[${m.timestamp_range}] ${m.description}`).join('\n');
}

// Format previous state CONSISTENTLY - same structure every time
function formatPreviousState(state) {
    if (!state) return '';
    
    const patienceDesc = state.patience >= 8 ? 'still patient, giving it a chance' : 
                         state.patience >= 5 ? 'getting impatient' : 'about to scroll';
    const boredomDesc = state.boredom <= 2 ? 'not bored' : 
                        state.boredom <= 5 ? 'slightly bored' : 
                        state.boredom <= 7 ? 'pretty bored' : 'extremely bored';
    const excitementDesc = state.excitement >= 8 ? 'very hyped' : 
                           state.excitement >= 5 ? 'somewhat interested' : 'not feeling it';
    
    return `**Your Emotional State at ${state.timestamp}s:**

- Patience level: ${state.patience}/10 (${patienceDesc})
- Boredom level: ${state.boredom}/10 (${boredomDesc})
- Excitement level: ${state.excitement}/10 (${excitementDesc})
- What you were thinking: "${state.thought}"
`;
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

// Extract structured data from AI response
function extractStructuredData(analysis, timestamp) {
    // Try to parse JSON first
    try {
        const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || analysis.match(/{[\s\S]*}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (parsed.patience && parsed.boredom && parsed.excitement) {
                return {
                    timestamp: timestamp,
                    patience: parseInt(parsed.patience) || 5,
                    boredom: parseInt(parsed.boredom) || 5,
                    excitement: parseInt(parsed.excitement) || 5,
                    thought: parsed.thought || parsed.summary || 'continuing...'
                };
            }
        }
    } catch (e) {
        // Fallback to regex
    }
    
    // Fallback regex extraction
    const p = analysis.match(/patience[