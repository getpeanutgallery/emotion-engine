#!/usr/bin/env node
/**
 * Extract Key Events - First 30 Seconds
 * Specifically for COD trailer analysis
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/key-events-30s';
const MAX_DURATION = 30;  // Only process first 30 seconds

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

async function detectScenesFFmpeg(videoPath, maxDuration) {
    console.log('   🎞️  Scene detection (FFmpeg)...');
    const events = [];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(maxDuration),
            '-vf', 'select=gt(scene\\,0.35),showinfo',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            const match = line.match(/pts_time:([0-9.]+)/);
            if (match) {
                const t = parseFloat(match[1]);
                if (t <= maxDuration) {
                    events.push({ time: t, type: 'scene', desc: 'Scene cut' });
                }
            }
        });

        ffmpeg.on('close', () => {
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

async function detectAudioEvents(videoPath, maxDuration) {
    console.log('   🎤 Audio level detection (FFmpeg)...');
    const events = [];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(maxDuration),
            '-af', 'silencedetect=noise=-40dB:d=0.3',
            '-f', 'null', '-'
        ]);

        let lastSilenceEnd = 0;
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            const silenceEnd = line.match(/silence_end: ([0-9.]+)/);
            if (silenceEnd) {
                const t = parseFloat(silenceEnd[1]);
                if (t <= maxDuration && t - lastSilenceEnd > 1) {
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
    console.log('  Hybrid Key Event Extraction - First 30s');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(VIDEO_PATH)) {
        console.error('Video not found:', VIDEO_PATH);
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const fullDuration = await getDuration(VIDEO_PATH);
    console.log(`📹 Video: ${path.basename(VIDEO_PATH)}`);
    console.log(`   Full duration: ${fullDuration.toFixed(1)}s`);
    console.log(`   Processing: first ${MAX_DURATION}s\n`);

    // Run detection on first 30s
    const [sceneEvents, audioEvents] = await Promise.all([
        detectScenesFFmpeg(VIDEO_PATH, MAX_DURATION),
        detectAudioEvents(VIDEO_PATH, MAX_DURATION)
    ]);

    let events = [...sceneEvents, ...audioEvents].sort((a, b) => a.time - b.time);

    // Add safety net (every 4s if no event)
    for (let t = 0; t < MAX_DURATION; t += 4) {
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

    // Extract all frames
    console.log(`\n✅ Total events: ${events.length}`);
    console.log('\n🎬 Extracting frames...\n');

    const frames = [];
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type.padEnd(6)} `);
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
        processedDuration: MAX_DURATION,
        fullDuration,
        totalFrames: frames.length,
        types: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        frames: frames.map(f => ({
            filename: `frame-${String(f.index).padStart(3, '0')}-${f.type}-${f.time.toFixed(1)}s.jpg`,
            time: f.time,
            type: f.type,
            sizeKB: f.sizeKB
        })),
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   Frames extracted: ${report.totalFrames}`);
    console.log(`   Scene: ${report.types.scene} | Audio: ${report.types.audio} | Safety: ${report.types.safety}`);
    console.log(`   Average interval: ${report.avgInterval}s`);
    console.log(`\n📁 Output: ${OUTPUT_DIR}/`);
    console.log(`📝 Report: ${path.join(OUTPUT_DIR, 'report.json')}`);
    console.log('\n═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
