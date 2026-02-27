#!/usr/bin/env node
/**
 * Quick Stateful Test — 3 Frames with GPT-4o Mini
 * Faster, cheaper, more reliable JSON output
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-stateful-quick.cjs
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

async function extractFrame(timestamp) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/quick-frame-${timestamp}.jpg`;
        const args = ['-ss', String(timestamp), '-i', VIDEO_PATH, '-vframes', '1', '-vf', 'scale=480:-1', '-q:v', '5', outputPath];
        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                const buffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve(buffer);
            } else reject(new Error('Failed'));
        });
    });
}

async function main() {
    console.log('🎯 Quick Stateful Test (3 Frames)\n');
    
    const client = new OpenRouterClient({ apiKey: API_KEY, maxRetries: 2 });
    
    // Just 3 key frames
    const timestamps = [0, 10, 20];
    const results = [];
    
    for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        process.stdout.write(`${ts}s: Extracting... `);
        const buffer = await extractFrame(ts);
        process.stdout.write(`${(buffer.length/1024).toFixed(1)}KB → `);
        
        // Build stateful prompt
        let prompt;
        if (i === 0) {
            prompt = `You are a 17-year-old Gen Z viewer with zero patience. This is the OPENING frame at ${ts}s. Rate your emotions 1-10 (patience, boredom, excitement, frustration, clarity) and give a 1-sentence reaction. Output ONLY JSON like {"patience": 3, "boredom": 8, "excitement": 2, "frustration": 6, "clarity": 2, "thought": "your reaction here"}`;
        } else {
            const prev = results[i-1];
            prompt = `You are a 17-year-old Gen Z viewer. Your previous state at ${timestamps[i-1]}s was: boredom ${prev.boredom}/10, excitement ${prev.excitement}/10, thought: "${prev.thought}". Now at ${ts}s, how do you feel? Has it gotten better or worse? Output ONLY JSON with updated scores and new thought.`;
        }
        
        try {
            const result = await client.complete({
                model: 'gpt-4o-mini',  // Faster, cheaper, reliable
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}`, detail: 'high' } }] }
                ],
                max_tokens: 300,
                temperature: 0.3
            });
            
            // Parse
            let content = result.choices[0].message.content;
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                // Extract with regex
                const numbers = content.match(/\d+/g);
                const thought = content.match(/"thought":\s*"([^"]+)"/);
                parsed = {
                    patience: numbers?.[0] || 5,
                    boredom: numbers?.[1] || 5,
                    excitement: numbers?.[2] || 5,
                    frustration: numbers?.[3] || 5,
                    clarity: numbers?.[4] || 5,
                    thought: thought?.[1] || 'No thought'
                };
            }
            
            process.stdout.write(`B${parsed.boredom} E${parsed.excitement} "${parsed.thought.substring(0, 40)}..." ($${result.estimatedCost?.toFixed(4) || '0.0001'})\n`);
            
            results.push({
                timestamp: ts,
                ...parsed,
                stateChange: i === 0 ? 'initial' : parsed.boredom > results[i-1].boredom ? 'worsening' : parsed.boredom < results[i-1].boredom ? 'improving' : 'stable'
            });
            
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
        }
        
        if (i < timestamps.length - 1) await sleep(500);
    }
    
    // Summary
    console.log('\n📊 Emotional Journey:');
    results.forEach((r, i) => {
        const arrow = i === 0 ? '→' : r.stateChange === 'worsening' ? '↓' : r.stateChange === 'improving' ? '↑' : '→';
        console.log(`  ${r.timestamp}s: B${r.boredom} E${r.excitement} ${arrow} "${r.thought.substring(0, 50)}"`);
    });
    
    const avgBoredom = results.reduce((s, r) => s + parseInt(r.boredom), 0) / results.length;
    const avgExcitement = results.reduce((s, r) => s + parseInt(r.excitement), 0) / results.length;
    
    console.log(`\n🎯 Average: Boredom ${avgBoredom.toFixed(1)}/10, Excitement ${avgExcitement.toFixed(1)}/10`);
    console.log(`🧒 Verdict: ${avgBoredom > 7 ? '❌ WOULD SCROLL' : avgExcitement > 6 ? '🔥 ENGAGED' : '⚠️ AT RISK'}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(console.error);
