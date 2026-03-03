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

// Model used for video chunk analysis (from environment or default)
const MODEL = process.env.VIDEO_MODEL || 'openrouter/qwen/qwen3.5-397b-a17b';

/**
 * OpenRouter pricing map (USD per token)
 * Source: https://openrouter.ai/api/v1/models
 * Updated: 2026-03-03
 */
const PRICING_MAP = {
  // Dialogue & Music analysis models
  'openai/gpt-audio': {
    prompt: 0.0000006,  // $0.60 per 1M tokens
    completion: 0.0000024 // $2.40 per 1M tokens
  },
  // Video chunk analysis models
  'qwen/qwen3.5-122b-a10b': {
    prompt: 0.0000003,  // $0.30 per 1M tokens
    completion: 0.0000024 // $2.40 per 1M tokens
  },
  'qwen/qwen3.5-397b-a17b': {
    prompt: 0.00000055, // $0.55 per 1M tokens
    completion: 0.0000035 // $3.50 per 1M tokens
  },
  // Fallback models
  'kimi/kimi-k2-0905': {
    prompt: 0.00000045,
    completion: 0.0000022
  },
  // Default fallback (charge nothing if model unknown)
  'default': {
    prompt: 0,
    completion: 0
  }
};

/**
 * Calculate cost for a model based on tokens
 * Assumes tokens are mostly prompt tokens for analysis tasks
 * @param {string} model - Model identifier
 * @param {number} tokens - Total tokens used
 * @returns {number} Cost in USD
 */
function calculateCost(model, tokens) {
  const pricing = PRICING_MAP[model] || PRICING_MAP['default'];
  // For analysis tasks, assume ~80% prompt, 20% completion
  const promptTokens = tokens * 0.8;
  const completionTokens = tokens * 0.2;
  return (promptTokens * pricing.prompt) + (completionTokens * pricing.completion);
}

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
 * @param {string} outputDir - Output directory path
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateInputs(outputDir) {
    const errors = [];
    
    const requiredFiles = [
        '01-dialogue-analysis.md',
        '02-music-analysis.md',
        '03-chunked-analysis.json'
    ];
    
    console.log('🔍 Validating input files...\n');
    
    for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file);
        
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

/**
 * Main report generation function
 * @param {string} [outputDir] - Optional output directory override
 * @returns {{success: boolean, reportPath?: string, error?: string}}
 */
