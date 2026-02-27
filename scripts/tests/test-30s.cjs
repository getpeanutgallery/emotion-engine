#!/usr/bin/env node
/**
 * First 30 Seconds Analysis Test
 * Extract, evaluate, and visualize the opening of CoD trailer
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-30s.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const { OpenRouterClient } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

// Impatient Teenager persona
const PERSONA = {
    id: 'impatient-teenager',
    name: 'The Impatient Teenager',
    description: 'A 16-19 year old heavy TikTok/YouTube Shorts consumer with zero tolerance for slow content.',
    conflict: 'Abandons if hook takes >3 seconds',
    systemPrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day.

You have ZERO patience for:
- Logo animations or intro sequences
- Slow buildup to the main content
- Corporate speak or buzzwords
- Poor video quality or boring visuals
- Videos that don't get to the point immediately

You will happily scroll away if bored. Be brutally honest about when you'd skip this video.

Rate emotions on 1-10 scale where:
- Boredom 8+ = You'd scroll away NOW
- Excitement 7+ = You'd watch to the end
- Patience 3- = You're already annoyed

Respond with ONLY a JSON object containing scores and a brief rationale.`
};

/**
 * Extract frames from first 30 seconds (every 2s = 15 frames)
 */
async function extract30sFrames() {
    console.log('🎬 Extracting frames from first 30 seconds...');
    const frames = [];
    
    // Every 2 seconds for 30 seconds = 15 frames
    for (let timestamp = 0; timestamp <= 30; timestamp += 2) {
        const buffer = await extractFrameAt(timestamp);
        frames.push({
            index: frames.length,
            timestamp: timestamp * 1000,
            base64: buffer.toString('base64'),
            sizeKB: (buffer.length / 1024).toFixed(1)
        });
        console.log(`   ✅ ${timestamp}s: ${(buffer.length/1024).toFixed(1)} KB`);
    }
    
    return frames;
}

