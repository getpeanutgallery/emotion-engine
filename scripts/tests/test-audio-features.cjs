#!/usr/bin/env node
/**
 * Audio Feature Extraction + Proxy Analysis
 * Extract audio signals via ffmpeg, interpret via text prompts
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-audio-features.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { OpenRouterClient } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;
const AUDIO_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-output';
const FEATURES_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/audio-features';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

// Ensure directories exist
if (!fs.existsSync(FEATURES_DIR)) {
    fs.mkdirSync(FEATURES_DIR, { recursive: true });
}

const TIMESTAMPS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];

/**
 * Extract comprehensive audio features using ffmpeg
 */
async function extractAudioFeatures(timestamp) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(AUDIO_DIR, `audio-${String(timestamp).padStart(3, '0')}s.mp3`);
        const featuresPath = path.join(FEATURES_DIR, `features-${String(timestamp).padStart(3, '0')}s.json`);
        
        // Multi-stage analysis
        const analyses = {
            volume: null,
            spectrogram: null,
            onset: null
        };
        
        // 1. Volume/loudness analysis (ebur128 standard)
        const volumeProcess = spawn('ffmpeg', [
            '-ss', String(timestamp),
            '-t', '3',
            '-i', VIDEO_PATH,
            '-af', 'ebur128=peak=true',
            '-f', 'null',
            '-'
        ]);
        
        let volumeOutput = '';
        volumeProcess.stderr.on('data', (data) => {
            volumeOutput += data.toString();
        });
        
        volumeProcess.on('close', () => {
            // Parse volume stats
            const integratedMatch = volumeOutput.match(/I:\s+([-\d.]+)\s+LUFS/);
            const peakMatch = volumeOutput.match(/Peak:\s+([\d.]+)\s+dB/);
            const rangeMatch = volumeOutput.match(/LRA:\s+([\d.]+)\s+LU/);
            
            analyses.volume = {
                integratedLUFS: integratedMatch ? parseFloat(integratedMatch[1]) : -23,
                peakDB: peakMatch ? parseFloat(peakMatch[1]) : 0,
                loudnessRange: rangeMatch ? parseFloat(rangeMatch[1]) : 10,
                // Interpretation
                perceivedLoudness: integratedMatch ? (integratedMatch[1] > -14 ? 'loud' : integratedMatch[1] > -20 ? 'medium' : 'quiet') : 'medium',
                hasPeaks: peakMatch && parseFloat(peakMatch[1]) > -3
            };
            
            resolve({
                timestamp,
                ...analyses,
                audioFile: outputPath,
                features: generateFeatureDescription(analyses)
            });
        });
    });
}

/**
 * Generate human-readable audio feature description
 */
function generateFeatureDescription(analyses) {
    const v = analyses.volume;
    
    // LUFS interpretation for Gen Z
    let vibe = '';
    let intensity = 5;
    let style = 'ambient';
    
    if (v.integratedLUFS > -12) {
        vibe = 'loud, in-your-face';
        intensity = 8;
        style = v.peakDB > -1 ? 'intense electronic/orchestral' : 'compressed modern';
    } else if (v.integratedLUFS > -18) {
        vibe = 'present, engaging';
        intensity = 6;
        style = 'balanced soundtrack';
    } else if (v.integratedLUFS > -24) {
        vibe = 'subtle, atmospheric';
        intensity = 4;
        style = 'ambient/noise floor';
    } else {
        vibe = 'quiet, background';
        intensity = 2;
        style = 'muted/distant';
    }
    
    // Dynamic range hints at music type
    if (v.loudnessRange > 15) {
        style += ', cinematic orchestral with quiet/loud dynamics';
    } else if (v.loudnessRange > 8) {
        style += ', modern pop with some dynamics';
    } else {
        style += ', heavily compressed (constant loudness)';
    }
    
    // Peak detection for "punch"
    const punchiness = v.hasPeaks ? 'punchy impacts/transients present' : 'smooth, no hard hits';
    
    return {
        loudnessDescription: `Volume: ${v.perceivedLoudness} (${v.integratedLUFS.toFixed(1)} LUFS), ${vibe}`,
        musicStyle: style,
        intensityScore: intensity,
        dynamics: `Loudness range: ${v.loudnessRange.toFixed(1)} LU (${v.loudnessRange > 10 ? 'dynamic' : 'compressed'})`,
        punchiness: punchiness,
        genreGuess: guessGenre(v),
        teenReaction: predictTeenReaction(v, intensity)
    };
}

