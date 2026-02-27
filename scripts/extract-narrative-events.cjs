#!/usr/bin/env node
/**
 * Multi-Modal Key Event Extraction v3.0
 * Scene + Audio + Text + Duration Safety Net
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv.includes('--output-dir') 
    ? process.argv[process.argv.indexOf('--output-dir') + 1]
    : './narrative-frames';

const MAX_DURATION = 30;
const SCENE_THRESHOLD = 0.28;
const MAX_INTERVAL = 4;

async function detectScenes(videoPath) {
    console.log('   [1/4] Scene cuts...');
    const results = [];
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath, '-t', String(MAX_DURATION),
            '-vf', `select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (d) => {
            const m = d.toString().match(/pts_time:([0-9.]+)/);
            if (m) {
                const t = parseFloat(m[1]);
                if (t <= MAX_DURATION) results.push({time: t, type: 'scene', source: 'scene'});
            }
        });
        ffmpeg.on('close', () => {
            const unique = [];
            for (const r of results) {
                if (!unique.some(u => Math.abs(u.time - r.time) < 0.4)) unique.push(r);
            }
            console.log(`         ${unique.length} detected`);
            resolve(unique);
        });
    });
}

async function detectAudio(videoPath) {
    console.log('   [2/4] Audio transitions...');
    const results = [];
    let last = 0;
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath, '-t', String(MAX_DURATION),
            '-af', 'silencedetect=noise=-35dB:d=0.4',
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (d) => {
            const m = d.toString().match(/silence_end: ([0-9.]+)/);
            if (m) {
                const t = parseFloat(m[1]);
                if (t <= MAX_DURATION && t - last > 1) {
                    results.push({time: t, type: 'audio', source: 'audio'});
                    last = t;
                }
            }
        });
        ffmpeg.on('close', () => {
            console.log(`         ${results.length} detected`);
            resolve(results);
        });
    });
}

async function detectTextChanges(videoPath) {
    console.log('   [3/4] Text/title detection...');
    const results = [];
    const tempDir = fs.mkdtempSync('/tmp/text-detect-');
    
    // Sample every 0.4s
    for (let t = 0; t < MAX_DURATION; t += 0.4) {
        await new Promise((resolve) => {
            const ffmpeg = spawn('ffmpeg', [
                '-ss', String(t), '-i', videoPath,
                '-vframes', '1', '-vf', 'scale=320:-1',
                '-q:v', '5', '-y',
                path.join(tempDir, `f-${Math.round(t*10)}.jpg`)
            ]);
            ffmpeg.on('close', resolve);
        });
    }
    
    // Compare consecutive frames
    let prevSize = 0;
    let lastEvent = 0;
    for (let t = 0; t < MAX_DURATION - 0.4; t += 0.4) {
        const p = path.join(tempDir, `f-${Math.round(t*10)}.jpg`);
        if (!fs.existsSync(p)) continue;
        const size = fs.statSync(p).size;
        
        if (prevSize > 0) {
            const change = Math.abs(size - prevSize) / prevSize;
            if (change > 0.25 && t - lastEvent > 0.8) {
                results.push({time: t, type: 'text', source: 'text'});
                lastEvent = t;
            }
        }
        prevSize = size;
    }
    
    fs.rmSync(tempDir, { recursive: true });
    console.log(`         ${results.length} detected`);
    return results;
}

function addSafetyNet(events, maxDuration) {
    const safety = [];
    for (let t = 0; t < maxDuration; t += MAX_INTERVAL) {
        if (!events.some(e => Math.abs(e.time - t) < 1.5)) {
            safety.push({time: t, type: 'safety', source: 'safety'});
        }
    }
    return [...events, ...safety].sort((a, b) => a.time - b.time);
}

function dedupe(events) {
    const unique = [];
    for (const e of events) {
        if (!unique.some(u => Math.abs(u.time - e.time) < 0.5)) {
            unique.push(e);
        }
    }
    return unique;
}

async function extractFrame(videoPath, t, outPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-ss', String(t), '-i', videoPath,
            '-vframes', '1', '-vf', 'scale=480:-1',
            '-q:v', '5', '-y', outPath
        ]);
        ffmpeg.on('close', (c) => c === 0 ? resolve() : reject());
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Multi-Modal Extraction v3.0');
    console.log('  Scene + Audio + Text + Safety');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const [scenes, audio, text] = await Promise.all([
        detectScenes(VIDEO_PATH),
        detectAudio(VIDEO_PATH),
        detectTextChanges(VIDEO_PATH)
    ]);

    let events = dedupe([...scenes, ...audio, ...text]);
    events = addSafetyNet(events, MAX_DURATION);
    events = dedupe(events);

    console.log(`\n✅ Total events: ${events.length}`);
    console.log(`   Scene: ${scenes.length} | Audio: ${audio.length} | Text: ${text.length} | Safety: ${events.length - scenes.length - audio.length - text.length}`);
    console.log('\n🎬 Extracting...\n');

    const frames = [];
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type.padEnd(6)} `);
        try {
            await extractFrame(VIDEO_PATH, e.time, out);
            const size = fs.statSync(out).size;
            frames.push({i, time: e.time, type: e.type, sizeKB: (size/1024).toFixed(1)});
            console.log(`✅ ${(size/1024).toFixed(1)}KB`);
        } catch {
            console.log('❌');
        }
    }

    const report = {
        video: VIDEO_PATH,
        duration: MAX_DURATION,
        frames: frames.length,
        byType: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            text: frames.filter(f => f.type === 'text').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Total: ${report.frames} frames`);
    console.log(`   Scene: ${report.byType.scene} | Audio: ${report.byType.audio} | Text: ${report.byType.text} | Safety: ${report.byType.safety}`);
    console.log(`   Avg interval: ${report.avgInterval}s`);
    console.log(`\n   Output: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
