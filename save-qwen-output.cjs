#!/usr/bin/env node
const fs = require('fs');

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error('❌ OPENROUTER_API_KEY not set'); process.exit(1); }

async function main() {
    console.log('Re-running Qwen test and saving output...\n');
    
    const videoPath = '/tmp/test-10s.mp4';
    const buf = fs.readFileSync(videoPath);
    const b64 = buf.toString('base64');
    const dataUrl = `data:video/mp4;base64,${b64}`;
    
    const prompt = 'You are a 17-year-old Gen Z viewer. Watch this Call of Duty trailer (first 10s) and describe your emotional reaction moment by moment. Rate patience 1-10, boredom 1-10, excitement 1-10. Be honest, teen voice. What would make you scroll?';
    
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
    const analysis = data.choices[0].message.content;
    
    // Save to file
    const outDir = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer';
    const outPath = outDir + '/qwen-10s-analysis.txt';
    fs.writeFileSync(outPath, `MODEL: ${data.model}\nTOKENS: ${data.usage?.total_tokens || 'N/A'}\n\n${analysis}`);
    
    console.log('✅ Saved to:', outPath);
    console.log('\n--- FULL OUTPUT ---\n');
    console.log(analysis);
}

main().catch(console.error);