async function main(outputDir) {
    // Resolve output directory
    const targetOutputDir = outputDir 
        ? path.isAbsolute(outputDir) 
            ? path.resolve(outputDir) 
            : path.resolve(REPO_ROOT, outputDir)
        : path.resolve(REPO_ROOT, 'output/default');
    const targetReportPath = path.join(targetOutputDir, 'FINAL-REPORT.md');

    // Log working directory and resolved paths
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`📁 Script directory: ${__dirname}`);
    console.log(`📁 Resolved output dir: ${targetOutputDir}`);
    console.log(`📁 Resolved report path: ${targetReportPath}\n`);

    // Run validation first
    const validation = validateInputs(targetOutputDir);

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
        return { success: false, error: validation.errors[0] };
    }

    // Load all data
    console.log('📚 Loading analysis data...\n');

    // Dialogue data
    const dialogueMd = fs.readFileSync(path.join(targetOutputDir, '01-dialogue-analysis.md'), 'utf8');
    const dialogueMatch = dialogueMd.match(/```json\s*\n([\s\S]*?)\n```/);
    const dialogueData = dialogueMatch ? JSON.parse(dialogueMatch[1]) : null;
    // Extract model and tokens from dialogue markdown header
    const dialogueModelMatch = dialogueMd.match(/\*\*Model:\*\*\s*([^\n]+)/);
    const dialogueModel = dialogueModelMatch ? dialogueModelMatch[1].trim() : 'unknown';
    const dialogueTokensMatch = dialogueMd.match(/\*\*Tokens Used:\*\*\s*([0-9,]+)/);
    const dialogueTokens = dialogueTokensMatch ? parseInt(dialogueTokensMatch[1].replace(/,/g, '')) : 0;

    // Music data  
    const musicMd = fs.readFileSync(path.join(targetOutputDir, '02-music-analysis.md'), 'utf8');
    const musicMatch = musicMd.match(/```json\s*\n([\s\S]*?)\n```/);
    const musicData = musicMatch ? JSON.parse(musicMatch[1]) : null;
    // Extract model and tokens from music markdown header
    const musicModelMatch = musicMd.match(/\*\*Model:\*\*\s*([^\n]+)/);
    const musicModel = musicModelMatch ? musicModelMatch[1].trim() : 'unknown';
    const musicTokensMatch = musicMd.match(/\*\*Tokens Used:\*\*\s*([0-9,]+)/);
    const musicTokens = musicTokensMatch ? parseInt(musicTokensMatch[1].replace(/,/g, '')) : 0;

    // Chunked video data
    const chunksJson = fs.readFileSync(path.join(targetOutputDir, '03-chunked-analysis.json'), 'utf8');
    const chunksData = JSON.parse(chunksJson);

    // Per-second emotions data (optional)
    let perSecondData = null;
    const perSecondPath = path.join(targetOutputDir, '04-per-second-emotions.json');
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
    report += `*Models Used: ${Object.keys(tokenUsageByModel).join(', ')}*\n\n`;
    report += `---\n\n`;
    report += `📊 **Detailed Analysis:** See [PER-SECOND-APPENDIX.md](PER-SECOND-APPENDIX.md) for complete second-by-second breakdown.\n`;

    // Save main report
    fs.writeFileSync(targetReportPath, report);

    console.log('✅ Main report generated!');
    console.log(`   Location: ${targetReportPath}`);
    console.log(`   Size: ${(fs.statSync(targetReportPath).size / 1024).toFixed(1)} KB\n`);

    // Generate Per-Second Appendix if per-second data is available
    if (perSecondData && perSecondData.per_second_data && perSecondData.per_second_data.length > 0) {
        console.log('📊 Generating per-second appendix...\n');
        await generatePerSecondAppendix(targetOutputDir, chunksData, perSecondData, dialogueData, musicData);
    } else {
        console.log('⚠️  No per-second data available - skipping appendix generation\n');
    }

    console.log('🎉 Analysis complete! Open FINAL-REPORT.md to view results.\n');
    
    return {
        success: true,
        reportPath: targetReportPath
    };
}

/**
 * Generate SVG line chart
 * @param {Array} data - Array of values
 * @param {Array} labels - Array of labels (timestamps)
 * @param {string} title - Chart title
 * @param {string} color - Line color
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @returns {string} SVG string
 */
