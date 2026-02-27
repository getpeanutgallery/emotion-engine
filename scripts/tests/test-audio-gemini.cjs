#!/usr/bin/env node
/**
 * Audio Analysis with Gemini 2.5 Flash (Working Audio LLM)
 * Actually HEARS the audio using fetch API + Gemini
 * Replaces audio-analysis-###.json with real LLM interpretations
 */

const fs = require("fs/promises");
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;
const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const AUDIO_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output';
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/stateful-output';

const TIMESTAMPS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

async function encodeAudioToBase64(audioPath) {
    const audioBuffer = await fs.readFile(audioPath);
    return audioBuffer.toString("base64");
}

async function loadVisionResults() {
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
        } catch (e) {
            console.warn(`⚠️ Could not load frame ${i}: ${e.message}`);
        }
    }
    return visionData;
}

async function analyzeAudioWithGemini(audioPath, timestamp, visionContext) {
    const base64Audio = await encodeAudioToBase64(audioPath);
    const audioStats = await fs.stat(audioPath);
    
    const prompt = `${visionContext}

---

NOW LISTEN TO THE AUDIO at [${timestamp}s to ${timestamp+3}s].

You are the same 17-year-old Gen Z viewer. You've just experienced the video visually as described above.

Listen carefully and rate on 1-10 scale:
- hypeLevel: How hype/intense is the music/sound? (1=snooze, 10=full adrenaline)
- audioBoredom: Is the audio boring? (1=epic soundtrack, 10=elevator music)
- audioExcitement: Does the audio pump you up? (1=puts you to sleep, 10=hype train)
- soundQuality: How good does it sound? (1=amateur hour, 10=cinema quality)
- audioClarity: Can you clearly hear what's happening? (1=muddy mess, 10=crystal clear)

Also describe:
- musicStyle: Brief description (e.g., "intense orchestral dubstep", "slow ambient synth", "corporate elevator music", "narrator talking")
- keySounds: What key sounds/music elements are present?
- audioThought: Your immediate reaction to the audio as a teen
- audioScrollInfluence: Does the audio make you MORE or LESS likely to scroll? (more_engaged / more_bored / neutral)

Be authentic Gen Z voice. Brief but descriptive.

Respond ONLY with valid JSON containing all fields.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://opentruth.local",
            "X-Title": "OpenTruth Audio Analysis"
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
            max_tokens: 600,
            temperature: 0.4
        })
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
    }

    // Parse JSON from response
    let content = data.choices[0].message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        // Fallback extraction
        parsed = {
            hypeLevel: 5,
            audioBoredom: 5,
            audioExcitement: 5,
            soundQuality: 5,
            audioClarity: 5,
            musicStyle: "Could not parse",
            keySounds: "See raw response",
            audioThought: content.substring(0, 150),
            audioScrollInfluence: "neutral",
            parseError: e.message
        };
    }

    return {
        timestamp,
        audioScores: {
            hypeLevel: parsed.hypeLevel || parsed.hype_level || 5,
            boredom: parsed.audioBoredom || parsed.audio_boredom || 5,
            excitement: parsed.audioExcitement || parsed.audio_excitement || 5,
            quality: parsed.soundQuality || parsed.sound_quality || 5,
            clarity: parsed.audioClarity || parsed.audio_clarity || 5
        },
        musicStyle: parsed.musicStyle || parsed.music_style || "Unknown",
        keySounds: parsed.keySounds || parsed.key_sounds || "",
        thought: parsed.audioThought || parsed.audio_thought || "No thought provided",
        scrollInfluence: parsed.audioScrollInfluence || parsed.audio_scroll_influence || "neutral",
        rawResponse: content.substring(0, 300),
        usage: data.usage,
        fileSize: audioStats.size
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Audio Analysis with Gemini 2.5 Flash (Actual Audio LLM)');
    console.log('  Replacing audio-analysis-###.json with real hearing data');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Load vision context
    console.log('📊 Loading vision results for context...');
    const visionData = await loadVisionResults();
    console.log(`   ✅ Loaded ${visionData.length} vision frames\n`);
    
    let totalCost = 0;
    let totalTokens = 0;
    
    for (let i = 0; i < TIMESTAMPS.length; i++) {
        const ts = TIMESTAMPS[i];
        const audioFile = path.join(AUDIO_DIR, `audio-${String(ts).padStart(3, '0')}s.mp3`);
        
        process.stdout.write(`[${i+1}/${TIMESTAMPS.length}] ${ts}s: `);
        
        try {
            // Check if audio file exists
            try {
                await fs.access(audioFile);
            } catch {
                process.stdout.write(`❌ Audio file not found\n`);
                continue;
            }
            
            // Get vision context for this timestamp
            const vision = visionData.find(v => v.timestamp === ts);
            const visionContext = vision 
                ? `VISION CONTEXT at ${ts}s: You felt bored ${vision.scores.boredom}/10, excited ${vision.scores.excitement}/10. You thought: "${vision.thought?.substring(0, 80)}..."`
                : `No vision context for ${ts}s`;
            
            process.stdout.write(`🎧 analyzing... `);
            const startTime = Date.now();
            
            const analysis = await analyzeAudioWithGemini(audioFile, ts, visionContext);
            const duration = Date.now() - startTime;
            
            // Track costs
            const tokens = analysis.usage?.total_tokens || 0;
            totalTokens += tokens;
            totalCost += tokens * 0.0000005; // Approximate Gemini 2.5 Flash cost
            
            process.stdout.write(`✅ Hype:${analysis.audioScores.hypeLevel} Boredom:${analysis.audioScores.boredom} (${duration}ms, ${tokens}tok)\n`);
            
            // Save to audio-analysis-###.json (replacing old format)
            const outputFile = path.join(AUDIO_DIR, `audio-analysis-${String(i).padStart(3, '0')}.json`);
            await fs.writeFile(outputFile, JSON.stringify({
                timestamp: ts,
                audioFile: audioFile,
                analysis: analysis,
                visionContext: visionContext,
                processedAt: new Date().toISOString()
            }, null, 2));
            
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
            
            // Save error record
            const outputFile = path.join(AUDIO_DIR, `audio-analysis-${String(i).padStart(3, '0')}.json`);
            await fs.writeFile(outputFile, JSON.stringify({
                timestamp: ts,
                error: e.message,
                processedAt: new Date().toISOString()
            }, null, 2));
        }
        
        // Small delay to avoid rate limits
        if (i < TIMESTAMPS.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Audio Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📁 Updated files: ${AUDIO_DIR}/audio-analysis-###.json`);
    console.log(`📊 Total tokens: ${totalTokens}`);
    console.log(`💰 Estimated cost: $${totalCost.toFixed(4)}`);
    console.log('\nNext: Generate merged vision+audio report');
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
