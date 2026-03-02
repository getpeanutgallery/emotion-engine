#!/usr/bin/env node
/**
 * Final Report Generator
 * Merges all pipeline outputs into comprehensive emotion analysis report
 * 
 * Usage: node scripts/generate-report.cjs [analysis-output-dir]
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.argv[2] || './analysis-output';
const REPORT_PATH = path.join(OUTPUT_DIR, 'FINAL-REPORT.md');

// Verify all inputs exist
const requiredFiles = [
    '01-dialogue-analysis.md',
    '02-music-analysis.md',
    '03-chunked-analysis.json'
];

for (const file of requiredFiles) {
    const filePath = path.join(OUTPUT_DIR, file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing required file: ${file}`);
        console.error(`   Run pipeline first: node scripts/run-pipeline.cjs`);
        process.exit(1);
    }
}

// Load all data
console.log('📚 Loading analysis data...\n');

// Dialogue data
const dialogueMd = fs.readFileSync(path.join(OUTPUT_DIR, '01-dialogue-analysis.md'), 'utf8');
const dialogueMatch = dialogueMd.match(/```json\s*\n([\s\S]*?)\n```/);
const dialogueData = dialogueMatch ? JSON.parse(dialogueMatch[1]) : null;

// Music data  
const musicMd = fs.readFileSync(path.join(OUTPUT_DIR, '02-music-analysis.md'), 'utf8');
const musicMatch = musicMd.match(/```json\s*\n([\s\S]*?)\n```/);
const musicData = musicMatch ? JSON.parse(musicMatch[1]) : null;

// Chunked video data
const chunksJson = fs.readFileSync(path.join(OUTPUT_DIR, '03-chunked-analysis.json'), 'utf8');
const chunksData = JSON.parse(chunksJson);

console.log(`   ✓ Dialogue segments: ${dialogueData?.dialogue_segments?.length || 0}`);
console.log(`   ✓ Music segments: ${musicData?.audio_segments?.length || 0}`);
console.log(`   ✓ Video chunks: ${chunksData?.chunks?.length || 0}\n`);

// Build comprehensive report
console.log('📝 Generating final report...\n');

let report = `# Emotion Analysis Report
`;
report += `# ${path.basename(chunksData.video, path.extname(chunksData.video))}\n\n`;
report += `**Generated:** ${new Date().toISOString()}\n\n`;
report += `**Persona:** ${chunksData.persona.name} — ${chunksData.persona.description}\n\n`;
report += `**Total Duration:** ${chunksData.duration}s  \n`;
report += `**Total Tokens Used:** ${chunksData.totalTokens.toLocaleString()}\n\n`;

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
        const scroll = p.chunk.analysis.match(/scroll["']?\s*[:\-]?\s*["']?([^"]+)/i);
        if (scroll) {
            report += `> Scroll intent: "${scroll[1].substring(0, 100)}${scroll[1].length > 100 ? '...' : ''}"\n\n`;
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
    const note = c.summary ? c.summary.substring(0, 40) + '...' : '...';
    report += `| ${c.startTime}s-${c.endTime}s | ${p} | ${b} | ${e} | ${note} |\n`;
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
report += `<details>\n<summary>Click to expand full JSON data</summary>\n\n`;
report += `### Dialogue Analysis\n\n`;
report += '```json\n';
report += JSON.stringify(dialogueData, null, 2);
report += '\n```\n\n';
report += `### Music Analysis\n\n`;
report += '```json\n';
report += JSON.stringify(musicData, null, 2);
report += '\n```\n\n';
report += `### Video Chunks\n\n`;
report += '```json\n';
report += JSON.stringify(chunksData, null, 2);
report += '\n```\n\n';
report += `</details>\n\n`;

// Footer
report += `---\n\n`;
report += `*Generated by OpenTruth Emotion Engine*  \n`;
report += `*Models: openai/gpt-audio (dialogue, music), qwen/qwen3.5-122b-a10b (video)*\n`;

// Save report
fs.writeFileSync(REPORT_PATH, report);

console.log('✅ Report generated!');
console.log(`\n   Location: ${REPORT_PATH}`);
console.log(`   Size: ${(fs.statSync(REPORT_PATH).size / 1024).toFixed(1)} KB`);
console.log(`\n🎉 Analysis complete! Open ${REPORT_PATH} to view results.\n`);
