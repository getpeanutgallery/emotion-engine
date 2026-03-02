#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 3-step pipeline in sequence
 * 
 * Usage: node scripts/run-pipeline.cjs <video-path> [output-dir]
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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const STEPS = [
    {
        name: 'Extract Dialogue',
        script: '01-extract-dialogue.cjs',
        output: '01-dialogue-analysis.md',
        description: 'Transcribe speech, identify speakers, detect emotions'
    },
    {
        name: 'Analyze Music',
        script: '02-extract-music.cjs',
        output: '02-music-analysis.md',
        description: 'Analyze music, SFX, audio atmosphere'
    },
    {
        name: 'Chunked Video Analysis',
        script: '03-analyze-chunks.cjs',
        output: '03-chunked-analysis.json',
        description: 'Process video chunks with context memory'
    }
];

function runStep(step, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`  Step ${index + 1}/3: ${step.name}`);
        console.log(`  ${step.description}`);
        console.log(`${'='.repeat(70)}\n`);
        
        const startTime = Date.now();
        const scriptPath = path.join(__dirname, step.script);
        
        const child = spawn('node', [scriptPath, VIDEO_PATH, OUTPUT_DIR], {
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (code === 0) {
                console.log(`\n✅ Step ${index + 1} complete (${duration}s)`);
                
                // Verify output was created
                const outputPath = path.join(OUTPUT_DIR, step.output);
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    console.log(`   Output: ${step.output} (${(stats.size / 1024).toFixed(1)} KB)`);
                    resolve();
                } else {
                    reject(new Error(`Output file missing: ${step.output}`));
                }
            } else {
                reject(new Error(`Step ${index + 1} failed with code ${code}`));
            }
        });
        
        child.on('error', (err) => {
            reject(new Error(`Failed to run step ${index + 1}: ${err.message}`));
        });
    });
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║         Emotion Engine - Complete Analysis Pipeline                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝');
    console.log(`\nVideo: ${VIDEO_PATH}`);
    console.log(`Output: ${OUTPUT_DIR}\n`);
    
    const pipelineStart = Date.now();
    
    try {
        // Run each step sequentially
        for (let i = 0; i < STEPS.length; i++) {
            await runStep(STEPS[i], i);
        }
        
        const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(1);
        
        console.log('\n' + '='.repeat(70));
        console.log('  🎉 PIPELINE COMPLETE!');
        console.log('='.repeat(70));
        console.log(`\n  Total time: ${totalDuration}s`);
        console.log(`  Output directory: ${OUTPUT_DIR}/`);
        console.log('\n  Files generated:');
        STEPS.forEach(step => {
            console.log(`    • ${step.output}`);
        });
        console.log('\n  Ready for final report generation:');
        console.log(`    node scripts/generate-report.cjs ${OUTPUT_DIR}`);
        console.log('='.repeat(70) + '\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n' + '='.repeat(70));
        console.error('  ❌ PIPELINE FAILED');
        console.error('='.repeat(70));
        console.error(`\n  Error: ${error.message}\n`);
        process.exit(1);
    }
}

main();
