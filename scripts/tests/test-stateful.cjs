#!/usr/bin/env node
/**
 * Stateful Sequential Evaluation — OpenTruth Emotion Engine
 * 
 * Each persona instance inherits the previous emotional state,
 * creating a realistic emotional trajectory through the video.
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-stateful.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { OpenRouterClient } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/stateful-output';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Impatient Teenager persona
const PERSONA = {
    id: 'impatient-teenager',
    name: 'The Impatient Teenager',
    description: 'A 16-19 year old heavy TikTok/YouTube Shorts consumer with zero tolerance for slow content.',
    basePrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day.

You have ZERO patience for:
- Logo animations or intro sequences
- Slow buildup to the main content
- Corporate speak or buzzwords
- Poor video quality or boring visuals
- Videos that don't get to the point immediately

You will happily scroll away if bored. Be brutally honest.`
};

/**
 * Extract frames for evaluation
 */
async function extractFrames() {
    console.log('🎬 Extracting frames from first 30 seconds...\n');
    const frames = [];
    
    // Every 3 seconds for 30 seconds = 11 frames (slightly faster than 2s)
    for (let timestamp = 0; timestamp <= 30; timestamp += 3) {
        const buffer = await extractFrameAt(timestamp);
        frames.push({
            index: frames.length,
            timestamp: timestamp * 1000,
            timestampSec: timestamp,
            base64: buffer.toString('base64'),
            sizeKB: (buffer.length / 1024).toFixed(1)
        });
        console.log(`   ✅ Frame ${frames.length}: ${timestamp}s (${(buffer.length/1024).toFixed(1)} KB)`);
    }
    
    return frames;
}

async function extractFrameAt(timestampSeconds) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/stateful-frame-${timestampSeconds}.jpg`;
        
        const args = [
            '-ss', String(timestampSeconds),
            '-i', VIDEO_PATH,
            '-vframes', '1',
            '-vf', 'scale=480:-1',
            '-q:v', '5',
            '-f', 'image2',
            outputPath
        ];
        
        const ffmpeg = spawn('ffmpeg', args);
        
        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
                const buffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve(buffer);
            } else {
                reject(new Error('Frame extraction failed'));
            }
        });
    });
}

/**
 * Build prompt with previous state context
 */
function buildStatefulPrompt(frame, previousState, isFirstFrame) {
    const basePrompt = PERSONA.basePrompt;
    
    if (isFirstFrame || !previousState) {
        // First frame — fresh persona
        return `${basePrompt}

This is the OPENING FRAME at ${(frame.timestamp / 1000).toFixed(0)} seconds.

You have never seen this video before. What's your immediate, gut reaction?

Rate your emotional state (1-10 scale):
- patience: How long will you wait before scrolling? (1-10, 10 = very patient)
- boredom: How bored are you right now? (1-10, 10 = extremely bored)  
- excitement: How excited/engaged? (1-10, 10 = extremely excited)
- frustration: How frustrated? (1-10, 10 = extremely frustrated)
- clarity: How clear is what's happening? (1-10, 10 = very clear)

Also provide:
- currentThought: Your immediate reaction (1 sentence, teen voice)
- scrollIntent: Are you about to scroll? (yes/no/maybe)
- attentionRemaining: Estimated seconds before you scroll (number)

Respond with ONLY valid JSON.`;
    } else {
        // Subsequent frames — inherit previous state
        const prev = previousState;
        const timeElapsed = (frame.timestamp / 1000).toFixed(0);
        const prevTime = (prev.timestamp / 1000).toFixed(0);
        const timeDelta = timeElapsed - prevTime;
        
        return `${basePrompt}

