#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const OUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/audio-energy';
const MAX_DUR = 30;

async function analyzeAudio() {
    console.log('   Analyzing audio energy (EBU R128)...');
    const samples = [];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO, '-t', String(MAX_DUR),
            '-af', 'ebur128=peak=true',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (d) => {
            const line = d.toString();
            const m = line.match(/t:\s*(\d+\.\d+).*?M:\s*(-?\d+\.\d+)/);
            if (m) {
                samples.push({
                    time: parseFloat(m[1]),
                    lufs: parseFloat(m[2])
                });
            }
        });

        ffmpeg.on('close', () => {
            if (samples.length === 0) {
                console.log('         No audio data (trying alternative method)...');
                resolve([]);
                return;
            }
            
            const avg = samples.reduce((a, s) => a + s.lufs, 0) / samples.length;
            const threshold = avg + 10;
            
            const peaks = [];
            let inPeak = false;
            let peakStart = 0;
            
            for (const s of samples) {
                if (s.lufs > threshold) {
                    if (!inPeak) {
                        inPeak = true;
                        peakStart = s.time;
                    }
                } else if (inPeak) {
                    peaks.push({ time: peakStart, lufs: avg });
                    inPeak = false;
                }
            }
            
            console.log(`         Baseline: ${avg.toFixed(1)} LUFS`);
            console.log(`         Threshold: ${threshold.toFixed(1)} LUFS`);
            console.log(`         Found ${peaks.length} audio peaks`);
            resolve(peaks);
        });
    });
}

async function extractFrame(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', ['-ss', String(t), '-i', VIDEO, '-vframes', '1',
            '-vf', 'scale=480:-1', '-q:v', '5', '-y', out])
            .on('close', (c) => c === 0 && fs.existsSync(out) ? res() : rej());
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Audio Energy Peak Detection');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const peaks = await analyzeAudio();
    
    if (peaks.length === 0) {
        console.log('⚠️  No audio peaks detected\n');
        return;
    }

    console.log('\n🎬 Extracting frames at peaks...\n');
    
    const frames = [];
    for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        const out = path.join(OUT_DIR, `peak-${String(i).padStart(2, '0')}-${p.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${peaks.length}] ${p.time.toFixed(1).padStart(4)}s `);
        
        try {
            await extractFrame(p.time, out);
            const sz = fs.statSync(out).size / 1024;
            frames.push({ ...p, sizeKB: sz });
            console.log(`✅ ${sz.toFixed(1)}KB`);
        } catch { console.log('❌'); }
    }

    const report = {
        video: VIDEO,
        duration: MAX_DUR,
        peaks: frames,
        timestamps: frames.map(f => f.time)
    };

    fs.writeFileSync(path.join(OUT_DIR, 'peaks.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Extracted ${frames.length} frames`);
    console.log(`   These are likely dialogue/narration moments`);
    console.log(`\n   Output: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
