#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const OUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/image-output/narrative-hires';
const MAX_DUR = 30;
const OCR_RES = 1280;

let worker = null;

async function initOCR() {
    console.log('   Initializing OCR...');
    worker = await createWorker('eng');
    console.log('   ✅ OCR ready');
}

async function detectScenes() {
    console.log('   [1/3] Scene cuts...');
    const r = [];
    return new Promise((res) => {
        const ffmpeg = spawn('ffmpeg', ['-i', VIDEO, '-t', String(MAX_DUR), '-vf', 'select=gt(scene\\,0.35),showinfo', '-f', 'null', '-']);
        ffmpeg.stderr.on('data', (d) => {
            const m = d.toString().match(/pts_time:([0-9.]+)/);
            if (m) r.push({time: parseFloat(m[1]), type: 'scene'});
        });
        ffmpeg.on('close', () => {
            const u = [];
            for (const x of r) if (!u.some(y => Math.abs(y.time - x.time) < 0.3)) u.push(x);
            console.log(`         ${u.length} scenes`);
            res(u);
        });
    });
}

async function detectOCR() {
    console.log('   [2/3] High-res OCR (1280px)...');
    const r = [];
    const tmp = fs.mkdtempSync('/tmp/ocr-hr-');
    const samples = [];
    for (let t = 0; t < MAX_DUR; t += 0.4) samples.push(t);
    
    console.log(`         Sampling ${samples.length} frames...`);
    
    for (let i = 0; i < samples.length; i++) {
        await new Promise((res) => {
            spawn('ffmpeg', ['-ss', String(samples[i]), '-i', VIDEO, '-vframes', '1', 
                '-vf', `scale=${OCR_RES}:-1:flags=lanczos,unsharp=3:3:1.0`,
                '-q:v', '2', '-y', path.join(tmp, `f-${i}.jpg`)]).on('close', res);
        });
    }
    
    let lastText = '';
    let lastEvent = 0;
    
    for (let i = 0; i < samples.length; i++) {
        const p = path.join(tmp, `f-${i}.jpg`);
        if (!fs.existsSync(p)) continue;
        
        try {
            const { data: { text, confidence } } = await worker.recognize(p);
            const clean = text.trim().replace(/\s+/g, ' ');
            
            if (clean.length > 4 && confidence > 65 && samples[i] - lastEvent > 1.0) {
                const isNew = clean !== lastText;
                const hasWords = /[a-zA-Z]{3,}/.test(clean);
                const isTitle = /call|duty|black|ops|trailer|official/i.test(clean);
                
                if ((isNew || confidence > 85) && (hasWords || isTitle)) {
                    r.push({time: samples[i], type: 'ocr', text: clean.substring(0, 60), ocrConfidence: confidence, isTitle});
                    lastEvent = samples[i];
                    if (isTitle) console.log(`         🎯 TITLE @ ${samples[i].toFixed(1)}s [${confidence.toFixed(0)}%]: "${clean.substring(0, 45)}"`);
                    else if (confidence > 75) console.log(`         📝 TEXT @ ${samples[i].toFixed(1)}s [${confidence.toFixed(0)}%]: "${clean.substring(0, 35)}..."`);
                }
            }
            lastText = clean;
        } catch {}
        try { fs.unlinkSync(p); } catch {}
    }
    
    fs.rmdirSync(tmp);
    console.log(`         ${r.length} OCR (${r.filter(x => x.isTitle).length} titles)`);
    return r;
}

async function extract(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', ['-ss', String(t), '-i', VIDEO, '-vframes', '1', '-vf', 'scale=480:-1', '-q:v', '5', '-y', out])
            .on('close', (c) => c === 0 && fs.existsSync(out) ? res() : rej());
    });
}

function addSafety(ev) {
    const s = [];
    for (let t = 0; t < MAX_DUR; t += 4) {
        if (!ev.some(e => Math.abs(e.time - t) < 2)) s.push({time: t, type: 'safety'});
    }
    return [...ev, ...s].sort((a, b) => a.time - b.time);
}

function dedupe(ev) {
    const u = [];
    for (const e of ev) if (!u.some(x => Math.abs(x.time - e.time) < 0.4)) u.push(e);
    return u;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  High-Res OCR v3.2 (1280px)');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await initOCR();

    const [scenes, ocr] = await Promise.all([detectScenes(), detectOCR()]);
    await worker.terminate();

    let events = dedupe([...scenes, ...ocr]);
    events = addSafety(events);
    events = dedupe(events);

    console.log(`\n✅ Total: ${events.length} (Scene: ${scenes.length}, OCR: ${ocr.length})\n`);
    console.log('🎬 Extracting...\n');

    const frames = [];
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const out = path.join(OUT_DIR, `frame-${String(i).padStart(3, '0')}-${e.type}-${e.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${events.length}] ${e.time.toFixed(1).padStart(4)}s ${e.type.padEnd(6)}`);
        if (e.text) process.stdout.write(` [${e.ocrConfidence.toFixed(0)}%] "${e.text.substring(0, 30)}"`);
        process.stdout.write(' ');
        try {
            await extract(e.time, out);
            const sz = fs.statSync(out).size / 1024;
            frames.push({...e, sizeKB: sz});
            console.log(`✅ ${sz.toFixed(1)}KB`);
        } catch { console.log('❌'); }
    }

    const report = {
        total: frames.length,
        byType: { scene: frames.filter(f => f.type === 'scene').length, ocr: frames.filter(f => f.type === 'ocr').length, safety: frames.filter(f => f.type === 'safety').length },
        textFrames: frames.filter(f => f.type === 'ocr').map(f => ({ time: f.time, text: f.text, confidence: f.ocrConfidence, isTitle: f.isTitle })),
        avgInterval: (MAX_DUR / frames.length).toFixed(2)
    };

    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Total: ${report.total} | Scene: ${report.byType.scene} | OCR: ${report.byType.ocr} | Safety: ${report.byType.safety}`);
    console.log(`   Avg: ${report.avgInterval}s`);
    if (report.textFrames.length) {
        console.log('\n📝 Text detected:');
        report.textFrames.forEach(f => console.log(`   ${f.isTitle ? '🎯' : '📝'} ${f.time.toFixed(1)}s [${f.confidence.toFixed(0)}%]: "${f.text}"`));
    }
    console.log(`\n📁 ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); if (worker) worker.terminate(); process.exit(1); });
