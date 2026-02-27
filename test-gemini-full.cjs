#!/usr/bin/env node
const fs = require('fs');
const { spawn } = require('child_process');

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

const MODEL = 'google/gemini-2.5-flash';
const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';

async function testFullVideo() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Gemini FULL Video Test (30s)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const tmpDir = fs.mkdtempSync('/tmp/gemini-full-');
    const videoPath = tmpDir + '/full-30s.mp4';
    
    console.log('📹 Extracting 30s...');
    await new Promise((res) => {
        spawn('ffmpeg', ['-ss', '0', '-i', VIDEO_PATH, '-t', '30', '-vf', 'scale=720:-1', '-c:v', 'libx264', '-b:v', '1.5M', '-y', videoPath]).on('close', res);
    });
    
    const sizeMB = fs.statSync(videoPath).size / 1024 / 1024;
    console.log(`   Size: ${sizeMB.toFixed(2)} MB\n`);
    
    console.log('🔐 Encoding to base64...');
    const buf = fs.readFileSync(videoPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
    
    console.log('🤖 Sending to Gemini...');
    const startTime = Date.now();
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                        { type: 'text', text: 'Describe what happens in this 30s Call of Duty trailer moment by moment. Be brief.' },
                        { type: 'video_url', video_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: 1000
            })
        });
        
        const duration = Date.now() - startTime;
        const data = await response.json();
        fs.rmSync(tmpDir, { recursive: true });
        
        console.log('\n═══════════════════════════════════════════════════════════');
        
        if (response.ok) {
            console.log('✅ SUCCESS!');
            console.log(`   Duration: ${duration}ms`);
            console.log(`   Tokens: ${data.usage?.total_tokens || 'N/A'}`);
            console.log('\n📝 Response:');
            console.log(data.choices[0].message.content);
            return { success: true, size: sizeMB };
        } else {
            console.log('❌ FAILED');
            console.log(`   Error: ${data.error?.message || response.status}`);
            if (data.error?.message?.includes('limit') || data.error?.message?.includes('size')) {
                console.log('\n⚠️  SIZE LIMIT HIT - Same as Qwen (10MB)');
            }
            return { success: false, error: data.error?.message };
        }
    } catch (e) {
        fs.rmSync(tmpDir, { recursive: true });
        console.log('\n❌ ERROR:', e.message);
        return { success: false };
    }
}

testFullVideo().then(r => {
    console.log('\n═══════════════════════════════════════════════════════════');
    if (r.success) {
        console.log(`🎉 Gemini handled ${r.size.toFixed(2)}MB!`);
    } else {
        console.log('⚠️  Failed - likely 10MB limit');
    }
});