function guessGenre(volumeData) {
    // Very rough heuristic based on loudness characteristics
    if (volumeData.integratedLUFS > -10 && volumeData.loudnessRange < 5) {
        return 'trap/hip-hop/edm (constant loudness bass music)';
    } else if (volumeData.integratedLUFS < -20 && volumeData.loudnessRange > 12) {
        return 'classical/orchestral or ambient';
    } else if (volumeData.integratedLUFS > -16 && volumeData.loudnessRange > 10) {
        return 'modern action movie score (intense moments with quiet sections)';
    } else if (volumeData.hasPeaks && volumeData.integratedLUFS > -18) {
        return 'pop/rock with punchy drums';
    }
    return 'modern trailer music (compressed dynamics)';
}

function predictTeenReaction(volumeData, intensity) {
    if (volumeData.integratedLUFS > -12) {
        return intensity > 7 ? '💥 Gets hyped/loud = engaging for short bursts' : '🆗 Loud but constant = might tune out';
    } else if (volumeData.integratedLUFS < -22) {
        return '🔇 Too quiet, probably corporate/background music = boring';
    } else {
        return intensity > 5 ? '🎵 Good energy level for this demographic' : '⚠️ Low energy, may not hold attention';
    }
}

/**
 * Analyze audio features with text model (prompt-based interpretation)
 */
