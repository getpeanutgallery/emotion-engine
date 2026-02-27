#!/usr/bin/env node
/**
 * Batch Frame Evaluation Test
 * Process multiple frames through OpenRouter and aggregate results
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-batch.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { OpenRouterClient } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

// Impatient Teenager persona
const PERSONA = {
    id: 'impatient-teenager',
    name: 'The Impatient Teenager',
    description: 'A 16-19 year old who consumes TikTok/YouTube Shorts/Instagram Reels constantly. They have been conditioned by algorithmic feeds to expect instant gratification.',
    conflict: 'Abandons content if the hook takes longer than 3 seconds to appear.',
    systemPrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day. Your attention span has been shaped by TikTok's algorithm.

You have ZERO patience for:
- Logo animations or intro sequences
- Slow buildup to the main content
- Corporate speak or buzzwords
- Poor video quality or boring visuals
- Videos that don't get to the point immediately

You will happily scroll away if bored. Be brutally honest about when you'd skip this video.

Rate emotions on 1-10 scale where:
- Boredom 8+ = You'd scroll away NOW
- Excitement 7+ = You'd watch to the end
- Patience 3- = You're already annoyed

Respond with ONLY a JSON object containing the scores and a brief rationale.`
};

/**
 * Extract frames at specific timestamps
 */
async function extractFrames(timestamps) {
    console.log(`🎬 Extracting ${timestamps.length} frames...`);
    const frames = [];
    
    for (const timestamp of timestamps) {
        const buffer = await extractFrameAt(timestamp);
        frames.push({
            timestamp: timestamp * 1000, // convert to ms
            base64: buffer.toString('base64')
        });
        console.log(`   ✅ Frame at ${timestamp}s: ${(buffer.length/1024).toFixed(1)} KB`);
    }
    
    return frames;
}

