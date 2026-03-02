#!/usr/bin/env node
/**
 * Extract Key Events for Emotion Analysis v3.0
 * Multi-modal Scene + Dialogue + Audio + Action Detection
 * 
 * Usage: node extract-narrative-events.cjs <video-path> [options]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const videoPath = args[0] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = args.includes('--output-dir') 
    ? args[args.indexOf('--output-dir') + 1]
    : './narrative-frames';

const MAX_DURATION = parseFloat(process.env.MAX_DURATION || '30');
const SCENE_THRESHOLD = 0.30;  // Lower to catch more
const MAX_INTERVAL = 5;        // Force extract every 5s max

// Event storage
let events = [];

async function getDuration(videoPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);
        let output = '';
        ffprobe.stdout.on('data', d => output += d);
        ffprobe.on('close', c => c === 0 ? resolve(parseFloat(output.trim())) : reject());
    });
}

// 1. Scene Cut Detection
async function detectScenes(videoPath) {
    console.log('   [1/4] Scene cuts (FFmpeg)...');
    const results = [];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(MAX_DURATION),
            '-vf', `select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            const match = line.match(/pts_time:([0-9.]+)/);
            if (match) {
                const t = parseFloat(match[1]);
                if (t <= MAX_DURATION) {
                    results.push({ time: t, type: 'scene', source: 'scene' });
                }
            }
        });

        ffmpeg.on('close', () => {
            // Deduplicate
            const unique = [];
            for (const r of results) {
                if (!unique.some(u => Math.abs(u.time - r.time) < 0.4)) {
                    unique.push(r);
                }
            }
            console.log(`         ${unique.length} detected`);
            resolve(unique);
        });
    });
}

// 2. Audio Energy Detection (finds dialogue, explosions, music drops)
async function detectAudio(videoPath) {
    console.log('   [2/4] Audio energy spikes (FFmpeg)...');
    const results = [];
    const tempDir = fs.mkdtempSync('/tmp/audio-detect-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    // Extract audio
    await new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(MAX_DURATION),
            '-vn', '-acodec', 'pcm_s16le',
            '-ar', '16000', '-ac', '1',
            '-y', audioPath
        ]);
        ffmpeg.on('close', resolve);
    });

    // Analyze volume over time
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', audioPath,
            '-af', 'volumedetect,astats=metadata=1:reset=1',
            '-f', 'null', '-'
        ]);

        let maxVolume = -100;
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            const volMatch = line.match(/max_volume: ([-\d.]+) dB/);
            if (volMatch) {
                maxVolume = Math.max(maxVolume, parseFloat(volMatch[1]));
            }
        });

        ffmpeg.on('close', () => {
            fs.rmSync(tempDir, { recursive: true, force: true });
            
            // Use silencedetect to find transitions (speech/dialogue)
            detectSilenceTransitions(videoPath, maxVolume).then(resolve);
        });
    });
}

// Helper: Find silence→sound transitions (dialogue starts)
async function detectSilenceTransitions(videoPath, maxVolume) {
    const results = [];
    const silenceThreshold = maxVolume - 10;  // 10dB below peak
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(MAX_DURATION),
            '-af', `silencedetect=noise=${silenceThreshold}dB:d=0.5`,
            '-f', 'null', '-'
        ]);

        let lastSilenceEnd = 0;
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            
            // Silence ends = sound starts
            const endMatch = line.match(/silence_end: ([0-9.]+)/);
            if (endMatch) {
                const t = parseFloat(endMatch[1]);
                if (t <= MAX_DURATION && t - lastSilenceEnd > 1.5) {
                    results.push({ time: t, type: 'audio', source: 'audio' });
                    lastSilenceEnd = t;
                }
            }
        });

        ffmpeg.on('close', () => {
            console.log(`         ${results.length} detected`);
            resolve(results);
        });
    });
}

// 3. Text/Titling Detection (sample frames, detect significant visual changes)
async function detectText(videoPath) {
    console.log('   [3/4] Text/title detection (heuristic)...');
    const results = [];
    const tempDir = fs.mkdtempSync('/tmp/text-detect-');
    
    // Sample frames every 0.3s
    const interval = 0.3;
    const samples = [];
    for (let t = 0; t < MAX_DURATION; t += interval) {
        samples.push(t);
    }
    
    // Extract frames
    for (let i = 0; i < samples.length; i++) {
        await new Promise((resolve) => {
            const ffmpeg = spawn('ffmpeg', [
                '-ss', String(samples[i]),
                '-i', videoPath,
                '-vframes', '1',
                '-vf', 'scale=320:-1',
                '-q:v', '5',
                '-y',
                path.join(tempDir, `frame-${i}.jpg`)
            ]);
            ffmpeg.on('close', resolve);
        });
    }
    
    // Analyze: detect size changes (indicates new content)
    let prevSize = 0;
    let prevTime = 0;
    
    for (let i = 0; i < samples.length; i++) {
        const framePath = path.join(tempDir, `frame-${i}.jpg`);
        if (!fs.existsSync(framePath)) continue;
        
        const stats = fs.statSync(framePath);
        const size = stats.size;
        const time = samples[i];
        
        if (i > 0 && prevSize > 0) {
            const change = Math.abs(size - prevSize) / prevSize;
            
            // Significant change = possible new content/text
            if (change > 0.20 && time - prevTime > 0.5) {
                results.push({ 
                    time: time, 
                    type: 'text', 
                    source: 'text',
                    confidence: change 
                });
                prevTime = time;
            }
        }
        
        prevSize = size;
        fs.unlinkSync(framePath);
    }
    
    fs.rmdirSync(tempDir);
    console.log(`         ${results.length} detected`);
    return results;
}

// 4. Motion/Action Detection (optical flow magnitude)
async function detectMotion(videoPath) {
    console.log('   [4/4] Motion analysis...');
    console.log('         (Skipping - requires OpenCV)');
    return [];  // Placeholder for OpenCV integration
}

// Merge and deduplicate all events
function mergeEvents(allEvents) {
    // Flatten
    const flat = allEvents.flat();
    
    // Sort by time
    flat.sort((a, b) => a.time - b.time);
    
    // Deduplicate with 0.4s window
    const unique = [];
    for (const e of flat) {
        if (!unique.some(u => Math.abs(u.time - e.time) < 0.4)) {
            unique.push(e);
        }
    }
    
    return unique;
}

// Add safety net frames (force