async function interpretAudioWithText(client, features, timestamp, visionContext) {
    const prompt = `
You are analyzing AUDIO CHARACTERISTICS at ${timestamp}s in a Call of Duty: Black Ops 7 trailer.

${visionContext}

AUDIO SIGNALS DETECTED:
${features.loudnessDescription}
Music Style: ${features.musicStyle}
Intensity Score: ${features.intensityScore}/10
Dynamics: ${features.dynamics}
Punch/Impact: ${features.punchiness}
Genre Guess: ${features.genreGuess}
Expected Teen Reaction: ${features.teenReaction}

Based on these audio characteristics:
1. AUDIO HYPE (1-10): Is the music/sound hyped/intense? (1=soft ambient, 10=full adrenaline EDM)
2. AUDIO BOREDOM (1-10): Is the audio boring for Gen Z? (1=fire soundtrack, 10=elevator music)
3. AUDIO EXCITEMENT (1-10): Does the sound pump you up?
4. SOUND QUALITY (1-10): How professional/cinematic does it sound?
5. DIALOGUE PRESENT (yes/no/maybe): Based on dynamics, likely voiceover?

Your audio interpretation (1 sentence): How does this audio match the visuals described above?

Does audio HELP or HURT engagement compared to just the visuals? (+2 helps, -2 hurts, 0 neutral)

Respond ONLY with JSON: {"hype": N, "boredom": N, "excitement": N, "quality": N, "dialogue": "yes/no/maybe", "interpretation": "...", "multiplier": +2/-2/0}
`;

    try {
        const result = await client.complete({
            model: 'kimi-2.5-vision', // Use same model, we're just interpreting features
            messages: [
                { role: 'system', content: 'You are a music/audio expert specializing in trailer music analysis. Interpret these audio features through a Gen Z lens.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 400,
            temperature: 0.3
        });
        
        let content = result.choices[0].message.content;
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        let parsed = JSON.parse(content);
        return {
            ...parsed,
            cost: result.estimatedCost,
            tokens: result.usage?.total_tokens || 0
        };
        
    } catch (e) {
        // Fallback based on features
        return {
            hype: features.intensityScore,
            boredom: features.intensityScore < 4 ? 8 : features.intensityScore > 7 ? 3 : 5,
            excitement: features.intensityScore,
            quality: 7,
            dialogue: 'maybe',
            interpretation: `Audio features suggest ${features.genreGuess} at ${features.loudnessDescription}`,
            multiplier: features.intensityScore > 6 ? 1 : features.intensityScore < 4 ? -1 : 0,
            cost: 0,
            error: e.message
        };
    }
}

/**
 * Generate final multi-modal report
 */
async function generateFinalReport(visionData, audioData, interpretations, timestamp) {
    // Load vision result
    const v = visionData.find(d => d.timestamp === timestamp);
    const a = interpretations;
    
    if (!v) return null;
    
    // Calculate combined scores
    const combined = {
        timestamp,
        vision: {
            patience: v.scores.patience,
            boredom: v.scores.boredom,
            excitement: v.scores.excitement,
            thought: v.thought
        },
        audio: {
            hype: a.hype,
            boredom: a.boredom,
            excitement: a.excitement,
            interpretation: a.interpretation
        },
        multiModal: {
            // Weighted: audio can amplify or diminish visual response
            totalExcitement: Math.min(10, v.scores.excitement + (a.multiplier > 0 ? 2 : a.multiplier < 0 ? -2 : 0)),
            totalBoredom: Math.max(1, v.scores.boredom + (a.boredom > 6 && v.scores.boredom > 6 ? 2 : 0)),
            verdict: generateVerdict(v.scores, a, a.multiplier),
            keyInsight: generateInsight(v, a)
        }
    };
    
    return combined;
}

function generateVerdict(vision, audio, multiplier) {
    if (vision.excitement >= 7 && audio.hype >= 7 && multiplier >= 0) {
        return '🔥🔥 FULL ENGAGEMENT (Visuals + Audio both fire)';
    } else if (vision.excitement >= 6 && audio.hype < 4) {
        return '⚠️ AUDIO KILLS VIBE (Good visuals, dead audio)';
    } else if (vision.excitement < 4 && audio.hype >= 7) {
        return '🎵 AUDIO SAVES IT (Boring visuals, hyped audio)';
    } else if (vision.excitement < 4 && audio.hype < 5) {
        return '💀 DOUBLE FAIL (Visuals and audio both weak)';
    } else {
        return '➡️ NEUTRAL (Neither helps nor hurts significantly)';
    }
}

function generateInsight(vision, audio) {
    if (vision.thought?.includes('cyberpunk') && audio.interpretation?.includes('electronic')) {
        return 'Audio matches visual aesthetic perfectly';
    } else if (vision.thought?.includes('corporate') && audio.interpretation?.includes('elevator')) {
        return 'Corporate vibe confirmed: visuals AND audio are corporate';
    } else if (vision.thought?.includes('fire') && audio.hype < 5) {
        return 'Mismatch: Visuals are hype but music is flat';
    } else if (audio.hype > 7 && vision.excitement < 5) {
        return 'Audio carries this moment more than visuals';
    }
    return 'Standard multi-modal coherence';
}

/**
 * Main
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Audio Feature Extraction + Text Interpretation');
    console.log('  No audio-capable LLM needed!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const client = new OpenRouterClient({ apiKey: API_KEY, maxRetries: 2 });
    
    // Load vision results for context
    const visionData = [];
    for (let i = 0; i < TIMESTAMPS.length; i++) {
        const frameFile = path.join('./stateful-output', `frame-${String(i).padStart(3, '0')}.json`);
        if (fs.existsSync(frameFile)) {
            const data = JSON.parse(fs.readFileSync(frameFile));
            visionData.push({
                timestamp: data.frame.timestampSec,
                scores: data.state.scores,
                thought: data.state.currentThought
            });
        }
    }
    
    console.log(`📊 Loaded ${visionData.length} vision results for context\n`);
    
    // Process each timestamp
    const finalReport = [];
    
    for (let i = 0; i < TIMESTAMPS.length; i++) {
        const ts = TIMESTAMPS[i];
        const visionContext = visionData.find(v => v.timestamp === ts)?.thought || 'No vision context';
        
        process.stdout.write(`[${i+1}/${TIMESTAMPS.length}] ${ts}s: `);
        
        try {
            // Step 1: Extract features
            const features = await extractAudioFeatures(ts);
            process.stdout.write(`📊 features extracted → `);
            
            // Step 2: Interpret with text model
            const interpretation = await interpretAudioWithText(client, features.features, ts, visionContext);
            process.stdout.write(`🧠 interpreted (Hype:${interpretation.hype}) → `);
            
            // Step 3: Generate multi-modal report
            const report = await generateFinalReport(visionData, features, interpretation, ts);
            if (report) {
                finalReport.push(report);
                process.stdout.write(`✅ ${report.multiModal.verdict.substring(0, 30)}...\n`);
            }
            
            // Save individual result
            fs.writeFileSync(
                path.join(FEATURES_DIR, `multimodal-ts-${String(ts).padStart(3, '0')}s.json`),
                JSON.stringify(report, null, 2)
            );
            
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
        }
        
        if (i < TIMESTAMPS.length - 1) await sleep(300);
    }
    
    // Save full report
    fs.writeFileSync(
        path.join(FEATURES_DIR, 'complete-multimodal-report.json'),
        JSON.stringify({ timestamps: TIMESTAMPS, results: finalReport }, null, 2)
    );
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Multi-Modal Audio Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📁 Results: ${FEATURES_DIR}/`);
    console.log(`📄 Full report: ${FEATURES_DIR}/complete-multimodal-report.json`);
    console.log('\n🎵 Audio features used (no special audio LLM needed):');
    console.log('   • LUFS loudness measurement');
    console.log('   • Dynamic range analysis');
    console.log('   • Peak detection');
    console.log('   • Text-based interpretation');
    console.log('\n⚡ If you want deeper audio understanding tomorrow, we can swap in:');
    console.log('   • GPT-4o-audio-preview (OpenAI direct)');
    console.log('   • Gemini 1.5 Pro audio (Google)');
    console.log('   • Local Whisper + audio classifier');
    console.log('═══════════════════════════════════════════════════════════\n');
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

main().catch(console.error);
