#!/usr/bin/env node
/**
 * Extract Key Events — FFmpeg-based Scene + Audio Detection
 * No external Python dependencies
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = process.argv[2];
if (!VIDEO_PATH) {
    console.log('Usage: node extract-key-events-simple.cjs <video-path>');
    process.exit(1);
}

const OUTPUT_DIR = './frames';
const MAX_INTERVAL = 3;

async function getDuration(videoPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);
        let output = '';
        ffprobe.stdout.on('data', (data) => output += data.toString());
        ffprobe.on('close', (code) => {
            if (code === 0) resolve(parseFloat(output.trim()));
            else reject(new Error('Failed'));
        });
    });
}

async function detectScenesFFmpeg(videoPath) {
    console.log('   🎞️  Scene detection (FFmpeg)...');
    const events = [];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-vf', 'select=gt(scene\\,0.3),showinfo',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            const match = line.match(/pts_time:([0-9.]+)/);
            if (match) {
                const t = parseFloat(match[1]);
                events.push({ time: t, type: 'scene', desc: 'Scene cut' });
            }
        });

        ffmpeg.on('close', () => {
            // Remove duplicates (FFmpeg outputs multiple times)
            const unique = [];
            for (const e of events) {
                if (!unique.some(u => Math.abs(u.time - e.time) < 0.5)) {
                    unique.push(e);
                }
            }
            console.log(`      Found ${unique.length} scene cuts`);
            resolve(unique);
        });
    });
}

async function detectAudioEvents(videoPath) {
    console.log('   🎤 Audio level detection (FFmpeg)...');
    const events = [];
    
    return new Promise((resolve) => {
        // Detect silences - transitions from silence to sound indicate speech/dialogue
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-af', 'silencedetect=noise=-40dB:d=0.3',
            '-f', 'null', '-'
        ]);

        let lastSilenceEnd = 0;
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            
            // Silence end = sound starts (potential dialogue)
            const silenceEnd = line.match(/silence_end: ([0-9.]+)/);
            if (silenceEnd) {
                const t = parseFloat(silenceEnd[1]);
                if (t - lastSilenceEnd > 1) {  // At least 1s gap
                    events.push({ time: t, type: 'audio', desc: 'Sound/dialogue starts' });
                    lastSilenceEnd = t;
                }
            }
        });

        ffmpeg.on('close', () => {
            console.log(`      Found ${events.length} audio events`);
            resolve(events);
        });
    });
}

async function extractFrame(videoPath, timestamp, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-ss', String(timestamp), '-i', videoPath,
            '-vframes', '1', '-vf', 'scale=480:-1',
            '-q:v', '5', '-f', 'image2', '-y', outputPath
        ]);
        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) resolve();
            else reject(new Error('Failed'));
        });
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Hybrid Key Event Extraction (FFmpeg-based)');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(VIDEO_PATH)) {
        console.error('Video not found:', VIDEO_PATH);
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const duration = await getDuration(VIDEO_PATH);
    console.log(`📹 Video: ${path.basename(VIDEO_PATH)} (${duration.toFixed(1)}s)\n`);

    // Run detection
    const [sceneEvents, audioEvents] = await Promise.all([
        detectScenesFFmpeg(VIDEO_PATH),
        detectAudioEvents(VIDEO_PATH)
    ]);

    let events = [...sceneEvents, ...audioEvents].sort((a, b) => a.time - b.time);

    // Add safety net
    for (let t = 0; t < duration; t += MAX_INTERVAL) {
        if (!events.some(e => Math.abs(e.time - t) < 1.5)) {
            events.push({ time: t, type: 'safety', desc: 'Safety net' });
        }
    }
    events.sort((a, b) => a.time - b.time);

    // Deduplicate
    const unique = [];
    for (const e of events) {
        if (!unique.some(u => Math.abs(u.time - e.time) < 0.5)) unique.push(e);
    }
    events = unique;

    console.log(`\n✅ Total events: ${events.length}\n`);
    console.log('🎬 Extracting frames...');

    const frames = [];
    for (let i = 0; i < events.length && i < 25; i++) {  // Limit to 25 frames for test
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}.jpg`);
        process.stdout.write(`   [${i + 1}/${Math.min(events.length, 25)}] ${e.time.toFixed(1)}s ${e.type.padEnd(8)} `);
        try {
            await extractFrame(VIDEO_PATH, e.time, out);
            const size = fs.statSync(out).size;
            frames.push({ index: i, time: e.time, type: e.type, sizeKB: (size / 1024).toFixed(1) });
            console.log(`✅ ${(size / 1024).toFixed(1)}KB`);
        } catch {
            console.log('❌');
        }
    }

    // Report
    const report = {
        video: path.basename(VIDEO_PATH),
        duration,
        totalFrames: frames.length,
        allEvents: events.length,
        types: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        timestamps: frames.map(f => f.time),
        avgInterval: (duration / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   Frames extracted: ${report.totalFrames} of ${report.allEvents} events`);
    console.log(`   Scene: ${report.types.scene} | Audio: ${report.types.audio} | Safety: ${report.types.safety}`);
    console.log(`   Avg interval: ${report.avgInterval}s`);
    console.log(`   vs Fixed 3s: ${Math.floor(duration / 3)} frames`);
    console.log(`   vs Fixed 4s: ${Math.floor(duration / 4)} frames`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
