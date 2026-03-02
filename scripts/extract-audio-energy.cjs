#!/usr/bin/env node
/**
 * Audio Energy Peak Detection
 * Finds dialogue moments via RMS volume analysis
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/audio-energy';
const MAX_DURATION = 30;
const PEAK_THRESHOLD = 2.0;  // Must be 2x baseline energy

async function analyzeAudioEnergy() {
    console.log('   Analyzing audio energy...');
    const samples = [];
    const windowSize = 0.5;  // 500ms windows
    
    // Use ffmpeg ebur128 filter for loudness analysis
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO_PATH,
            '-t', String(MAX_DURATION),
            '-af', 'ebur128=peak=true:framelog=verbose',
            '-f', 'null', '-'
        ], { timeout: 60000 });

        let lastTime = 0;
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            
            // Parse momentary loudness (LUFS)
            const lufsMatch = line.match(/M:\s*(-?[\d.]+)\s*S:\s*(-?[\d.]+).*?time:(\d+:\d+:\d+\.\d+)/);
            if (lufsMatch) {
                const momentaryLUFS = parseFloat(lufsMatch[1]);
                const shortTermLUFS = parseFloat(lufsMatch[2]);
                const timeStr = lufsMatch[3];
                
                // Convert time string to seconds
                const [h, m, s] = timeStr.split(':').map(parseFloat);
                const time = h * 3600 + m * 60 + s;
                
                if (time <= MAX_DURATION) {
                    samples.push({
                        time,
                        momentary: momentaryLUFS,
                        shortTerm: shortTermLUFS
                    });
                }
            }
        });

        ffmpeg.on('close', () => {
            // Calculate baseline and find peaks
            const avgLUFS = samples.reduce((a, s) => a + s.momentary, 0) / samples.length;
            const threshold = avgLUFS + 8;  // 8 LUFS above average = significantly louder
            
            const peaks = [];
            let inPeak = false;
            let peakStart = 0;
            let maxLoudness = -100;
            
            for (let i = 0; i < samples.length; i++) {
                const s = samples[i];
                
                if (s.momentary > threshold) {
                    if (!inPeak) {
                        inPeak = true;
                        peakStart = s.time;
                        maxLoudness = s.momentary;
                    } else {
                        maxLoudness = Math.max(maxLoudness, s.momentary);
                    }
                } else if (inPeak) {
                    // End of peak
                    peaks.push({
                        time: peakStart,
                        type: 'audio-peak',
                        lufs: maxLoudness,
                        duration: s.time - peakStart
                    });
                    inPeak = false;
                    maxLoudness = -100;
                }
            }
            
            console.log(`         Baseline: ${avgLUFS.toFixed(1)} LUFS`);
            console.log(`         Threshold: ${threshold.toFixed(1)} LUFS (+8)`);
            console.log(`         Found ${peaks.length} audio peaks`);
            
            resolve(peaks);
        });
    });
}

async function extractFrame(t, out) {
    return new Promise((res, rej) => {
        spawn('ffmpeg', ['-ss', String(t), '-i', VIDEO_PATH, '-vframes', '1',
            '-vf', 'scale=480:-1', '-q:v', '5', '-y', out])
            .on('close', (c) => c === 0 && fs.existsSync(out) ? res() : rej());
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Audio Energy Peak Detection');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Detect audio peaks
    const audioPeaks = await analyzeAudioEnergy();
    
    console.log('\n🎬 Extracting frames at audio peaks...\n');
    
    const frames = [];
    for (let i = 0; i < audioPeaks.length; i++) {
        const peak = audioPeaks[i];
        const out = path.join(OUTPUT_DIR, 
            `peak-${String(i).padStart(2, '0')}-${peak.time.toFixed(1)}s-${peak.lufs.toFixed(0)}LUFS.jpg`
        );
        
        process.stdout.write(`   [${i + 1}/${audioPeaks.length}] ${peak.time.toFixed(1).padStart(4)}s ${peak.lufs.toFixed(0)}LUFS `);
        
        try {
            await extractFrame(peak.time, out);
            const size = fs.statSync(out).size / 1024;
            frames.push({ ...peak, sizeKB: size });
            console.log(`✅ ${size.toFixed(1)}KB`);
        } catch {
            console.log('❌');
        }
    }

    const report = {
        video: VIDEO_PATH,
        peaks: frames,
        timestamps: frames.map(f => f.time),
        generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'audio-peaks.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Extracted ${frames.length} frames at audio peaks`);
    console.log(`   Probably dialogue/narration moments`);
    console.log(`\n   Output: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
