#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 3-step pipeline in sequence
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_PATH = process.argv[2] || '.dev-cache/9txkGBj_trg.mp4';
const OUTPUT_DIR = process.argv[3] || './analysis-output';

if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Video not found: ${VIDEO_PATH}`);
    process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const STEPS = [
    { name: 'Extract Dialogue', script: '01-extract-dialogue.cjs', output: '01-dialogue-analysis.md' },
    { name: 'Analyze Music', script: '02-extract-music.cjs', output: '02-music-analysis.md' },
    { name: 'Chunked Video Analysis', script: '03-analyze-chunks.cjs', output: '03-chunked-analysis.json' }
];

function runStep(step, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  Step ${index + 1}/3: ${step.name}`);
        console.log(`${'='.repeat(60)}\n`);
        
        const scriptPath = path.join(__dirname, step.script);
        const child = spawn('node', [scriptPath, VIDEO_PATH, OUTPUT_DIR], { stdio: 'inherit' });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ Step ${index + 1} complete`);
                resolve();
            } else {
                reject(new Error(`Step ${index + 1} failed with code ${code}`));
            }
        });
    });
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         Emotion Engine - Complete Pipeline               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\nVideo: ${VIDEO_PATH}`);
    console.log(`Output: ${OUTPUT_DIR}\n`);
    
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await runStep(STEPS[i], i);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('  🎉 PIPELINE COMPLETE!');
        console.log('='.repeat(60));
        console.log(`\n  Next: node scripts/generate-report.cjs ${OUTPUT_DIR}`);
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('\n❌ PIPELINE FAILED:', error.message);
        process.exit(1);
    }
}

main();
