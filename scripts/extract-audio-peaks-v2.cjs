#!/usr/bin/env node
/**
 * Audio Peak Detection - Alternative Method
 * Uses volume analysis with sliding window
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const OUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/audio-energy';
const MAX_DUR = 30;

async function detectAudioPeaks() {
    console.log('   Analyzing audio peaks (volume-based)...');
    const tempDir = fs.mkdtempSync('/tmp/audio-');
    const audioPath = path.join(tempDir, 'audio.wav');
    
    // Extract audio first
    await new Promise((resolve) => {
        spawn('ffmpeg', ['-i', VIDEO, '-t', String(MAX_DUR), '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-y', audioPath])
            .on('close', resolve);
    });
    
    // Get volume data per 100ms window
    const volumes = [];
    const windowSize = 0.1; // 100ms
    
    return new Promise((resolve) => {
        // Use silencedetect with very sensitive threshold
        const ffmpeg = spawn('ffmpeg', [
            '-i', audioPath,
            '-af', 'silencedetect=noise=-30dB:d=0.2',
            '-f', 'null', '-'
        ]);
        
        let silenceStart = 0;
        let silenceEnd = 0;
        const soundSegments = [];
        
        ffmpeg.stderr.on('data', (d) => {
            const line = d.toString();
            
            const startMatch = line.match(/silence_start: ([0-9.]+)/);
            const endMatch = line.match(/silence_end: ([0-9.]+)/);
            
            if (startMatch) {
                silenceStart = parseFloat(startMatch[1]);
                // If we had a sound segment before this silence, save it
                if (silenceEnd > 0 && silenceStart - silenceEnd > 0.3) {
                    soundSegments.push({
                        start: silenceEnd,
                        end: silenceStart,
                        duration: silenceStart - silenceEnd
                    });
                }
            }
            
            if (endMatch) {
                silenceEnd = parseFloat(endMatch[1]);
            }
        });
        
        ffmpeg.on('close', () => {
            fs.rmSync(tempDir, { recursive: true });
            
            // Convert sound segments to peak points (start of each sound)
            const peaks = soundSegments
                .filter(s => s.duration > 0.5 && s.duration < 10) // Filter very short or very long
                .map(s => ({
                    time: s.start,
                    duration: s.duration,
                    type: 'audio-peak'
                }));
            
            console.log(`         Found ${peaks.length} sound segments`);
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
    console.log('  Audio Peak Detection v2');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const peaks = await detectAudioPeaks();
    
    if (peaks.length === 0) {
        console.log('⚠️  No distinct audio peaks found\n');
        console.log('   (Trailer likely has continuous loud music)\n');
        return;
    }

    console.log('\n🎬 Extracting frames at audio peaks...\n');
    
    const frames = [];
    for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        const out = path.join(OUT_DIR, `peak-${String(i).padStart(2, '0')}-${p.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${peaks.length}] ${p.time.toFixed(1).padStart(4)}s (${p.duration.toFixed(1)}s duration) `);
        
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

    fs.writeFileSync(path.join(OUT_DIR, 'audio-peaks.json'), JSON.stringify(report, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Extracted ${frames.length} frames at audio peaks`);
    console.log(`   These mark likely dialogue/narration starts`);
    console.log(`\n   Output: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