async function extractFrameAt(timestampSeconds) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/batch-frame-${timestampSeconds}.jpg`;
        
        const args = [
            '-ss', String(timestampSeconds),
            '-i', VIDEO_PATH,
            '-vframes', '1',
            '-vf', 'scale=480:-1',
            '-q:v', '5',
            '-f', 'image2',
            outputPath
        ];
        
        const ffmpeg = spawn('ffmpeg', args);
        
        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
                const buffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve(buffer);
            } else {
                reject(new Error('Frame extraction failed'));
            }
        });
    });
}

/**
 * Batch evaluate frames
 */
async function evaluateFrames(client, frames) {
    console.log('\n🧠 Evaluating frames with OpenRouter...');
    const results = [];
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const timestampSec = (frame.timestamp / 1000).toFixed(1);
        
        process.stdout.write(`   [${i + 1}/${frames.length}] ${timestampSec}s... `);
        
        try {
            const startTime = Date.now();
            const evaluation = await client.evaluateFrame({
                model: 'kimi-2.5-vision',
                base64Image: frame.base64,
                timestamp: frame.timestamp,
                persona: PERSONA,
                lenses: ['patience', 'boredom', 'excitement']
            });
            
            const duration = Date.now() - startTime;
            process.stdout.write(`✅ (${duration}ms, $${evaluation.cost.toFixed(4)})\n`);
            
            results.push({
                timestamp: frame.timestamp,
                scores: evaluation.scores,
                cost: evaluation.cost,
                duration
            });
            
            // Small delay to avoid rate limits
            if (i < frames.length - 1) {
                await sleep(500);
            }
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
            results.push({
                timestamp: frame.timestamp,
                error: e.message
            });
        }
    }
    
    return results;
}

/**
 * Build timeline and aggregate metrics
 */
function analyzeResults(results) {
    console.log('\n📊 Building Timeline...');
    
    // Valid results only
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
        console.error('❌ No valid results');
        return null;
    }
    
    // Timeline data
    const timeline = validResults.map(r => ({
        timestamp: r.timestamp,
        patience: r.scores.patience,
        boredom: r.scores.boredom,
        excitement: r.scores.excitement
    }));
    
    // Find peak boredom and lowest excitement
    const peakBoredom = validResults.reduce((max, r) => 
        r.scores.boredom > max.scores.boredom ? r : max
    );
    
    const peakExcitement = validResults.reduce((max, r) => 
        r.scores.excitement > max.scores.excitement ? r : max
    );
    
    // Abandonment point (when boredom hits 8+)
    const abandonmentPoint = validResults.find(r => r.scores.boredom >= 8);
    
    // Calculate friction index
    const avgBoredom = validResults.reduce((sum, r) => sum + r.scores.boredom, 0) / validResults.length;
    const avgExcitement = validResults.reduce((sum, r) => sum + r.scores.excitement, 0) / validResults.length;
    const frictionIndex = Math.round(((avgBoredom + (10 - avgExcitement)) / 2) * 10);
    
    // Totals
    const totalCost = validResults.reduce((sum, r) => sum + r.cost, 0);
    const avgDuration = validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length;
    
    return {
        timeline,
        peakBoredom,
        peakExcitement,
        abandonmentPoint,
        frictionIndex,
        totalCost,
        avgDuration,
        frameCount: validResults.length
    };
}

/**
 * Print timeline visualization
 */
function printTimeline(analysis) {
    console.log('\n📈 Engagement Timeline:');
    console.log('');
    console.log('Time  | Patience | Boredom | Excitement | Verdict');
    console.log('------|----------|---------|------------|--------');
    
    analysis.timeline.forEach(point => {
        const time = String(Math.round(point.timestamp / 1000)).padStart(3);
        const patience = String(point.patience).padStart(8);
        const boredom = String(point.boredom).padStart(7);
        const excitement = String(point.excitement).padStart(10);
        
        let verdict = '✓';
        if (point.boredom >= 8) verdict = '❌ SCROLL';
        else if (point.excitement >= 7) verdict = '🔥 ENGAGED';
        else if (point.patience <= 3) verdict = '⚠️  ANNOYED';
        
        console.log(`${time}s | ${patience} | ${boredom} | ${excitement} | ${verdict}`);
    });
    
    console.log('\n📊 Key Moments:');
    console.log(`   • Peak Boredom: ${(analysis.peakBoredom.timestamp / 1000).toFixed(1)}s (score: ${analysis.peakBoredom.scores.boredom}/10)`);
    console.log(`   • Peak Excitement: ${(analysis.peakExcitement.timestamp / 1000).toFixed(1)}s (score: ${analysis.peakExcitement.scores.excitement}/10)`);
    
    if (analysis.abandonmentPoint) {
        console.log(`   • ⚠️  Abandonment Risk: ${(analysis.abandonmentPoint.timestamp / 1000).toFixed(1)}s`);
    }
    
    console.log(`\n🎯 Friction Index: ${analysis.frictionIndex}/100`);
    console.log(`   ${analysis.frictionIndex > 70 ? '❌ HIGH FRICTION' : analysis.frictionIndex > 40 ? '⚠️  MODERATE' : '✅ LOW FRICTION'}`);
    
    console.log(`\n💰 Total Cost: $${analysis.totalCost.toFixed(4)} (${analysis.frameCount} frames)`);
    console.log(`⏱️  Avg Response Time: ${Math.round(analysis.avgDuration)}ms per frame`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Batch Frame Evaluation — OpenTruth Emotion Engine');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Initialize client
    const client = new OpenRouterClient({
        apiKey: API_KEY,
        defaultModel: 'kimi-2.5-vision',
        maxRetries: 2,
        timeout: 60000
    });
    
    // Select key frames for analysis (not all 70, just strategic moments)
    const keyTimestamps = [
        0,    // Opening
        3,    // Should be hooked by now
        10,   // Early content
        30,   // 30s mark
        60,   // 1 minute
        90,   // 1:30
        120,  // 2:00
        138   // End
    ];
    
    console.log(`🎯 Analyzing ${keyTimestamps.length} key moments`);
    console.log(`   Video: Call of Duty: Black Ops 7 Trailer (2:20)`);
    console.log(`   Persona: Impatient Teenager`);
    console.log('');
    
    // Extract frames
    const frames = await extractFrames(keyTimestamps);
    
    // Evaluate
    const results = await evaluateFrames(client, frames);
    
    // Analyze
    const analysis = analyzeResults(results);
    
    if (analysis) {
        printTimeline(analysis);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Final Verdict');
        console.log('═══════════════════════════════════════════════════════════');
        
        if (analysis.abandonmentPoint) {
            const time = (analysis.abandonmentPoint.timestamp / 1000).toFixed(1);
            console.log(`\n❌ The Impatient Teenager would SCROLL AWAY at ${time}s`);
            console.log(`   Reason: Boredom hit ${analysis.abandonmentPoint.scores.boredom}/10`);
        } else if (analysis.frictionIndex > 70) {
            console.log(`\n⚠️  The Impatient Teenager is STRUGGLING but might finish`);
            console.log(`   Friction Index: ${analysis.frictionIndex}/100 (high friction)`);
        } else {
            console.log(`\n✅ The Impatient Teenager would WATCH TO THE END`);
            console.log(`   Friction Index: ${analysis.frictionIndex}/100 (low friction)`);
        }
        
        console.log(`\n💡 Recommendation:`);
        if (analysis.peakBoredom.timestamp < 10000) {
            console.log(`   The opening is too slow. Cut the first ${(analysis.peakBoredom.timestamp / 1000).toFixed(0)} seconds.`);
        } else if (analysis.timeline[0].excitement < 5) {
            console.log(`   The hook isn't strong enough. Add a faster-paced intro.`);
        } else {
            console.log(`   Content pacing is good, but watch for boredom spikes.`);
        }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
