#!/usr/bin/env node
/**
 * Stateful Audio Analysis with Gemini 2.5 Flash
 * Carries audio context forward like vision analysis does
 * Persona hears the full audio journey, not just isolated clips
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
                scrollIntent: data.state.scrollIntent,
                stateChange: data.state.stateChange
            });
        } catch (e) {
            console.warn(`⚠️ Could not load frame ${i}: ${e.message}`);
        }
    }
    return visionData;
}

/**
 * Build audio history narrative from previous analyses
 */
function buildAudioHistory(audioResults) {
    if (audioResults.length === 0) return "This is the FIRST audio clip. No previous audio to compare against.";
    
    const recent = audioResults.slice(-3);
    const history = recent.map((r, i) => {
        const idx = audioResults.length - recent.length + i;
        return `[${r.timestamp}s]: "${r.musicStyle}" - Hype:${r.audioScores.hypeLevel}/10, Boredom:${r.audioScores.boredom}/10. Thought: "${r.thought?.substring(0, 50)}..."`;
    }).join('\n');
    
    // Detect trends
    const trends = [];
    if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const hypeChange = last.audioScores.hypeLevel - first.audioScores.hypeLevel;
        const boredomChange = last.audioScores.boredom - first.audioScores.boredom;
        
        if (hypeChange >= 3) trends.push("🔥 Audio getting MORE intense");
        else if (hypeChange <= -3) trends.push("📉 Audio getting LESS intense");
        
        if (boredomChange >= 3) trends.push("😴 Audio getting MORE boring");
        else if (boredomChange <= -3) trends.push("⚡ Audio getting LESS boring");
    }
    
    return `AUDIO HISTORY:\n${history}${trends.length > 0 ? '\n\nTREND: ' + trends.join(', ') : ''}`;
}

