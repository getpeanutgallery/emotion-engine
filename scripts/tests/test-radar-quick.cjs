#!/usr/bin/env node
/**
 * Quick Radar Test — 3 Key Frames
 * Verify visualization works with minimal API calls
 * 
 * Usage: OPENROUTER_API_KEY=sk-xxx node test-radar-quick.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { OpenRouterClient } = require('./lambda/lib/openrouter-enhanced.cjs');

const VIDEO_PATH = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine/.dev-cache/9txkGBj_trg.mp4';
const API_KEY = process.env.OPENROUTER_API_KEY;
const OUTPUT_DIR = '/home/derrick/Documents/GitHub/OpenTruth/emotion-engine';

if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    process.exit(1);
}

const PERSONA = {
    id: 'impatient-teenager',
    name: 'The Impatient Teenager',
    description: 'A 16-19 year old heavy TikTok/YouTube Shorts consumer.',
    systemPrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day.

You have ZERO patience for slow intros, logos, or corporate speak.
Rate emotions 1-10 where:
- Boredom 8+ = You'd scroll away NOW
- Excitement 7+ = You'd watch to the end
- Patience 3- = You're already annoyed

Respond with ONLY JSON: {"patience": N, "boredom": N, "excitement": N, "frustration": N, "clarity": N, "rationale": "brief"}`
};

async function extractFrame(timestamp) {
    return new Promise((resolve, reject) => {
        const outputPath = `/tmp/radar-frame-${timestamp}.jpg`;
        const args = ['-ss', String(timestamp), '-i', VIDEO_PATH, '-vframes', '1', '-vf', 'scale=480:-1', '-q:v', '5', outputPath];
        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                const buffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve(buffer);
            } else reject(new Error('Extraction failed'));
        });
    });
}

async function main() {
    console.log('🎯 Quick Radar Test — 3 Strategic Frames\n');
    
    const client = new OpenRouterClient({ apiKey: API_KEY, maxRetries: 2, timeout: 60000 });
    
    // Test 3 key moments: Opening, Mid-opening, Action
    const timestamps = [0, 10, 20];
    const results = [];
    
    for (const ts of timestamps) {
        process.stdout.write(`📹 ${ts}s: Extracting... `);
        const buffer = await extractFrame(ts);
        process.stdout.write(`${(buffer.length/1024).toFixed(1)}KB → `);
        
        process.stdout.write('Analyzing... ');
        try {
            const eval = await client.evaluateFrame({
                model: 'kimi-2.5-vision',
                base64Image: buffer.toString('base64'),
                timestamp: ts * 1000,
                persona: PERSONA,
                lenses: ['patience', 'boredom', 'excitement', 'frustration', 'clarity']
            });
            process.stdout.write(`✅ B${eval.scores.boredom} E${eval.scores.excitement} ($${eval.cost.toFixed(4)})\n`);
            results.push({ timestamp: ts, ...eval });
        } catch (e) {
            console.log(`❌ ${e.message}`);
        }
        await sleep(500);
    }
    
    // Build radar data
    const emotions = ['patience', 'boredom', 'excitement', 'frustration', 'clarity'];
    const radarData = emotions.map(e => ({
        axis: e.charAt(0).toUpperCase() + e.slice(1),
        value: Math.round((results.reduce((sum, r) => sum + r.scores[e], 0) / results.length) * 10) / 10
    }));
    
    console.log('\n📊 Radar Data (Averaged):');
    radarData.forEach(d => console.log(`   ${d.axis}: ${d.value}/10`));
    
    // Find verdict
    const avgBoredom = results.reduce((s, r) => s + r.scores.boredom, 0) / results.length;
    const avgExcitement = results.reduce((s, r) => s + r.scores.excitement, 0) / results.length;
    const frictionIndex = Math.round(((avgBoredom + (10 - avgExcitement)) / 2) * 10);
    
    console.log(`\n🎯 Friction Index: ${frictionIndex}/100`);
    console.log(`🧒 Verdict: ${avgBoredom >= 7 ? '❌ WOULD SCROLL' : avgExcitement >= 6 ? '🔥 ENGAGED' : '⚠️ NEUTRAL'}`);
    
    // Generate simple HTML report
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>OpenTruth Radar Test</title>
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/main.css">
    <script type="module" src="components/radar-chart.js"></script>
    <style>
        body { padding: 2rem; max-width: 900px; margin: 0 auto; background: var(--color-bg); color: var(--color-text-primary); }
        h1 { color: var(--color-accent-primary); }
        .result { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.5rem; margin: 1rem 0; }
        .verdict { font-size: 1.5rem; text-align: center; padding: 1rem; border-radius: var(--radius-md); margin: 1rem 0; }
        .verdict.scroll { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .verdict.engaged { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0; }
        .stat { background: var(--color-surface-elevated); padding: 1rem; text-align: center; border-radius: var(--radius-md); }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--color-accent-primary); }
        .stat-label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--color-border); }
        th { color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; }
    </style>
</head>
<body>
    <h1>🎯 Radar Visualization Test</h1>
    <p style="color: var(--color-text-secondary);">Call of Duty Trailer — 3 Key Moments (0s, 10s, 20s)</p>
    
    <div class="result">
        <div class="stats">
            <div class="stat"><div class="stat-value">${results.length}</div><div class="stat-label">Frames</div></div>
            <div class="stat"><div class="stat-value">$${results.reduce((s, r) => s + r.cost, 0).toFixed(3)}</div><div class="stat-label">Cost</div></div>
            <div class="stat"><div class="stat-value">${frictionIndex}</div><div class="stat-label">Friction Index</div></div>
        </div>
        
        <div class="verdict ${avgBoredom >= 7 ? 'scroll' : avgExcitement >= 6 ? 'engaged' : ''}">
            ${avgBoredom >= 7 ? '❌ IMPATIENT TEEN WOULD SCROLL' : avgExcitement >= 6 ? '🔥 ENGAGED & WATCHING' : '⚠️ NEUTRAL / AT RISK'}
        </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div class="result">
            <h3>📊 Emotional Radar</h3>
            <radar-chart id="radar"></radar-chart>
        </div>
        
        <div class="result">
            <h3>📈 Frame-by-Frame</h3>
            <table>
                <tr><th>Time</th><th>Boredom</th><th>Excitement</th><th>Patience</th></tr>
                ${results.map(r => `<tr><td>${r.timestamp}s</td><td>${r.scores.boredom}</td><td>${r.scores.excitement}</td><td>${r.scores.patience}</td></tr>`).join('')}
            </table>
        </div>
    </div>
    
    <div class="result">
        <h3>💡 Insights</h3>
        <ul style="color: var(--color-text-secondary); line-height: 1.8;">
            ${results.some(r => r.scores.boredom >= 8) ? '<li>⚠️ <strong>Critical:</strong> Boredom spikes above 8/10 — immediate scroll risk</li>' : ''}
            ${avgExcitement < 5 ? '<li>📉 <strong>Pacing Issue:</strong> Average excitement below 5/10 — content too slow</li>' : ''}
            ${results[0]?.scores.boredom > 7 ? '<li>🚨 <strong>Hook Failure:</strong> Opening fails to capture attention within 3 seconds</li>' : ''}
            <li>💰 <strong>Analysis cost:</strong> $${results.reduce((s, r) => s + r.cost, 0).toFixed(4)} for ${results.length} frames</li>
        </ul>
    </div>
    
    <script>
        document.getElementById('radar').setData(${JSON.stringify(radarData)});
    </script>
</body>
</html>`;
    
    const outputPath = path.join(OUTPUT_DIR, 'report-radar-test.html');
    fs.writeFileSync(outputPath, html);
    
    console.log(`\n✅ Report saved: ${outputPath}`);
    console.log(`\n🌐 View report:`);
    console.log(`   cd ${OUTPUT_DIR}`);
    console.log(`   python3 -m http.server 8080`);
    console.log(`   open http://localhost:8080/report-radar-test.html`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
main().catch(console.error);
