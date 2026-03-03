#!/usr/bin/env node
/**
 * Final Report Generator
 * Merges all pipeline outputs into comprehensive emotion analysis report
 * 
 * Usage: node server/generate-report.cjs [analysis-output-dir]
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Get repo root (parent of server/ directory)
const REPO_ROOT = path.resolve(__dirname, '..');

// Convert relative paths to absolute, resolving relative to repo root
const OUTPUT_DIR = process.argv[2] 
    ? path.isAbsolute(process.argv[2]) 
        ? path.resolve(process.argv[2]) 
        : path.resolve(REPO_ROOT, process.argv[2])
    : path.resolve(REPO_ROOT, 'output/default');
const REPORT_PATH = path.join(OUTPUT_DIR, 'FINAL-REPORT.md');

// Log working directory and resolved paths
console.log(`📁 Working directory: ${process.cwd()}`);
console.log(`📁 Script directory: ${__dirname}`);
console.log(`📁 Resolved output dir: ${OUTPUT_DIR}`);
console.log(`📁 Resolved report path: ${REPORT_PATH}\n`);

// Model used for video chunk analysis (from environment or default)
const MODEL = process.env.VIDEO_MODEL || 'openrouter/qwen/qwen3.5-397b-a17b';

/**
 * Escape HTML special characters to prevent XSS and ensure proper display
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const htmlEntities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => htmlEntities[char]);
}

/**
 * Validate input files before generating report
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateInputs() {
    const errors = [];
    
    const requiredFiles = [
        '01-dialogue-analysis.md',
        '02-music-analysis.md',
        '03-chunked-analysis.json'
    ];
    
    console.log('🔍 Validating input files...\n');
    
    for (const file of requiredFiles) {
        const filePath = path.join(OUTPUT_DIR, file);
        
        // Check file exists
        if (!fs.existsSync(filePath)) {
            errors.push(`Missing required file: ${file}`);
            console.error(`   ❌ ${file} - NOT FOUND`);
            continue;
        }
        
        // Check file size > 0
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            errors.push(`File is empty: ${file}`);
            console.error(`   ❌ ${file} - EMPTY FILE`);
            continue;
        }
        
        // Validate JSON files have expected structure
        if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                
                // Validate expected structure for chunked-analysis.json
                if (file === '03-chunked-analysis.json') {
                    if (!data.chunks || !Array.isArray(data.chunks)) {
                        errors.push(`Invalid structure in ${file}: missing 'chunks' array`);
                        console.error(`   ❌ ${file} - INVALID STRUCTURE (no chunks array)`);
                        continue;
                    }
                    if (!data.persona || !data.video || !data.duration) {
                        errors.push(`Invalid structure in ${file}: missing required fields`);
                        console.error(`   ❌ ${file} - INVALID STRUCTURE (missing fields)`);
                        continue;
                    }
                }
                
                console.log(`   ✅ ${file} - Valid (${(stats.size / 1024).toFixed(1)} KB)`);
            } catch (e) {
                errors.push(`Invalid JSON syntax in ${file}: ${e.message}`);
                console.error(`   ❌ ${file} - INVALID JSON: ${e.message}`);
            }
        } else {
            console.log(`   ✅ ${file} - Valid (${(stats.size / 1024).toFixed(1)} KB)`);
        }
    }
    
    if (errors.length > 0) {
        console.log('\n');
        return { valid: false, errors };
    }
    
    console.log('\n✅ All input files validated successfully\n');
    return { valid: true, errors: [] };
}

// Run validation first
const validation = validateInputs();

if (!validation.valid) {
    console.error('\n❌ VALIDATION FAILED');
    console.error('='.repeat(70));
    console.error('\n  Errors found:');
    validation.errors.forEach((err, idx) => {
        console.error(`    ${idx + 1}. ${err}`);
    });
    console.error('\n');
    console.error('  Run the pipeline first:');
    console.error(`    node run-pipeline.cjs <video-path> [output-dir]`);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
}

// Load all data
console.log('📚 Loading analysis data...\n');

// Dialogue data
const dialogueMd = fs.readFileSync(path.join(OUTPUT_DIR, '01-dialogue-analysis.md'), 'utf8');
const dialogueMatch = dialogueMd.match(/```json\s*\n([\s\S]*?)\n```/);
const dialogueData = dialogueMatch ? JSON.parse(dialogueMatch[1]) : null;
// Extract model and tokens from dialogue markdown header
const dialogueModelMatch = dialogueMd.match(/\*\*Model:\*\*\s*([^\n]+)/);
const dialogueModel = dialogueModelMatch ? dialogueModelMatch[1].trim() : 'unknown';
const dialogueTokensMatch = dialogueMd.match(/\*\*Tokens Used:\*\*\s*([0-9,]+)/);
const dialogueTokens = dialogueTokensMatch ? parseInt(dialogueTokensMatch[1].replace(/,/g, '')) : 0;

// Music data  
const musicMd = fs.readFileSync(path.join(OUTPUT_DIR, '02-music-analysis.md'), 'utf8');
const musicMatch = musicMd.match(/```json\s*\n([\s\S]*?)\n```/);
const musicData = musicMatch ? JSON.parse(musicMatch[1]) : null;
// Extract model and tokens from music markdown header
const musicModelMatch = musicMd.match(/\*\*Model:\*\*\s*([^\n]+)/);
const musicModel = musicModelMatch ? musicModelMatch[1].trim() : 'unknown';
const musicTokensMatch = musicMd.match(/\*\*Tokens Used:\*\*\s*([0-9,]+)/);
const musicTokens = musicTokensMatch ? parseInt(musicTokensMatch[1].replace(/,/g, '')) : 0;

// Chunked video data
const chunksJson = fs.readFileSync(path.join(OUTPUT_DIR, '03-chunked-analysis.json'), 'utf8');
const chunksData = JSON.parse(chunksJson);

// Per-second emotions data (optional)
let perSecondData = null;
const perSecondPath = path.join(OUTPUT_DIR, '04-per-second-emotions.json');
if (fs.existsSync(perSecondPath)) {
    perSecondData = JSON.parse(fs.readFileSync(perSecondPath, 'utf8'));
}

console.log(`   ✓ Dialogue segments: ${dialogueData?.dialogue_segments?.length || 0}`);
console.log(`   ✓ Music segments: ${musicData?.audio_segments?.length || 0}`);
console.log(`   ✓ Video chunks: ${chunksData?.chunks?.length || 0}\n`);

// Calculate token usage breakdown by model
console.log('📊 Calculating token usage breakdown...\n');

const tokenUsageByModel = {};

// Helper function to add tokens to model tracking
function addTokenUsage(model, tokens, source) {
    if (!model || !tokens) return;
    if (!tokenUsageByModel[model]) {
        tokenUsageByModel[model] = {
            tokens: 0,
            requests: 0,
            sources: new Set()
        };
    }
    tokenUsageByModel[model].tokens += tokens;
    tokenUsageByModel[model].requests += 1;
    tokenUsageByModel[model].sources.add(source);
}

// Determine actual token counts (use estimates for older files without tracking)
const actualDialogueTokens = dialogueTokens > 0 ? dialogueTokens : 2500;
const actualMusicTokens = musicTokens > 0 ? musicTokens : 3000;

// Track dialogue analysis tokens
addTokenUsage(dialogueModel, actualDialogueTokens, 'Dialogue Analysis');

// Track music analysis tokens
addTokenUsage(musicModel, actualMusicTokens, 'Music Analysis');

// Track video chunk analysis tokens (exact from chunk data)
chunksData.chunks.forEach(chunk => {
    if (chunk.tokens) {
        addTokenUsage(MODEL, chunk.tokens, 'Video Chunk Analysis');
    }
});

// Track per-second emotion analysis tokens if available
if (perSecondData && perSecondData.totalTokens) {
    // Per-second analysis uses the same model as chunks typically
    const perSecondModel = MODEL;
    addTokenUsage(perSecondModel, perSecondData.totalTokens, 'Per-Second Emotion Analysis');
}

// Convert sets to arrays for display
Object.keys(tokenUsageByModel).forEach(model => {
    tokenUsageByModel[model].sources = Array.from(tokenUsageByModel[model].sources);
});

console.log('   Token usage by model:');
Object.entries(tokenUsageByModel).forEach(([model, data]) => {
    console.log(`     - ${model}: ${data.tokens.toLocaleString()} tokens (${data.requests} requests)`);
});
console.log('');

// Build comprehensive report
console.log('📝 Generating final report...\n');

let report = `# Emotion Analysis Report
`;
report += `# ${path.basename(chunksData.video, path.extname(chunksData.video))}\n\n`;
report += `**Generated:** ${new Date().toISOString()}\n\n`;
// Extract persona name from new structure
const personaName = chunksData.persona?.config?.soul?.Name || 
                    chunksData.persona?.config?.soul?.['Name'] || 
                    chunksData.persona?.id || 
                    'Unknown Persona';
const personaDesc = chunksData.persona?.config?.soul?.['Core Truth'] || '';
report += `**Persona:** ${personaName}`;
if (personaDesc) report += ` — ${personaDesc}`;
report += `\n\n`;
report += `**Total Duration:** ${chunksData.duration}s  \n`;

// Calculate total tokens from all pipeline steps
const perSecondTokens = perSecondData?.totalTokens || 0;
const totalTokensAllSteps = chunksData.totalTokens + perSecondTokens + actualDialogueTokens + actualMusicTokens;

report += `**Total Tokens Used:** ${totalTokensAllSteps.toLocaleString()}\n\n`;

// Token Usage Breakdown section
report += `---\n\n`;
report += `## 📊 Token Usage Breakdown\n\n`;
report += `| Model | Tokens | Requests | Pipeline Steps |\n`;
report += `|-------|--------|----------|----------------|\n`;

Object.entries(tokenUsageByModel).forEach(([model, data]) => {
    const steps = data.sources.join(', ');
    report += `| ${model} | ${data.tokens.toLocaleString()} | ${data.requests} | ${steps} |\n`;
});

report += `\n`;

// Executive Summary
report += `---\n\n`;
report += `## 📊 Executive Summary\n\n`;

// Calculate average ratings across all chunks
const avgPatience = chunksData.chunks.reduce((a, c) => {
    const match = c.analysis.match(/patience["']?\s*[:\-]?\s*(\d+)/i);
    return a + (match ? parseInt(match[1]) : 5);
}, 0) / chunksData.chunks.length;

const avgBoredom = chunksData.chunks.reduce((a, c) => {
    const match = c.analysis.match(/boredom["']?\s*[:\-]?\s*(\d+)/i);
    return a + (match ? parseInt(match[1]) : 5);
}, 0) / chunksData.chunks.length;

const avgExcitement = chunksData.chunks.reduce((a, c) => {
    const match = c.analysis.match(/excitement["']?\s*[:\-]?\s*(\d+)/i);
    return a + (match ? parseInt(match[1]) : 5);
}, 0) / chunksData.chunks.length;

report += `| Metric | Average Score | Status |\n`;
report += `|--------|---------------|--------|\n`;
report += `| Patience | ${avgPatience.toFixed(1)}/10 | ${avgPatience > 6 ? '🟢 High' : avgPatience > 3 ? '🟡 Medium' : '🔴 Low'} |\n`;
report += `| Boredom | ${avgBoredom.toFixed(1)}/10 | ${avgBoredom < 4 ? '🟢 Low' : avgBoredom < 7 ? '🟡 Medium' : '🔴 High'} |\n`;
report += `| Excitement | ${avgExcitement.toFixed(1)}/10 | ${avgExcitement > 6 ? '🟢 High' : avgExcitement > 3 ? '🟡 Medium' : '🔴 Low'} |\n\n`;

// Scroll Risk Assessment
const scrollMentions = chunksData.chunks.filter(c => 
    c.analysis.toLowerCase().includes('scroll') ||
    c.analysis.toLowerCase().includes('bored')
).length;

const scrollRisk = scrollMentions > chunksData.chunks.length / 2 ? '🔴 HIGH RISK' : 
                   scrollMentions > chunksData.chunks.length / 4 ? '🟡 MEDIUM RISK' : 
                   '🟢 LOW RISK';

report += `**Scroll Risk:** ${scrollRisk} (${scrollMentions}/${chunksData.chunks.length} chunks mention scrolling/boredom)\n\n`;

// Key Moments
report += `---\n\n`;
report += `## 🎯 Key Moments\n\n`;

// Find peak excitement moments
const excitementPeaks = chunksData.chunks
    .map((c, i) => {
        const match = c.analysis.match(/excitement["']?\s*[:\-]?\s*(\d+)/i);
        return { chunk: c, index: i, score: match ? parseInt(match[1]) : 5 };
    })
    .filter(x => x.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

if (excitementPeaks.length > 0) {
    report += `### Peak Excitement Moments\n\n`;
    excitementPeaks.forEach(p => {
        report += `**[${p.chunk.startTime}s - ${p.chunk.endTime}s]** — Excitement: ${p.score}/10\n\n`;
        const visuals = p.chunk.analysis.match(/visuals?["']?\s*[:\-]?\s*["']?([^"]+)/i);
        if (visuals) {
            report += `> "${visuals[1].substring(0, 100)}${visuals[1].length > 100 ? '...' : ''}"\n\n`;
        }
    });
}

// Low points (high boredom)
const boredomLows = chunksData.chunks
    .map((c, i) => {
        const match = c.analysis.match(/boredom["']?\s*[:\-]?\s*(\d+)/i);
        return { chunk: c, index: i, score: match ? parseInt(match[1]) : 5 };
    })
    .filter(x => x.score >= 7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

if (boredomLows.length > 0) {
    report += `### Risk Moments (High Boredom)\n\n`;
    boredomLows.forEach(p => {
        report += `**[${p.chunk.startTime}s - ${p.chunk.endTime}s]** — Boredom: ${p.score}/10\n\n`;
        
        // Parse the analysis JSON to extract per-second thoughts
        let scrollIntentText = null;
        try {
            const analysisJson = JSON.parse(p.chunk.analysis);
            if (analysisJson.per_second_analysis && Array.isArray(analysisJson.per_second_analysis)) {
                // Find seconds with high boredom (>= 7) in this chunk
                const highBoredomSeconds = analysisJson.per_second_analysis
                    .filter(s => s.boredom >= 7 && s.thought)
                    .map(s => s.thought);
                
                if (highBoredomSeconds.length > 0) {
                    // Use the first high-boredom thought
                    scrollIntentText = highBoredomSeconds[0];
                    // Truncate long thoughts to 100 chars for readability
                    if (scrollIntentText.length > 100) {
                        scrollIntentText = scrollIntentText.substring(0, 100) + '...';
                    }
                }
            }
        } catch (e) {
            // JSON parse failed, skip thought extraction
        }
        
        if (scrollIntentText) {
            report += `> Scroll intent: "${scrollIntentText}"\n\n`;
        } else {
            report += `> Scroll intent: N/A (no thought data available)\n\n`;
        }
    });
}

// Dialogue Impact
if (dialogueData?.dialogue_segments?.length > 0) {
    report += `---\n\n`;
    report += `## 🗣️ Dialogue Analysis\n\n`;
    
    report += `### Key Spoken Moments\n\n`;
    dialogueData.dialogue_segments.slice(0, 5).forEach(d => {
        report += `**[${d.timestamp_start}] ${d.speaker}** (${d.emotion}, ${d.delivery})\n\n`;
        report += `> "${d.text}"\n\n`;
    });
}

// Music Impact
if (musicData?.audio_segments?.length > 0) {
    report += `---\n\n`;
    report += `## 🎵 Audio & Music Analysis\n\n`;
    
    musicData.audio_segments.forEach(m => {
        report += `**[${m.timestamp_start} - ${m.timestamp_end}]** — ${m.mood.toUpperCase()}\n\n`;
        report += `- ${m.description}\n`;
        report += `- Genre: ${m.genre}\n`;
        if (m.sfx?.length > 0) {
            report += `- SFX: ${m.sfx.join(', ')}\n`;
        }
        report += `\n`;
    });
}

// Emotional Journey Timeline
report += `---\n\n`;
report += `## 📈 Emotional Journey Timeline\n\n`;
report += `| Time | Patience | Boredom | Excitement | Notes |\n`;
report += `|------|----------|---------|------------|-------|\n`;

chunksData.chunks.forEach(c => {
    const p = c.analysis.match(/patience["']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    const b = c.analysis.match(/boredom["']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    const e = c.analysis.match(/excitement["']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    
    // Build meaningful notes from actual content (dialogue, music, persona thoughts)
    const notes = [];
    
    try {
        const analysis = JSON.parse(c.analysis);
        
        // 1. Extract actual dialogue quotes from this time segment
        if (dialogueData?.dialogue_segments) {
            const segmentDialogues = dialogueData.dialogue_segments.filter(d => {
                // Convert timestamp "00:XX" to seconds and check if in range
                const startSec = parseInt(d.timestamp_start.split(':')[1]);
                const endSec = parseInt(d.timestamp_end.split(':')[1]);
                return startSec >= c.startTime && startSec < c.endTime;
            });
            
            if (segmentDialogues.length > 0) {
                // Take first 1-2 key quotes, truncate to ~40 chars each
                const quotes = segmentDialogues.slice(0, 2).map(d => {
                    const text = d.text.replace(/[""]/g, '').trim();
                    return text.length > 40 ? text.substring(0, 40) + '...' : text;
                });
                if (quotes.length > 0) {
                    notes.push(`"${quotes[0]}"`);
                }
            }
        }
        
        // 2. Extract music/audio description from this time segment
        if (musicData?.audio_segments) {
            const segmentMusic = musicData.audio_segments.find(m => {
                const startSec = parseInt(m.timestamp_start.split(':')[1]);
                return startSec >= c.startTime && startSec < c.endTime;
            });
            
            if (segmentMusic) {
                // Extract mood + key description, truncate to ~30 chars
                const moodDesc = `${segmentMusic.mood} ${segmentMusic.description || ''}`.replace(/[""]/g, '').trim();
                const shortDesc = moodDesc.length > 30 ? moodDesc.substring(0, 30) + '...' : moodDesc;
                if (shortDesc) {
                    notes.push(shortDesc);
                }
            }
        }
        
        // 3. Extract persona thought from high-emotion moment
        if (analysis.per_second_analysis && Array.isArray(analysis.per_second_analysis)) {
            // Find seconds with strong emotions (boredom >= 7 OR excitement >= 7 OR SCROLLING)
            const highEmotionSeconds = analysis.per_second_analysis
                .filter(s => (s.boredom >= 7 || s.excitement >= 7 || s.scroll_risk === 'SCROLLING') && s.thought)
                .sort((a, b) => {
                    // Prioritize SCROLLING, then highest emotion score
                    if (a.scroll_risk === 'SCROLLING' && b.scroll_risk !== 'SCROLLING') return -1;
                    if (b.scroll_risk === 'SCROLLING' && a.scroll_risk !== 'SCROLLING') return 1;
                    const aScore = Math.max(a.boredom, a.excitement);
                    const bScore = Math.max(b.boredom, b.excitement);
                    return bScore - aScore;
                });
            
            if (highEmotionSeconds.length > 0) {
                // Take the thought from the most impactful moment, truncate to ~50 chars
                const thought = highEmotionSeconds[0].thought.replace(/[""]/g, '').trim();
                const shortThought = thought.length > 50 ? thought.substring(0, 50) + '...' : thought;
                if (shortThought) {
                    notes.push(shortThought);
                }
            }
        }
        
        // 4. Highlight emotional shift triggers (what caused the change)
        if (analysis.per_second_analysis && Array.isArray(analysis.per_second_analysis)) {
            // Check for boredom spikes triggered by specific visual patterns
            const boredomSpikes = analysis.per_second_analysis.filter(s => 
                s.boredom >= 8 && s.visuals && 
                (s.visuals.toLowerCase().includes('logo') || 
                 s.visuals.toLowerCase().includes('text') || 
                 s.visuals.toLowerCase().includes('black'))
            );
            
            if (boredomSpikes.length > 0) {
                const trigger = boredomSpikes[0].visuals.replace(/[""]/g, '').trim();
                const shortTrigger = trigger.length > 30 ? trigger.substring(0, 30) + '...' : trigger;
                notes.push(`⚠️ ${shortTrigger}`);
            }
            
            // Check for excitement spikes from action
            const excitementSpikes = analysis.per_second_analysis.filter(s => 
                s.excitement >= 9 && s.visuals &&
                (s.visuals.toLowerCase().includes('explosion') || 
                 s.visuals.toLowerCase().includes('action') ||
                 s.visuals.toLowerCase().includes('combat'))
            );
            
            if (excitementSpikes.length > 0 && !boredomSpikes.length) {
                const trigger = excitementSpikes[0].visuals.replace(/[""]/g, '').trim();
                const shortTrigger = trigger.length > 30 ? trigger.substring(0, 30) + '...' : trigger;
                notes.push(`🔥 ${shortTrigger}`);
            }
        }
    } catch (err) {
        // JSON parse failed, fall back to basic info
        if (c.contextUsed?.dialogueLines > 0) {
            notes.push(`💬 ${c.contextUsed.dialogueLines} lines`);
        }
    }
    
    // Format notes concisely (max ~150 chars total for table readability)
    // Join with separators, but limit total length
    const note = notes.length > 0 ? notes.join(' | ') : 'No data';
    const truncatedNote = note.length > 150 ? note.substring(0, 150) + '...' : note;
    report += `| ${c.startTime}s-${c.endTime}s | ${p} | ${b} | ${e} | ${truncatedNote} |\n`;
});

report += `\n`;

// Recommendations
report += `---\n\n`;
report += `## 💡 Recommendations\n\n`;

if (avgBoredom > 5) {
    report += `### 🔴 Critical Issues\n\n`;
    report += `- High boredom detected (${avgBoredom.toFixed(1)}/10). Consider:\n`;
    report += `  - Faster pacing in first 3 seconds (critical scroll window)\n`;
    report += `  - More immediate action/impact\n`;
    report += `  - Reduce intro/exposition\n\n`;
}

if (avgExcitement < 6) {
    report += `### 🟡 Improvement Opportunities\n\n`;
    report += `- Low excitement (${avgExcitement.toFixed(1)}/10). Consider:\n`;
    report += `  - Add more dynamic moments\n`;
    report += `  - Enhance music drop timing\n`;
    report += `  - Increase visual spectacle\n\n`;
}

if (avgPatience < 5) {
    report += `### 🟡 Retention Risk\n\n`;
    report += `- Low patience (${avgPatience.toFixed(1)}/10). Viewers likely to scroll.\n\n`;
}

report += `### ✅ Strengths to Maintain\n\n`;
if (avgExcitement > 6) {
    report += `- Strong excitement peaks — keep dynamic energy\n`;
}
if (avgBoredom < 4) {
    report += `- Good pacing — maintains attention\n`;
}
report += `\n`;

// Raw Data
report += `---\n\n`;
report += `## 📋 Raw Analysis Data\n\n`;
report += `<details>\n`;
report += `<summary>Click to expand full JSON data</summary>\n\n`;
report += `#### Dialogue Analysis\n\n`;
report += `<pre><code class="language-json">`;
report += escapeHtml(JSON.stringify(dialogueData, null, 2));
report += `</code></pre>\n\n`;
report += `#### Music Analysis\n\n`;
report += `<pre><code class="language-json">`;
report += escapeHtml(JSON.stringify(musicData, null, 2));
report += `</code></pre>\n\n`;
report += `#### Video Chunks\n\n`;
report += `<pre><code class="language-json">`;
report += escapeHtml(JSON.stringify(chunksData, null, 2));
report += `</code></pre>\n\n`;
report += `</details>\n\n`;

// Footer
report += `---\n\n`;
report += `*Generated by OpenTruth Emotion Engine*  \n`;
report += `*Models Used: ${Object.keys(tokenUsageByModel).join(', ')}*\n`;

// Save report
fs.writeFileSync(REPORT_PATH, report);

console.log('✅ Report generated!');
console.log(`\n   Location: ${REPORT_PATH}`);
console.log(`   Size: ${(fs.statSync(REPORT_PATH).size / 1024).toFixed(1)} KB`);
console.log(`\n🎉 Analysis complete! Open ${REPORT_PATH} to view results.\n`);