**Your emotional state from ${prevTime} seconds ago:**
- Patience: ${prev.scores.patience}/10 (${prev.scores.patience <= 3 ? 'LOW' : prev.scores.patience >= 7 ? 'OK' : 'medium'})
- Boredom: ${prev.scores.boredom}/10 (${prev.scores.boredom >= 7 ? 'HIGH' : 'low'})
- Excitement: ${prev.scores.excitement}/10 (${prev.scores.excitement >= 6 ? 'GOOD' : 'low'})
- Your thought: "${prev.currentThought}"
- Scroll intent: ${prev.scrollIntent}
- Attention remaining: ~${prev.attentionRemaining}s

You've been watching for ${timeElapsed} seconds total (${timeDelta}s since last frame).

**Now you see this next frame:**

How has your emotional state changed? Consider:
- Did it get better or worse?
- Are you more or less likely to scroll now?
- Is your patience depleted?

Rate your UPDATED emotional state (1-10 scale):
- patience: Updated patience level
- boredom: Updated boredom level
- excitement: Updated excitement level
- frustration: Updated frustration level
- clarity: Updated clarity level

Also provide:
- currentThought: Your updated reaction (1 sentence, teen voice)
- stateChange: How you changed from before (brief, e.g., "more bored", "slightly intrigued", "about to scroll")
- scrollIntent: Are you about to scroll? (yes/no/maybe)
- attentionRemaining: Estimated seconds before you scroll (number, 0 if scrolling now)
- cumulativeBoredom: Running total of boredom exposure (number, previous ${prev.cumulativeBoredom || prev.scores.boredom} + current)

Respond with ONLY valid JSON.`;
    }
}

/**
 * Parse LLM response with flexible handling
 */
function parseResponse(content) {
    // Clean up markdown
    content = content.replace(/```json\s*/g, '');
    content = content.replace(/```\s*/g, '');
    content = content.trim();
    
    // Try direct parse
    try {
        return JSON.parse(content);
    } catch (e) {
        // Try to extract JSON from surrounding text
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                // Continue to fallback
            }
        }
    }
    
    // Last resort: look for key-value pairs
    const result = {};
    const patienceMatch = content.match(/"?patience"?\s*[:=]\s*(\d+)/i);
    const boredomMatch = content.match(/"?boredom"?\s*[:=]\s*(\d+)/i);
    const excitementMatch = content.match(/"?excitement"?\s*[:=]\s*(\d+)/i);
    const frustrationMatch = content.match(/"?frustration"?\s*[:=]\s*(\d+)/i);
    const clarityMatch = content.match(/"?clarity"?\s*[:=]\s*(\d+)/i);
    const thoughtMatch = content.match(/"?currentThought"?\s*[:=]\s*"([^"]*)"/i);
    const scrollMatch = content.match(/"?scrollIntent"?\s*[:=]\s*"(yes|no|maybe)"/i);
    
    result.patience = patienceMatch ? parseInt(patienceMatch[1]) : 5;
    result.boredom = boredomMatch ? parseInt(boredomMatch[1]) : 5;
    result.excitement = excitementMatch ? parseInt(excitementMatch[1]) : 5;
    result.frustration = frustrationMatch ? parseInt(frustrationMatch[1]) : 5;
    result.clarity = clarityMatch ? parseInt(clarityMatch[1]) : 5;
    result.currentThought = thoughtMatch ? thoughtMatch[1] : 'No thought provided';
    result.scrollIntent = scrollMatch ? scrollMatch[1] : 'no';
    result.attentionRemaining = 10;
    result.stateChange = 'parsed from text';
    result.cumulativeBoredom = result.boredom;
    
    return result;
}

/**
 * Evaluate single frame with state
 */
async function evaluateFrame(client, frame, previousState, isFirstFrame) {
    const prompt = buildStatefulPrompt(frame, previousState, isFirstFrame);
    
    const messages = [
        {
            role: 'system',
            content: prompt
        },
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${frame.base64}`,
                        detail: 'high'
                    }
                }
            ]
        }
    ];
    
    const startTime = Date.now();
    
    const result = await client.complete({
        model: 'kimi-2.5-vision',
        messages,
        temperature: 0.3,
        max_tokens: 8000,  // Increased for reasoning + JSON output
        reasoning: 'low'   // Kimi thinking mode: low verbosity
    });
    
    const duration = Date.now() - startTime;
    
    // Parse response
    const parsed = parseResponse(result.choices[0].message.content);
    
    // Build state object
    const state = {
        frameIndex: frame.index,
        timestamp: frame.timestamp,
        timestampSec: frame.timestampSec,
        scores: {
            patience: parsed.patience || parsed.scores?.patience || 5,
            boredom: parsed.boredom || parsed.scores?.boredom || 5,
            excitement: parsed.excitement || parsed.scores?.excitement || 5,
            frustration: parsed.frustration || parsed.scores?.frustration || 5,
            clarity: parsed.clarity || parsed.scores?.clarity || 5
        },
        currentThought: parsed.currentThought || parsed.thought || '',
        stateChange: parsed.stateChange || 'initial',
        scrollIntent: parsed.scrollIntent || 'no',
        attentionRemaining: parsed.attentionRemaining || 10,
        cumulativeBoredom: parsed.cumulativeBoredom || parsed.scores?.boredom || 5,
        isFirstFrame,
        cost: result.estimatedCost,
        tokens: result.usage?.total_tokens || 0,
        duration,
        raw: result
    };
    
    return state;
}

