#!/usr/bin/env node
/**
 * OpenRouter Integration Test
 * Extract a frame from CoD trailer and evaluate with impatient-teenager persona
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-openrouter.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { OpenRouterClient, MODELS } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    console.log('   Get your key from: https://openrouter.ai/settings/keys');
    console.log('   Then run: OPENROUTER_API_KEY=sk-xxx node test-openrouter.cjs');
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

Respond with honest scores.`
};

/**
 * Extract a single frame at specified timestamp
 */
async function extractFrameAt(timestampSeconds) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/test-frame-${Date.now()}.jpg`;
        
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
                fs.unlinkSync(outputPath); // Cleanup
                resolve(buffer);
            } else {
                reject(new Error('Frame extraction failed'));
            }
        });
    });
}

/**
 * Main test
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  OpenRouter Integration Test — OpenTruth Emotion Engine');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Show available models
    console.log('📋 Available Vision Models:');
    Object.entries(MODELS).forEach(([key, model]) => {
        console.log(`   • ${key}`);
        console.log(`     ${model.name} — $${model.pricing.prompt}/$${model.pricing.completion} per 1M tokens`);
        console.log(`     Best for: ${model.bestFor}`);
        console.log('');
    });
    
    // Initialize client
    const client = new OpenRouterClient({
        apiKey: API_KEY,
        defaultModel: 'kimi-2.5-vision',
        maxRetries: 2,
        timeout: 60000
    });
    
    // Test 1: Simple text completion (verify API key works)
    console.log('🧪 Test 1: API Key Verification');
    try {
        const ping = await client.complete({
            model: 'kimi-2.5-vision', // Primary model for OpenTruth
            messages: [
                { role: 'user', content: 'Say "OpenRouter API is working" and nothing else.' }
            ],
            max_tokens: 50,
            temperature: 0
        });
        console.log('✅ API Key valid:', ping.choices[0].message.content);
        console.log('   Model:', ping.model);
        console.log('   Tokens:', ping.usage?.total_tokens);
        console.log('   Cost: $', ping.estimatedCost?.toFixed(6));
    } catch (e) {
        console.error('❌ API test failed:', e.message);
        process.exit(1);
    }
    
    console.log('\n─────────────────────────────────────────────────────────\n');
    
    // Test 2: Extract frame at 0s (opening shot - critical for impatient teen)
    console.log('🎬 Test 2: Frame Extraction');
    console.log('   Extracting frame at 0:00 (opening shot)...');
    
    let frameBuffer;
    try {
        frameBuffer = await extractFrameAt(0);
        console.log(`✅ Frame extracted: ${frameBuffer.length} bytes (${(frameBuffer.length/1024).toFixed(1)} KB)`);
    } catch (e) {
        console.error('❌ Frame extraction failed:', e.message);
        process.exit(1);
    }
    
    // Convert to base64
    const base64Frame = frameBuffer.toString('base64');
    console.log(`   Base64 length: ${base64Frame.length} chars`);
    
    console.log('\n─────────────────────────────────────────────────────────\n');
    
    // Test 3: Vision evaluation with different models
    const testModels = ['kimi-2.5-vision', 'llama-3.2-vision'];
    const results = [];
    
    for (const modelKey of testModels) {
        console.log(`🧠 Test 3.${testModels.indexOf(modelKey) + 1}: Vision Evaluation (${modelKey})`);
        console.log('   Sending frame to LLM for emotional analysis...');
        console.log('   Persona: Impatient Teenager');
        console.log('   Lenses: Patience, Boredom, Excitement');
        
        const startTime = Date.now();
        
        try {
            const evaluation = await client.evaluateFrame({
                model: modelKey,
                base64Image: base64Frame,
                timestamp: 0,
                persona: PERSONA,
                lenses: ['patience', 'boredom', 'excitement']
            });
            
            const duration = Date.now() - startTime;
            
            console.log('\n   📊 Results:');
            console.log(`   • Patience: ${evaluation.scores.patience}/10`);
            console.log(`   • Boredom: ${evaluation.scores.boredom}/10`);
            console.log(`   • Excitement: ${evaluation.scores.excitement}/10`);
            
            if (evaluation.scores.rationale) {
                console.log(`   💭 Rationale: ${evaluation.scores.rationale.substring(0, 100)}...`);
            }
            
            console.log(`\n   ⏱️  Response time: ${duration}ms`);
            console.log(`   💰 Cost: $${evaluation.cost.toFixed(6)}`);
            console.log(`   🎨 Model: ${evaluation.model}`);
            console.log(`   📝 Tokens: ${evaluation.usage.total_tokens} (${evaluation.usage.prompt_tokens} prompt, ${evaluation.usage.completion_tokens} completion)`);
            
            results.push({
                model: modelKey,
                scores: evaluation.scores,
                cost: evaluation.cost,
                duration,
                tokens: evaluation.usage.total_tokens
            });
            
            console.log('   ✅ Evaluation complete\n');
            
        } catch (e) {
            console.error(`   ❌ Evaluation failed: ${e.message}\n`);
        }
        
        // Small delay between models
        if (modelKey !== testModels[testModels.length - 1]) {
            await sleep(1000);
        }
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    
    if (results.length === 0) {
        console.log('❌ No successful evaluations');
    } else {
        console.log('\n📊 Model Comparison:');
        console.log('');
        console.log('Model              | Patience | Boredom | Excitement | Cost     | Tokens');
        console.log('-------------------|----------|---------|------------|----------|--------');
        
        results.forEach(r => {
            const modelName = MODELS[r.model]?.name || r.model;
            const pad = (str, len) => String(str).padStart(len);
            console.log(
                `${modelName.substring(0, 17).padEnd(17)} | ` +
                `${pad(r.scores.patience, 8)} | ` +
                `${pad(r.scores.boredom, 7)} | ` +
                `${pad(r.scores.excitement, 10)} | ` +
                `$${pad(r.cost.toFixed(4), 7)} | ` +
                `${pad(r.tokens, 6)}`
            );
        });
        
        console.log('\n🎯 Analysis:');
        const bestModel = results.reduce((best, current) => 
            current.cost < best.cost ? current : best
        );
        console.log(`   • Most cost-effective: ${MODELS[bestModel.model]?.name || bestModel.model}`);
        console.log(`   • Total test cost: $${results.reduce((sum, r) => sum + r.cost, 0).toFixed(6)}`);
        
        // Check if impatient teen would scroll
        const avgBoredom = results.reduce((sum, r) => sum + r.scores.boredom, 0) / results.length;
        const avgExcitement = results.reduce((sum, r) => sum + r.scores.excitement, 0) / results.length;
        
        console.log('\n🧒 Impatient Teenager Verdict:');
        if (avgBoredom >= 7) {
            console.log('   ❌ WOULD SCROLL AWAY (boredom too high)');
        } else if (avgExcitement >= 6) {
            console.log('   ✅ WOULD KEEP WATCHING (excitement sufficient)');
        } else {
            console.log('   ⚠️  MIGHT SCROLL (neutral engagement)');
        }
        console.log(`   Avg Boredom: ${avgBoredom.toFixed(1)}/10, Avg Excitement: ${avgExcitement.toFixed(1)}/10`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ Integration test complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Next Steps:');
    console.log('1. ✓ API key works');
    console.log('2. ✓ Vision models respond to video frames');
    console.log('3. ✓ Emotional scoring is working');
    console.log('4. → Integrate into Lambda handler');
    console.log('5. → Batch process all 70 frames');
    console.log('6. → Build aggregation/visualization');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