async function analyzeAudioStateful(audioPath, timestamp, visionContext, audioHistory, isFirstFrame) {
    const base64Audio = await encodeAudioToBase64(audioPath);
    const audioStats = await fs.stat(audioPath);
    
    const prompt = `${visionContext}

---

${audioHistory}

---

NOW LISTEN TO THE AUDIO at [${timestamp}s to ${timestamp+3}s].

You are the same 17-year-old Gen Z viewer. ${isFirstFrame ? "This is your first audio impression." : "Compare to previous audio."}

Listen and rate 1-10:
- hypeLevel: How hype/intense? (1=snooze, 10=adrenaline)
- audioBoredom: Boring? (1=epic, 10=elevator music)
- audioExcitement: Does it pump you up?
- soundQuality: How professional?
- audioClarity: Can you hear clearly?

Also provide:
- musicStyle: Brief description
- keySounds: Array of key elements
- audioThought: Your reaction (consider history!)
- audioScrollInfluence: (more_engaged / more_bored / neutral)
- audioStateChange: vs previous (improving / worsening / stable)
- audioWhiplash: Genre/vibe shift? (yes/no + brief why)

${isFirstFrame ? '' : 'IMPORTANT: Note any WHIPLASH (sudden drop/rise in energy, genre change, etc.)'}

Respond with JSON only.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://opentruth.local",
            "X-Title": "OpenTruth Stateful Audio"
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
    
    if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
    }

    let content = data.choices[0].message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        parsed = {
            hypeLevel: 5, audioBoredom: 5, audioExcitement: 5,
            soundQuality: 5, audioClarity: 5,
            musicStyle: "Parse error", keySounds: [],
            audioThought: content.substring(0, 150),
            audioScrollInfluence: "neutral",
            audioStateChange: "stable",
            audioWhiplash: "no",
            parseError: e.message
        };
    }

    return {
        timestamp,
        isFirstFrame,
        audioScores: {
            hypeLevel: parsed.hypeLevel || parsed.hype_level || 5,
            boredom: parsed.audioBoredom || parsed.audio_boredom || 5,
            excitement: parsed.audioExcitement || parsed.audio_excitement || 5,
            quality: parsed.soundQuality || parsed.sound_quality || 5,
            clarity: parsed.audioClarity || parsed.audio_clarity || 5
        },
        musicStyle: parsed.musicStyle || parsed.music_style || "Unknown",
        keySounds: parsed.keySounds || parsed.key_sounds || [],
        thought: parsed.audioThought || parsed.audio_thought || "No thought",
        scrollInfluence: parsed.audioScrollInfluence || parsed.audio_scroll_influence || "neutral",
        stateChange: parsed.audioStateChange || parsed.audio_state_change || "stable",
        whiplash: parsed.audioWhiplash || parsed.audio_whiplash || "no",
        rawResponse: content.substring(0, 300),
        usage: data.usage,
        fileSize: audioStats.size
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  STATEFUL Audio Analysis with Gemini 2.5 Flash');
    console.log('  Carries audio context forward like vision analysis');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 Loading vision results...');
    const visionData = await loadVisionResults();
    console.log(`   ✅ Loaded ${visionData.length} vision frames\n`);
    
    const audioResults = [];
    let totalCost = 0;
    let totalTokens = 0;
    
    for (let i = 0; i < TIMESTAMPS.length; i++) {
        const ts = TIMESTAMPS[i];
        const audioFile = path.join(AUDIO_DIR, `audio-${String(ts).padStart(3, '0')}s.mp3`);
        
        process.stdout.write(`[${i+1}/${TIMESTAMPS.length}] ${ts}s: `);
        
        try {
            await fs.access(audioFile);
            
            const vision = visionData.find(v => v.timestamp === ts);
            const visionContext = vision 
                ? `VISION at ${ts}s: Boredom ${vision.scores.boredom}/10, Excitement ${vision.scores.excitement}/10. Thought: "${vision.thought?.substring(0, 70)}..."`
                : `No vision context`;
            
            const audioHistory = buildAudioHistory(audioResults);
            const isFirstFrame = i === 0;
            
            process.stdout.write(`🎧 analyzing${isFirstFrame ? ' (first)' : ' (with history)'}... `);
            const startTime = Date.now();
            
            const analysis = await analyzeAudioStateful(audioFile, ts, visionContext, audioHistory, isFirstFrame);
            const duration = Date.now() - startTime;
            
            // Track
            const tokens = analysis.usage?.total_tokens || 0;
            totalTokens += tokens;
            totalCost += tokens * 0.0000005;
            
            // Store for next iteration
            audioResults.push(analysis);
            
            const trendEmoji = analysis.stateChange === 'worsening' ? '📉' : 
                              analysis.stateChange === 'improving' ? '🔥' : '➡️';
            const whiplashEmoji = analysis.whiplash?.includes('yes') ? '💥' : '';
            
            process.stdout.write(`✅ Hype:${analysis.audioScores.hypeLevel} ${trendEmoji}${whiplashEmoji} (${duration}ms)\n`);
            
            // Save
            const outputFile = path.join(AUDIO_DIR, `audio-analysis-${String(i).padStart(3, '0')}.json`);
            await fs.writeFile(outputFile, JSON.stringify({
                timestamp: ts,
                audioFile,
                analysis,
                visionContext,
                audioHistory: audioHistory.substring(0, 500),
                processedAt: new Date().toISOString()
            }, null, 2));
            
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
        }
        
        if (i < TIMESTAMPS.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Stateful Audio Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📁 Files updated: ${AUDIO_DIR}/audio-analysis-###.json`);
    console.log(`📊 Total tokens: ${totalTokens} (~$${totalCost.toFixed(4)})`);
    console.log('\nKey differences from non-stateful:');
    console.log('  • Each analysis knows previous audio context');
    console.log('  • Detects audio whiplash (sudden genre/energy shifts)');
    console.log('  • Tracks cumulative audio boredom like vision does');
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