/**
 * Main sequential evaluation loop
 */
async function runStatefulEvaluation() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Stateful Sequential Evaluation — OpenTruth');
    console.log('  Each persona inherits previous emotional state');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const client = new OpenRouterClient({
        apiKey: API_KEY,
        maxRetries: 2,
        timeout: 60000
    });
    
    // Extract frames
    const frames = await extractFrames();
    console.log(`\n🎯 Evaluating ${frames.length} frames sequentially...`);
    console.log('   (Each frame builds on previous emotional state)\n');
    
    const states = [];
    let previousState = null;
    let totalCost = 0;
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const isFirstFrame = i === 0;
        
        process.stdout.write(`   [${i + 1}/${frames.length}] ${frame.timestampSec}s... `);
        
        try {
            const state = await evaluateFrame(client, frame, previousState, isFirstFrame);
            
            process.stdout.write(`B${state.scores.boredom} E${state.scores.excitement} ${state.scrollIntent === 'yes' ? '⚠️SCROLL' : ''} ($${state.cost.toFixed(4)})\n`);
            
            // Save individual state file
            const stateFile = path.join(OUTPUT_DIR, `frame-${String(i).padStart(3, '0')}.json`);
            fs.writeFileSync(stateFile, JSON.stringify({
                frame,
                state,
                timestamp: new Date().toISOString()
            }, null, 2));
            
            states.push(state);
            previousState = state;
            totalCost += state.cost;
            
            // Check for early termination
            if (state.scrollIntent === 'yes' && state.attentionRemaining <= 0) {
                console.log(`\n   🚨 SCROLL DETECTED at ${frame.timestampSec}s — stopping evaluation`);
                break;
            }
            
            // Rate limit protection
            if (i < frames.length - 1) {
                await sleep(300);
            }
            
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
            console.error(e);
        }
    }
    
    console.log(`\n✅ Evaluation complete: ${states.length} frames processed`);
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    
    return { frames, states, totalCost };
}

/**
 * Generate stateful analysis report
 */
