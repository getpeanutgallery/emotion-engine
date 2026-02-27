#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VIDEO = '.dev-cache/9txkGBj_trg.mp4';
const MODEL = 'qwen/qwen3.5-122b-a10b';
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

async function encodeVideo(videoPath, duration = 30) {
    const tmp = fs.mkdtempSync('/tmp/qwen-');
    const out = path.join(tmp, 'segment.mp4');
    
    console.log(`📹 Extracting ${duration}s...`);
    await new Promise((res, rej) => {
        spawn('ffmpeg', ['-i', videoPath, '-t', String(duration), '-c', 'copy', '-y', out])
            .on('close', (c) => c === 0 ? res() : rej());
    });
    
    const buf = fs.readFileSync(out);
    const b64 = buf.toString('base64');
    fs.rmSync(tmp, { recursive: true });
    
    console.log(`   ✅ ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
    return `data:video/mp4;base64,${b64}`;
}

async function analyze(dataUrl) {
    console.log('\n🤖 Sending to Qwen3.5-122B...\n');
    
    const prompt = 'You are a 17-year-old Gen Z viewer. Watch this Call of Duty trailer (30s) and describe your emotional journey moment by moment. Rate patience/boredom/excitement 1-10. Be honest, teen voice. Mention timestamps.';
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'video_url', video_url: { url: dataUrl } }
                ]
            }],
            max_tokens: 2000
        })
    });
    
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Qwen3.5-122B Video Test');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    try {
        const dataUrl = await encodeVideo(VIDEO, 30);
        const analysis = await analyze(dataUrl);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(analysis);
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (e) {
        console.error('\n❌', e.message);
        if (e.message.includes('support')) {
            console.log('\n💡 Try: google/gemini-2.5-flash (confirmed video support)');
        }
        process.exit(1);
    }
}

main();
