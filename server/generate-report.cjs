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
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Access canvas through pnpm structure
const canvasPath = path.join(__dirname, '..', 'node_modules', '.pnpm', 'canvas@3.2.1', 'node_modules', 'canvas');
const { createCanvas } = require(canvasPath);

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

    // Check if analyzed data is a subset of total video duration
    const analyzedDuration = perSecondData ? perSecondData.per_second_data?.length || 0 : chunksData.chunks?.length || 0;
    const totalDuration = chunksData.duration;
    const isPartialAnalysis = analyzedDuration > 0 && analyzedDuration < totalDuration;

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

    // Add subset warning if analysis covers less than full video
    if (isPartialAnalysis) {
        report += `\n⚠️ **Note:** Analysis covers ${analyzedDuration}s of ${totalDuration}s total video`;
        if (analyzedDuration < totalDuration * 0.5) {
            report += ` _(less than 50% of video analyzed)_`;
        }
        report += `\n`;
    }

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
    
    // Add subset warning near timeline if analysis is partial
    if (isPartialAnalysis) {
        report += `> ⚠️ **Partial Data:** This timeline shows ${analyzedDuration}s of ${totalDuration}s total video. `;
        report += `Some portions may not be included due to MAX_CHUNKS limits or testing mode.\n\n`;
    }
    
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
 * Generate PNG line chart using Chart.js and chartjs-node-canvas
 * @param {Array} data - Array of values
 * @param {Array} labels - Array of labels (timestamps)
 * @param {string} title - Chart title
 * @param {string} color - Line color (hex)
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateLineChartPng(data, labels, title, color, width = 800, height = 400) {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    
    // Sample labels to avoid crowding (show every Nth label)
    const labelStep = Math.ceil(labels.length / 10);
    const sampledLabels = labels.map((label, i) => (i % labelStep === 0 || i === labels.length - 1) ? `${label}s` : '');
    
    const configuration = {
        type: 'line',
        data: {
            labels: sampledLabels,
            datasets: [{
                label: title,
                data: data,
                borderColor: color,
                backgroundColor: color + '33', // 20% opacity for area fill
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    min: 0,
                    max: 10,
                    title: {
                        display: true,
                        text: 'Score'
                    },
                    ticks: {
                        stepSize: 2
                    }
                }
            }
        }
    };
    
    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

/**
 * Generate PNG bar chart for scroll risk using Chart.js and chartjs-node-canvas
 * @param {Array} data - Array of risk values (0-3)
 * @param {Array} labels - Array of labels (timestamps)
 * @param {string} title - Chart title
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateBarChartPng(data, labels, title, width = 800, height = 400) {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    
    // Map risk values to colors and labels
    const riskColors = ['#00ff00', '#ffff00', '#ffa500', '#ff0000'];
    const riskLabels = ['Low', 'Medium', 'High', 'SCROLLING'];
    
    // Sample labels to avoid crowding
    const labelStep = Math.ceil(labels.length / 10);
    const sampledLabels = labels.map((label, i) => (i % labelStep === 0 || i === labels.length - 1) ? `${label}s` : '');
    
    const backgroundColors = data.map(value => riskColors[Math.min(value, riskColors.length - 1)]);
    
    const configuration = {
        type: 'bar',
        data: {
            labels: sampledLabels,
            datasets: [{
                label: 'Risk Level',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: '#333',
                borderWidth: 0.5
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                },
                annotation: {
                    annotations: {
                        // Green band for Low risk zone (0-0.99)
                        lowZone: {
                            type: 'box',
                            yMin: 0,
                            yMax: 1,
                            backgroundColor: 'rgba(0, 255, 0, 0.1)',
                            borderColor: 'rgba(0, 255, 0, 0.3)',
                            borderWidth: 1,
                            drawTime: 'beforeDatasetsDraw'
                        },
                        // Yellow band for Medium risk zone (1-1.99)
                        mediumZone: {
                            type: 'box',
                            yMin: 1,
                            yMax: 2,
                            backgroundColor: 'rgba(255, 255, 0, 0.1)',
                            borderColor: 'rgba(255, 255, 0, 0.3)',
                            borderWidth: 1,
                            drawTime: 'beforeDatasetsDraw'
                        },
                        // Orange band for High risk zone (2-2.99)
                        highZone: {
                            type: 'box',
                            yMin: 2,
                            yMax: 3,
                            backgroundColor: 'rgba(255, 165, 0, 0.1)',
                            borderColor: 'rgba(255, 165, 0, 0.3)',
                            borderWidth: 1,
                            drawTime: 'beforeDatasetsDraw'
                        },
                        // Red band for SCROLLING zone (3-3.5)
                        scrollingZone: {
                            type: 'box',
                            yMin: 3,
                            yMax: 3.5,
                            backgroundColor: 'rgba(255, 0, 0, 0.1)',
                            borderColor: 'rgba(255, 0, 0, 0.3)',
                            borderWidth: 1,
                            drawTime: 'beforeDatasetsDraw'
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    min: 0,
                    max: 3,
                    title: {
                        display: true,
                        text: 'Risk Level (Severity)'
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            // Show categorical labels at each integer level
                            const labels = {
                                0: 'Low',
                                1: 'Medium',
                                2: 'High',
                                3: 'SCROLLING'
                            };
                            return labels[value] || '';
                        }
                    }
                }
            }
        }
    };
    
    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

/**
 * Generate PNG charts for emotion metrics (using Chart.js + chartjs-node-canvas)
 * @param {string} outputDir - Output directory path
 * @param {Array} data - Per-second emotion data
 * @param {number} duration - Video duration in seconds
 */
async function generatePngCharts(outputDir, data, duration) {
    console.log('📊 Generating PNG charts with Chart.js...\n');
    
    try {
        const labels = data.map(s => s.timestamp);
        
        // 1. Boredom Timeline (Line Chart)
        const boredomData = data.map(s => s.boredom);
        const boredomPng = await generateLineChartPng(boredomData, labels, 'Boredom Over Time (Higher = Worse)', '#ff6384');
        fs.writeFileSync(path.join(outputDir, 'boredom-timeline.png'), boredomPng);
        console.log('   ✅ boredom-timeline.png generated');
        
        // 2. Excitement Timeline (Line Chart)
        const excitementData = data.map(s => s.excitement);
        const excitementPng = await generateLineChartPng(excitementData, labels, 'Excitement Over Time (Higher = Better)', '#36a2eb');
        fs.writeFileSync(path.join(outputDir, 'excitement-timeline.png'), excitementPng);
        console.log('   ✅ excitement-timeline.png generated');
        
        // 3. Patience Timeline (Line Chart)
        const patienceData = data.map(s => s.patience);
        const patiencePng = await generateLineChartPng(patienceData, labels, 'Patience Over Time (Higher = Better)', '#4bc0c0');
        fs.writeFileSync(path.join(outputDir, 'patience-timeline.png'), patiencePng);
        console.log('   ✅ patience-timeline.png generated');
        
        // 4. Scroll Risk Timeline (Bar Chart)
        // Map risk levels to numeric values: low=0, medium=1, high=2, SCROLLING=3
        const scrollRiskData = data.map(s => {
            switch(s.scroll_risk) {
                case 'SCROLLING': return 3;  // Highest severity
                case 'high': return 2;
                case 'medium': return 1;
                case 'low': return 0;
                default: return 0;
            }
        });
        const scrollRiskPng = await generateBarChartPng(scrollRiskData, labels, 'Scroll Risk Timeline');
        fs.writeFileSync(path.join(outputDir, 'scroll-risk-timeline.png'), scrollRiskPng);
        console.log('   ✅ scroll-risk-timeline.png generated');
        
        console.log('\n✅ All PNG charts generated successfully\n');
        return true;
    } catch (error) {
        console.error('❌ Error generating PNG charts:', error.message);
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

    // Generate PNG charts first
    await generatePngCharts(outputDir, data, duration);

    let appendix = `# Per-Second Emotion Analysis Appendix\n\n`;
    appendix += `**Video:** ${path.basename(chunksData.video, path.extname(chunksData.video))}\n\n`;
    appendix += `**Generated:** ${new Date().toISOString()}\n\n`;
    appendix += `**Total Duration:** ${duration} seconds\n\n`;
    
    // Add subset warning if per-second data covers less than full video
    const analyzedSeconds = data.length;
    const isPartialPerSecond = analyzedSeconds < duration;
    
    if (isPartialPerSecond) {
        appendix += `⚠️ **Partial Analysis:** This appendix covers ${analyzedSeconds} seconds of ${duration}s total video.\n\n`;
        appendix += `> **Why is this incomplete?** The analysis was limited by MAX_CHUNKS settings or testing mode. `;
        appendix += `Only the first ${analyzedSeconds} seconds were analyzed to reduce token costs and processing time.\n\n`;
        appendix += `---\n\n`;
    }
    
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
    
    // Add explanatory text before correlations
    appendix += `### How to Read Correlations\n\n`;
    appendix += `Correlation measures how two emotions move together:\n\n`;
    appendix += `- **Negative correlation** (-1.0): When one goes UP, the other goes DOWN\n`;
    appendix += `  - Example: Patience ↔ Boredom should be negative (bored = impatient)\n\n`;
    appendix += `- **Positive correlation** (+1.0): Both move in same direction\n`;
    appendix += `  - Example: Patience ↔ Excitement should be positive (excited = patient)\n\n`;
    appendix += `- **Near zero** (0): No relationship - emotions are independent\n\n`;
    appendix += `**Strength guide**:\n`;
    appendix += `- ±0.7 to ±1.0 = Strong correlation\n`;
    appendix += `- ±0.3 to ±0.7 = Moderate correlation\n`;
    appendix += `- 0 to ±0.3 = Weak or no correlation\n\n`;
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

    // Generate correlation visualizations
    const visualizationsDir = path.join(REPO_ROOT, 'visualizations');
    if (!fs.existsSync(visualizationsDir)) {
        fs.mkdirSync(visualizationsDir, { recursive: true });
    }

    // Generate correlation matrix heatmap
    const matrixImagePath = path.join(visualizationsDir, 'correlation-matrix.png');
    generateCorrelationMatrix(pbCorr, peCorr, beCorr, matrixImagePath);

    // Generate scatter plots
    const pbScatterPath = path.join(visualizationsDir, 'patience-vs-boredom.png');
    const peScatterPath = path.join(visualizationsDir, 'patience-vs-excitement.png');
    const beScatterPath = path.join(visualizationsDir, 'boredom-vs-excitement.png');
    
    generateScatterPlot(data, 'boredom', 'patience', 'Patience vs Boredom', pbScatterPath, pbCorr);
    generateScatterPlot(data, 'excitement', 'patience', 'Patience vs Excitement', peScatterPath, peCorr);
    generateScatterPlot(data, 'excitement', 'boredom', 'Boredom vs Excitement', beScatterPath, beCorr);

    // Add visual reference to appendix
    appendix += `![Correlation Matrix](../visualizations/correlation-matrix.png)\n\n`;
    appendix += `**Scatter Plots**:\n`;
    appendix += `- ![Patience vs Boredom](../visualizations/patience-vs-boredom.png)\n`;
    appendix += `- ![Patience vs Excitement](../visualizations/patience-vs-excitement.png)\n`;
    appendix += `- ![Boredom vs Excitement](../visualizations/boredom-vs-excitement.png)\n\n`;

    appendix += `| Emotion Pair | Correlation | Interpretation |\n`;
    appendix += `|--------------|-------------|----------------|\n`;
    appendix += `| Patience ↔ Boredom | ${pbCorr.toFixed(2)} | ${pbCorr < -0.5 ? 'Strong negative (expected)' : pbCorr < 0 ? 'Weak negative' : 'Positive (unexpected)'} |\n`;
    appendix += `| Patience ↔ Excitement | ${peCorr.toFixed(2)} | ${peCorr > 0.5 ? 'Strong positive' : peCorr > 0 ? 'Weak positive' : 'No correlation'} |\n`;
    appendix += `| Boredom ↔ Excitement | ${beCorr.toFixed(2)} | ${beCorr < -0.5 ? 'Strong negative (expected)' : beCorr < 0 ? 'Weak negative' : 'No correlation'} |\n\n`;

    // Add interpretation guide after the table
    appendix += `### What These Correlations Mean\n\n`;
    
    // Interpret patience-boredom correlation
    const pbStrength = Math.abs(pbCorr) >= 0.7 ? 'Strong' : Math.abs(pbCorr) >= 0.3 ? 'Moderate' : 'Weak';
    const pbDirection = pbCorr < 0 ? 'negative' : 'positive';
    const pbExpected = pbCorr < -0.5 ? '✅ Expected' : pbCorr < 0 ? '⚠️ Weak but expected' : '❌ Unexpected';
    appendix += `- **Patience ↔ Boredom: ${pbCorr.toFixed(2)}** (${pbStrength} ${pbDirection}) ${pbExpected}\n`;
    if (pbCorr < 0) {
        appendix += `  - As boredom increases, patience crashes\n`;
        appendix += `  - Shows consistent persona scoring\n`;
    } else {
        appendix += `  - Unexpected: patience should decrease with boredom\n`;
    }
    appendix += `\n`;

    // Interpret patience-excitement correlation
    const peStrength = Math.abs(peCorr) >= 0.7 ? 'Strong' : Math.abs(peCorr) >= 0.3 ? 'Moderate' : 'Weak';
    const peDirection = peCorr < 0 ? 'negative' : 'positive';
    const peExpected = peCorr > 0.5 ? '✅ Expected' : peCorr > 0 ? '⚠️ Weak but expected' : '❌ Unexpected';
    appendix += `- **Patience ↔ Excitement: ${peCorr.toFixed(2)}** (${peStrength} ${peDirection}) ${peExpected}\n`;
    if (peCorr > 0) {
        appendix += `  - Excited moments make persona more patient\n`;
        appendix += `  - Content engagement drives tolerance\n`;
    } else {
        appendix += `  - Unexpected: excitement should increase patience\n`;
    }
    appendix += `\n`;

    // Interpret boredom-excitement correlation
    const beStrength = Math.abs(beCorr) >= 0.7 ? 'Strong' : Math.abs(beCorr) >= 0.3 ? 'Moderate' : 'Weak';
    const beDirection = beCorr < 0 ? 'negative' : 'positive';
    const beExpected = beCorr < -0.5 ? '✅ Expected' : beCorr < 0 ? '⚠️ Weak but expected' : '❌ Unexpected';
    appendix += `- **Boredom ↔ Excitement: ${beCorr.toFixed(2)}** (${beStrength} ${beDirection}) ${beExpected}\n`;
    if (beCorr < 0) {
        appendix += `  - High excitement = low boredom (opposite ends)\n`;
        appendix += `  - Shows clear emotional differentiation\n`;
    } else {
        appendix += `  - Unexpected: boredom and excitement should be opposites\n`;
    }
    appendix += `\n`;

    appendix += `### Key Insights\n\n`;

    const insights = [];

    // Add insight about correlation visuals
    insights.push(`📊 **Visual Analysis:** Correlation matrix and scatter plots generated in \`visualizations/\` folder - see charts above for intuitive understanding of emotion relationships.`);

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

/**
 * Generate correlation matrix heatmap
 */
function generateCorrelationMatrix(pbCorr, peCorr, beCorr, outputPath) {
    const width = 400;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const correlationData = {
        labels: ['Patience', 'Boredom', 'Excitement'],
        datasets: [{
            label: 'Correlation Matrix',
            data: [
                // Patience row
                { x: 0, y: 0, v: 1.00 },
                { x: 1, y: 0, v: pbCorr },
                { x: 2, y: 0, v: peCorr },
                // Boredom row
                { x: 0, y: 1, v: pbCorr },
                { x: 1, y: 1, v: 1.00 },
                { x: 2, y: 1, v: beCorr },
                // Excitement row
                { x: 0, y: 2, v: peCorr },
                { x: 1, y: 2, v: beCorr },
                { x: 2, y: 2, v: 1.00 }
            ],
            backgroundColor: (context) => {
                const value = context.raw?.v;
                if (value === undefined) return '#ffffff';
                if (value === 1.00) return '#e0e0e0'; // Diagonal
                if (value > 0.7) return '#2ecc71';     // Strong positive
                if (value > 0.3) return '#58d68d';     // Moderate positive
                if (value > 0) return '#f9e79f';       // Weak positive
                if (value > -0.3) return '#f9e79f';    // Weak negative
                if (value > -0.7) return '#e74c3c';    // Moderate negative
                return '#c0392b';                       // Strong negative
            }
        }]
    };

    const configuration = {
        type: 'matrix',
        data: correlationData,
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const labels = ['Patience', 'Boredom', 'Excitement'];
                            const xLabel = labels[context.raw?.x || 0];
                            const yLabel = labels[context.raw?.y || 0];
                            return `${xLabel} vs ${yLabel}: ${context.raw?.v?.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: -0.5,
                    max: 2.5,
                    ticks: {
                        stepSize: 1,
                        callback: (value) => ['Patience', 'Boredom', 'Excitement'][value]
                    },
                    title: { display: true, text: 'X Axis' }
                },
                y: {
                    type: 'linear',
                    min: -0.5,
                    max: 2.5,
                    ticks: {
                        stepSize: 1,
                        callback: (value) => ['Patience', 'Boredom', 'Excitement'][value]
                    },
                    title: { display: true, text: 'Y Axis' },
                    reverse: true
                }
            }
        },
        plugins: [{
            id: 'textAnnotation',
            afterDatasetDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                chart.data.datasets[0].data.forEach(point => {
                    const xScale = chart.scales.x;
                    const yScale = chart.scales.y;
                    const x = xScale.getPixelForValue(point.x);
                    const y = yScale.getPixelForValue(point.y);
                    
                    ctx.fillStyle = point.v === 1.00 ? '#333333' : '#ffffff';
                    ctx.fillText(point.v.toFixed(2), x, y);
                });
                
                ctx.restore();
            }
        }]
    };

    // Fallback: Create simple heatmap using canvas drawing
    const canvas = { width, height };
    const imageBuffer = createSimpleCorrelationMatrix(pbCorr, peCorr, beCorr, width, height);
    fs.writeFileSync(outputPath, imageBuffer);
}

/**
 * Create simple correlation matrix using raw canvas operations
 */
function createSimpleCorrelationMatrix(pbCorr, peCorr, beCorr, width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const labels = ['Patience', 'Boredom', 'Excitement'];
    const cellSize = Math.min(width, height) / 3;
    const padding = 60;
    const matrixSize = cellSize * 3;
    const offsetX = (width - matrixSize) / 2;
    const offsetY = (height - matrixSize) / 2;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.fillText('Emotion Correlation Matrix', width / 2, 30);

    // Draw cells
    const correlations = [
        [1.00, pbCorr, peCorr],
        [pbCorr, 1.00, beCorr],
        [peCorr, beCorr, 1.00]
    ];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const x = offsetX + col * cellSize;
            const y = offsetY + row * cellSize;
            const value = correlations[row][col];

            // Cell background color
            if (value === 1.00) {
                ctx.fillStyle = '#e0e0e0';
            } else if (value > 0.7) {
                ctx.fillStyle = '#2ecc71';
            } else if (value > 0.3) {
                ctx.fillStyle = '#58d68d';
            } else if (value > 0) {
                ctx.fillStyle = '#f9e79f';
            } else if (value > -0.3) {
                ctx.fillStyle = '#f9e79f';
            } else if (value > -0.7) {
                ctx.fillStyle = '#e74c3c';
            } else {
                ctx.fillStyle = '#c0392b';
            }

            ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

            // Text value
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = value === 1.00 ? '#333333' : '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value.toFixed(2), x + cellSize / 2, y + cellSize / 2);
        }
    }

    // Axis labels
    ctx.font = '14px Arial';
    ctx.fillStyle = '#2c3e50';
    
    // X-axis labels
    labels.forEach((label, i) => {
        ctx.save();
        ctx.translate(offsetX + i * cellSize + cellSize / 2, offsetY + matrixSize + 20);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });

    // Y-axis labels
    labels.forEach((label, i) => {
        ctx.textAlign = 'right';
        ctx.fillText(label, offsetX - 10, offsetY + i * cellSize + cellSize / 2);
    });

    // Legend
    const legendX = width - 120;
    const legendY = 60;
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Legend:', legendX, legendY);
    
    const legendItems = [
        { color: '#c0392b', label: 'Strong -' },
        { color: '#e74c3c', label: 'Moderate -' },
        { color: '#f9e79f', label: 'Weak' },
        { color: '#58d68d', label: 'Moderate +' },
        { color: '#2ecc71', label: 'Strong +' }
    ];

    legendItems.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY + 15 + i * 20, 15, 15);
        ctx.fillStyle = '#333333';
        ctx.fillText(item.label, legendX + 20, legendY + 27 + i * 20);
    });

    return canvas.toBuffer('image/png');
}

/**
 * Generate scatter plot for two emotions
 */
function generateScatterPlot(data, xKey, yKey, title, outputPath, correlation) {
    const width = 400;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const padding = 50;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 25);

    // Add correlation value
    ctx.font = '12px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText(`r = ${correlation.toFixed(2)}`, width / 2, 42);

    // Find min/max for scaling
    const xValues = data.map(d => d[xKey]);
    const yValues = data.map(d => d[yKey]);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Draw axes
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Axis labels
    ctx.font = '12px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.fillText(xKey.charAt(0).toUpperCase() + xKey.slice(1), width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yKey.charAt(0).toUpperCase() + yKey.slice(1), 0, 0);
    ctx.restore();

    // Draw grid lines
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * plotWidth;
        const y = padding + (i / 5) * plotHeight;
        
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        // Axis ticks
        ctx.fillStyle = '#7f8c8d';
        ctx.textAlign = 'center';
        ctx.fillText((xMin + (i / 5) * (xMax - xMin)).toFixed(0), x, height - padding + 15);
        ctx.textAlign = 'right';
        ctx.fillText((yMin + (i / 5) * (yMax - yMin)).toFixed(0), padding - 5, y + 4);
    }

    // Calculate trend line
    const xAvg = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const yAvg = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < data.length; i++) {
        numerator += (xValues[i] - xAvg) * (yValues[i] - yAvg);
        denominator += Math.pow(xValues[i] - xAvg, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yAvg - slope * xAvg;

    // Draw trend line
    const x1 = 0;
    const y1 = slope * x1 + intercept;
    const x2 = 10;
    const y2 = slope * x2 + intercept;

    const screenX1 = padding + (x1 - xMin) / (xMax - xMin) * plotWidth;
    const screenY1 = height - padding - (y1 - yMin) / (yMax - yMin) * plotHeight;
    const screenX2 = padding + (x2 - xMin) / (xMax - xMin) * plotWidth;
    const screenY2 = height - padding - (y2 - yMin) / (yMax - yMin) * plotHeight;

    ctx.strokeStyle = correlation > 0 ? '#27ae60' : '#c0392b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX1, screenY1);
    ctx.lineTo(screenX2, screenY2);
    ctx.stroke();

    // Draw data points
    data.forEach((point, i) => {
        const x = padding + (point[xKey] - xMin) / (xMax - xMin) * plotWidth;
        const y = height - padding - (point[yKey] - yMin) / (yMax - yMin) * plotHeight;

        ctx.fillStyle = correlation > 0 ? 'rgba(39, 174, 96, 0.6)' : 'rgba(192, 57, 43, 0.6)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Border
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, plotWidth, plotHeight);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
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
