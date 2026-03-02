#!/usr/bin/env node
/**
 * Multi-Modal v3.2 - High-Res OCR
 * Uses 1280px width for better text detection
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/narrative-v3-hires';
const MAX_DURATION = 30;
const SCENE_THRESHOLD = 0.35;
const OCR_RESOLUTION = 1280;  // Full HD for text detection
const FRAME_RESOLUTION = 480;  // Standard for emotion analysis

let ocrWorker = null;

async function initOCR() {
    console.log('   Initializing OCR (high-res)...');
    ocrWorker = await createWorker('eng');
    console.log('   ✅ OCR ready');
}

async function detectScenes() {
    console.log('   [1/4] Scene cuts...');
    const results = [];
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH, '-t', String(MAX_DURATION),
            '-vf', `select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (d) => {
            const m = d.toString().match(/pts_time:([0-9.]+)/);
            if (m) results.push({time: parseFloat(m[1]), type: 'scene', source: 'scene'});
        });
        ffmpeg.on('close', () => {
            const u = [];
            for (const r of results) if (!u.some(x => Math.abs(x.time - r.time) < 0.3)) u.push(r);
            console.log(`         ${u.length} scene cuts`);
            resolve(u);
        });
    });
}

async function detectAudio() {
    console.log('   [2/4] Audio transitions...');
    const results = [];
    let last = 0;
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH, '-t', String(MAX_DURATION),
            '-af', 'silencedetect=noise=-40dB:d=0.5',
            '-f', 'null', '-'
        ]);
        ffmpeg.stderr.on('data', (d) => {
            const m = d.toString().match(/silence_end: ([0-9.]+)/);
            if (m) {
                const t = parseFloat(m[1]);
                if (t - last > 1.2) { results.push({time: t, type: 'audio', source: 'audio'}); last = t; }
            }
        });
        ffmpeg.on('close', () => { console.log(`         ${results.length} audio events`); resolve(results); });
    });
}

async function detectOCR() {
    console.log('   [3/4] High-res OCR (1280px)...');
    const results = [];
    const tempDir = fs.mkdtempSync('/tmp/ocr-hires-');
    
    // Sample every 0.4s for finer granularity
    const samples = [];
    for (let t = 0; t < MAX_DURATION; t += 0.4) samples.push(t);
    
    console.log(`         Sampling ${samples.length} frames at ${OCR_RESOLUTION}px...`);
    
    // Extract HIGH-RES frames for OCR
    for (let i = 0; i < samples.length; i++) {
        await new Promise((res) => {
            spawn('ffmpeg', [
                '-ss', String(samples[i]), 
                '-i', VIDEO_PATH, 
                '-vframes', '1',
                '-vf', `scale=${OCR_RESOLUTION}:-1:flags=lanczos,unsharp=3:3:1.5`,  // High quality + sharpening
                '-q:v', '2',  // High quality JPEG
                '-y', 
                path.join(tempDir, `f-${i}.jpg`)
            ]).on('close', res);
        });
    }
    
    // OCR with higher confidence threshold
    let lastText = '';
    let lastEvent = 0;
    let prevFrameText = '';
    
    for (let i = 0; i < samples.length; i++) {
        const p = path.join(tempDir, `f-${i}.jpg`);
        if (!fs.existsSync(p)) continue;
        
        try {
            const { data: { text, confidence } } = await ocrWorker.recognize(p);
            const clean = text.trim().replace(/\s+/g, ' ');
            
            // Higher quality threshold
            if (clean.length > 4 && confidence > 60) {
                const isNewText = clean !== lastText && !clean.includes(lastText);
                const timeGap = samples[i] - lastEvent;
                
                // Detect new text or significant changes
                if ((isNewText || confidence > 80) && timeGap > 1.0) {
                    // Check for meaningful content
                    const hasRealWords = /[a-zA-Z]{3,}/.test(clean);
                    const isTitle = /call|duty|black|ops|official|trailer|activision/i.test(clean);
                    
                    if (hasRealWords || isTitle) {
                        results.push({
                            time: samples[i], 
                            type: 'ocr', 
                            source: 'ocr',
                            text: clean.substring(0, 70),
                            ocrConfidence: confidence,
                            isTitle
                        });
                        lastEvent = samples[i];
                        
                        if (isTitle) {
                            console.log(`         🎯 TITLE @ ${samples[i].toFixed(1)}s (${confidence}%): "${clean.substring(0, 50)}"`);
                        } else if (confidence > 70) {
                            console.log(`         📝 TEXT @ ${samples[i].toFixed(1)}s (${confidence}%): "${clean.substring(0, 40)}${clean.length > 40 ? '...' : ''}"`);
                        }
                    }
                }
                
                lastText = clean;
            }
            
            prevFrameText = clean;
        } catch (e) {
            // OCR failed on this frame
        }
        
        try { fs.unlinkSync(p); } catch {}
    }
    
    fs.rmdirSync(tempDir);
    console.log(`         ${results.length} OCR events (${results.filter(r => r.isTitle).length} titles)`);
    return results;
}

async function extractFrame(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', [
            '-ss', String(t), 
            '-i', VIDEO_PATH, 
            '-vframes', '1',
            '-vf', `scale=${FRAME_RESOLUTION}:-1`,  // Standard res for output
            '-q:v', '5', 
            '-y', 
            out
        ]).on('close', (c) => {
            if (c === 0 && fs.existsSync(out)) res(); else rej();
        });
    });
}

function addSafety(events) {
    const safety = [];
    for (let t = 0; t < MAX_DURATION; t += 4) {
        if (!events.some(e => Math.abs(e.time - t) < 2)) {
            safety.push({time: t, type: 'safety', source: 'safety'});
        }
    }
    return [...events, ...safety].sort((a, b) => a.time - b.time);
}

function dedupe(events) {
    const u = [];
    for (const e of events) {
        if (!u.some(x => Math.abs(x.time - e.time) < 0.4)) u.push(e);
    }
    return u;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Multi-Modal v3.2 - High-Res OCR');
    console.log(`  OCR: ${OCR_RESOLUTION}px | Output: ${FRAME_RESOLUTION}px`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    await initOCR();

    const [scenes, audio, ocr] = await Promise.all([
        detectScenes(), 
        detectAudio(), 
        detectOCR()
    ]);

    await ocrWorker.terminate();

    let events = dedupe([...scenes, ...audio, ...ocr]);
    events = addSafety(events);
    events = dedupe(events);

    console.log(`\n✅ Total: ${events.length} events`);
    console.log(`   Scene: ${scenes.length} | Audio: ${audio.length} | OCR: ${ocr.length}\n`);

    console.log('🎬 Extracting frames...\n');
    const frames = [];
    
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type.padEnd(6)}`);
        if (e.text) process.stdout.write(` [${e.ocrConfidence || '--'}%] "${e.text.substring(0, 35)}${e.text.length > 35 ? '...' : ''}"`);
        process.stdout.write(' ');
        
        try {
            await extractFrame(e.time, out);
            const size = fs.statSync(out).size / 1024;
            frames.push({...e, index: i, sizeKB: size});
            console.log(`✅ ${size.toFixed(1)}KB`);
        } catch { console.log(`❌`); }
    }

    const report = {
        video: VIDEO_PATH, 
        duration: MAX_DURATION, 
        totalFrames: frames.length,
        resolution: { ocr: OCR_RESOLUTION, output: FRAME_RESOLUTION },
        byType: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            ocr: frames.filter(f => f.type === 'ocr').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        textFrames: frames.filter(f => f.type === 'ocr').map(f => ({
            time: f.time, 
            text: f.text, 
            confidence: f.ocrConfidence,
            isTitle: f.isTitle
        })),
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Total: ${report.totalFrames} frames`);
    console.log(`   Scene: ${report.byType.scene} | Audio: ${report.byType.audio} | OCR: ${report.byType.ocr} | Safety: ${report.byType.safety}`);
    console.log(`   Avg: ${report.avgInterval}s`);
    
    if (report.textFrames.length > 0) {
        console.log('\n📝 OCR Results:');
        report.textFrames.forEach(f => {
            const marker = f.isTitle ? '🎯' : '📝';
            console.log(`   ${marker} ${f.time.toFixed(1)}s [${f.confidence.toFixed(0)}%]: "${f.text}"`);
        });
    }
    
    console.log(`\n📁 ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Error:', err);
    if (ocrWorker) ocrWorker.terminate().catch(() => {});
    process.exit(1);
});
