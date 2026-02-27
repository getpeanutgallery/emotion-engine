#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/key-events-30s';
const MAX_DURATION = 30;

async function detectScenes() {
    console.log('   🎞️  Scene detection...');
    const events = [];
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH, '-t', String(MAX_DURATION),
            '-vf', 'select=gt(scene\\,0.35),showinfo',
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (data) => {
            const m = data.toString().match(/pts_time:([0-9.]+)/);
            if (m) events.push({ time: parseFloat(m[1]), type: 'scene' });
        });
        ffmpeg.on('close', () => {
            const unique = [];
            for (const e of events) {
                if (!unique.some(u => Math.abs(u.time - e.time) < 0.5)) unique.push(e);
            }
            console.log(`      Found ${unique.length} scene cuts`);
            resolve(unique);
        });
    });
}

async function detectAudio() {
    console.log('   🎤 Audio detection...');
    const events = [];
    let last = 0;
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH, '-t', String(MAX_DURATION),
            '-af', 'silencedetect=noise=-40dB:d=0.3',
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (data) => {
            const m = data.toString().match(/silence_end: ([0-9.]+)/);
            if (m) {
                const t = parseFloat(m[1]);
                if (t - last > 1) { events.push({ time: t, type: 'audio' }); last = t; }
            }
        });
        ffmpeg.on('close', () => {
            console.log(`      Found ${events.length} audio events`);
            resolve(events);
        });
    });
}

async function extractFrame(t, out) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-ss', String(t), '-i', VIDEO_PATH,
            '-vframes', '1', '-vf', 'scale=480:-1',
            '-q:v', '5', '-y', out
        ]);
        ffmpeg.on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Hybrid Key Event Extraction - First 30s');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const [scene, audio] = await Promise.all([detectScenes(), detectAudio()]);
    let events = [...scene, ...audio].sort((a, b) => a.time - b.time);

    for (let t = 0; t < MAX_DURATION; t += 4) {
        if (!events.some(e => Math.abs(e.time - t) < 1.5)) {
            events.push({ time: t, type: 'safety' });
        }
    }
    events.sort((a, b) => a.time - b.time);

    const unique = [];
    for (const e of events) {
        if (!unique.some(u => Math.abs(u.time - e.time) < 0.5)) unique.push(e);
    }
    events = unique;

    console.log(`\n✅ Total events: ${events.length}\n`);
    console.log('🎬 Extracting frames...\n');

    const frames = [];
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type.padEnd(6)} `);
        try {
            await extractFrame(e.time, out);
            const size = fs.statSync(out).size;
            frames.push({ i, time: e.time, type: e.type, sizeKB: (size / 1024).toFixed(1) });
            console.log(`✅ ${(size / 1024).toFixed(1)}KB`);
        } catch { console.log('❌'); }
    }

    const report = {
        video: VIDEO_PATH,
        duration: MAX_DURATION,
        frames: frames.length,
        types: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Frames: ${report.frames} | Scene: ${report.types.scene} | Audio: ${report.types.audio} | Safety: ${report.types.safety}`);
    console.log(`   Avg interval: ${report.avgInterval}s`);
    console.log(`   Output: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