function generateStatefulReport(data) {
    const { frames, states, totalCost } = data;
    
    // Build radar data from final states
    const radarData = [
        { axis: 'Patience', value: avg(states.map(s => s.scores.patience)) },
        { axis: 'Boredom', value: avg(states.map(s => s.scores.boredom)) },
        { axis: 'Excitement', value: avg(states.map(s => s.scores.excitement)) },
        { axis: 'Frustration', value: avg(states.map(s => s.scores.frustration)) },
        { axis: 'Clarity', value: avg(states.map(s => s.scores.clarity)) }
    ];
    
    // Find key moments
    const abandonment = states.find(s => s.scrollIntent === 'yes');
    const peakBoredom = states.reduce((max, s) => s.scores.boredom > max.scores.boredom ? s : max);
    const peakExcitement = states.reduce((max, s) => s.scores.excitement > max.scores.excitement ? s : max);
    
    // Calculate cumulative metrics
    const cumulativeBoredom = states.reduce((sum, s) => sum + s.scores.boredom, 0);
    const frictionIndex = Math.round((avg(states.map(s => s.scores.boredom)) + (10 - avg(states.map(s => s.scores.excitement)))) / 2 * 10);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenTruth Stateful Analysis — Call of Duty Trailer</title>
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/main.css">
    <script type="module" src="components/radar-chart.js"></script>
    <style>
        body { padding: 2rem; max-width: 1100px; margin: 0 auto; background: var(--color-bg); color: var(--color-text-primary); }
        h1 { color: var(--color-accent-primary); margin-bottom: 0.5rem; }
        .subtitle { color: var(--color-text-secondary); margin-bottom: 2rem; }
        .highlight { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-md); padding: 1rem; margin: 1rem 0; }
        .scroll-alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--color-accent-danger); }
        .recovery { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: var(--color-accent-success); }
        .timeline { display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0; }
        .timeline-item { display: grid; grid-template-columns: 60px 1fr 200px; gap: 1rem; align-items: center; padding: 0.75rem; background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border); }
        .timeline-item.scrolled { border-color: var(--color-accent-danger); background: rgba(239, 68, 68, 0.05); }
        .timeline-time { font-weight: bold; color: var(--color-accent-primary); }
        .timeline-thought { font-style: italic; color: var(--color-text-secondary); font-size: 0.875rem; }
        .timeline-scores { text-align: right; font-size: 0.75rem; color: var(--color-text-muted); }
        .state-badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 500; }
        .state-worsening { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .state-improving { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .state-stable { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
        .stat-box { background: var(--color-surface-elevated); padding: 1rem; border-radius: var(--radius-md); text-align: center; }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--color-accent-primary); }
        .stat-label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; }
        .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0; }
        @media (max-width: 900px) { .report-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h1>🧠 Stateful Analysis Report</h1>
    <p class="subtitle">
        Call of Duty: Black Ops 7 Trailer — Sequential Emotional Journey<br>
        <strong>Method:</strong> Each frame inherits previous emotional state | <strong>Frames:</strong> ${states.length} | <strong>Cost:</strong> $${totalCost.toFixed(4)}
    </p>
    
    ${abandonment ? `
    <div class="highlight scroll-alert">
        <strong>🚨 ABANDONMENT DETECTED</strong><br>
        The Impatient Teenager scrolled away at <strong>${(abandonment.timestamp / 1000).toFixed(0)} seconds</strong><br>
        Final thought: "${abandonment.currentThought}"
    </div>
    ` : ''}
    
    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-value">${states.length}</div>
            <div class="stat-label">Frames Evaluated</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${frictionIndex}</div>
            <div class="stat-label">Friction Index</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${cumulativeBoredom}</div>
            <div class="stat-label">Cumulative Boredom</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">$${totalCost.toFixed(3)}</div>
            <div class="stat-label">Total Cost</div>
        </div>
    </div>
    
    <div class="report-grid">
        <div>
            <h3>📊 Emotional Radar (Final State)</h3>
            <radar-chart id="radar"></radar-chart>
        </div>
        
        <div>
            <h3>📈 Key Metrics</h3>
            <div class="highlight">
                <strong>Peak Boredom:</strong> ${peakBoredom.scores.boredom}/10 at ${(peakBoredom.timestamp / 1000).toFixed(0)}s<br>
                <strong>Peak Excitement:</strong> ${peakExcitement.scores.excitement}/10 at ${(peakExcitement.timestamp / 1000).toFixed(0)}s<br>
                <strong>Avg Attention Span:</strong> ${avg(states.map(s => s.attentionRemaining)).toFixed(1)}s
            </div>
            
            <h3 style="margin-top: 1.5rem;">🎯 Verdict</h3>
            <p style="color: var(--color-text-secondary);">
                ${abandonment 
                    ? `❌ The Impatient Teenager abandoned the video at ${(abandonment.timestamp / 1000).toFixed(0)} seconds due to accumulated boredom and lack of engaging content.`
                    : frictionIndex > 70 
                        ? `⚠️ The video creates significant friction. The teen finished but was highly disengaged throughout.`
                        : `✅ The video maintained adequate engagement for this demographic.`
                }
            </p>
        </div>
    </div>
    
    <h3>🎬 Emotional Journey Timeline</h3>
    <div class="timeline">
        ${states.map((s, i) => `
        <div class="timeline-item ${s.scrollIntent === 'yes' ? 'scrolled' : ''}">
            <div class="timeline-time">${(s.timestamp / 1000).toFixed(0)}s</div>
            <div class="timeline-thought">
                "${s.currentThought}"
                ${i > 0 ? `<span class="state-badge state-${s.stateChange.includes('worse') || s.scores.boredom > states[i-1].scores.boredom ? 'worsening' : s.stateChange.includes('better') ? 'improving' : 'stable'}">${s.stateChange}</span>` : '<span class="state-badge state-stable">initial</span>'}
            </div>
            <div class="timeline-scores">
                B${s.scores.boredom} E${s.scores.excitement} P${s.scores.patience}<br>
                ${s.scrollIntent === 'yes' ? '⚠️ SCROLL' : s.attentionRemaining < 3 ? '⏱️ ' + s.attentionRemaining + 's left' : '✓ watching'}
            </div>
        </div>
        `).join('')}
    </div>
    
    <h3>💡 Insights from Emotional Trajectory</h3>
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.5rem;">
        <ul style="color: var(--color-text-secondary); line-height: 1.8; padding-left: 1.5rem;">
            ${states[0]?.scores.boredom > 7 ? `<li><strong>Hook Failure:</strong> Opening immediately scored ${states[0].scores.boredom}/10 boredom — no recovery possible</li>` : ''}
            ${states.some((s, i) => i > 0 && s.scores.boredom > states[i-1].scores.boredom) ? `<li><strong>Boredom Acceleration:</strong> Engagement got progressively worse, not better</li>` : ''}
            ${abandonment ? `<li><strong>Abandonment Point:</strong> Scroll occurred at ${(abandonment.timestamp / 1000).toFixed(0)}s when cumulative frustration exceeded tolerance</li>` : ''}
            ${states.some(s => s.scores.excitement >= 7) ? `<li><strong>Late Recovery Attempt:</strong> Brief excitement spike detected, but likely too late</li>` : '<li><strong>No Recovery:</strong> Never achieved sufficient excitement to retain viewer</li>'}
        </ul>
    </div>
    
    <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.875rem;">
        <p>OpenTruth Emotion Engine — Stateful Sequential Evaluation</p>
        <p style="margin-top: 0.5rem;">Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <script>
        document.getElementById('radar').setData(${JSON.stringify(radarData)});
    </script>
</body>
</html>`;
    
    const outputPath = path.join(OUTPUT_DIR, 'report-stateful.html');
    fs.writeFileSync(outputPath, html);
    
    return outputPath;
}

function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main
 */
async function main() {
    try {
        const data = await runStatefulEvaluation();
        
        console.log('\n📝 Generating report...');
        const reportPath = generateStatefulReport(data);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✅ Stateful Evaluation Complete!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`\n📁 Individual state files: ${OUTPUT_DIR}/`);
        console.log(`📄 HTML Report: ${reportPath}`);
        console.log('\n🌐 View report:');
        console.log(`   python3 -m http.server 8080`);
        console.log(`   http://localhost:8080/stateful-output/report-stateful.html`);
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
    } catch (err) {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    }
}

main();
