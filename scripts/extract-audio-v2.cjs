#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const OUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/audio-peaks';
const MAX_DUR = 30;

async function detectPeaks() {
    console.log('   Analyzing audio for peaks...');
    const tmp = fs.mkdtempSync('/tmp/audio-');
    const audio = path.join(tmp, 'audio.wav');
    
    // Extract audio
    await new Promise((res) => {
        spawn('ffmpeg', ['-i', VIDEO, '-t', String(MAX_DUR), '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-y', audio]).on('close', res);
    });
    
    // Detect sound segments
    const segments = [];
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', ['-i', audio, '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-']);
        
        let silenceStart = 0, silenceEnd = 0;
        ffmpeg.stderr.on('data', (d) => {
            const line = d.toString();
            const start = line.match(/silence_start: ([0-9.]+)/);
            const end = line.match(/silence_end: ([0-9.]+)/);
            
            if (start) silenceStart = parseFloat(start[1]);
            if (end) {
                silenceEnd = parseFloat(end[1]);
                if (silenceEnd > 0 && silenceStart > silenceEnd) {
                    segments.push({ start: silenceEnd, end: silenceStart });
                }
            }
        });
        
        ffmpeg.on('close', () => {
            fs.rmSync(tmp, { recursive: true });
            const peaks = segments.filter(s => s.end - s.start > 0.5).map(s => ({ time: s.start, duration: s.end - s.start }));
            console.log(`         Found ${peaks.length} sound segments`);
            resolve(peaks);
        });
    });
}

async function extract(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', ['-ss', String(t), '-i', VIDEO, '-vframes', '1', '-vf', 'scale=480:-1', '-q:v', '5', '-y', out]).on('close', (c) => c === 0 && fs.existsSync(out) ? res() : rej());
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Audio Peak Detection v2');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const peaks = await detectPeaks();
    
    if (peaks.length === 0) {
        console.log('⚠️  No peaks found (continuous audio)\n');
        return;
    }

    console.log('\n🎬 Extracting...\n');
    const frames = [];
    for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        const out = path.join(OUT_DIR, `peak-${String(i).padStart(2, '0')}-${p.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${peaks.length}] ${p.time.toFixed(1).padStart(4)}s `);
        try {
            await extract(p.time, out);
            const sz = fs.statSync(out).size / 1024;
            frames.push({...p, sizeKB: sz});
            console.log(`✅ ${sz.toFixed(1)}KB`);
        } catch { console.log('❌'); }
    }

    fs.writeFileSync(path.join(OUT_DIR, 'peaks.json'), JSON.stringify({peaks: frames}, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Extracted ${frames.length} frames`);
    console.log(`   Output: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
