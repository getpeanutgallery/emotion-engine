#!/usr/bin/env node
/**
 * Extract Key Events — Hybrid Scene + Audio Detection
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = process.argv[2];
if (!VIDEO_PATH) {
    console.log('Usage: node extract-key-events.cjs <video-path> [options]');
    process.exit(1);
}

const OUTPUT_DIR = process.argv.includes('--output-dir') 
    ? process.argv[process.argv.indexOf('--output-dir') + 1] 
    : './frames';

const MAX_INTERVAL = 4;

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
            else reject(new Error('Failed to get duration'));
        });
    });
}

async function detectScenes(videoPath) {
    console.log('   🎞️  Scene detection...');
    const events = [];
    const tempDir = fs.mkdtempSync('/tmp/scenedetect-');
    
    return new Promise((resolve) => {
        const scenedetect = spawn('scenedetect', [
            '-i', videoPath,
            '-o', tempDir,
            'detect-content',
            '-t', '0.3',
            'list-scenes',
            '-f', path.join(tempDir, 'scenes.csv')
        ]);

        scenedetect.on('close', () => {
            const csvPath = path.join(tempDir, 'scenes.csv');
            if (fs.existsSync(csvPath)) {
                const csv = fs.readFileSync(csvPath, 'utf8');
                csv.split('\n').slice(1).forEach(line => {
                    const parts = line.split(',');
                    if (parts.length >= 3) {
                        const t = parseFloat(parts[1]);
                        if (!isNaN(t)) events.push({ time: t, type: 'scene', desc: 'Scene cut' });
                    }
                });
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`      Found ${events.length} scene cuts`);
            resolve(events);
        });
    });
}

async function detectDialogue(videoPath) {
    console.log('   🎤 Dialogue detection...');
    const events = [];
    const tempDir = fs.mkdtempSync('/tmp/whisper-');
    
    return new Promise((resolve) => {
        const whisper = spawn('whisper', [
            videoPath,
            '--model', 'base',
            '--output_format', 'json',
            '--output_dir', tempDir,
            '--verbose', 'False'
        ]);

        whisper.on('close', () => {
            const jsonFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.json'));
            if (jsonFiles.length > 0) {
                const result = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFiles[0]), 'utf8'));
                if (result.segments) {
                    result.segments.forEach(seg => {
                        if (seg.text?.trim()) {
                            events.push({ time: seg.start, type: 'dialogue', desc: `Speech: "${seg.text.trim().substring(0, 40)}${seg.text.length > 40 ? '...' : ''}"` });
                        }
                    });
                }
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`      Found ${events.length} dialogue segments`);
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
            else reject(new Error('Extraction failed'));
        });
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Hybrid Key Event Extraction');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(VIDEO_PATH)) {
        console.error('Video not found:', VIDEO_PATH);
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const duration = await getDuration(VIDEO_PATH);
    console.log(`📹 Video: ${path.basename(VIDEO_PATH)} (${duration.toFixed(1)}s)\n`);

    let events = [];
    
    try {
        const [sceneEvents, dialogueEvents] = await Promise.all([
            detectScenes(VIDEO_PATH),
            detectDialogue(VIDEO_PATH)
        ]);
        events = [...sceneEvents, ...dialogueEvents].sort((a, b) => a.time - b.time);
    } catch (e) {
        console.log('⚠️  Detectors failed:', e.message);
    }

    // Add safety net
    for (let t = 0; t < duration; t += MAX_INTERVAL) {
        if (!events.some(e => Math.abs(e.time - t) < 2)) {
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
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1)}s ${e.type.padEnd(8)} `);
        try {
            await extractFrame(VIDEO_PATH, e.time, out);
            const size = fs.statSync(out).size;
            frames.push({ index: i, time: e.time, type: e.type, sizeKB: (size / 1024).toFixed(1) });
            console.log(`✅ ${(size / 1024).toFixed(1)}KB`);
        } catch (err) {
            console.log('❌');
        }
    }

    // Report
    const report = {
        video: path.basename(VIDEO_PATH),
        duration,
        totalFrames: frames.length,
        types: {
            scene: frames.filter(f => f.type === 'scene').length,
            dialogue: frames.filter(f => f.type === 'dialogue').length,
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
    console.log(`   Frames: ${report.totalFrames} (3s fixed would give ${Math.floor(duration / 3)})`);
    console.log(`   Scene: ${report.types.scene} | Dialogue: ${report.types.dialogue} | Safety: ${report.types.safety}`);
    console.log(`   Avg interval: ${report.avgInterval}s`);
    console.log(`   Improvement: ${((report.totalFrames / (duration / 3) - 1) * 100).toFixed(0)}%`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