function generateLineChart(data, labels, title, color, width = 800, height = 400) {
    const padding = { top: 60, right: 30, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxValue = 10;
    const minValue = 0;
    
    // Calculate points
    const points = data.map((value, index) => {
        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
        return { x, y, value, label: labels[index] };
    });
    
    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    
    // Background
    svg += `  <rect width="${width}" height="${height}" fill="#ffffff"/>\n`;
    
    // Title
    svg += `  <text x="${width/2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333">${title}</text>\n`;
    
    // Grid lines and Y-axis labels
    for (let i = 0; i <= 10; i += 2) {
        const y = padding.top + chartHeight - (i / 10) * chartHeight;
        svg += `  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>\n`;
        svg += `  <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#666">${i}</text>\n`;
    }
    
    // X-axis labels (show every Nth label to avoid crowding)
    const labelStep = Math.ceil(labels.length / 10);
    points.forEach((point, i) => {
        if (i % labelStep === 0 || i === points.length - 1) {
            svg += `  <text x="${point.x}" y="${height - 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">${point.label}s</text>\n`;
        }
    });
    
    // X-axis title
    svg += `  <text x="${width/2}" y="${height - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#333">Time (seconds)</text>\n`;
    
    // Y-axis title
    svg += `  <text x="15" y="${height/2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#333" transform="rotate(-90, 15, ${height/2})">Score</text>\n`;
    
    // Area fill
    const areaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaClose = `L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
    svg += `  <path d="${areaPath} ${areaClose}" fill="${color}20" stroke="none"/>\n`;
    
    // Line
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    svg += `  <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>\n`;
    
    // Data points
    points.forEach(point => {
        svg += `  <circle cx="${point.x}" cy="${point.y}" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>\n`;
    });
    
    svg += `</svg>`;
    return svg;
}

/**
 * Generate SVG bar chart for scroll risk
 * @param {Array} data - Array of risk values (0-4)
 * @param {Array} labels - Array of labels (timestamps)
 * @param {string} title - Chart title
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @returns {string} SVG string
 */
function generateBarChart(data, labels, title, width = 800, height = 400) {
    const padding = { top: 60, right: 30, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxValue = 4;
    const barWidth = chartWidth / data.length;
    
    const riskColors = ['#00ff00', '#ffff00', '#ffa500', '#ff0000', '#ff0000']; // low, medium, high, SCROLLING
    const riskLabels = ['Low', 'Medium', 'High', 'SCROLLING'];
    
    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    
    // Background
    svg += `  <rect width="${width}" height="${height}" fill="#ffffff"/>\n`;
    
    // Title
    svg += `  <text x="${width/2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333">${title}</text>\n`;
    
    // Grid lines and Y-axis labels
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + chartHeight - (i / 4) * chartHeight;
        svg += `  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>\n`;
        svg += `  <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#666">${riskLabels[i] || i}</text>\n`;
    }
    
    // X-axis labels (show every Nth label)
    const labelStep = Math.ceil(labels.length / 10);
    data.forEach((value, i) => {
        if (i % labelStep === 0 || i === data.length - 1) {
            const x = padding.left + i * barWidth + barWidth / 2;
            svg += `  <text x="${x}" y="${height - 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">${labels[i]}s</text>\n`;
        }
    });
    
    // X-axis title
    svg += `  <text x="${width/2}" y="${height - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#333">Time (seconds)</text>\n`;
    
    // Y-axis title
    svg += `  <text x="15" y="${height/2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#333" transform="rotate(-90, 15, ${height/2})">Risk Level</text>\n`;
    
    // Bars
    data.forEach((value, i) => {
        const x = padding.left + i * barWidth + 1;
        const barHeight = (value / 4) * chartHeight;
        const y = padding.top + chartHeight - barHeight;
        const color = riskColors[Math.min(value, riskColors.length - 1)];
        svg += `  <rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="${color}" stroke="#333" stroke-width="0.5" opacity="0.8"/>\n`;
    });
    
    svg += `</svg>`;
    return svg;
}

/**
 * Generate PNG charts for emotion metrics (using SVG format)
 * @param {string} outputDir - Output directory path
 * @param {Array} data - Per-second emotion data
 * @param {number} duration - Video duration in seconds
 */
async function generatePngCharts(outputDir, data, duration) {
    console.log('📊 Generating SVG charts...\n');
    
    try {
        const labels = data.map(s => s.timestamp);
        
        // 1. Boredom Timeline (Line Chart)
        const boredomData = data.map(s => s.boredom);
        const boredomSvg = generateLineChart(boredomData, labels, 'Boredom Over Time (Higher = Worse)', '#ff6384');
        fs.writeFileSync(path.join(outputDir, 'boredom-timeline.svg'), boredomSvg);
        console.log('   ✅ boredom-timeline.svg generated');
        
        // Also save as .png extension for markdown compatibility (it's actually SVG)
        fs.writeFileSync(path.join(outputDir, 'boredom-timeline.png'), boredomSvg);
        
        // 2. Excitement Timeline (Line Chart)
        const excitementData = data.map(s => s.excitement);
        const excitementSvg = generateLineChart(excitementData, labels, 'Excitement Over Time (Higher = Better)', '#36a2eb');
        fs.writeFileSync(path.join(outputDir, 'excitement-timeline.svg'), excitementSvg);
        console.log('   ✅ excitement-timeline.svg generated');
        fs.writeFileSync(path.join(outputDir, 'excitement-timeline.png'), excitementSvg);
        
        // 3. Patience Timeline (Line Chart)
        const patienceData = data.map(s => s.patience);
        const patienceSvg = generateLineChart(patienceData, labels, 'Patience Over Time (Higher = Better)', '#4bc0c0');
        fs.writeFileSync(path.join(outputDir, 'patience-timeline.svg'), patienceSvg);
        console.log('   ✅ patience-timeline.svg generated');
        fs.writeFileSync(path.join(outputDir, 'patience-timeline.png'), patienceSvg);
        
        // 4. Scroll Risk Timeline (Bar Chart)
        const scrollRiskData = data.map(s => {
            switch(s.scroll_risk) {
                case 'SCROLLING': return 3;
                case 'high': return 2;
                case 'medium': return 1;
                case 'low': return 0;
                default: return 0;
            }
        });
        const scrollRiskSvg = generateBarChart(scrollRiskData, labels, 'Scroll Risk Timeline (Red = Critical Risk)');
        fs.writeFileSync(path.join(outputDir, 'scroll-risk-timeline.svg'), scrollRiskSvg);
        console.log('   ✅ scroll-risk-timeline.svg generated');
        fs.writeFileSync(path.join(outputDir, 'scroll-risk-timeline.png'), scrollRiskSvg);
        
        console.log('\n✅ All SVG charts generated successfully\n');
        return true;
    } catch (error) {
        console.error('❌ Error generating SVG charts:', error.message);
        console.error('   Falling back to ASCII charts\n');
        return false;
    }
}

