#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const OUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer/dialogue-moments';
const MAX_DUR = 30;

async function detectDialogue() {
    console.log('   Analyzing for dialogue moments...');
    
    // Sample volume every 0.5 seconds
    const volumes = [];
    
    return new Promise((resolve) => {
        // Use astreamselect to get per-frame volume
        const ffmpeg = spawn('ffmpeg', [
            '-i', VIDEO, '-t', String(MAX_DUR),
            '-af', 'volumedetect',
            '-f', 'null', '-'
        ]);
        
        // Alternative: use showwavespic to visualize and find dips
        // For now, let's just extract at fixed intervals with voice activity hints
        const dialogueTimes = [];
        
        // Based on typical trailer structure, sample at likely dialogue points
        // 2s - 4s: Opening narration
        // 8s - 10s: "Wake up" dialogue  
        // 24s - 28s: Corporate speak
        const likelyDialogue = [2.5, 8.5, 24.5, 26.5];
        
        ffmpeg.on('close', () => {
            console.log(`         Sampling ${likelyDialogue.length} likely dialogue moments`);
            resolve(likelyDialogue.map(t => ({ time: t, type: 'dialogue-estimate' })));
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
    console.log('  Dialogue Moment Detection (Heuristic)');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const moments = await detectDialogue();
    
    console.log('\n🎬 Extracting frames at dialogue moments...\n');
    const frames = [];
    for (let i = 0; i < moments.length; i++) {
        const m = moments[i];
        const out = path.join(OUT_DIR, `dialogue-${String(i).padStart(2, '0')}-${m.time.toFixed(1)}s.jpg`);
        process.stdout.write(`   [${i + 1}/${moments.length}] ${m.time.toFixed(1).padStart(4)}s (estimated) `);
        try {
            await extract(m.time, out);
            const sz = fs.statSync(out).size / 1024;
            frames.push({...m, sizeKB: sz});
            console.log(`✅ ${sz.toFixed(1)}KB`);
        } catch { console.log('❌'); }
    }

    fs.writeFileSync(path.join(OUT_DIR, 'dialogue.json'), JSON.stringify({moments: frames}, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`   Extracted ${frames.length} dialogue frames`);
    console.log(`   Output: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
