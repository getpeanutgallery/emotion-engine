#!/usr/bin/env node
/**
 * Final Report Generator
 * Merges all pipeline outputs into comprehensive report
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.argv[2] || './analysis-output';
const REPORT_PATH = path.join(OUTPUT_DIR, 'FINAL-REPORT.md');

const requiredFiles = ['01-dialogue-analysis.md', '02-music-analysis.md', '03-chunked-analysis.json'];
for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(OUTPUT_DIR, file))) {
        console.error(`❌ Missing: ${file}`);
        console.error('   Run: node scripts/run-pipeline.cjs');
        process.exit(1);
    }
}

console.log('📚 Loading data...\n');

const dialogueMd = fs.readFileSync(path.join(OUTPUT_DIR, '01-dialogue-analysis.md'), 'utf8');
const musicMd = fs.readFileSync(path.join(OUTPUT_DIR, '02-music-analysis.md'), 'utf8');
const chunksData = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, '03-chunked-analysis.json'), 'utf8'));

console.log(`   ✓ ${chunksData.chunks?.length || 0} chunks loaded\n`);
console.log('📝 Generating report...\n');

let report = `# Emotion Analysis Report\n# ${path.basename(chunksData.video, path.extname(chunksData.video))}\n\n`;
report += `**Generated:** ${new Date().toISOString()}\n`;
report += `**Persona:** ${chunksData.persona.name}\n`;
report += `**Duration:** ${chunksData.duration}s  \n`;
report += `**Tokens:** ${chunksData.totalTokens.toLocaleString()}\n\n`;

// Executive Summary
report += `## 📊 Executive Summary\n\n`;

const avgRating = (field) => {
    const matches = chunksData.chunks.map(c => c.analysis.match(new RegExp(field + '["\']?\\s*[:\\-]?\\s*(\\d+)', 'i')));
    const values = matches.filter(m => m).map(m => parseInt(m[1]));
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '-';
};

const avgPatience = avgRating('patience');
const avgBoredom = avgRating('boredom');
const avgExcitement = avgRating('excitement');

report += `| Metric | Score |\n`;
report += `|--------|-------|\n`;
report += `| Patience | ${avgPatience}/10 |\n`;
report += `| Boredom | ${avgBoredom}/10 |\n`;
report += `| Excitement | ${avgExcitement}/10 |\n\n`;

// Timeline
report += `## 📈 Emotional Journey\n\n`;
report += `| Time | P | B | E | Summary |\n`;
report += `|------|---|---|---|---------|\n`;

chunksData.chunks.forEach(c => {
    const p = c.analysis.match(/patience["\']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    const b = c.analysis.match(/boredom["\']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    const e = c.analysis.match(/excitement["\']?\s*[:\-]?\s*(\d+)/i)?.[1] || '-';
    const summary = c.summary?.substring(0, 30) + '...' || '...';
    report += `| ${c.startTime}s | ${p} | ${b} | ${e} | ${summary} |\n`;
});

report += `\n`;

// Append raw analysis
report += `## 📝 Full Analysis\n\n`;
report += `### Dialogue\n\n${dialogueMd}\n\n`;
report += `### Music\n\n${musicMd}\n\n`;

report += `### Video Chunks\n\n\`\`\`json\n${JSON.stringify(chunksData, null, 2)}\n\`\`\`\n\n`;

fs.writeFileSync(REPORT_PATH, report);

console.log('✅ Report generated!');
console.log(`   ${REPORT_PATH}`);
console.log(`   ${(fs.statSync(REPORT_PATH).size / 1024).toFixed(1)} KB\n`);
