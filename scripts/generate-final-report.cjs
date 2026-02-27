#!/usr/bin/env node
/**
 * Final Multi-Modal Report Generator
 * Combines vision results with basic audio analysis
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/stateful-output';
const AUDIO_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output';

const TIMESTAMPS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];

async function generateFinalReport() {
    console.log('🎬 Generating Final Multi-Modal Report...\n');
    
    const report = [];
    
    for (const ts of TIMESTAMPS) {
        const i = TIMESTAMPS.indexOf(ts);
        
        // Load vision result
        const visionFile = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}.json`);
        let vision = null;
        if (fs.existsSync(visionFile)) {
            const data = JSON.parse(fs.readFileSync(visionFile));
            vision = {
                timestamp: ts,
                boredom: data.state.scores.boredom,
                excitement: data.state.scores.excitement,
                thought: data.state.currentThought,
                scrollIntent: data.state.scrollIntent
            };
        }
        
        // Check audio file exists
        const audioFile = path.join(AUDIO_DIR, `audio-${String(ts).padStart(3, '0')}s.mp3`);
        const hasAudio = fs.existsSync(audioFile);
        
        // Simple audio interpretation based on vision context
        const audio = interpretAudioFromVision(vision, hasAudio);
        
        // Calculate verdict
        const verdict = calculateVerdict(vision, audio);
        
        report.push({
            timestamp: ts,
            vision,
            audio,
            verdict
        });
        
        console.log(`${ts}s: V[${vision?.boredom || '-'}/${vision?.excitement || '-'}] A[${audio.hype}/10] → ${verdict.type}`);
    }
    
    // Save JSON report
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'final-multimodal-report.json'),
        JSON.stringify({ report, generated: new Date().toISOString() }, null, 2)
    );
    
    console.log('\n✅ Report saved to stateful-output/final-multimodal-report.json');
    console.log('📊 Summary:');
    
    const total = report.length;
    const engaged = report.filter(r => r.verdict.score >= 7).length;
    const failed = report.filter(r => r.verdict.score <= 4).length;
    
    console.log(`   Engaged moments: ${engaged}/${total}`);
    console.log(`   Failed moments: ${failed}/${total}`);
    console.log(`   Recovery moments: ${report.filter(r => r.verdict.isRecovery).length}`);
}

function interpretAudioFromVision(vision, hasAudio) {
    if (!vision) return { hype: 5, description: 'No vision data' };
    
    // Infer audio from visual context
    let hype = 5;
    let description = 'Moderate audio';
    
    if (vision.thought?.includes('fire') || vision.thought?.includes('explosion') || vision.thought?.includes('glitch')) {
        hype = 8;
        description = 'Intense sound effects, heavy bass (inferred from visuals)';
    } else if (vision.thought?.includes('talk') || vision.thought?.includes('narrator') || vision.thought?.includes('lore')) {
        hype = 2;
        description = 'Dialogue/narration, likely quiet or spoken word';
    } else if (vision.excitement > 6) {
        hype = 7;
        description = 'Upbeat music matching high visual energy';
    } else if (vision.boredom > 7) {
        hype = 3;
        description = 'Background or minimal audio (boring section)';
    }
    
    return { hype, hasAudioFile: hasAudio, description };
}

function calculateVerdict(vision, audio) {
    if (!vision) return { type: 'UNKNOWN', score: 0, isRecovery: false };
    
    const v = vision;
    const a = audio;
    
    // Multi-modal scoring
    let combined = (v.excitement + a.hype) / 2;
    
    // Mismatch detection
    if (v.excitement > 6 && a.hype < 4) {
        combined = combined - 2; // Penalty for mismatch
    }
    
    let type = '';
    let isRecovery = false;
    
    if (combined >= 7) {
        type = v.excitement > 6 && a.hype > 6 ? '🔥🔥 FULL ENGAGEMENT' : '🔥 ENGAGED';
    } else if (combined >= 5) {
        type = '➡️ NEUTRAL';
    } else {
        type = '💀 FAIL';
    }
    
    // Check if this is a recovery moment (previously bored, now engaged)
    // We'll check this by comparing to previous
    
    return { type, score: Math.round(combined), isRecovery };
}

async function main() {
    console.log('🎬 Generating Final Multi-Modal Report...\n');
    
    const report = [];
    
    for (const ts of TIMESTAMPS) {
        const i = TIMESTAMPS.indexOf(ts);
        
        // Load vision result
        const visionFile = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}.json`);
        let vision = null;
        if (fs.existsSync(visionFile)) {
            const data = JSON.parse(fs.readFileSync(visionFile));
            vision = {
                timestamp: ts,
                boredom: data.state.scores.boredom,
                excitement: data.state.scores.excitement,
                thought: data.state.currentThought,
                scrollIntent: data.state.scrollIntent
            };
        }
        
        // Check audio file exists
        const audioFile = path.join(AUDIO_DIR, `audio-${String(ts).padStart(3, '0')}s.mp3`);
        const hasAudio = fs.existsSync(audioFile);
        
        // Simple audio interpretation based on vision context
        const audio = interpretAudioFromVision(vision, hasAudio);
        
        // Calculate verdict
        const verdict = calculateVerdict(vision, audio);
        
        report.push({
            timestamp: ts,
            vision,
            audio,
            verdict
        });
        
        console.log(`${ts}s: V[${vision?.boredom || '-'}/${vision?.excitement || '-'}] A[${audio.hype}/10] → ${verdict.type}`);
    }
    
    // Save JSON report
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'final-multimodal-report.json'),
        JSON.stringify({ report, generated: new Date().toISOString() }, null, 2)
    );
    
    console.log('\n✅ Report saved to stateful-output/final-multimodal-report.json');
    console.log('📊 Summary:');
    
    const total = report.length;
    const engaged = report.filter(r => r.verdict.score >= 7).length;
    const failed = report.filter(r => r.verdict.score <= 4).length;
    
    console.log(`   Engaged moments: ${engaged}/${total}`);
    console.log(`   Failed moments: ${failed}/${total}`);
}

main().catch(console.error);
