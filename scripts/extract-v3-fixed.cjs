#!/usr/bin/env node
/**
 * Multi-Modal Event Extraction v3.0 - Fixed
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/narrative-v3';
const MAX_DURATION = 30;
const SCENE_THRESHOLD = 0.35;
const MAX_INTERVAL = 4;

async function detectScenes() {
    console.log('   [1/3] Scene cuts...');
    const results = [];
    
    return new Promise((resolve) => {
        // Use single backslash in array - spawn handles it correctly
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH,
            '-t', String(MAX_DURATION),
            '-vf', `select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
            '-f', 'null', '-'
        ], { timeout: 60000 });

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            // Look for both pts_time and the scene score
            const ptsMatch = line.match(/pts_time:([0-9.]+)/);
            if (ptsMatch) {
                const t = parseFloat(ptsMatch[1]);
                if (t <= MAX_DURATION) {
                    results.push({time: t, type: 'scene', source: 'scene'});
                }
            }
        });

        ffmpeg.on('close', () => {
            // Deduplicate - multiple detections for same timestamp
            const unique = [];
            for (const r of results) {
                if (!unique.some(u => Math.abs(u.time - r.time) < 0.3)) {
                    unique.push(r);
                }
            }
            console.log(`         ${unique.length} scene cuts detected`);
            resolve(unique);
        });
    });
}

async function detectAudioTransitions() {
    console.log('   [2/3] Audio transitions...');
    const results = [];
    let lastTime = 0;
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH,
            '-t', String(MAX_DURATION),
            '-af', 'silencedetect=noise=-40dB:d=0.5',
            '-f', 'null', '-'
        ], { timeout: 60000 });

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            // Silence ending means sound starts (potential dialogue)
            const match = line.match(/silence_end: ([0-9.]+)/);
            if (match) {
                const t = parseFloat(match[1]);
                if (t <= MAX_DURATION && t - lastTime > 1.2) {
                    results.push({time: t, type: 'audio', source: 'audio'});
                    lastTime = t;
                }
            }
        });

        ffmpeg.on('close', () => {
            console.log(`         ${results.length} audio transitions detected`);
            resolve(results);
        });
    });
}

async function extractFrame(timestamp, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-ss', String(timestamp),
            '-i', VIDEO_PATH,
            '-vframes', '1',
            '-vf', 'scale=480:-1',
            '-q:v', '5',
            '-y', outputPath
        ], { timeout: 15000 });
        
        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
                resolve();
            } else {
                reject(new Error(`Extraction failed with code ${code}`));
            }
        });
    });
}

function addSafetyFrames(events) {
    const safety = [];
    for (let t = 0; t < MAX_DURATION; t += MAX_INTERVAL) {
        const hasEvent = events.some(e => Math.abs(e.time - t) < 2);
        if (!hasEvent) {
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

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Multi-Modal v3.0');
    console.log('  Scene + Audio + Safety');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Detect events
    const [scenes, audio] = await Promise.all([
        detectScenes(),
        detectAudioTransitions()
    ]);

    // Merge, add safety, dedupe
    let events = dedupe([...scenes, ...audio]);
    events = addSafetyFrames(events);
    events = dedupe(events);

    console.log(`\n✅ Total events: ${events.length}`);

    // Extract frames
    console.log('\n🎬 Extracting frames...\n');
    const frames = [];
    
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const outPath = path.join(OUTPUT_DIR, 
            `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`
        );
        
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s `);
        
        try {
            await extractFrame(e.time, outPath);
            const sizeKB = fs.statSync(outPath).size / 1024;
            frames.push({...e, index: i, sizeKB});
            console.log(`✅ ${sizeKB.toFixed(1)}KB`);
        } catch (err) {
            console.log(`❌ ${err.message}`);
        }
    }

    // Report
    const report = {
        video: VIDEO_PATH,
        duration: MAX_DURATION,
        totalFrames: frames.length,
        byType: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   Total: ${report.totalFrames} frames`);
    console.log(`   Scene cuts: ${report.byType.scene}`);
    console.log(`   Audio transitions: ${report.byType.audio}`);
    console.log(`   Safety net: ${report.byType.safety}`);
    console.log(`   Average interval: ${report.avgInterval}s`);
    console.log(`\n📁 Output: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
