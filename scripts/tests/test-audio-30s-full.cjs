#!/usr/bin/env node
/**
 * Full 30s Audio Analysis — Single Shot
 * No stateful progression, just one big audio dump + vision summary
 */

const fs = require("fs/promises");
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;
const AUDIO_FILE = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output/full-30s.mp3';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/stateful-output';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

async function encodeAudioToBase64(audioPath) {
    const audioBuffer = await fs.readFile(audioPath);
    return audioBuffer.toString("base64");
}

async function loadAllVisionResults() {
    const TIMESTAMPS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    const visionData = [];
    for (let i = 0; i < TIMESTAMPS.length; i++) {
        const frameFile = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}.json`);
        try {
            const data = JSON.parse(await fs.readFile(frameFile, 'utf8'));
            visionData.push({
                timestamp: data.frame.timestampSec,
                scores: data.state.scores,
                thought: data.state.currentThought,
                scrollIntent: data.state.scrollIntent
            });
        } catch (e) {}
    }
    return visionData;
}

function buildVisionJourney(visionData) {
    return visionData.map(v => 
        `[${v.timestamp}s]: Boredom ${v.scores.boredom}/10, Excitement ${v.scores.excitement}/10. Thought: "${v.thought?.substring(0, 70)}..." ${v.scrollIntent === 'yes' ? '⚠️ NEARLY SCROLLED' : ''}`
    ).join('\n');
}

async function analyzeFullAudio(base64Audio, visionJourney) {
    const prompt = `You are a 17-year-old Gen Z viewer who just watched a Call of Duty: Black Ops 7 trailer.

Here is your COMPLETE VISUAL EMOTIONAL JOURNEY over 30 seconds:

${visionJourney}

---

NOW LISTEN TO THE ENTIRE 30-SECOND AUDIO TRACK in one go.

Describe the audio experience as a NARRATIVE JOURNEY:
1. How does the audio START? (0-3s)
2. How does it BUILD or CHANGE? (middle sections)
3. Where does it PEAK or CRASH? (notable moments)
4. How does it END? (final impression)

Key questions:
- What is the dominant music genre/style throughout?
- Where are the major energy shifts? (timestamp them approximately)
- Does the audio match or contradict the emotional journey above?
- Did audio SAVE any boring moments? Or KILL exciting ones?
- Most memorable sound element?

Rate overall:
- hypeLevel: 1-10 (overall hype throughout)
- consistency: 1-10 (does audio quality/style stay consistent?)
- variety: 1-10 (enough variation to stay interesting?)
- syncQuality: 1-10 (audio matches visual energy?)

Final verdict: Would you watch based on audio alone? (yes/maybe/no + why)

Be authentic Gen Z voice. Brief but tell the STORY of the audio.

Respond with JSON containing narrative and ratings.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://opentruth.local",
            "X-Title": "OpenTruth 30s Audio Analysis"
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "input_audio",
                            input_audio: { data: base64Audio, format: "mp3" }
                        }
                    ]
                }
            ],
            max_tokens: 64000,
            temperature: 0.4
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    let content = data.choices[0].message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        parsed = { rawResponse: content.substring(0, 500), parseError: e.message };
    }
    
    return {
        ...parsed,
        usage: data.usage,
        rawResponse: content.substring(0, 400)
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Full 30s Audio Analysis — Single Shot');
    console.log('  One big audio file, no stateful progression');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 Loading complete vision journey...');
    const visionData = await loadAllVisionResults();
    const visionJourney = buildVisionJourney(visionData);
    console.log(`   ✅ Loaded ${visionData.length} vision frames\n`);
    
    console.log('🎵 Encoding 30s audio (this may take a moment)...');
    const base64Audio = await encodeAudioToBase64(AUDIO_FILE);
    const stats = await fs.stat(AUDIO_FILE);
    console.log(`   ✅ ${(stats.size / 1024).toFixed(0)}KB → ${base64Audio.length.toLocaleString()} chars base64\n`);
    
    console.log('🚀 Sending to Gemini (30s audio + vision context)...');
    console.log('   This is a single call, not 11 sequential calls');
    console.log('   Model will hear the FULL audio journey at once\n');
    
    const startTime = Date.now();
    const analysis = await analyzeFullAudio(base64Audio, visionJourney);
    const duration = Date.now() - startTime;
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Full 30s Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n⏱️  Duration: ${duration}ms`);
    console.log(`📊 Tokens: ${analysis.usage?.total_tokens || 'N/A'}`);
    console.log(`💰 Cost: $${(analysis.usage?.total_tokens * 0.0000005).toFixed(4) || 'N/A'}`);
    
    console.log('\n📝 Response:\n');
    console.log(analysis.rawResponse.substring(0, 800));
    if (analysis.rawResponse.length > 800) console.log('\n... (truncated)');
    
    // Save
    const outputDir = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output/30s-96kbps';
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
        path.join(outputDir, 'audio-analysis-full.json'),
        JSON.stringify({
            audioFile: AUDIO_FILE,
            fileSize: stats.size,
            visionJourneySummary: visionJourney.substring(0, 500) + '...',
            analysis,
            processedAt: new Date().toISOString()
        }, null, 2)
    );
    
    // Copy audio file to archive
    await fs.copyFile(AUDIO_FILE, path.join(outputDir, 'full-30s.mp3'));
    await fs.rm(AUDIO_FILE); // Remove from root
    
    console.log(`\n📁 Saved to: ${outputDir}/`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
