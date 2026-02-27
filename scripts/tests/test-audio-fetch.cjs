#!/usr/bin/env node
/**
 * Audio Test — Native Fetch API (OpenRouter Docs Format)
 * Using fs/promises and native fetch per official documentation
 */

const fs = require("fs/promises");

const API_KEY = process.env.OPENROUTER_API_KEY;
const AUDIO_FILE = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output/audio-000s.mp3';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

async function encodeAudioToBase64(audioPath) {
    const audioBuffer = await fs.readFile(audioPath);
    return audioBuffer.toString("base64");
}

async function testAudioFetch() {
    console.log('🎵 Testing OpenRouter Audio API with Native Fetch\n');
    
    // Read and encode the audio file
    console.log(`📁 Reading audio: ${AUDIO_FILE}`);
    const base64Audio = await encodeAudioToBase64(AUDIO_FILE);
    console.log(`   ✅ ${base64Audio.length} chars base64\n`);
    
    // Verify file exists and get info
    const stats = await fs.stat(AUDIO_FILE);
    console.log(`📊 Audio file size: ${(stats.size / 1024).toFixed(1)} KB`);
    
    console.log('\n🚀 Sending to OpenRouter...');
    console.log('   Endpoint: https://openrouter.ai/api/v1/chat/completions');
    console.log('   Model: google/gemini-2.5-flash');
    console.log('   Format: input_audio (snake_case per docs)\n');
    
    const startTime = Date.now();
    
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://opentruth.local",
                "X-Title": "OpenTruth Audio Test"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "You are a 17-year-old Gen Z viewer analyzing a Call of Duty trailer. Describe what you hear in this audio clip: music style, sound effects, energy level. Be brief, use teen voice. Rate hype level 1-10.",
                            },
                            {
                                type: "input_audio",
                                input_audio: {
                                    data: base64Audio,
                                    format: "mp3",
                                },
                            },
                        ],
                    },
                ],
            }),
        });
        
        const duration = Date.now() - startTime;
        
        console.log(`📡 Response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        
        if (data.error) {
            console.error('\n❌ API Error:', data.error);
            console.error('   Message:', data.error.message);
            console.error('   Code:', data.error.code);
            if (data.error.metadata) {
                console.error('   Metadata:', JSON.stringify(data.error.metadata, null, 2));
            }
            process.exit(1);
        }
        
        console.log('\n✅ SUCCESS!');
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Model used: ${data.model || 'unknown'}`);
        
        if (data.choices && data.choices[0]) {
            const content = data.choices[0].message?.content || '';
            console.log('\n📝 Response:\n');
            console.log(content);
            
            // Save result
            const output = {
                timestamp: new Date().toISOString(),
                duration,
                model: data.model,
                usage: data.usage,
                response: content,
                raw: data
            };
            
            await fs.writeFile(
                '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-fetch-test-result.json',
                JSON.stringify(output, null, 2)
            );
            
            console.log('\n💾 Saved to: audio-fetch-test-result.json');
        }
        
        if (data.usage) {
            console.log('\n📊 Token Usage:');
            console.log(`   Prompt: ${data.usage.prompt_tokens}`);
            console.log(`   Completion: ${data.usage.completion_tokens}`);
            console.log(`   Total: ${data.usage.total_tokens}`);
        }
        
    } catch (error) {
        console.error('\n💥 Fetch error:', error.message);
        if (error.cause) {
            console.error('   Cause:', error.cause.message);
        }
        process.exit(1);
    }
}

testAudioFetch().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
