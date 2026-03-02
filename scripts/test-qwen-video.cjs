#!/usr/bin/env node
/**
 * Qwen3.5 Video Analysis Test
 * Send 30s video directly to qwen/qwen3.5-122b-a10b
 */

const fs = require('fs');
const path = require('path');

const VIDEO_PATH = '.dev-cache/9txkGBj_trg.mp4';
const MODEL = 'qwen/qwen3.5-122b-a10b';
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

// Extract first 30s of video and encode to base64
async function encodeVideoSegment(videoPath, duration = 30) {
    const { spawn } = require('child_process');
    const tempDir = fs.mkdtempSync('/tmp/qwen-video-');
    const outputPath = path.join(tempDir, 'segment-30s.mp4');
    
    console.log(`📹 Extracting first ${duration}s of video...`);
    
    await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', String(duration),
            '-c', 'copy',  // Copy without re-encoding for speed
            '-y',
            outputPath
        ]);
        
        ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('FFmpeg failed'));
        });
    });
    
    // Read and encode
    const buffer = fs.readFileSync(outputPath);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64}`;
    
    // Cleanup
    fs.unlinkSync(outputPath);
    fs.rmdirSync(tempDir);
    
    console.log(`   ✅ Encoded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    return dataUrl;
}

async function analyzeVideoWithQwen(videoDataUrl) {
    console.log('\n🤖 Sending to Qwen3.5-122B...\n');
    
    const prompt = `You are a 17-year-old Gen Z viewer who watches 200+ TikToks/YouTube Shorts per day.

Watch this Call of Duty: Black Ops 7 trailer (first 30 seconds) and analyze your emotional journey moment by moment.

For each significant moment, tell me:
1. What you see/hear
2. Your immediate emotional reaction (patience level, boredom, excitement)
3. Whether you're about to scroll away

Be brutally honest in teen voice. Rate things 1-10. Mention specific timestamps.

Format as a narrative journey.`;

    const startTime = Date.now();
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://opentruth.local',
                'X-Title': 'OpenTruth Video Test'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'video_url',
                                video_url: {
                                    url: videoDataUrl
                                }
                            }
                        ]
                    }
                ],
                stream: false,
                max_tokens: 2000
            })
        });
        
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Response received in ${duration}ms`);
        console.log(`   Model: ${data.model || MODEL}`);
        console.log(`   Tokens: ${data.usage?.total_tokens || 'N/A'}`);
        
        return data.choices[0].message.content;
        
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Qwen3.5-122B Video Analysis Test');
    console.log('  Sending 30s video directly to model');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    try {
        // Encode video
        const videoDataUrl = await encodeVideoSegment(VIDEO_PATH, 30);
        
        // Send to Qwen
        const analysis = await analyzeVideoWithQwen(videoDataUrl);
        
        // Save results
        const outputDir = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/reports/call-of-duty-7-trailer';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const outputPath = path.join(outputDir, 'qwen-video-analysis.txt');
        fs.writeFileSync(outputPath, analysis);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✅ Analysis Complete!');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('📝 Qwen Response:\n');
        console.log(analysis);
        console.log(`\n💾 Saved to: ${outputPath}\n`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (error.message.includes('does not support')) {
            console.log('\n💡 The model may not support video input.');
            console.log('   Try using google/gemini-2.5-flash instead (confirmed video support)');
        }
        
        process.exit(1);
    }
}

main();
