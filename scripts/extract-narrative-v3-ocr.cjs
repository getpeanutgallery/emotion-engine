#!/usr/bin/env node
/**
 * Multi-Modal v3.1 with OCR
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/narrative-v3-ocr';
const MAX_DURATION = 30;
const SCENE_THRESHOLD = 0.35;

let ocrWorker = null;

async function initOCR() {
    console.log('   Initializing OCR...');
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
    console.log('   [2/4] Audio...');
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
        ffmpeg.on('close', () => { console.log(`         ${results.length} audio`); resolve(results); });
    });
}

async function detectOCR() {
    console.log('   [3/4] OCR...');
    const results = [];
    const tempDir = fs.mkdtempSync('/tmp/ocr-');
    
    // Sample every 0.5s
    const samples = [];
    for (let t = 0; t < MAX_DURATION; t += 0.5) samples.push(t);
    
    console.log(`         Sampling ${samples.length} frames...`);
    
    // Extract frames
    for (let i = 0; i < samples.length; i++) {
        await new Promise((res) => {
            spawn('ffmpeg', ['-ss', String(samples[i]), '-i', VIDEO_PATH, '-vframes', '1', 
                '-vf', 'scale=640:-1', '-q:v', '4', '-y', path.join(tempDir, `f-${i}.jpg`)]).on('close', res);
        });
    }
    
    // OCR frames
    let lastText = '';
    let lastEvent = 0;
    
    for (let i = 0; i < samples.length; i++) {
        const p = path.join(tempDir, `f-${i}.jpg`);
        if (!fs.existsSync(p)) continue;
        
        try {
            const { data: { text } } = await ocrWorker.recognize(p);
            const clean = text.trim().replace(/\s+/g, ' ');
            
            if (clean.length > 3 && clean !== lastText && samples[i] - lastEvent > 1.5) {
                const isTitle = /call|duty|black|ops|official/i.test(clean);
                results.push({
                    time: samples[i], type: 'ocr', source: 'ocr',
                    text: clean.substring(0, 60), isTitle
                });
                lastEvent = samples[i];
                if (isTitle) console.log(`         🎯 TITLE at ${samples[i].toFixed(1)}s: "${clean.substring(0, 40)}"`);
            }
            lastText = clean;
        } catch {}
        try { fs.unlinkSync(p); } catch {}
    }
    
    fs.rmdirSync(tempDir);
    console.log(`         ${results.length} OCR events (${results.filter(r => r.isTitle).length} titles)`);
    return results;
}

async function extractFrame(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', ['-ss', String(t), '-i', VIDEO_PATH, '-vframes', '1',
            '-vf', 'scale=480:-1', '-q:v', '5', '-y', out]).on('close', (c) => {
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
    console.log('  Multi-Modal v3.1 with OCR');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    await initOCR();

    const [scenes, audio, ocr] = await Promise.all([
        detectScenes(), detectAudio(), detectOCR()
    ]);

    await ocrWorker.terminate();

    let events = dedupe([...scenes, ...audio, ...ocr]);
    events = addSafety(events);
    events = dedupe(events);

    console.log(`\n✅ Total: ${events.length} events`);
    console.log(`   Scene: ${scenes.length} | Audio: ${audio.length} | OCR: ${ocr.length}\n`);

    console.log('🎬 Extracting...\n');
    const frames = [];
    
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type}`);
        if (e.text) process.stdout.write(` "${e.text.substring(0, 30)}${e.text.length > 30 ? '...' : ''}"`);
        process.stdout.write(' ');
        
        try {
            await extractFrame(e.time, out);
            const size = fs.statSync(out).size / 1024;
            frames.push({...e, index: i, sizeKB: size});
            console.log(`✅ ${size.toFixed(1)}KB`);
        } catch { console.log(`❌`); }
    }

    const report = {
        video: VIDEO_PATH, duration: MAX_DURATION, totalFrames: frames.length,
        byType: {
            scene: frames.filter(f => f.type === 'scene').length,
            audio: frames.filter(f => f.type === 'audio').length,
            ocr: frames.filter(f => f.type === 'ocr').length,
            safety: frames.filter(f => f.type === 'safety').length
        },
        textFrames: frames.filter(f => f.type === 'ocr').map(f => ({time: f.time, text: f.text})),
        timestamps: frames.map(f => f.time),
        avgInterval: (MAX_DURATION / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Total: ${report.totalFrames} frames`);
    console.log(`   Scene: ${report.byType.scene} | Audio: ${report.byType.audio} | OCR: ${report.byType.ocr} | Safety: ${report.byType.safety}`);
    console.log(`   Avg: ${report.avgInterval}s`);
    if (report.textFrames.length > 0) {
        console.log('\n📝 Text found:');
        report.textFrames.forEach(f => console.log(`   ${f.time.toFixed(1)}s: "${f.text}"`));
    }
    console.log(`\n📁 ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Error:', err);
    if (ocrWorker) ocrWorker.terminate().catch(() => {});
    process.exit(1);
});
