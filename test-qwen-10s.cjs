#!/usr/bin/env node
const fs = require('fs');

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Qwen3.5-122B Video Test (10s)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Read the 10s video we just extracted
    const videoPath = '/tmp/test-10s.mp4';
    const buf = fs.readFileSync(videoPath);
    const b64 = buf.toString('base64');
    const dataUrl = `data:video/mp4;base64,${b64}`;
    
    console.log(`📹 Video: ${(buf.length / 1024 / 1024).toFixed(2)} MB (10 seconds)\n`);
    console.log('🤖 Sending to Qwen3.5-122B...\n');
    
    const prompt = 'You are a 17-year-old Gen Z viewer. Watch this Call of Duty trailer (first 10s) and describe your emotional reaction moment by moment. Rate patience 1-10, boredom 1-10, excitement 1-10. Be honest, teen voice. What would make you scroll?';
    
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen/qwen3.5-122b-a10b',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'video_url', video_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: 1500
            })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            console.error('❌ API Error:', JSON.stringify(data.error, null, 2));
            return;
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ SUCCESS! Qwen Response:\n');
        console.log(data.choices[0].message.content);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`Model: ${data.model}`);
        console.log(`Tokens: ${data.usage?.total_tokens || 'N/A'}`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main();