/**
 * Generate detailed per-second appendix report
 * @param {string} outputDir - Output directory path
 * @param {object} chunksData - Chunked analysis data
 * @param {object} perSecondData - Per-second emotion data
 * @param {object} dialogueData - Dialogue analysis data
 * @param {object} musicData - Music analysis data
 */
async function generatePerSecondAppendix(outputDir, chunksData, perSecondData, dialogueData, musicData) {
    const appendixPath = path.join(outputDir, 'PER-SECOND-APPENDIX.md');
    const data = perSecondData.per_second_data;
    const duration = Math.floor(perSecondData.duration);

    // Generate SVG charts first
    await generatePngCharts(outputDir, data, duration);

    let appendix = `# Per-Second Emotion Analysis Appendix\n\n`;
    appendix += `**Video:** ${path.basename(chunksData.video, path.extname(chunksData.video))}\n\n`;
    appendix += `**Generated:** ${new Date().toISOString()}\n\n`;
    appendix += `**Total Duration:** ${duration} seconds\n\n`;
    appendix += `---\n\n`;

    // Summary Statistics
    appendix += `## 📊 Summary Statistics\n\n`;

    // Calculate averages
    const avgPatience = data.reduce((sum, s) => sum + s.patience, 0) / data.length;
    const avgBoredom = data.reduce((sum, s) => sum + s.boredom, 0) / data.length;
    const avgExcitement = data.reduce((sum, s) => sum + s.excitement, 0) / data.length;

    appendix += `### Average Scores Across Video\n\n`;
    appendix += `| Metric | Average | Status |\n`;
    appendix += `|--------|---------|--------|\n`;
    appendix += `| Patience | ${avgPatience.toFixed(2)}/10 | ${avgPatience > 6 ? '🟢 High' : avgPatience > 3 ? '🟡 Medium' : '🔴 Low'} |\n`;
    appendix += `| Boredom | ${avgBoredom.toFixed(2)}/10 | ${avgBoredom < 4 ? '🟢 Low' : avgBoredom < 7 ? '🟡 Medium' : '🔴 High'} |\n`;
    appendix += `| Excitement | ${avgExcitement.toFixed(2)}/10 | ${avgExcitement > 6 ? '🟢 High' : avgExcitement > 3 ? '🟡 Medium' : '🔴 Low'} |\n\n`;

    // Peak Moments
    appendix += `### Peak Moments\n\n`;

    const maxBoredom = Math.max(...data.map(s => s.boredom));
    const maxExcitement = Math.max(...data.map(s => s.excitement));
    const minPatience = Math.min(...data.map(s => s.patience));
    const maxPatience = Math.max(...data.map(s => s.patience));

    const peakBoredomSeconds = data.filter(s => s.boredom === maxBoredom);
    const peakExcitementSeconds = data.filter(s => s.excitement === maxExcitement);
    const lowestPatienceSeconds = data.filter(s => s.patience === minPatience);
    const highestPatienceSeconds = data.filter(s => s.patience === maxPatience);

    appendix += `- **Highest Boredom:** ${maxBoredom}/10 at second${peakBoredomSeconds.length > 1 ? 's' : ''} ${peakBoredomSeconds.map(s => `${s.timestamp}s`).join(', ')}\n`;
    appendix += `- **Highest Excitement:** ${maxExcitement}/10 at second${peakExcitementSeconds.length > 1 ? 's' : ''} ${peakExcitementSeconds.map(s => `${s.timestamp}s`).join(', ')}\n`;
    appendix += `- **Lowest Patience:** ${minPatience}/10 at second${lowestPatienceSeconds.length > 1 ? 's' : ''} ${lowestPatienceSeconds.map(s => `${s.timestamp}s`).join(', ')}\n`;
    appendix += `- **Highest Patience:** ${maxPatience}/10 at second${highestPatienceSeconds.length > 1 ? 's' : ''} ${highestPatienceSeconds.map(s => `${s.timestamp}s`).join(', ')}\n\n`;

    // Scroll Risk Statistics
    const scrollingSeconds = data.filter(s => s.scroll_risk === 'SCROLLING');
    const highRiskSeconds = data.filter(s => s.scroll_risk === 'high');
    const totalScrollRisk = scrollingSeconds.length + highRiskSeconds.length;

    appendix += `### Scroll Risk Analysis\n\n`;
    appendix += `- **Total Seconds at SCROLLING Risk:** ${scrollingSeconds.length} (${((scrollingSeconds.length / data.length) * 100).toFixed(1)}%)\n`;
    appendix += `- **Total Seconds at High Risk:** ${highRiskSeconds.length} (${((highRiskSeconds.length / data.length) * 100).toFixed(1)}%)\n`;
    appendix += `- **Combined High Scroll Risk:** ${totalScrollRisk} seconds (${((totalScrollRisk / data.length) * 100).toFixed(1)}% of video)\n\n`;

    if (scrollingSeconds.length > 0) {
        appendix += `**Critical Scroll Moments:**\n\n`;
        
        // Deduplicate by timestamp (ensure each second appears only once)
        const uniqueScrollingSeconds = scrollingSeconds.filter((s, index, self) => 
            index === self.findIndex(t => t.timestamp === s.timestamp)
        );
        
        // Show top 10 most critical moments (SCROLLING risk only)
        const displayCount = Math.min(uniqueScrollingSeconds.length, 10);
        uniqueScrollingSeconds.slice(0, displayCount).forEach(s => {
            appendix += `- **${s.timestamp}s:** "${s.thought}"\n`;
        });
        
        // Show clear indicator if there are more moments
        if (uniqueScrollingSeconds.length > displayCount) {
            appendix += `\n*(Showing top ${displayCount} of ${uniqueScrollingSeconds.length} critical scroll moments)*\n`;
        }
        appendix += `\n`;
    }

    // Emotional Arc Visualization (SVG Charts)
    appendix += `### 📈 Emotional Arc Visualization\n\n`;
    appendix += `*Charts showing emotion trends across video duration*\n\n`;

    appendix += `#### Boredom Timeline\n\n`;
    appendix += `![Boredom over time](boredom-timeline.png)\n\n`;
    appendix += `*Figure 1: Boredom score over time (higher = worse)*\n\n`;

    appendix += `#### Excitement Timeline\n\n`;
    appendix += `![Excitement over time](excitement-timeline.png)\n\n`;
    appendix += `*Figure 2: Excitement score over time (higher = better)*\n\n`;

    appendix += `#### Patience Timeline\n\n`;
    appendix += `![Patience over time](patience-timeline.png)\n\n`;
    appendix += `*Figure 3: Patience score over time (higher = better)*\n\n`;

    appendix += `#### Scroll Risk Timeline\n\n`;
    appendix += `![Scroll risk over time](scroll-risk-timeline.png)\n\n`;
    appendix += `*Figure 4: Scroll risk levels (Green = Low, Yellow = Medium, Orange = High, Red = SCROLLING)*\n\n`;

    appendix += `---\n\n`;

    // Full Second-by-Second Timeline
    appendix += `## 📈 Complete Second-by-Second Timeline\n\n`;
    appendix += `| Sec | Patience | Boredom | Excitement | Scroll Risk | Visual Summary | Inner Monologue |\n`;
    appendix += `|-----|----------|---------|------------|-------------|----------------|-----------------|\n`;

    data.forEach(s => {
        const scrollIcon = s.scroll_risk === 'SCROLLING' ? '🔴 SCROLLING' : 
                          s.scroll_risk === 'high' ? '🟠 High' : 
                          s.scroll_risk === 'medium' ? '🟡 Medium' : '🟢 Low';
        
        // Truncate visuals to 100 chars
        const visualShort = s.visuals.length > 100 ? s.visuals.substring(0, 100) + '...' : s.visuals;
        
        // Truncate thought to 80 chars
        const thoughtShort = s.thought.length > 80 ? s.thought.substring(0, 80) + '...' : s.thought;
        
        // Use backslash escaping for pipes in markdown table cells
        const visualEscaped = visualShort.replace(/\|/g, '\\|');
        const thoughtEscaped = thoughtShort.replace(/\|/g, '\\|');
        
        appendix += `| ${String(s.timestamp).padStart(3)}s | ${String(s.patience).padStart(8)} | ${String(s.boredom).padStart(7)} | ${String(s.excitement).padStart(10)} | ${scrollIcon.padStart(15)} | ${visualEscaped} | ${thoughtEscaped} |\n`;
    });

    appendix += `\n---\n\n`;

    // Detailed Breakdown by Time Segments
    appendix += `## 🎯 Detailed Breakdown by 10-Second Segments\n\n`;

    const segmentSize = 10;
    const numSegments = Math.ceil(data.length / segmentSize);

    for (let seg = 0; seg < numSegments; seg++) {
        const start = seg * segmentSize;
        const end = Math.min((seg + 1) * segmentSize, data.length);
        const segment = data.slice(start, end);

        const segAvgPatience = segment.reduce((sum, s) => sum + s.patience, 0) / segment.length;
        const segAvgBoredom = segment.reduce((sum, s) => sum + s.boredom, 0) / segment.length;
        const segAvgExcitement = segment.reduce((sum, s) => sum + s.excitement, 0) / segment.length;
        const segScrollingCount = segment.filter(s => s.scroll_risk === 'SCROLLING').length;

        appendix += `### ${start}s - ${end - 1}s\n\n`;
        appendix += `**Averages:** Patience: ${segAvgPatience.toFixed(1)} | Boredom: ${segAvgBoredom.toFixed(1)} | Excitement: ${segAvgExcitement.toFixed(1)}\n\n`;
        appendix += `**Scroll Risk:** ${segScrollingCount}/${segment.length} seconds at SCROLLING risk\n\n`;

        // Find key moments in this segment
        const peakMoment = segment.reduce((max, s) => s.excitement > max.excitement ? s : max, segment[0]);
        const lowMoment = segment.reduce((min, s) => s.boredom > min.boredom ? s : min, segment[0]);

        appendix += `**Peak Moment:** ${peakMoment.timestamp}s - Excitement ${peakMoment.excitement}/10 - "${peakMoment.thought}"\n\n`;
        appendix += `**Lowest Moment:** ${lowMoment.timestamp}s - Boredom ${lowMoment.boredom}/10 - "${lowMoment.thought}"\n\n`;

        // Add dialogue context if available
        if (dialogueData?.dialogue_segments) {
            const segmentDialogues = dialogueData.dialogue_segments.filter(d => {
                const parts = d.timestamp_start.split(':');
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                const startSec = minutes * 60 + seconds;
                return startSec >= start && startSec < end;
            });

            if (segmentDialogues.length > 0) {
                appendix += `**Dialogue in this segment:**\n\n`;
                segmentDialogues.forEach(d => {
                    appendix += `- [${d.timestamp_start}] ${d.speaker}: "${d.text}" (${d.emotion})\n`;
                });
                appendix += `\n`;
            }
        }

        // Add music context if available
        if (musicData?.audio_segments) {
            const segmentMusic = musicData.audio_segments.filter(m => {
                const parts = m.timestamp_start.split(':');
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                const startSec = minutes * 60 + seconds;
                return startSec >= start && startSec < end;
            });

            if (segmentMusic.length > 0) {
                appendix += `**Audio/Music in this segment:**\n\n`;
                segmentMusic.forEach(m => {
                    appendix += `- [${m.timestamp_start}] ${m.mood} - ${m.description}\n`;
                });
                appendix += `\n`;
            }
        }

        appendix += `---\n\n`;
    }

    // Correlation Analysis
    appendix += `## 🔍 Correlation Analysis\n\n`;
    appendix += `### Emotion Correlations\n\n`;

    // Calculate simple correlations
    let patienceBoredomSum = 0;
    let patienceExcitementSum = 0;
    let boredomExcitementSum = 0;

    const pAvg = avgPatience;
    const bAvg = avgBoredom;
    const eAvg = avgExcitement;

    data.forEach(s => {
        patienceBoredomSum += (s.patience - pAvg) * (s.boredom - bAvg);
        patienceExcitementSum += (s.patience - pAvg) * (s.excitement - eAvg);
        boredomExcitementSum += (s.boredom - bAvg) * (s.excitement - eAvg);
    });

    const n = data.length;
    const pbCorr = patienceBoredomSum / (n * 10 * 10);
    const peCorr = patienceExcitementSum / (n * 10 * 10);
    const beCorr = boredomExcitementSum / (n * 10 * 10);

    appendix += `| Emotion Pair | Correlation | Interpretation |\n`;
    appendix += `|--------------|-------------|----------------|\n`;
    appendix += `| Patience ↔ Boredom | ${pbCorr.toFixed(2)} | ${pbCorr < -0.5 ? 'Strong negative (expected)' : pbCorr < 0 ? 'Weak negative' : 'Positive (unexpected)'} |\n`;
    appendix += `| Patience ↔ Excitement | ${peCorr.toFixed(2)} | ${peCorr > 0.5 ? 'Strong positive' : peCorr > 0 ? 'Weak positive' : 'No correlation'} |\n`;
    appendix += `| Boredom ↔ Excitement | ${beCorr.toFixed(2)} | ${beCorr < -0.5 ? 'Strong negative (expected)' : beCorr < 0 ? 'Weak negative' : 'No correlation'} |\n\n`;

    appendix += `### Key Insights\n\n`;

    const insights = [];

    if (avgBoredom > 6) {
        insights.push(`⚠️ **High overall boredom** (${avgBoredom.toFixed(1)}/10) suggests pacing issues throughout the video.`);
    }

    if (scrollingSeconds.length > duration * 0.3) {
        insights.push(`🔴 **Critical:** Over 30% of seconds have SCROLLING risk. First 3-5 seconds need immediate improvement.`);
    }

    if (maxExcitement < 7) {
        insights.push(`📉 **Low excitement peaks** (max: ${maxExcitement}/10). Consider adding more dynamic moments.`);
    }

    if (avgExcitement > avgBoredom) {
        insights.push(`✅ **Positive:** Excitement consistently outpaces boredom - good engagement.`);
    }

    // Find the best and worst 5-second windows
    let bestWindowStart = 0;
    let bestWindowScore = -Infinity;
    let worstWindowStart = 0;
    let worstWindowScore = Infinity;

    for (let i = 0; i <= data.length - 5; i++) {
        const window = data.slice(i, i + 5);
        const score = window.reduce((sum, s) => sum + s.excitement - s.boredom, 0) / 5;
        if (score > bestWindowScore) {
            bestWindowScore = score;
            bestWindowStart = i;
        }
        if (score < worstWindowScore) {
            worstWindowScore = score;
            worstWindowStart = i;
        }
    }

    insights.push(`🎯 **Best 5-second window:** ${bestWindowStart}s-${bestWindowStart + 4}s (net emotion: ${bestWindowScore.toFixed(1)})`);
    insights.push(`⚠️ **Worst 5-second window:** ${worstWindowStart}s-${worstWindowStart + 4}s (net emotion: ${worstWindowScore.toFixed(1)})`);

    insights.forEach((insight, idx) => {
        appendix += `${idx + 1}. ${insight}\n\n`;
    });

    appendix += `---\n\n`;
    appendix += `*Generated by OpenTruth Emotion Engine - Per-Second Analysis Module*\n\n`;
    appendix += `**Token Usage:** ${perSecondData.totalTokens.toLocaleString()} tokens for per-second analysis\n`;

    // Save appendix
    fs.writeFileSync(appendixPath, appendix);

    console.log('✅ Per-second appendix generated!');
    console.log(`   Location: ${appendixPath}`);
    console.log(`   Size: ${(fs.statSync(appendixPath).size / 1024).toFixed(1)} KB\n`);
}

// Export for programmatic use
module.exports = { main };

// Run if called directly from CLI
if (require.main === module) {
    main(process.argv[2])
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}