async function extractFrameAt(timestampSeconds) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/30s-frame-${timestampSeconds}.jpg`;
        
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
 * Evaluate all frames
 */
async function evaluateFrames(client, frames) {
    console.log(`\n🧠 Evaluating ${frames.length} frames with OpenRouter...`);
    const results = [];
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const timestampSec = (frame.timestamp / 1000).toFixed(0);
        
        process.stdout.write(`   [${i + 1}/${frames.length}] ${timestampSec}s... `);
        
        try {
            const startTime = Date.now();
            const evaluation = await client.evaluateFrame({
                model: 'kimi-2.5-vision',
                base64Image: frame.base64,
                timestamp: frame.timestamp,
                persona: PERSONA,
                lenses: ['patience', 'boredom', 'excitement', 'frustration', 'clarity']
            });
            
            const duration = Date.now() - startTime;
            process.stdout.write(`✅ Score: B${evaluation.scores.boredom} E${evaluation.scores.excitement} ($${evaluation.cost.toFixed(4)})\n`);
            
            results.push({
                timestamp: frame.timestamp,
                index: frame.index,
                scores: evaluation.scores,
                rationale: evaluation.scores.rationale || '',
                cost: evaluation.cost,
                duration
            });
            
            // Rate limit protection
            if (i < frames.length - 1) {
                await sleep(300);
            }
        } catch (e) {
            process.stdout.write(`❌ ${e.message}\n`);
            results.push({
                timestamp: frame.timestamp,
                index: frame.index,
                error: e.message
            });
        }
    }
    
    return results;
}

/**
 * Build radar data from results
 */
function buildRadarData(results) {
    const valid = results.filter(r => !r.error);
    if (valid.length === 0) return [];
    
    const emotions = ['patience', 'boredom', 'excitement', 'frustration', 'clarity'];
    const sums = {};
    const counts = {};
    
    for (const r of valid) {
        for (const emotion of emotions) {
            if (r.scores[emotion] !== undefined) {
                sums[emotion] = (sums[emotion] || 0) + r.scores[emotion];
                counts[emotion] = (counts[emotion] || 0) + 1;
            }
        }
    }
    
    return emotions
        .filter(e => counts[e] > 0)
        .map(emotion => ({
            axis: emotion.charAt(0).toUpperCase() + emotion.slice(1),
            value: Math.round((sums[emotion] / counts[emotion]) * 10) / 10
        }));
}

/**
 * Generate HTML report
 */
function generateReport(results, radarData, frames) {
    const validResults = results.filter(r => !r.error);
    
    // Calculate metrics
    const totalCost = validResults.reduce((sum, r) => sum + r.cost, 0);
    const avgDuration = validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length;
    
    // Find key moments
    const peakBoredom = validResults.reduce((max, r) => r.scores.boredom > max.scores.boredom ? r : max);
    const peakExcitement = validResults.reduce((max, r) => r.scores.excitement > max.scores.excitement ? r : max);
    const abandonment = validResults.find(r => r.scores.boredom >= 8);
    
    // Friction index
    const avgBoredom = validResults.reduce((sum, r) => sum + r.scores.boredom, 0) / validResults.length;
    const avgExcitement = validResults.reduce((sum, r) => sum + r.scores.excitement, 0) / validResults.length;
    const frictionIndex = Math.round(((avgBoredom + (10 - avgExcitement)) / 2) * 10);
    
    // Timeline data
    const timeline = validResults.map(r => ({
        time: r.timestamp / 1000,
        patience: r.scores.patience,
        boredom: r.scores.boredom,
        excitement: r.scores.excitement,
        frustration: r.scores.frustration,
        clarity: r.scores.clarity
    }));
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenTruth Analysis — Call of Duty Trailer (First 30s)</title>
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/main.css">
    <script type="module" src="components/radar-chart.js"></script>
    <style>
        body {
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            background: var(--color-bg);
            color: var(--color-text-primary);
        }
        h1 {
            color: var(--color-accent-primary);
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: var(--color-text-secondary);
            margin-bottom: 2rem;
        }
        .report-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        @media (max-width: 900px) {
            .report-grid {
                grid-template-columns: 1fr;
            }
        }
        .stats-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            padding: 1.5rem;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
        }
        .stat-item {
            background: var(--color-surface-elevated);
            padding: 1rem;
            border-radius: var(--radius-md);
            text-align: center;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: var(--color-accent-primary);
        }
        .stat-label {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .verdict {
            background: ${abandonment ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
            border: 1px solid ${abandonment ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'};
            border-radius: var(--radius-md);
            padding: 1rem;
            text-align: center;
            margin-top: 1rem;
        }
        .verdict-title {
            font-weight: bold;
            color: ${abandonment ? 'var(--color-accent-danger)' : 'var(--color-accent-success)'};
            font-size: 1.125rem;
        }
        .timeline-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }
        .timeline-table th,
        .timeline-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid var(--color-border);
        }
        .timeline-table th {
            color: var(--color-text-muted);
            font-weight: 500;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .timeline-table td {
            color: var(--color-text-secondary);
        }
        .score {
            font-weight: bold;
        }
        .score-high { color: var(--color-accent-success); }
        .score-medium { color: var(--color-accent-warning); }
        .score-low { color: var(--color-accent-danger); }
        .highlight-row {
            background: rgba(99, 102, 241, 0.1);
        }
        .recommendation {
            background: var(--color-surface-elevated);
            border-left: 3px solid var(--color-accent-primary);
            border-radius: 0 var(--radius-md) var(--radius-md) 0;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        .recommendation-title {
            font-weight: 600;
            color: var(--color-text-primary);
            margin-bottom: 0.5rem;
        }
        .recommendation-text {
            color: var(--color-text-secondary);
            font-size: 0.875rem;
        }
        .frame-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        .frame-item {
            background: var(--color-surface-elevated);
            border-radius: var(--radius-md);
            overflow: hidden;
        }
        .frame-item img {
            width: 100%;
            height: auto;
            display: block;
        }
        .frame-meta {
            padding: 0.5rem;
            font-size: 0.75rem;
            color: var(--color-text-muted);
            text-align: center;
        }
        .frame-scores {
            font-size: 0.625rem;
            color: var(--color-accent-primary);
        }
    </style>
</head>
<body>
    <h1>🎬 OpenTruth Analysis Report</h1>
    <p class="subtitle">Call of Duty: Black Ops 7 Trailer — First 30 Seconds<br>
    Persona: <strong>Impatient Teenager</strong> | Model: <strong>Kimi K2.5 Vision</strong></p>
    
    <div class="report-grid">
        <div class="stats-card">
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${validResults.length}</div>
                    <div class="stat-label">Frames</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">$${totalCost.toFixed(3)}</div>
                    <div class="stat-label">Total Cost</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${Math.round(avgDuration)}ms</div>
                    <div class="stat-label">Avg Time</div>
                </div>
            </div>
            
            <div class="verdict">
                <div class="verdict-title">${abandonment ? '❌ WOULD SCROLL AWAY' : '✅ ENGAGEMENT OK'}</div>
                ${abandonment ? `<p>At ${(abandonment.timestamp / 1000).toFixed(0)}s due to boredom (${abandonment.scores.boredom}/10)</p>` : '<p>Maintained engagement throughout</p>'}
                <p style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">Friction Index: <strong>${frictionIndex}/100</strong> — ${frictionIndex > 70 ? 'High Risk' : frictionIndex > 40 ? 'Moderate' : 'Low Risk'}</p>
            </div>
        </div>
        
        <radar-chart id="radar"></radar-chart>
    </div>
    
    <div class="stats-card" style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">📊 Engagement Timeline</h3>
        <table class="timeline-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Patience</th>
                    <th>Boredom</th>
                    <th>Excitement</th>
                    <th>Verdict</th>
                </tr>
            </thead>
            <tbody>
                ${timeline.map(t => {
                    const isAbandon = t.boredom >= 8;
                    const isEngaged = t.excitement >= 6;
                    const isAnnoyed = t.patience <= 3;
                    const rowClass = isAbandon ? 'highlight-row' : '';
                    const verdict = isAbandon ? '❌ SCROLL' : isEngaged ? '🔥 ENGAGED' : isAnnoyed ? '⚠️ ANNOYED' : '➡️ NEUTRAL';
                    
                    return `<tr class="${rowClass}">
                        <td>${t.time}s</td>
                        <td class="score ${t.patience >= 7 ? 'score-high' : t.patience <= 3 ? 'score-low' : 'score-medium'}">${t.patience}</td>
                        <td class="score ${t.boredom >= 7 ? 'score-low' : t.boredom <= 3 ? 'score-high' : 'score-medium'}">${t.boredom}</td>
                        <td class="score ${t.excitement >= 6 ? 'score-high' : t.excitement <= 3 ? 'score-low' : 'score-medium'}">${t.excitement}</td>
                        <td>${verdict}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="stats-card" style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">💡 Recommendations</h3>
        
        ${abandonment ? `
        <div class="recommendation">
            <div class="recommendation-title">🚨 Critical: Early Abandonment</div>
            <div class="recommendation-text">
                The impatient teen would scroll away at ${(abandonment.timestamp / 1000).toFixed(0)} seconds 
                (boredom: ${abandonment.scores.boredom}/10). 
                ${abandonment.rationale ? `<em>"${abandonment.rationale.substring(0, 100)}..."</em>` : ''}
            </div>
        </div>
        ` : ''}
        
        ${peakBoredom.timestamp < 5000 ? `
        <div class="recommendation">
            <div class="recommendation-title">⚡ Speed Up the Hook</div>
            <div class="recommendation-text">
                Peak boredom (${peakBoredom.scores.boredom}/10) occurs in the first 5 seconds. 
                Cut the logo intro and jump directly to gameplay footage.
            </div>
        </div>
        ` : ''}
        
        ${peakExcitement.scores.excitement < 6 ? `
        <div class="recommendation">
            <div class="recommendation-title">🎯 Increase Engagement</div>
            <div class="recommendation-text">
                Maximum excitement only reached ${peakExcitement.scores.excitement}/10 at ${(peakExcitement.timestamp / 1000).toFixed(0)}s.
                Add more dynamic visuals, quick cuts, or pattern interrupts.
            </div>
        </div>
        ` : ''}
    </div>
    
    <div class="stats-card">
        <h3 style="margin-bottom: 1rem;">🖼️ Analyzed Frames</h3>
        <div class="frame-grid">
            ${frames.map((f, i) => {
                const r = validResults[i];
                if (!r) return '';
                return `
                <div class="frame-item">
                    <img src="data:image/jpeg;base64,${f.base64}" alt="Frame ${i}">
                    <div class="frame-meta">
                        ${f.timestamp / 1000}s
                        <div class="frame-scores">P${r.scores.patience} B${r.scores.boredom} E${r.scores.excitement}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>
    
    <script>
        // Set radar chart data
        const radarData = ${JSON.stringify(radarData)};
        const radarChart = document.getElementById('radar');
        if (radarChart) {
            radarChart.setData(radarData);
        }
    </script>
</body>
</html>`;
    
    const outputPath = path.join(OUTPUT_DIR, 'report-30s.html');
    fs.writeFileSync(outputPath, html);
    
    return {
        validResults,
        totalCost,
        avgDuration,
        peakBoredom,
        peakExcitement,
        abandonment,
        frictionIndex,
        outputPath
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  First 30 Seconds Analysis — OpenTruth Emotion Engine');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const client = new OpenRouterClient({
        apiKey: API_KEY,
        defaultModel: 'kimi-2.5-vision',
        maxRetries: 2,
        timeout: 60000
    });
    
    // Extract frames
    const frames = await extract30sFrames();
    
    // Evaluate
    const results = await evaluateFrames(client, frames);
    
    // Build radar data
    const radarData = buildRadarData(results);
    console.log('\n📊 Radar Data:', JSON.stringify(radarData, null, 2));
    
    // Generate report
    console.log('\n📝 Generating HTML report...');
    const summary = generateReport(results, radarData, frames);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Analysis Complete');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📁 Report saved: ${summary.outputPath}`);
    console.log(`💰 Total cost: $${summary.totalCost.toFixed(4)}`);
    console.log(`⏱️  Avg response: ${Math.round(summary.avgDuration)}ms`);
    console.log(`🎯 Friction Index: ${summary.frictionIndex}/100`);
    
    if (summary.abandonment) {
        console.log(`\n❌ ABANDONMENT at ${(summary.abandonment.timestamp / 1000).toFixed(0)}s`);
    }
    
    console.log(`\n📊 Peak Moments:`);
    console.log(`   • Highest Boredom: ${summary.peakBoredom.scores.boredom}/10 @ ${(summary.peakBoredom.timestamp / 1000).toFixed(0)}s`);
    console.log(`   • Highest Excitement: ${summary.peakExcitement.scores.excitement}/10 @ ${(summary.peakExcitement.timestamp / 1000).toFixed(0)}s`);
    
    console.log('\n🌐 Open report in browser:');
    console.log(`   python3 -m http.server 8080`);
    console.log(`   http://localhost:8080/report-30s.html`);
    console.log('\n═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
